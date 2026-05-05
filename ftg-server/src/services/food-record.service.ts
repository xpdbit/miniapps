/**
 * 食物记录服务 - CRUD、图片上传、搜索、软删除、统计
 */
import prisma from '../lib/prisma';
import type { Prisma, $Enums } from '@prisma/client';
import { getStorageProvider, buildStoragePath } from '../lib/storage-factory';

// ============================================================
// 类型定义
// ============================================================

/** 创建食物记录输入参数 */
export interface CreateFoodRecordInput {
  foodName: string;
  foodType: string;
  imageBuffer?: Buffer;
  imageUrl?: string;
  themeImageUrl?: string;
  caloriesTotal?: number;
  caloriesPer100g?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  aiDescShort?: string;
  aiDescGameStyle?: string;
  aiDescDetail?: string;
  gameDescription?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  ipLocation?: string;
  themeId?: string;
  isPublic?: boolean;
}

/** 列表查询参数 */
export interface ListRecordParams {
  page: number;
  limit: number;
  foodType?: string;
  themeId?: string;
}

/** 日期范围 */
export interface DateRange {
  start: Date;
  end: Date;
}

/** 食物类型统计 */
export interface FoodTypeStats {
  foodType: string;
  count: number;
}

/** 日期趋势 */
export interface DateTrend {
  date: string;
  count: number;
}

/** 记录统计 */
export interface RecordStats {
  totalCount: number;
  foodTypeDistribution: FoodTypeStats[];
  dateTrend: DateTrend[];
}

// ============================================================
// 常量
// ============================================================

/** 有效的食物类型列表 */
const VALID_FOOD_TYPES = [
  'grain', 'vegetable', 'fruit', 'meat', 'seafood',
  'dairy', 'nut', 'snack', 'beverage', 'seasoning', 'dish', 'other',
] as const;

/** 列表查询的字段选择 */
const LIST_RECORD_SELECT = {
  id: true,
  imageUrl: true,
  themeImageUrl: true,
  foodName: true,
  foodType: true,
  caloriesTotal: true,
  aiDescShort: true,
  gameDescription: true,
  locationName: true,
  themeId: true,
  createdAt: true,
} satisfies Prisma.FoodRecordSelect;

// ============================================================
// 辅助函数
// ============================================================

/** 将值安全转为数字，无效返回 undefined */
function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
}

/** 将值安全转为布尔，无效返回 undefined */
function toBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return undefined;
}

/** 验证食物类型 */
function validateFoodType(value: unknown): string | undefined {
  if (typeof value === 'string' && (VALID_FOOD_TYPES as readonly string[]).includes(value)) {
    return value;
  }
  return undefined;
}

// ============================================================
// 服务函数
// ============================================================

/**
 * 创建食物记录
 * 如果有图片 buffer，先上传再存储 URL
 */
export async function create(userId: number, data: Record<string, unknown>) {
  // 1. 处理图片上传
  let imageUrl: string | undefined;
  const buffer = data.imageBuffer;
  if (buffer instanceof Buffer) {
    const storage = getStorageProvider();
    const key = buildStoragePath(userId, 'food', 'jpg');
    imageUrl = await storage.upload(key, buffer, 'image/jpeg');
  }

  // 2. 验证 foodType
  const foodType = validateFoodType(data.foodType);
  if (!foodType) {
    throw new Error('无效的食物类型');
  }

  // 3. 构建创建数据
  const createInput: Prisma.FoodRecordUncheckedCreateInput = {
    userId,
    foodName: String(data.foodName ?? ''),
    foodType: foodType as $Enums.FoodType,
    imageUrl: imageUrl ?? (data.imageUrl as string | undefined),
    themeImageUrl: data.themeImageUrl as string | undefined,
    caloriesTotal: toNumber(data.caloriesTotal),
    caloriesPer100g: toNumber(data.caloriesPer100g),
    protein: toNumber(data.protein),
    fat: toNumber(data.fat),
    carbs: toNumber(data.carbs),
    aiDescShort: data.aiDescShort as string | undefined,
    aiDescGameStyle: data.aiDescGameStyle as string | undefined,
    aiDescDetail: data.aiDescDetail as string | undefined,
    gameDescription: data.gameDescription as string | undefined,
    latitude: toNumber(data.latitude),
    longitude: toNumber(data.longitude),
    locationName: data.locationName as string | undefined,
    ipLocation: data.ipLocation as string | undefined,
    themeId: data.themeId as string | undefined,
    isPublic: toBoolean(data.isPublic),
  };

  return prisma.foodRecord.create({ data: createInput });
}

