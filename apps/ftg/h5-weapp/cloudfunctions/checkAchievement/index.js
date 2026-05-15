/**
 * checkAchievement 云函数
 *
 * 支持两种调用方式：
 *   1. action=query  — 前端成就页调用，返回当前用户全部成就进度
 *   2. action=create — 数据库触发器 (food_records afterWrite)，检查并解锁新成就
 *
 * 触发方式: 数据库触发 (food_records 集合 afterWrite) + 前端主动调用
 * 超时: 3s  |  内存: 128MB
 */

const cloud = require('wx-server-sdk');
const { createResponse, createErrorResponse } = require('../shared/response');
const { withErrorHandler } = require('../shared/errorHandler');
const { logger } = require('../shared/logger');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const log = logger.createNamedLogger('checkAchievement');

// ============================================================
// 成就条件类型（与前端 @/types/achievement 同步）
// ============================================================
const CONDITION_TYPE = {
  TOTAL_RECORDS: 'total_records',
  STREAK_DAYS: 'streak_days',
  FOOD_TYPE_COUNT: 'food_type_count',
  THEME_USAGE: 'theme_usage',
  CHECKIN_COUNT: 'checkin_count',
};

// ============================================================
// 成就定义（与前端 @/constants/achievements 同步）
// ============================================================
const ACHIEVEMENTS_CONFIG = [
  {
    achievementId: 'first_record',
    name: '初次邂逅',
    unlockCondition: { type: CONDITION_TYPE.TOTAL_RECORDS, value: 1 },
  },
  {
    achievementId: 'ten_records',
    name: '美食探索者',
    unlockCondition: { type: CONDITION_TYPE.TOTAL_RECORDS, value: 10 },
  },
  {
    achievementId: 'fifty_records',
    name: '资深美食家',
    unlockCondition: { type: CONDITION_TYPE.TOTAL_RECORDS, value: 50 },
  },
  {
    achievementId: 'hundred_records',
    name: '食神降临',
    unlockCondition: { type: CONDITION_TYPE.TOTAL_RECORDS, value: 100 },
  },
  {
    achievementId: 'streak_3',
    name: '坚持三天',
    unlockCondition: { type: CONDITION_TYPE.STREAK_DAYS, value: 3 },
  },
  {
    achievementId: 'streak_7',
    name: '一周全勤',
    unlockCondition: { type: CONDITION_TYPE.STREAK_DAYS, value: 7 },
  },
  {
    achievementId: 'streak_30',
    name: '月度满贯',
    unlockCondition: { type: CONDITION_TYPE.STREAK_DAYS, value: 30 },
  },
  {
    achievementId: 'meat_lover',
    name: '肉食爱好者',
    unlockCondition: { type: CONDITION_TYPE.FOOD_TYPE_COUNT, value: 10, param: 'meat' },
  },
  {
    achievementId: 'veggie_master',
    name: '蔬菜达人',
    unlockCondition: { type: CONDITION_TYPE.FOOD_TYPE_COUNT, value: 10, param: 'vegetable' },
  },
  {
    achievementId: 'fruit_fanatic',
    name: '水果狂人',
    unlockCondition: { type: CONDITION_TYPE.FOOD_TYPE_COUNT, value: 10, param: 'fruit' },
  },
  {
    achievementId: 'theme_collector',
    name: '主题收藏家',
    unlockCondition: { type: CONDITION_TYPE.THEME_USAGE, value: 6 },
  },
  {
    achievementId: 'checkin_10',
    name: '打卡达人',
    unlockCondition: { type: CONDITION_TYPE.CHECKIN_COUNT, value: 10 },
  },
];

// ============================================================
// 获取用户统计信息
// ============================================================
async function getUserStats(openid) {
  // 并行查询所有统计数据
  const [
    totalRecordsRes,
    foodRecordsRes,
    checkinCountRes,
    userStatsRes,
  ] = await Promise.all([
    db.collection('food_records').where({ openid }).count(),
    db.collection('food_records')
      .where({ openid })
      .field({ foodType: true, themeId: true })
      .get(),
    db.collection('checkins').where({ openid }).count(),
    db.collection('user_stats').where({ openid }).get(),
  ]);

  // 各食物类型计数
  const foodTypeCounts = {};
  // 各主题使用计数
  const themeUsed = new Set();

  for (const record of foodRecordsRes.data) {
    const type = record.foodType || 'unknown';
    foodTypeCounts[type] = (foodTypeCounts[type] || 0) + 1;

    if (record.themeId) {
      themeUsed.add(record.themeId);
    }
  }

  // 连续打卡天数
  const currentStreak =
    userStatsRes.data.length > 0
      ? (userStatsRes.data[0].currentStreak || 0)
      : 0;

  return {
    totalRecords: totalRecordsRes.total,
    currentStreak,
    foodTypeCounts,
    themeCount: themeUsed.size,
    checkinCount: checkinCountRes.total,
  };
}

