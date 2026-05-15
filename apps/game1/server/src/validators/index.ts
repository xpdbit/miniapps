import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const playerIdParamSchema = z.object({
  playerId: z.coerce.number().int().positive(),
});

export const loginSchema = z.object({
  code: z.string().min(1, '微信登录 code 不能为空'),
});

export const updateProfileSchema = z.object({
  nickname: z.string().max(32).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
});

export const syncStatsSchema = z.object({
  level: z.number().int().positive().optional(),
  exp: z.number().int().min(0).optional(),
  totalMileage: z.number().min(0).optional(),
  playTime: z.number().int().min(0).optional(),
  prestigeCount: z.number().int().min(0).optional(),
});

export const uploadSaveSchema = z.object({
  saveData: z.record(z.unknown()),
  expectedVersion: z.number().int().positive().optional(),
});

export const matchResultSchema = z.object({
  opponentId: z.number().int().positive(),
  result: z.enum(['victory', 'defeat', 'draw']),
  battleLog: z.record(z.unknown()).optional(),
});

export const updateConfigSchema = z.object({
  value: z.record(z.unknown()),
});

export const batchConfigSchema = z.object({
  keys: z.array(z.string()).min(1).max(50),
});

export const shareRecordSchema = z.object({
  shareType: z.enum(['pvp_victory', 'prestige', 'achievement', 'normal']).default('normal'),
});

export const leaderboardQuerySchema = z.object({
  sortBy: z.enum(['totalMileage', 'level']).default('totalMileage'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const adminPlayerQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  sortBy: z.enum(['level', 'totalMileage', 'playTime', 'lastLoginAt', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