/**
 * 根据 ID 获取单条记录
 * 包含用户基本信息（nickname, avatarUrl）
 * 自动校验所有权和 isDeleted 状态
 */
export async function getById(id: number, userId: number) {
  return prisma.foodRecord.findFirst({
    where: { id, userId, isDeleted: false },
    include: {
      user: {
        select: { nickname: true, avatarUrl: true },
      },
    },
  });
}

/**
 * 分页查询用户食物记录
 * 支持 foodType 和 themeId 筛选
 * 使用 offset 分页
 */
export async function listByUser(userId: number, params: ListRecordParams) {
  const { page, limit, foodType, themeId } = params;
  const skip = (page - 1) * limit;

  // 构建 where 条件
  const where: Prisma.FoodRecordWhereInput = {
    userId,
    isDeleted: false,
  };

  if (foodType) {
    where.foodType = validateFoodType(foodType) as $Enums.FoodType;
  }
  if (themeId) {
    where.themeId = themeId;
  }

  const [records, total] = await Promise.all([
    prisma.foodRecord.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: LIST_RECORD_SELECT,
    }),
    prisma.foodRecord.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    list: records,
    total,
    page,
    pageSize: limit,
    totalPages,
    hasMore: page < totalPages,
  };
}

/**
 * 软删除记录
 * 先校验所有权，再标记删除
 */
export async function softDelete(id: number, userId: number): Promise<void> {
  const record = await prisma.foodRecord.findFirst({
    where: { id, userId, isDeleted: false },
    select: { id: true },
  });

  if (!record) {
    throw new Error('记录不存在或无权操作');
  }

  await prisma.foodRecord.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  });
}

/**
 * 搜索食物记录
 * 按食物名称模糊搜索
 */
export async function search(userId: number, keyword: string) {
  return prisma.foodRecord.findMany({
    where: {
      userId,
      isDeleted: false,
      foodName: { contains: keyword },
    },
    take: 20,
    orderBy: { createdAt: 'desc' },
    select: LIST_RECORD_SELECT,
  });
}

/**
 * 获取食物记录统计
 * - 按食物类型分组统计数量
 * - 按日期生成趋势数据
 */
export async function getStats(userId: number, dateRange?: DateRange): Promise<RecordStats> {
  // 基础 where 条件
  const baseWhere: Prisma.FoodRecordWhereInput = { userId, isDeleted: false };

  if (dateRange) {
    baseWhere.createdAt = { gte: dateRange.start, lte: dateRange.end };
  }

  // 并行查询：总数 + 类型分布
  const [totalCount, foodTypeDistribution] = await Promise.all([
    prisma.foodRecord.count({ where: baseWhere }),
    prisma.foodRecord.groupBy({
      by: ['foodType'],
      where: baseWhere,
      _count: true,
      orderBy: { _count: { foodType: 'desc' } },
    }),
  ]);

  // 获取所有记录的日期用于趋势分析
  const recordsForTrend = await prisma.foodRecord.findMany({
    where: baseWhere,
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  // 按日期分组统计
  const dateMap = new Map<string, number>();
  for (const record of recordsForTrend) {
    const dateKey = record.createdAt.toISOString().slice(0, 10);
    dateMap.set(dateKey, (dateMap.get(dateKey) ?? 0) + 1);
  }

  const dateTrend: DateTrend[] = [];
  for (const [date, count] of dateMap) {
    dateTrend.push({ date, count });
  }

  return {
    totalCount,
    foodTypeDistribution: foodTypeDistribution.map((entry) => ({
      foodType: entry.foodType,
      count: entry._count,
    })),
    dateTrend,
  };
}
