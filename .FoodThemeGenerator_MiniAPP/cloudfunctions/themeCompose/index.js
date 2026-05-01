/**
 * themeCompose 云函数
 * CloudRun HTTP 触发 — 服务端 Canvas 图片合成（备用/降级路径）
 *
 * 主要合成路径使用客户端 Taro Canvas 2D 离屏合成（src/utils/canvas/composer.ts）
 * 此云函数作为服务端备用方案，在客户端不支持 Canvas 2D 时降级调用
 *
 * 触发方式: HTTP (POST)
 * 超时: 30s  |  内存: 256MB
 */

const { createResponse, createErrorResponse } = require('../shared/response');
const { withErrorHandler } = require('../shared/errorHandler');
const { logger } = require('../shared/logger');

const log = logger.createNamedLogger('themeCompose');

/**
 * 云函数入口
 * @param {object} event - 请求事件
 * @param {string} event.foodImageFileID - 食物原图云文件 ID
 * @param {string} event.themeId - 目标主题 ID
 * @param {string} event.foodName - 食物名称
 * @param {string} event.foodType - 食物类型
 * @param {string} event.gameDescription - 游戏化描述文本
 * @param {object} context - 云函数上下文
 */
exports.main = async (event, context) => {
  return withErrorHandler(
    async () => {
      log.info('主题合成函数被调用（服务端备用路径）', {
        themeId: event.themeId,
        foodName: event.foodName,
      });

      // 参数校验
      const { CustomAppError } = require('../shared/errorHandler');
      if (!event.foodImageFileID) throw new CustomAppError(1002, '缺少必要参数: foodImageFileID');
      if (!event.themeId) throw new CustomAppError(1002, '缺少必要参数: themeId');

      // ========================================
      // 当前状态：服务端合成暂未实现
      //
      // 客户端已实现：src/utils/canvas/composer.ts
      // 使用 Taro createOffscreenCanvas + Canvas 2D API
      //
      // 如需实现服务端合成，参考：
      // 1. node-canvas 或 sharp 进行图片合成
      // 2. 从云存储下载主题配置和边框素材
      // 3. 合成后上传到云存储
      // ========================================

      const composeResult = {
        resultFileID: 'cloud://placeholder-compose-result.png',
        processingTime: 0,
        width: 1080,
        height: 1920,
      };

      log.warn('主题合成返回占位结果（服务端未实现）', {
        resultFileID: composeResult.resultFileID,
      });

      return createResponse(composeResult);
    },
    { functionName: 'themeCompose' }
  );
};
