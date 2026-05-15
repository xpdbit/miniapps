/**
 * SyncService — 云端同步核心
 *
 * 职责：
 * 1. 增速校验（防客户端修改数值）
 * 2. 离线收益服务端计算
 * 3. 存档冲突合并（服务端权威）
 */

import { Prisma } from '@prisma/client';
import { NotFoundError } from '../utils/errors';
import { computeChecksum } from './save.service';
import { prisma } from './db';

// ============================================================
// 增速校验配置（保守宽松，避免误伤）
// ============================================================

const GROWTH_LIMITS = {
  /** 经验/秒（正常约 0.1，战斗时 ~5，给 10x 余量） */
  expPerSecond: 50,
  /** 金币/秒（正常 ~0.5，战斗/事件 ~20，给 25x 余量） */
  goldPerSecond: 500,
  /** 里程/秒（正常 ~0.5，给 30x 余量） */
  mileagePerSecond: 50,
  /** 每次同步允许的最大等级跳跃 */
  maxLevelJump: 20,
  /** 两次同步之间的最小间隔（秒），防刷 */
  minSyncInterval: 3,
} as const;

// ============================================================
// 离线收益配置（与客户端 GameSyncManager 保持一致）
// ============================================================

const OFFLINE_REWARDS = {
  goldPerSecond: 0.5,
  expPerSecond: 0.1,
  mileagePerSecond: 0.05,
  maxOfflineSeconds: 8 * 3600, // 8 小时
} as const;

/**
 * 时间衰减系数
 *   < 1 小时 → 1.0x
 *   1～6 小时 → 0.8x
 *   6～24 小时 → 0.5x
 *   > 24 小时 → 0.2x
 */
function getTimeDecay(seconds: number): number {
  const hours = seconds / 3600;
  if (hours < 1) return 1.0;
  if (hours < 6) return 0.8;
  if (hours < 24) return 0.5;
  return 0.2;
}

// ============================================================
// 类型定义
// ============================================================

export interface SyncValidationResult {
  valid: boolean;
  /** 服务端纠偏后的值 */
  correctedStats: {
    level: number;
    exp: number;
    gold: number;
    gems: number;
    totalMileage: number;
    playTime: number;
    prestigeCount: number;
  };
  corrections: string[];
}

export interface OfflineReward {
  gold: number;
  exp: number;
  mileage: number;
  combatClears: number;
  elapsedSeconds: number;
  decayMultiplier: number;
}

export interface ReconcileResult {
  /** 服务端权威数据 */
  player: {
    id: number;
    level: number;
    exp: number;
    gold: number;
    gems: number;
    totalMileage: number;
    playTime: number;
    prestigeCount: number;
  };
  /** 离线期间应得的收益 */
  offlineRewards: OfflineReward | null;
  /** 服务端时间戳（毫秒） */
  serverTime: number;
}

export interface SaveMergeResult {
  /** 是否使用服务端数据（而不是客户端） */
  useServer: boolean;
  /** 合并后的保存数据 */
  mergedData: Record<string, unknown>;
  /** 新版本号 */
  version: number;
}

// ============================================================
// 1. 增速校验
// ============================================================

/**
 * 校验并纠偏同步数据
 * 核心原则：服务端是权威，超过合理增速的值被静默纠正
 */
