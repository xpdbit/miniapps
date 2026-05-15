/**
 * 主题服务 - CRUD、状态切换、模板管理、使用统计
 *
 * 注意：
 * - config_json 只接受合法的 JSON 对象（旧版兼容）
 * - template_markup 为新的 HTML-like 模板内容
 * - css_classes 存储引用的 classId 数组
 * - 删除主题需先确认无 food_record 引用该 themeId
 */
import prisma from '../lib/prisma';
import type { Prisma } from '@prisma/client';
import type { ThemeConfig } from '../types/theme';

// ============================================================
// 类型定义
// ============================================================

/** 创建主题输入参数 */
export interface CreateThemeInput {
  name: string;
  description?: string;
  shortName?: string;
  projectId?: string;
  gameName: string;
  configJson?: ThemeConfig;
  templateMarkup?: string;
  cssClasses?: string[];
  previewImageUrl?: string;
  isActive?: boolean;
  sortOrder?: number;
}

/** 更新主题输入参数（全部可选） */
export interface UpdateThemeInput {
  name?: string;
  description?: string;
  shortName?: string;
  projectId?: string;
  gameName?: string;
  configJson?: ThemeConfig;
  templateMarkup?: string;
  cssClasses?: string[];
  previewImageUrl?: string;
  isActive?: boolean;
  sortOrder?: number;
}

/** 主题列表输出项 */
export interface ThemeListItem {
  id: number;
  themeId: string;
  projectId: string;
  name: string;
  description: string | null;
  shortName: string | null;
  gameName: string;
  previewImageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  usageCount: number;
  createdAt: Date;
}

/** 主题详情输出（含所有字段） */
export interface ThemeDetail extends ThemeListItem {
  configJson: ThemeConfig | null;
  templateMarkup: string | null;
  cssClasses: string[];
  updatedAt: Date;
}

/** 使用统计输出 */
export interface UsageStats {
  totalUsage: number;
  uniqueUsers: number;
  recentUsage: { date: string; count: number }[];
}

/** 项目使用排行 */
export interface ProjectUsageRanking {
  themeId: string;
  name: string;
  usageCount: number;
}

// ============================================================
// 校验辅助
// ============================================================

/** 检查值是否包含 base64 图片特征 */
function containsBase64Image(value: unknown): boolean {
  if (typeof value === 'string') {
    return /^data:image\//i.test(value);
  }
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(containsBase64Image);
  }
  return false;
}

/**
 * 校验主题配置合法性
 * - 必须是对象类型（Prisma Json 存储）
 * - 不得包含 base64 图片数据
 * - 不得包含非 JSON 可序列化数据
 */
function validateConfigJson(config: unknown): config is ThemeConfig {
  if (config === null || config === undefined || typeof config !== 'object') {
    throw new Error('configJson 必须是合法的对象');
  }

  if (containsBase64Image(config)) {
    throw new Error('configJson 禁止存储 base64 图片数据');
  }

  try {
    JSON.parse(JSON.stringify(config));
  } catch {
    throw new Error('configJson 包含不可序列化的数据');
  }

  return true;
}

/** 校验 shortName 格式（仅字母数字横线） */
function validateShortName(shortName: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,49}$/.test(shortName);
}

// ============================================================
// 私有映射函数
// ============================================================

/** Theme 数据库记录 → ThemeDetail */
function toThemeDetail(theme: Prisma.ThemeGetPayload<Prisma.ThemeDefaultArgs>): ThemeDetail {
  const cssClasses = Array.isArray(theme.cssClasses)
    ? (theme.cssClasses as unknown as string[])
    : [];

  return {
    id: theme.id,
    themeId: theme.themeId,
    projectId: theme.projectId,
    name: theme.name,
    description: theme.description,
    shortName: theme.shortName,
    gameName: theme.gameName,
    configJson: theme.configJson as unknown as ThemeConfig | null,
    templateMarkup: theme.templateMarkup,
    cssClasses,
    previewImageUrl: theme.previewImageUrl,
    isActive: theme.isActive,
    sortOrder: theme.sortOrder,
    usageCount: theme.usageCount,
    createdAt: theme.createdAt,
    updatedAt: theme.updatedAt,
  };
}