// ============================================================
// 计算成就条件的当前进度值
// ============================================================
function getConditionProgress(condition, stats) {
  switch (condition.type) {
    case CONDITION_TYPE.TOTAL_RECORDS:
      return stats.totalRecords;
    case CONDITION_TYPE.STREAK_DAYS:
      return stats.currentStreak;
    case CONDITION_TYPE.FOOD_TYPE_COUNT: {
      const param = condition.param || '';
      return stats.foodTypeCounts[param] || 0;
    }
    case CONDITION_TYPE.THEME_USAGE:
      return stats.themeCount;
    case CONDITION_TYPE.CHECKIN_COUNT:
      return stats.checkinCount;
    default:
      return 0;
  }
}

// ============================================================
// 查询用户成就进度（action=query）
// ============================================================
async function queryUserAchievements(openid) {
  const { data: userAchievements } = await db
    .collection('user_achievements')
    .where({ openid })
    .get();

  const uaMap = {};
  for (const ua of userAchievements) {
    uaMap[ua.achievementId] = ua;
  }

  // 合并所有成就配置与用户进度
  return ACHIEVEMENTS_CONFIG.map((cfg) => {
    const ua = uaMap[cfg.achievementId];
    return {
      achievementId: cfg.achievementId,
      progress: ua ? ua.progress : 0,
      isUnlocked: ua ? ua.isUnlocked : false,
      unlockedAt: ua ? ua.unlockedAt : null,
    };
  });
}

// ============================================================
// 检查并解锁成就（action=create — 数据库触发器）
// ============================================================
async function checkAndUnlockAchievements(openid) {
  // 获取用户最新统计
  const stats = await getUserStats(openid);

  // 查询用户已有的 user_achievements 记录
  const { data: existingRecords } = await db
    .collection('user_achievements')
    .where({ openid })
    .get();

  const existingMap = {};
  const unlockedIds = new Set();
  for (const rec of existingRecords) {
    existingMap[rec.achievementId] = rec;
    if (rec.isUnlocked) {
      unlockedIds.add(rec.achievementId);
    }
  }

  const newlyUnlocked = [];

  for (const achievement of ACHIEVEMENTS_CONFIG) {
    const { achievementId, name, unlockCondition } = achievement;
    const currentProgress = getConditionProgress(unlockCondition, stats);
    const target = unlockCondition.value;

    const existing = existingMap[achievementId];
    const alreadyUnlocked = unlockedIds.has(achievementId);

    if (alreadyUnlocked) {
      // 已解锁 — 仅更新进度（可能增长）
      if (existing && existing.progress !== currentProgress) {
        await db
          .collection('user_achievements')
          .doc(existing._id)
          .update({ data: { progress: currentProgress } });
      }
      continue;
    }

    const meetsCondition = currentProgress >= target;

    if (meetsCondition) {
      // 新解锁
      const unlockedAt = new Date().toISOString();
      if (existing) {
        await db
          .collection('user_achievements')
          .doc(existing._id)
          .update({
            data: { progress: currentProgress, isUnlocked: true, unlockedAt },
          });
      } else {
        await db.collection('user_achievements').add({
          data: { openid, achievementId, progress: currentProgress, isUnlocked: true, unlockedAt },
        });
      }
      newlyUnlocked.push({ achievementId, name, isNewlyUnlocked: true });
      log.info('成就新解锁', { openid, achievementId, name });
    } else if (existing) {
      // 未解锁但进度有变化 -> 更新进度
      if (existing.progress !== currentProgress) {
        await db
          .collection('user_achievements')
          .doc(existing._id)
          .update({ data: { progress: currentProgress } });
      }
    } else {
      // 首次创建进度记录
      await db.collection('user_achievements').add({
        data: { openid, achievementId, progress: currentProgress, isUnlocked: false, unlockedAt: '' },
      });
    }
  }

  return newlyUnlocked;
}

// ============================================================
// 云函数入口
// ============================================================
exports.main = async (event, context) => {
  return withErrorHandler(
    async () => {
      const { action, data } = event;
      const openid = data && data.openid;

      log.info('成就检查函数被调用', { action, hasData: !!data });

      // ---------- action=query: 查询当前进度 ----------
      if (action === 'query') {
        if (!openid) {
          return createErrorResponse(1002, '缺少必要参数: openid');
        }

        const achievements = await queryUserAchievements(openid);
        return createResponse({ achievements });
      }

      // ---------- action=create: 检查并解锁 ----------
      if (action === 'create') {
        if (!openid) {
          return createResponse({ checked: false, reason: '无用户标识' });
        }

        const newlyUnlocked = await checkAndUnlockAchievements(openid);

        if (newlyUnlocked.length > 0) {
          log.info('本次新解锁成就', {
            openid,
            achievements: newlyUnlocked.map((a) => a.name),
          });
        }

        return createResponse({
          checked: true,
          newlyUnlocked,
        });
      }

      // ---------- 未知 action ----------
      return createResponse({ checked: false, reason: `未知操作: ${action}` });
    },
    { functionName: 'checkAchievement' }
  );
};
