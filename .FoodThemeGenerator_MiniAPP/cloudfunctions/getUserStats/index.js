/**
 * getUserStats 云函数
 * 数据库触发器 — 聚合用户统计数据
 *
 * 触发方式: 数据库触发 (users 集合 afterWrite)
 * 超时: 3s  |  内存: 256MB
 */

const { createResponse, createErrorResponse } = require('../shared/response');
const { withErrorHandler } = require('../shared/errorHandler');
const { logger } = require('../shared/logger');

const log = logger.createNamedLogger('getUserStats');

/**
 * 聚合用户统计数据
 * @param {string} openid - 用户 openid
 * @returns {Promise<object>} 用户统计对象 (UserStats)
 */
async function aggregateUserStats(openid) {
  // ========================================
  // TODO: 实现数据库聚合查询
  // 1. 查询 food_records 集合统计总记录数
  // 2. 查询 checkins 集合计算打卡数据
  // 3. 按 foodType 分组统计各类型数量
  // 4. 查询 user_achievements 统计成就数
  // 5. 查询本月 / 今日记录数
  // 6. 汇总卡路里数据
  // ========================================

  return {
    totalRecords: 0,
    totalCheckins: 0,
    currentStreak: 0,
    maxStreak: 0,
    achievementsUnlocked: 0,
    foodTypeCounts: {},
    recordsThisMonth: 0,
    recordsToday: 0,
    totalCalories: 0,
  };
}

/**
 * 云函数入口
 * @param {object} event - 请求事件
 * @param {string} event.openid - 用户 openid
 * @param {string} [event.action] - 操作类型 (get / refresh)
 * @param {object} context - 云函数上下文
 */
exports.main = async (event, context) => {
  return withErrorHandler(
    async () => {
      const { openid, action } = event;

      log.info('用户统计函数被调用', { openid, action });

      if (!openid) {
        const { CustomAppError } = require('../shared/errorHandler');
        throw new CustomAppError(1002, '缺少必要参数: openid');
      }

      const stats = await aggregateUserStats(openid);

      return createResponse(stats);
    },
    { functionName: 'getUserStats' }
  );
};