export async function validateSyncGrowth(
  playerId: number,
  clientStats: {
    level: number;
    exp: number;
    gold: number;
    gems: number;
    totalMileage: number;
    playTime: number;
    prestigeCount: number;
  },
): Promise<SyncValidationResult> {
  const dbPlayer = await prisma.game1Player.findUnique({ where: { id: playerId } });
  if (!dbPlayer) throw new NotFoundError('玩家不存在');

  const corrections: string[] = [];
  let { level, exp, gold, gems, totalMileage, playTime, prestigeCount } = clientStats;

  // 计算时间窗口（秒），强制执行最小同步间隔
  const lastUpdate = dbPlayer.lastSyncAt ?? dbPlayer.updatedAt;
  const rawElapsed = (Date.now() - lastUpdate.getTime()) / 1000;
  const elapsedSeconds = Math.max(GROWTH_LIMITS.minSyncInterval, rawElapsed);

  // ---------- 等级 ----------
  const levelDiff = level - dbPlayer.level;
  if (levelDiff > GROWTH_LIMITS.maxLevelJump) {
    level = dbPlayer.level + GROWTH_LIMITS.maxLevelJump;
    corrections.push(`等级增长超限: ${levelDiff} → ${GROWTH_LIMITS.maxLevelJump}`);
  }
  // 等级不能倒退（除非轮回——会在客户端重置为 1）
  if (level < 1) {
    level = 1;
    corrections.push('等级不能低于 1');
  }

  // ---------- 金币（可消耗，只限制增速上限，不拦截回退） ----------
  const goldGained = gold - dbPlayer.gold;
  const maxGoldGrowth = elapsedSeconds * GROWTH_LIMITS.goldPerSecond;
  if (goldGained > maxGoldGrowth) {
    gold = Math.floor(dbPlayer.gold + maxGoldGrowth);
    corrections.push(`金币增长超限: +${goldGained} > 允许 +${Math.floor(maxGoldGrowth)}`);
  }
  // 金币可消耗（购买、升级等），不回退拦截

  // ---------- 钻石（可消耗，同金币） ----------
  if (gems > dbPlayer.gems) {
    const gemsGained = gems - dbPlayer.gems;
    if (gemsGained > elapsedSeconds * 10) {
      gems = dbPlayer.gems + Math.floor(elapsedSeconds * 10);
      corrections.push(`钻石增长超限: +${gemsGained}`);
    }
  }
  // 钻石可消耗，不回退拦截

  // ---------- 经验 ----------
  const expGained = exp - dbPlayer.exp;
  const maxExpGrowth = elapsedSeconds * GROWTH_LIMITS.expPerSecond;
  if (expGained > maxExpGrowth) {
    exp = Math.floor(dbPlayer.exp + maxExpGrowth);
    corrections.push(`经验增长超限: +${expGained} > 允许 +${Math.floor(maxExpGrowth)}`);
  }
  // 经验不能倒退
  if (exp < dbPlayer.exp && level >= dbPlayer.level) {
    exp = dbPlayer.exp;
    corrections.push('经验不允许回退');
  }

  // ---------- 里程 ----------
  const mileageGained = totalMileage - dbPlayer.totalMileage;
  const maxMileageGrowth = elapsedSeconds * GROWTH_LIMITS.mileagePerSecond;
  if (mileageGained > maxMileageGrowth) {
    totalMileage = Math.floor((dbPlayer.totalMileage + maxMileageGrowth) * 100) / 100;
    corrections.push(`里程增长超限: +${mileageGained.toFixed(1)} > 允许 +${maxMileageGrowth.toFixed(1)}`);
  }
  // 里程不能倒退
  if (totalMileage < dbPlayer.totalMileage) {
    totalMileage = dbPlayer.totalMileage;
    corrections.push('里程不允许回退');
  }

  // ---------- 游玩时间 ----------
  // playTime 应由服务端根据 createdAt 计算，不应信任客户端
  playTime = Math.floor((Date.now() - dbPlayer.createdAt.getTime()) / 1000);

  // ---------- 轮回次数 ----------
  const prestigeDiff = prestigeCount - dbPlayer.prestigeCount;
  if (prestigeDiff < 0) {
    prestigeCount = dbPlayer.prestigeCount;
    corrections.push('轮回次数不允许回退');
  }
  if (prestigeDiff > 1) {
    // 每次轮回需要等级≥100，不可能短时间内多次轮回
    prestigeCount = dbPlayer.prestigeCount + 1;
    corrections.push('单次同步最多 1 次轮回');
  }

  return {
    valid: corrections.length === 0,
    correctedStats: { level, exp, gold, gems, totalMileage, playTime, prestigeCount },
    corrections,
  };
}

// ============================================================
// 2. 离线收益计算
// ============================================================

/**
 * 计算离线收益（服务端版本）
 * 客户端无法伪造时间戳，因为 elapsed 基于服务端记录的上次同步时间
 */
export function calculateOfflineRewards(elapsedSeconds: number): OfflineReward {
  const clamped = Math.min(elapsedSeconds, OFFLINE_REWARDS.maxOfflineSeconds);
  const decay = getTimeDecay(clamped);

  return {
    gold: OFFLINE_REWARDS.goldPerSecond * clamped * decay,
    exp: OFFLINE_REWARDS.expPerSecond * clamped * decay,
    mileage: OFFLINE_REWARDS.mileagePerSecond * clamped * decay,
    combatClears: Math.floor(clamped / 60),
    elapsedSeconds: clamped,
    decayMultiplier: decay,
  };
}

// ============================================================
// 3. 登录调协（Reconcile）
// ============================================================

