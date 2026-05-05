/**
 * foodRecognize 云函数 — 食物识别核心逻辑
 * CloudRun HTTP 触发 — 调用 PP-ShiTuV2 进行食物识别
 *
 * 触发方式: HTTP (POST) + 定时器 (每5分钟保活)
 * 超时: 60s | 内存: 512MB
 */

const cloud = require('wx-server-sdk');
cloud.init();
const { createResponse, createErrorResponse } = require('../shared/response');
const { withErrorHandler, CustomAppError } = require('../shared/errorHandler');
const { logger } = require('../shared/logger');
const { classifyFood } = require('./classify');
const { checkCache, storeCache } = require('./cache');

const log = logger.createNamedLogger('foodRecognize');

/**
 * 云函数入口
 * @param {object} event - 请求事件对象
 * @param {string} event.imageFileID - 待识别图片的云文件 ID
 * @param {object} context - 云函数上下文
 */
exports.main = async (event, context) => {
  return withErrorHandler(
    async () => {
      const startTime = Date.now();

      log.info('foodRecognize 被调用', {
        hasImage: !!event.imageFileID,
        hasBase64: !!event.imageBase64,
      });

      // 获取图片数据（支持 fileID 和 base64 两种输入）
      let imageBase64 = null;
      let imageFileID = null;

      if (event.imageBase64) {
        imageBase64 = event.imageBase64;
        imageFileID = 'direct_base64';
      } else if (event.imageFileID) {
        imageFileID = event.imageFileID;

        // 获取云存储文件临时 URL
        const tempResult = await cloud.getTempFileURL({
          fileList: [imageFileID],
        });

        const fileInfo = tempResult.fileList[0];
        if (!fileInfo || !fileInfo.tempFileURL) {
          throw new CustomAppError(6001, '图片文件不存在或已过期');
        }

        // 下载图片并转为 base64
        const https = require('https');
        const http = require('http');
        imageBase64 = await downloadImageToBase64(fileInfo.tempFileURL);
      } else {
        throw new CustomAppError(1002, '缺少必要参数: imageFileID 或 imageBase64');
      }

      // ========================================
      // 缓存检查（基于 fileID 哈希）
      // ========================================
      const { createHash } = require('crypto');
      const imageHash = createHash('md5').update(imageBase64).digest('hex');

      const cachedResult = await checkCache(imageHash);
      if (cachedResult) {
        log.info('命中缓存，返回缓存结果', { imageHash });
        return createResponse({
          ...cachedResult,
          fromCache: true,
          processingTime: Date.now() - startTime,
        });
      }

      // ========================================
      // 调用 PP-ShiTuV2 服务
      // ========================================
      const endpoint = process.env.PPSHITU_ENDPOINT || 'https://your-ppshituv2-url/';
      const recognitionResult = await callPPSHiTuV2(endpoint, imageBase64);

      // 判断是否为食物
      if (recognitionResult.confidence < 0.3) {
        log.warn('未识别到食物，置信度过低', { confidence: recognitionResult.confidence });
        throw new CustomAppError(3001, '未识别到食物，请重新拍摄清晰的食物照片');
      }

      // 分类映射
      const foodType = classifyFood(recognitionResult.foodName);

      // 组装结果
      const result = {
        recognized: true,
        foodName: recognitionResult.foodName,
        confidence: recognitionResult.confidence,
        foodType,
        alternatives: recognitionResult.alternatives || [],
        nutrition: recognitionResult.nutrition || {
          calories_per_100g: 150,
          protein: 5.0,
          fat: 5.0,
          carbs: 20.0,
        },
      };

      // 缓存结果（24小时）
      await storeCache(imageHash, result);

      log.info('食物识别完成', {
        foodName: result.foodName,
        foodType,
        confidence: result.confidence,
        processingTime: Date.now() - startTime,
      });

      return createResponse(result);
    },
    { functionName: 'foodRecognize' }
  );
};

/**
 * 下载图片并转为 base64
 * @param {string} url - 图片 URL
 * @returns {Promise<string>} base64 编码的图片数据
 */
function downloadImageToBase64(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? require('https') : require('http');
    const req = protocol.get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new CustomAppError(6001, `下载图片失败: HTTP ${res.statusCode}`));
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length > 10 * 1024 * 1024) {
          reject(new CustomAppError(6002, '图片大小超过 10MB 限制'));
          return;
        }
        resolve(buffer.toString('base64'));
      });
    });

    req.on('error', (err) => reject(new CustomAppError(6001, `下载图片失败: ${err.message}`)));
    req.on('timeout', () => {
      req.destroy();
      reject(new CustomAppError(4001, '下载图片超时'));
    });
  });
}

/**
 * 调用 PP-ShiTuV2 服务
 * @param {string} endpoint - 服务端点 URL
 * @param {string} imageBase64 - base64 图片数据
 * @param {number} retries - 剩余重试次数
 * @returns {Promise<object>} 识别结果
 */
async function callPPSHiTuV2(endpoint, imageBase64, retries = 2) {
  const url = endpoint.replace(/\/$/, '') + '/predict';

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await httpPost(url, {
        image_base64: imageBase64,
      });

      if (response.error) {
        throw new Error(response.message || 'PP-ShiTuV2 服务返回错误');
      }

      return response;
    } catch (error) {
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000; // 指数退避: 1s, 2s, 4s
        log.warn(`PP-ShiTuV2 调用失败，${delay}ms 后重试 (${attempt + 1}/${retries + 1})`, {
          error: error.message,
        });
        await new Promise((r) => setTimeout(r, delay));
      } else {
        log.error('PP-ShiTuV2 调用最终失败', { error: error.message });
        throw new CustomAppError(3004, '食物识别服务暂时不可用，请稍后再试');
      }
    }
  }
}

/**
 * HTTP POST 请求
 * @param {string} url - 请求 URL
 * @param {object} data - JSON 请求体
 * @returns {Promise<object>} 响应数据
 */
function httpPost(url, data) {
  return new Promise((resolve, reject) => {
    const { URL } = require('url');
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const httpModule = isHttps ? require('https') : require('http');

    const postData = JSON.stringify(data);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 50000,
    };

    const req = httpModule.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error(`无效的 JSON 响应: ${body.substring(0, 200)}`));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`HTTP 请求失败: ${err.message}`)));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    req.write(postData);
    req.end();
  });
}
