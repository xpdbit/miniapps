/**
 * 食物识别结果缓存
 * 基于图片 MD5 哈希，24小时有效
 * 存储至 food_recognize_cache 集合
 */

const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();
const { logger } = require('../shared/logger');
const log = logger.createNamedLogger('foodRecognizeCache');

/** 缓存 TTL (毫秒) */
const CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * 检查缓存
 * @param {string} imageHash - 图片 MD5 哈希
 * @returns {Promise<object|null>} 缓存的识别结果或 null
 */
async function checkCache(imageHash) {
  if (!imageHash) return null;

  try {
    const result = await db
      .collection('food_recognize_cache')
      .where({ imageHash })
      .limit(1)
      .get();

    const docs = result.data || [];
    if (docs.length === 0) {
      return null;
    }

    const cached = docs[0];

    // 检查是否过期
    if (cached.expiresAt && Date.now() > cached.expiresAt) {
      log.info('缓存已过期，删除过期记录', { imageHash });
      try {
        await db.collection('food_recognize_cache').doc(cached._id).remove();
      } catch {
        // 忽略删除错误
      }
      return null;
    }

    log.info('缓存命中', { imageHash, cachedAt: cached.cachedAt });
    return cached.result;
  } catch (error) {
    log.warn('缓存查询失败，继续正常流程', { error: error.message });
    return null;
  }
}

/**
 * 存储缓存
 * @param {string} imageHash - 图片 MD5 哈希
 * @param {object} result - 识别结果
 */
async function storeCache(imageHash, result) {
  if (!imageHash || !result) return;

  try {
    const now = Date.now();
    const data = {
      imageHash,
      result,
      cachedAt: now,
      expiresAt: now + CACHE_TTL,
    };

    // 使用 upsert 模式避免重复
    const existing = await db
      .collection('food_recognize_cache')
      .where({ imageHash })
      .limit(1)
      .get();

    if (existing.data && existing.data.length > 0) {
      await db
        .collection('food_recognize_cache')
        .doc(existing.data[0]._id)
        .update({ data });
    } else {
      await db.collection('food_recognize_cache').add({ data });
    }

    log.info('缓存已存储', { imageHash });
  } catch (error) {
    log.warn('缓存存储失败，不影响主流程', { error: error.message });
  }
}

module.exports = { checkCache, storeCache };
