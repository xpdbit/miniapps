/**
 * 成就服务 - 条件引擎与成就解锁逻辑
 */

import prisma from '../lib/prisma';
import { ACHIEVEMENTS_CONFIG, type AchievementConfigItem } from '../constants/achievements';
import { AchievementConditionType } from '../types/achievement';
import { getUserStats } from './user.service';

/** 用户成就进度（含定义信息） */
export interface AchievementProgress {
  achievementId: string;
  name: string;
  description: string;
  iconUrl: string;
  conditionType: AchievementConditionType;
  conditionValue: number;
  conditionParam?: string | null;
  themeId: string;
  progress: number;
  isUnlocked: boolean;
  unlockedAt: Date | null;
}

/** checkAndUnlock 返回结果 */
export interface CheckResult {
  newlyUnlocked: AchievementProgress[];
}

/** 返回所有预定义的成就配置 */
export function getAllDefinitions(): AchievementConfigItem[] {
  return ACHIEVEMENTS_CONFIG;
}

/** 获取用户的成就进度列表（含每个成就的定义信息） */
export async function getUserAchievements(userId: number): Promise<AchievementProgress[]> {
  const userAchievements = await prisma.userAchievement.findMany({
    where: { userId },
  });

  const userAchievementMap = new Map(userAchievements.map((ua) => [ua.achievementId, ua]));

  return ACHIEVEMENTS_CONFIG.map((def) => {
    const ua = userAchievementMap.get(def.achievementId);
    return {
      achievementId: def.achievementId,
      name: def.name,
      description: def.description,
      iconUrl: def.iconUrl,
      conditionType: def.conditionType,
      conditionValue: def.conditionValue,
      conditionParam: def.conditionParam,
      themeId: def.themeId,
      progress: ua?.progress ?? 0,
      isUnlocked: ua?.isUnlocked ?? false,
      unlockedAt: ua?.unlockedAt ?? null,
    };
  });
}

/**
 * 评估所有成就条件，解锁新达成的成就，更新进度
 *
 * - 使用 getUserStats() 获取统计信息
 * - 一次查询获取现有用户成就记录，避免 N+1
 * - 仅当进度或解锁状态变化时才写入 DB
 * - 不会重复解锁已解锁的成就
 */
export async function checkAndUnlock(userId: number): Promise<CheckResult> {
  const [stats, existingAchievements] = await Promise.all([
    getUserStats(userId),
    prisma.userAchievement.findMany({ where: { userId } }),
  ]);

  const existingMap = new Map(existingAchievements.map((a) => [a.achievementId, a]));

  // 仅在存在 THEME_USAGE 类型的成就时才查询去重主题数
  let distinctThemeCount = 0;
  const hasThemeUsage = ACHIEVEMENTS_CONFIG.some(
    (a) => a.conditionType === AchievementConditionType.THEME_USAGE,
  );
  if (hasThemeUsage) {
    const themeRecords = await prisma.foodRecord.findMany({
      where: { userId, isDeleted: false, themeId: { not: null } },
      select: { themeId: true },
      distinct: ['themeId'],
    });
    distinctThemeCount = themeRecords.length;
  }

  const newlyUnlocked: AchievementProgress[] = [];

  for (const def of ACHIEVEMENTS_CONFIG) {
    const { progress, isUnlocked } = evaluateCondition(def, stats, distinctThemeCount);
    const existing = existingMap.get(def.achievementId);
    const wasAlreadyUnlocked = existing?.isUnlocked ?? false;

    if (existing) {
      // 仅在进度或解锁状态变化时才更新
      if (existing.progress !== progress || existing.isUnlocked !== isUnlocked) {
        await prisma.userAchievement.update({
          where: { id: existing.id },
          data: {
            progress,
            isUnlocked,
            // 仅在从锁定变为解锁时设置解锁时间
            ...(isUnlocked && !wasAlreadyUnlocked ? { unlockedAt: new Date() } : {}),
          },
        });
      }
    } else {
      await prisma.userAchievement.create({
        data: {
          userId,
          achievementId: def.achievementId,
          progress,
          isUnlocked,
          unlockedAt: isUnlocked ? new Date() : undefined,
        },
      });
    }

    if (isUnlocked && !wasAlreadyUnlocked) {
      newlyUnlocked.push({
        achievementId: def.achievementId,
        name: def.name,
        description: def.description,
        iconUrl: def.iconUrl,
        conditionType: def.conditionType,
        conditionValue: def.conditionValue,
        conditionParam: def.conditionParam,
        themeId: def.themeId,
        progress,
        isUnlocked,
        unlockedAt: new Date(),
      });
    }
  }

  return { newlyUnlocked };
}

/** 条件引擎：根据条件类型评估单个成就是否达成并计算进度 */
function evaluateCondition(
  def: AchievementConfigItem,
  stats: Awaited<ReturnType<typeof getUserStats>>,
  distinctThemeCount: number,
): { progress: number; isUnlocked: boolean } {
  switch (def.conditionType) {
    case AchievementConditionType.TOTAL_RECORDS: {
      const progress = Math.min(stats.totalRecords, def.conditionValue);
      return { progress, isUnlocked: stats.totalRecords >= def.conditionValue };
    }
    case AchievementConditionType.STREAK_DAYS: {
      const progress = Math.min(stats.currentStreak, def.conditionValue);
      return { progress, isUnlocked: stats.currentStreak >= def.conditionValue };
    }
    case AchievementConditionType.FOOD_TYPE_COUNT: {
      const count = def.conditionParam ? (stats.foodTypeCounts[def.conditionParam] ?? 0) : 0;
      const progress = Math.min(count, def.conditionValue);
      return { progress, isUnlocked: count >= def.conditionValue };
    }
    case AchievementConditionType.THEME_USAGE: {
      const progress = Math.min(distinctThemeCount, def.conditionValue);
      return { progress, isUnlocked: distinctThemeCount >= def.conditionValue };
    }
    case AchievementConditionType.CHECKIN_COUNT: {
      const progress = Math.min(stats.totalCheckins, def.conditionValue);
      return { progress, isUnlocked: stats.totalCheckins >= def.conditionValue };
    }
    default:
      return { progress: 0, isUnlocked: false };
  }
}
