import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  condition: string;
}

const ACHIEVEMENT_DEFINITIONS: Record<string, AchievementDefinition> = {
  mileage_100: {
    id: 'mileage_100',
    title: '百里挑一',
    description: '累计里程达到 100',
    condition: 'totalMileage >= 100',
  },
  mileage_1000: {
    id: 'mileage_1000',
    title: '千里之行',
    description: '累计里程达到 1000',
    condition: 'totalMileage >= 1000',
  },
  mileage_10000: {
    id: 'mileage_10000',
    title: '万里长征',
    description: '累计里程达到 10000',
    condition: 'totalMileage >= 10000',
  },
  level_10: {
    id: 'level_10',
    title: '小试牛刀',
    description: '等级达到 10',
    condition: 'level >= 10',
  },
  level_50: {
    id: 'level_50',
    title: '半百之巅',
    description: '等级达到 50',
    condition: 'level >= 50',
  },
  pvp_10_wins: {
    id: 'pvp_10_wins',
    title: '初露锋芒',
    description: 'PVP 胜利 10 场',
    condition: 'pvpWins >= 10',
  },
  pvp_100_wins: {
    id: 'pvp_100_wins',
    title: '百战百胜',
    description: 'PVP 胜利 100 场',
    condition: 'pvpWins >= 100',
  },
  prestige_1: {
    id: 'prestige_1',
    title: '轮回初启',
    description: '完成 1 次轮回',
    condition: 'prestigeCount >= 1',
  },
  prestige_10: {
    id: 'prestige_10',
    title: '十世轮回',
    description: '完成 10 次轮回',
    condition: 'prestigeCount >= 10',
  },
  login_7_days: {
    id: 'login_7_days',
    title: '一周达人',
    description: '累计登录 7 天',
    condition: 'loginDays >= 7',
  },
  login_30_days: {
    id: 'login_30_days',
    title: '满月礼',
    description: '累计登录 30 天',
    condition: 'loginDays >= 30',
  },
};

/**
 * 解析条件字符串并与玩家属性比较。
 * 支持操作符: >=, <=, ==, >, <
 * 不使用 eval()，仅做安全的值比较。
 */
function evaluateCondition(condition: string, stats: Record<string, number>): boolean {
  const match = condition.match(/^(\w+)\s*(>=|<=|==|>|<)\s*(\d+)$/);
  if (!match) return false;

  const field = match[1];
  const operator = match[2];
  const value = parseInt(match[3], 10);
  const statValue = stats[field];

  if (statValue === undefined) return false;

  switch (operator) {
    case '>=':
      return statValue >= value;
    case '<=':
      return statValue <= value;
    case '==':
      return statValue === value;
    case '>':
      return statValue > value;
    case '<':
      return statValue < value;
    default:
      return false;
  }
}

/**
 * 检查所有成就定义，若条件满足则解锁。
 * 跳过已解锁（progress >= 1.0）的成就。
 */
export async function checkAndUnlockAchievements(
  playerId: number,
  stats: Record<string, number>,
): Promise<Array<{ achievementId: string; title: string; isNew: boolean }>> {
  const results: Array<{ achievementId: string; title: string; isNew: boolean }> = [];

  for (const def of Object.values(ACHIEVEMENT_DEFINITIONS)) {
    // 检查是否已解锁
    const existing = await prisma.game1Achievement.findUnique({
      where: {
        playerId_achievementId: { playerId, achievementId: def.id },
      },
    });
    if (existing && existing.progress >= 1.0) continue;

    const isUnlocked = evaluateCondition(def.condition, stats);

    if (isUnlocked) {
      await prisma.game1Achievement.upsert({
        where: {
          playerId_achievementId: { playerId, achievementId: def.id },
        },
        create: {
          playerId,
          achievementId: def.id,
          title: def.title,
          progress: 1.0,
        },
        update: {
          progress: 1.0,
          unlockedAt: new Date(),
        },
      });

      results.push({ achievementId: def.id, title: def.title, isNew: true });
      logger.info('成就已解锁', { achievementId: def.id, title: def.title, playerId });
    }
  }

  return results;
}

/**
 * 获取玩家的完整成就列表（含未解锁的），
 * 合并定义数据与数据库实际进度。
 */
export async function getPlayerAchievements(playerId: number) {
  const dbAchievements = await prisma.game1Achievement.findMany({
    where: { playerId },
  });

  const dbMap = new Map(dbAchievements.map((a) => [a.achievementId, a]));

  return Object.values(ACHIEVEMENT_DEFINITIONS).map((def) => {
    const dbRecord = dbMap.get(def.id);
    return {
      achievementId: def.id,
      title: def.title,
      description: def.description,
      condition: def.condition,
      unlockedAt: dbRecord?.unlockedAt ?? null,
      progress: dbRecord?.progress ?? 0,
    };
  });
}
