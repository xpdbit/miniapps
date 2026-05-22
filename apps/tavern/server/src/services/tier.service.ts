import prisma from '../utils/prisma'
import type { UserTierType } from '@prisma/client'

/* ========================================================================
 *  默认权限模板
 *  ======================================================================== */

const DEFAULT_PERMISSIONS: Record<UserTierType, object> = {
  FREE: {
    canUseCustomKey: false,
    canPublishCards: true,
    canExport: false,
    modelTier: 'free',
    prioritySupport: false,
    betaFeatures: false,
    maxTokenPerCall: 4096,
    maxContextLength: 8000,
  },
  PAID: {
    canUseCustomKey: true,
    canPublishCards: true,
    canExport: false,
    modelTier: 'paid',
    prioritySupport: false,
    betaFeatures: false,
    maxTokenPerCall: 16384,
    maxContextLength: 32000,
  },
  TESTER: {
    canUseCustomKey: true,
    canPublishCards: true,
    canExport: true,
    modelTier: 'all',
    prioritySupport: true,
    betaFeatures: true,
    maxTokenPerCall: 32768,
    maxContextLength: 128000,
  },
}

const DEFAULT_QUOTAS: Record<UserTierType, { dailyQuota: number; sessions: number; characters: number; personas: number }> = {
  FREE:    { dailyQuota: 20,  sessions: 5,  characters: 3,  personas: 2 },
  PAID:    { dailyQuota: 50,  sessions: 10, characters: 10, personas: 5 },
  TESTER:  { dailyQuota: 99999, sessions: 99, characters: 99, personas: 99 },
}

/* ========================================================================
 *  创建 / 获取 UserTier
 *  ======================================================================== */

export interface UserTierInfo {
  tier: UserTierType
  level: number
  maxDailyQuota: number
  maxSessions: number
  maxCharacters: number
  maxPersonas: number
  permissions: Record<string, unknown>
}

/**
 * 获取用户的等级信息。不存在则自动创建（默认 FREE Lv.1�? */
export async function getUserTier(userUuid: string): Promise<UserTierInfo> {
  let tier = await prisma.tavernUserTier.findUnique({ where: { userUuid: userUuid } })
  if (!tier) {
    return createDefaultTier(userUuid, 'FREE')
  }
  return {
    tier: tier.tier,
    level: tier.level,
    maxDailyQuota: tier.dailyQuotaMax,
    maxSessions: tier.maxSessions,
    maxCharacters: tier.maxCharacters,
    maxPersonas: tier.maxPersonas,
    permissions: tier.permissions as Record<string, unknown>,
  }
}

/**
 * 创建默认 UserTier
 */
export async function createDefaultTier(userUuid: string, tierType: UserTierType = 'FREE'): Promise<UserTierInfo> {
  const quotas = DEFAULT_QUOTAS[tierType]
  const permissions = DEFAULT_PERMISSIONS[tierType]
  const tier = await prisma.tavernUserTier.create({
    data: {
      userUuid: userUuid,
      tier: tierType,
      level: 1,
      dailyQuotaMax: quotas.dailyQuota,
      maxSessions: quotas.sessions,
      maxCharacters: quotas.characters,
      maxPersonas: quotas.personas,
      permissions,
    },
  })
  return {
    tier: tier.tier,
    level: tier.level,
    maxDailyQuota: tier.dailyQuotaMax,
    maxSessions: tier.maxSessions,
    maxCharacters: tier.maxCharacters,
    maxPersonas: tier.maxPersonas,
    permissions: tier.permissions as Record<string, unknown>,
  }
}

/**
 * 确保用户存在 UserTier（登录时调用�? * 如已存在则保持原值不变，不存在才创建 FREE 默认
 */
export async function ensureUserTier(userUuid: string): Promise<void> {
  const existing = await prisma.tavernUserTier.findUnique({ where: { userUuid: userUuid } })
  if (!existing) {
    await createDefaultTier(userUuid, 'FREE')
  }
}

/* ========================================================================
 *  模型访问控制
 *  ======================================================================== */

/** tierType 优先级：TESTER(3) > PAID(2) > FREE(1)  */
const TIER_PRIORITY: Record<UserTierType, number> = { FREE: 1, PAID: 2, TESTER: 3 }

export interface AvailableModel {
  modelId: string
  displayName: string
  provider: string
  description: string | null
  icon: string | null
  quotaCost: number
  minTier: UserTierType
  free: boolean
}

/**
 * 获取用户可用的模型列表（�?sortOrder 排序�? */
export async function getAvailableModels(userUuid: string): Promise<AvailableModel[]> {
  const tierInfo = await getUserTier(userUuid)
  const userPriority = TIER_PRIORITY[tierInfo.tier]

  const allModels = await prisma.tavernModelMeta.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })

  return allModels
    .filter(m => {
      // 等级检�?      if (tierInfo.level < m.minLevel) return false
      // 类型检查：用户 tier 优先�?>= 模型�?minTier 优先�?      return userPriority >= TIER_PRIORITY[m.minTier]
    })
    .map(m => ({
      modelId: m.modelId,
      displayName: m.displayName,
      provider: m.provider,
      description: m.description,
      icon: m.icon,
      quotaCost: m.quotaCost,
      minTier: m.minTier,
      free: m.minTier === 'FREE',
    }))
}

/**
 * 检查用户是否有权使用指定模�? * @returns { allowed: boolean, quotaCost: number }
 */
export async function checkModelAccess(
  userUuid: string,
  modelId: string,
): Promise<{ allowed: boolean; reason?: string; quotaCost?: number }> {
  const model = await prisma.tavernModelMeta.findUnique({ where: { modelId } })
  if (!model || !model.isActive) {
    return { allowed: false, reason: 'MODEL_NOT_FOUND' }
  }

  const tierInfo = await getUserTier(userUuid)
  const userPriority = TIER_PRIORITY[tierInfo.tier]

  if (tierInfo.level < model.minLevel) {
    return { allowed: false, reason: 'LEVEL_INSUFFICIENT' }
  }

  if (userPriority < TIER_PRIORITY[model.minTier]) {
    return { allowed: false, reason: 'TIER_INSUFFICIENT' }
  }

  return { allowed: true, quotaCost: model.quotaCost }
}

/* ========================================================================
 *  配额同步
 *  ======================================================================== */

/**
 * �?UserTier.maxDailyQuota 同步�?SharedUser.dailyQuota
 */
/**
 * ���ͬ��?(�ѷ��� - quota ���ڴ洢�� TavernUserTier.dailyQuotaUsed)
 */
export async function syncQuota(_userUuid: string): Promise<void> {
  // No-op: quota counters stored directly in TavernUserTier (dailyQuotaUsed/dailyQuotaMax)
}

