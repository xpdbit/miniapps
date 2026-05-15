/**
 * getLocationByIP 云函数
 * HTTP 触发 — 调用 QQ 地图 IP 定位 API 获取用户位置
 *
 * 触发方式: HTTP (GET / POST)
 * 超时: 5s  |  内存: 128MB
 *
 * QQ Maps API 文档:
 * https://lbs.qq.com/service/webService/webServiceGuide/webServiceIp
 *
 * 请求示例:
 * https://apis.map.qq.com/ws/location/v1/ip?ip=123.123.123.123&key=YOUR_KEY
 */

const https = require('https');
const { createResponse, createErrorResponse } = require('../shared/response');
const { withErrorHandler, CustomAppError } = require('../shared/errorHandler');
const { logger } = require('../shared/logger');
const { getApiKey } = require('../shared/apiKeyResolver');

const log = logger.createNamedLogger('getLocationByIP');

/** QQ Maps IP 定位 API 地址 */
const QQ_MAP_IP_URL = 'https://apis.map.qq.com/ws/location/v1/ip';

/** 外部请求超时（毫秒） */
const REQUEST_TIMEOUT = 4000;

/**
 * 使用 Node.js https 模块发起 GET 请求
 *
 * @param {string} url - 完整请求 URL
 * @returns {Promise<object>} 解析后的 JSON 响应
 */
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (parseError) {
          reject(new Error(`解析响应 JSON 失败: ${parseError.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`HTTP 请求失败: ${error.message}`));
    });

    req.setTimeout(REQUEST_TIMEOUT, () => {
      req.destroy();
      reject(new Error(`HTTP 请求超时 (${REQUEST_TIMEOUT}ms)`));
    });
  });
}

/**
 * 云函数入口
 * @param {object} event - 请求事件
 * @param {string} [event.ip] - 待查询 IP 地址（不传则取客户端 IP）
 * @param {object} context - 云函数上下文
 */
exports.main = async (event, context) => {
  return withErrorHandler(
    async () => {
      const ip = event.ip || (context && context.sourceIp) || '';

      log.info('IP 定位函数被调用', { ip });

      // ----- 1. 获取 QQ Maps API Key -----
      // 优先从云函数环境变量读取，其次从数据库 api_keys 集合获取
      let qqMapKey = process.env.QQ_MAP_KEY || '';

      if (!qqMapKey) {
        const dbKey = await getApiKey('qq_map', 300000); // 5 分钟缓存
        if (dbKey) {
          qqMapKey = dbKey;
        }
      }

      if (!qqMapKey) {
        throw new CustomAppError(1006, 'QQ Maps API Key 未配置，请在云函数环境变量中设置 QQ_MAP_KEY');
      }

      // ----- 2. 构造请求 URL -----
      const params = new URLSearchParams({ key: qqMapKey, output: 'json' });
      if (ip) {
        params.append('ip', ip);
      }
      const requestUrl = `${QQ_MAP_IP_URL}?${params.toString()}`;

      // ----- 3. 发起 HTTP 请求 -----
      log.info('正在请求 QQ Maps IP 定位 API');
      const response = await httpsGet(requestUrl);

      // ----- 4. 解析响应 -----
      // QQ Maps 响应格式:
      // {
      //   status: 0,        // 0 表示成功
      //   message: "query ok",
      //   result: {
      //     ip: "123.123.123.123",
      //     location: { lat: 22.5431, lng: 114.0579 },
      //     ad_info: { nation: "中国", province: "广东省", city: "深圳市", district: "南山区" }
      //   }
      // }
      if (response.status !== 0) {
        throw new CustomAppError(
          1006,
          `QQ Maps 接口返回错误: ${response.message}`,
          { status: response.status },
        );
      }

      const result = response.result;
      if (!result) {
        throw new CustomAppError(1006, 'QQ Maps 接口返回数据为空');
      }

      const location = {
        ip: result.ip || ip || 'unknown',
        province: (result.ad_info && result.ad_info.province) || '',
        city: (result.ad_info && result.ad_info.city) || '',
        district: (result.ad_info && result.ad_info.district) || '',
        lat: (result.location && result.location.lat) || 0,
        lng: (result.location && result.location.lng) || 0,
        isp: result.isp || '',
      };

      log.info('IP 定位完成', { city: location.city, province: location.province });

      return createResponse(location);
    },
    { functionName: 'getLocationByIP' }
  );
};
