/**
 * API Key 解析器
 * 从数据库 api_keys 集合中按 serviceName 读取 API Key
 * 内置内存缓存机制避免频繁查询数据库
 */

const { logger } = require('./logger');

/** 内存缓存：Map<serviceName, { apiKey, expiresAt }> */
const cache = new Map();

/** 默认缓存 TTL：5 分钟（毫秒） */
const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

/**
 * 获取 CloudBase 数据库实例
 * @returns {object} database 实例
 */
function getDb() {
  const cloud = require('wx-server-sdk');
  cloud.init();
  return cloud.database();
}

/**
 * 从数据库 api_keys 集合中获取 API Key（跳过缓存）
 * @param {string} serviceName - 服务名称 (如 'hunyuan', 'ppshitU')
 * @returns {Promise<string|null>} API Key 或 null
 */
async function fetchApiKeyFromDB(serviceName) {
  try {
    const db = getDb();
    const result = await db
      .collection('api_keys')
      .where({
        serviceName,
        isActive: true,
      })
      .field({ apiKey: true })
      .get();

    if (result.data && result.data.length > 0) {
      return result.data[0].apiKey;
    }

    logger.warn(`未找到服务 "${serviceName}" 的有效 API Key`);
    return null;
  } catch (error) {
    logger.error(`从数据库获取 API Key 失败 [${serviceName}]: ${error.message}`);
    return null;
  }
}

/**
 * 获取 API Key（自动缓存）
 * 先查内存缓存，未命中或过期则回源数据库
 *
 * @param {string} serviceName - 服务名称
 * @param {number} [cacheTTL] - 缓存有效期（毫秒），默认 5 分钟
 * @returns {Promise<string|null>} API Key 或 null
 */
async function getApiKey(serviceName, cacheTTL = DEFAULT_CACHE_TTL) {
  const cached = cache.get(serviceName);

  if (cached && cached.expiresAt > Date.now()) {
    logger.info(`使用缓存的 API Key [${serviceName}]`);
    return cached.apiKey;
  }

  const apiKey = await fetchApiKeyFromDB(serviceName);
  if (apiKey) {
    cache.set(serviceName, {
      apiKey,
      expiresAt: Date.now() + cacheTTL,
    });
  }

  return apiKey;
}

/**
 * 清除指定服务的 API Key 缓存
 * @param {string} serviceName - 服务名称
 */
function clearCache(serviceName) {
  cache.delete(serviceName);
  logger.info(`已清除 API Key 缓存 [${serviceName}]`);
}

/**
 * 清除所有 API Key 缓存
 */
function clearAllCache() {
  cache.clear();
  logger.info('已清除所有 API Key 缓存');
}

module.exports = {
  getApiKey,
  clearCache,
  clearAllCache,
};