/**
 * 登录时调协：计算离线收益 + 写入数据库 + 返回权威数据
 */
export async function reconcilePlayer(playerId: number): Promise<ReconcileResult> {
  const player = await prisma.game1Player.findUnique({ where: { id: playerId } });
  if (!player) throw new NotFoundError('玩家不存在');

  const now = Date.now();
  const lastUpdate = player.lastSyncAt ?? player.updatedAt;
  const elapsedSeconds = (now - lastUpdate.getTime()) / 1000;

  let offlineRewards: OfflineReward | null = null;

  // 离线超过 5 秒才计算收益
  if (elapsedSeconds > 5) {
    const rewards = calculateOfflineRewards(elapsedSeconds);

    // 写入数据库（使用事务保证原子性）
    await prisma.$transaction([
      prisma.game1Player.update({
        where: { id: playerId },
        data: {
          exp: { increment: Math.floor(rewards.exp) },
          gold: { increment: Math.floor(rewards.gold) },
          totalMileage: { increment: Math.floor(rewards.mileage) },
          lastSyncAt: new Date(),
        },
      }),
    ]);

    offlineRewards = rewards;
  } else {
    // 更新同步时间戳
    await prisma.game1Player.update({
      where: { id: playerId },
      data: { lastSyncAt: new Date() },
    });
  }

  // 返回权威数据
  const fresh = await prisma.game1Player.findUnique({ where: { id: playerId } });
  if (!fresh) throw new NotFoundError('玩家不存在');

  return {
    player: {
      id: fresh.id,
      level: fresh.level,
      exp: fresh.exp,
      gold: fresh.gold,
      gems: fresh.gems,
      totalMileage: fresh.totalMileage,
      playTime: Math.floor((Date.now() - fresh.createdAt.getTime()) / 1000),
      prestigeCount: fresh.prestigeCount,
    },
    offlineRewards,
    serverTime: Date.now(),
  };
}

// ============================================================
// 4. 存档冲突合并
// ============================================================

/**
 * 存档冲突合并策略
 * - 服务端版本 > 客户端版本 → 使用服务端（客户端数据过期）
 * - 客户端版本 > 服务端版本 → 使用客户端（服务端从未见过此数据）
 * - 同版本：按最后写入时间，取较新的
 */
export async function mergeSaveData(
  playerId: number,
  clientSave: Record<string, unknown>,
  clientVersion: number,
): Promise<SaveMergeResult> {
  const serverSave = await prisma.game1CloudSave.findUnique({ where: { playerId } });

  if (!serverSave) {
    // 服务端无存档 → 直接使用客户端数据
    const checksum = computeChecksum(clientSave);
    await prisma.game1CloudSave.create({
      data: {
        playerId,
        saveData: clientSave as Prisma.InputJsonValue,
        checksum,
        version: 1,
      },
    });
    return { useServer: false, mergedData: clientSave, version: 1 };
  }

  const serverVersion = serverSave.version ?? 1;

  // 客户端版本落后 → 使用服务端存档，不覆盖
  if (clientVersion < serverVersion) {
    return {
      useServer: true,
      mergedData: serverSave.saveData as Record<string, unknown>,
      version: serverVersion,
    };
  }

  // 客户端版本超前（离线期间产生的）→ 上传客户端存档
  if (clientVersion > serverVersion) {
    const checksum = computeChecksum(clientSave);
    await prisma.game1CloudSave.update({
      where: { playerId },
      data: {
        saveData: clientSave as Prisma.InputJsonValue,
        checksum,
        version: { increment: 1 },
      },
    });
    return { useServer: false, mergedData: clientSave, version: serverVersion + 1 };
  }

  // 同版本：按最后写入时间决定
  const clientTimestamp = (clientSave.lastSaveAt as number) ?? 0;
  const serverTimestamp = serverSave.updatedAt.getTime();

  if (clientTimestamp > serverTimestamp) {
    // 客户端更新 → 上传
    const checksum = computeChecksum(clientSave);
    await prisma.game1CloudSave.update({
      where: { playerId },
      data: {
        saveData: clientSave as Prisma.InputJsonValue,
        checksum,
        version: { increment: 1 },
      },
    });
    return { useServer: false, mergedData: clientSave, version: serverVersion + 1 };
  }

  // 服务端更新 → 下发
  return {
    useServer: true,
    mergedData: serverSave.saveData as Record<string, unknown>,
    version: serverVersion,
  };
}
