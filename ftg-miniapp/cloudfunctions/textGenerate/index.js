/**
 * textGenerate 云函数
 * CloudRun HTTP 触发 — 调用腾讯混元大模型生成食物描述文本
 *
 * 触发方式: HTTP (POST)
 * 超时: 60s  |  内存: 512MB
 */

const { createResponse, createErrorResponse } = require('../shared/response');
const { withErrorHandler } = require('../shared/errorHandler');
const { logger } = require('../shared/logger');

const log = logger.createNamedLogger('textGenerate');

/**
 * 云函数入口
 * @param {object} event - 请求事件
 * @param {string} event.foodName - 食物名称
 * @param {string} event.foodType - 食物类型
 * @param {object} context - 云函数上下文
 */
exports.main = async (event, context) => {
  return withErrorHandler(
    async () => {
      log.info('文本生成函数被调用', {
        foodName: event.foodName,
        foodType: event.foodType,
      });

      // 参数校验
      const { CustomAppError } = require('../shared/errorHandler');
      if (!event.foodName) throw new CustomAppError(1002, '缺少必要参数: foodName');

      // ========================================
      // TODO: 调用腾讯混元大模型生成描述文本
      // 1. 获取 Hunyuan API Key (通过 apiKeyResolver)
      // 2. 构造 Prompt（简短描述 + 游戏化风格描述 + 详细描述）
      // 3. 调用混元 API
      // 4. 解析响应为 AIFoodDescription 格式
      // ========================================

      const description = {
        short: `一份美味的${event.foodName}`,
        gameStyle: `获得道具：🍽️ ${event.foodName}！`,
        detail: `这是一份${event.foodName}，看起来非常美味。`,
      };

      log.info('文本生成完成', { foodName: event.foodName });

      return createResponse(description);
    },
    { functionName: 'textGenerate' }
  );
};