/** Theme 数据库记录 → ThemeListItem */
function toThemeListItem(theme: Prisma.ThemeGetPayload<Prisma.ThemeDefaultArgs>): ThemeListItem {
  return {
    id: theme.id,
    themeId: theme.themeId,
    projectId: theme.projectId,
    name: theme.name,
    description: theme.description,
    shortName: theme.shortName,
    gameName: theme.gameName,
    previewImageUrl: theme.previewImageUrl,
    isActive: theme.isActive,
    sortOrder: theme.sortOrder,
    usageCount: theme.usageCount,
    createdAt: theme.createdAt,
  };
}

// ============================================================
// CRUD 方法
// ============================================================

/**
 * 获取主题列表
 * @param isActive 可选，过滤启用/禁用状态
 * @param projectId 可选，过滤项目
 */
export async function getAll(isActive?: boolean, projectId?: string): Promise<ThemeListItem[]> {
  const where: Prisma.ThemeWhereInput = {};
  if (isActive !== undefined) {
    where.isActive = isActive;
  }
  if (projectId !== undefined) {
    where.projectId = projectId;
  }

  const themes = await prisma.theme.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });

  return themes.map(toThemeListItem);
}

/**
 * 根据 themeId 获取主题详情
 */
export async function getById(themeId: string): Promise<ThemeDetail | null> {
  const theme = await prisma.theme.findUnique({
    where: { themeId },
  });

  if (!theme) return null;
  return toThemeDetail(theme);
}

/**
 * 根据 shortName 获取主题详情（公开）
 */
export async function getByShortName(shortName: string): Promise<ThemeDetail | null> {
  const theme = await prisma.theme.findUnique({
    where: { shortName },
  });

  if (!theme) return null;
  return toThemeDetail(theme);
}

/**
 * 创建主题
 */
export async function create(data: CreateThemeInput): Promise<ThemeDetail> {
  if (data.shortName !== undefined && !data.shortName) {
    // 不传 shortName 时自动生成
    // 留空让 DB 层生成或不设置
  }
  if (data.shortName && !validateShortName(data.shortName)) {
    throw new Error('shortName 格式无效（仅允许字母数字横线，2-50字符）');
  }

  // shortName 唯一性手动检查（Prisma 会自动查，但先给友好提示）
  if (data.shortName) {
    const existing = await prisma.theme.findUnique({ where: { shortName: data.shortName } });
    if (existing) {
      throw new Error(`shortName "${data.shortName}" 已被使用`);
    }
  }

  if (data.configJson !== undefined) {
    validateConfigJson(data.configJson);
  }

  const theme = await prisma.theme.create({
    data: {
      themeId: crypto.randomUUID(),
      projectId: data.projectId ?? 'ftg',
      name: data.name,
      description: data.description ?? null,
      shortName: data.shortName ?? null,
      gameName: data.gameName,
      configJson: data.configJson !== undefined
        ? data.configJson as unknown as Prisma.InputJsonValue
        : undefined,
      templateMarkup: data.templateMarkup ?? null,
      cssClasses: data.cssClasses !== undefined
        ? data.cssClasses as unknown as Prisma.InputJsonValue
        : [],
      previewImageUrl: data.previewImageUrl ?? null,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
    },
  });

  return toThemeDetail(theme);
}

/**
 * 更新主题
 * @param themeId 主题唯一标识
 * @param data 更新字段
 */
