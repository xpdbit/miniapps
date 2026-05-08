/**
 * generateShareCard 云函数
 * CloudRun HTTP 触发 — 生成分享卡片图片
 *
 * 触发方式: HTTP (POST)
 * 超时: 30s  |  内存: 512MB
 */

const { createResponse, createErrorResponse } = require('../shared/response');
const { withErrorHandler } = require('../shared/errorHandler');
const { logger } = require('../shared/logger');

const log = logger.createNamedLogger('generateShareCard');

/**
 * 云函数入口
 * @param {object} event - 请求事件
 * @param {string} event.foodImageFileID - 食物图片云文件 ID
 * @param {string} event.foodName - 食物名称
 * @param {string} event.gameDescription - 游戏化描述
 * @param {string} event.locationName - 位置名称
 * @param {string} event.themeId - 主题 ID
 * @param {string} event.nickname - 用户昵称
 * @param {string} event.avatarUrl - 用户头像云文件 ID
 * @param {object} context - 云函数上下文
 */
exports.main = async (event, context) => {
  return withErrorHandler(
    async () => {
      log.info('分享卡片生成函数被调用', {
        foodName: event.foodName,
        themeId: event.themeId,
      });

      // 参数校验
      const { CustomAppError } = require('../shared/errorHandler');
      if (!event.foodImageFileID) throw new CustomAppError(1002, '缺少必要参数: foodImageFileID');
      if (!event.foodName) throw new CustomAppError(1002, '缺少必要参数: foodName');

      // ========================================
      // TODO: 生成分享卡片图片
      // 1. 根据 themeId 获取主题边框配置
      // 2. 下载食物图片和用户头像
      // 3. 在 Canvas 上绘制：
      //    - 主题边框背景
      //    - 食物图片（居中 / 缩放）
      //    - 用户头像 + 昵称
      //    - 食物名称 + 游戏化描述
      //    - 位置名称
      // 4. 导出合成图片
      // 5. 上传到云存储
      // 6. 返回云文件 ID 和临时 URL
      // ========================================

      const shareCardResult = {
        resultFileID: 'cloud://placeholder-share-card.png',
        tempFileURL: 'https://placeholder.temp.url/share-card.png',
        width: 750,
        height: 1334,
      };

      log.info('分享卡片生成完成', { resultFileID: shareCardResult.resultFileID });

      return createResponse(shareCardResult);
    },
    { functionName: 'generateShareCard' }
  );
};