export async function update(themeId: string, data: UpdateThemeInput): Promise<ThemeDetail | null> {
  const existing = await prisma.theme.findUnique({ where: { themeId } });
  if (!existing) return null;

  // 校验 configJson
  if (data.configJson !== undefined) {
    validateConfigJson(data.configJson);
  }

  // 校验 shortName 唯一性
  if (data.shortName !== undefined && data.shortName) {
    if (!validateShortName(data.shortName)) {
      throw new Error('shortName 格式无效（仅允许字母数字横线，2-50字符）');
    }
    if (data.shortName !== existing.shortName) {
      const dup = await prisma.theme.findUnique({ where: { shortName: data.shortName } });
      if (dup) {
        throw new Error(`shortName "${data.shortName}" 已被使用`);
      }
    }
  }

  const updateData: Prisma.ThemeUpdateInput = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.shortName !== undefined) updateData.shortName = data.shortName || null;
  if (data.projectId !== undefined) updateData.projectId = data.projectId;
  if (data.gameName !== undefined) updateData.gameName = data.gameName;
  if (data.configJson !== undefined) updateData.configJson = data.configJson as unknown as Prisma.InputJsonValue;
  if (data.templateMarkup !== undefined) updateData.templateMarkup = data.templateMarkup;
  if (data.cssClasses !== undefined) updateData.cssClasses = data.cssClasses as unknown as Prisma.InputJsonValue;
  if (data.previewImageUrl !== undefined) updateData.previewImageUrl = data.previewImageUrl;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  const theme = await prisma.theme.update({
    where: { themeId },
    data: updateData,
  });

  return toThemeDetail(theme);
}

/**
 * 切换主题启用/禁用状态
 */
export async function toggleActive(themeId: string): Promise<ThemeDetail | null> {
  const existing = await prisma.theme.findUnique({ where: { themeId } });
  if (!existing) return null;

  const theme = await prisma.theme.update({
    where: { themeId },
    data: { isActive: !existing.isActive },
  });

  return toThemeDetail(theme);
}

/**
 * 删除主题（检查是否被食物记录引用）
 */
export async function deleteByThemeId(themeId: string): Promise<boolean> {
  const existing = await prisma.theme.findUnique({ where: { themeId } });
  if (!existing) return false;

  // 检查是否有食物记录引用
  const recordCount = await prisma.foodRecord.count({
    where: { themeId },
  });
  if (recordCount > 0) {
    throw new Error(`主题已被 ${recordCount} 条食物记录引用，无法删除`);
  }

  await prisma.theme.delete({ where: { themeId } });
  return true;
}

// ============================================================
// 使用统计
// ============================================================

/**
 * 记录主题使用（防重复）
 * 同一 recordId 只计一次
 */
export async function recordUsage(themeId: string, recordId: string, userId: number): Promise<void> {
  const existing = await prisma.themeUsageLog.findUnique({
    where: { themeId_recordId: { themeId, recordId } },
  });
  if (existing) return; // 已存在，不重复计数

  await prisma.$transaction([
    prisma.themeUsageLog.create({
      data: { themeId, recordId, userId },
    }),
    prisma.theme.update({
      where: { themeId },
      data: { usageCount: { increment: 1 } },
    }),
  ]);
}

/**
 * 获取主题使用统计
 */
export async function getUsageStats(themeId: string): Promise<UsageStats> {
  const theme = await prisma.theme.findUnique({
    where: { themeId },
    select: { usageCount: true },
  });
  if (!theme) {
    throw new Error('主题不存在');
  }

  // 去重用户数
  const uniqueUsersResult = await prisma.themeUsageLog.findMany({
    where: { themeId },
    select: { userId: true },
    distinct: ['userId'],
  });

  // 近7天每日使用数
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentLogs = await prisma.themeUsageLog.findMany({
    where: {
      themeId,
      createdAt: { gte: sevenDaysAgo },
    },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  // 按日期分组
  const dailyMap = new Map<string, number>();
  for (const log of recentLogs) {
    const date = log.createdAt.toISOString().slice(0, 10);
    dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
  }

  // 填充近7天
  const recentUsage: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    recentUsage.push({ date: dateStr, count: dailyMap.get(dateStr) || 0 });
  }

  return {
    totalUsage: theme.usageCount,
    uniqueUsers: uniqueUsersResult.length,
    recentUsage,
  };
}

/**
 * 获取项目主题使用排行
 */
export async function getProjectUsageRanking(projectId: string): Promise<ProjectUsageRanking[]> {
  const themes = await prisma.theme.findMany({
    where: { projectId, isActive: true },
    select: {
      themeId: true,
      name: true,
      usageCount: true,
    },
    orderBy: { usageCount: 'desc' },
  });

  return themes.map((t) => ({
    themeId: t.themeId,
    name: t.name,
    usageCount: t.usageCount,
  }));
}
