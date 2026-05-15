/**
 * manageApiKey 云函数
 * 前端可调用 — API Key 管理（加密/存储/验证/删除）
 *
 * 超时: 10s  |  内存: 256MB
 */

const cloud = require('wx-server-sdk');
const { createResponse, createErrorResponse } = require('../shared/response');
const { withErrorHandler, CustomAppError } = require('../shared/errorHandler');
const { logger } = require('../shared/logger');
const { clearCache } = require('../shared/apiKeyResolver');

// ============================================================
// CloudBase 初始化
// ============================================================
cloud.init();
const db = cloud.database();

const log = logger.createNamedLogger('manageApiKey');

// ============================================================
// 简单 XOR + Base64 加密（开发阶段使用，生产环境应替换为 AES-256）
// ============================================================
const XOR_KEY = 'FoodThemeGen2024!';

/**
 * 使用 XOR 异或加密文本
 * @param {string} text - 明文
 * @returns {string} Base64 编码的密文
 */
function encrypt(text) {
  if (!text) return '';
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const keyChar = XOR_KEY.charCodeAt(i % XOR_KEY.length);
    result += String.fromCharCode(text.charCodeAt(i) ^ keyChar);
  }
  return Buffer.from(result, 'utf-8').toString('base64');
}

/**
 * 解密 XOR + Base64 密文
 * @param {string} encoded - Base64 编码的密文
 * @returns {string} 明文
 */
function decrypt(encoded) {
  if (!encoded) return '';
  const text = Buffer.from(encoded, 'base64').toString('utf-8');
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const keyChar = XOR_KEY.charCodeAt(i % XOR_KEY.length);
    result += String.fromCharCode(text.charCodeAt(i) ^ keyChar);
  }
  return result;
}

/**
 * 将 API Key 脱敏展示（仅显示前3后4位）
 * @param {string} key - 原始 API Key
 * @returns {string} 脱敏后的 Key（如 sk-****abcd）
 */
function maskApiKey(key) {
  if (!key) return '****';
  if (key.length <= 8) {
    return key.substring(0, 3) + '****';
  }
  return key.substring(0, 3) + '****' + key.substring(key.length - 4);
}

/**
 * 获取 PP-ShiTuV2 服务状态
 * @returns {Promise<{available: boolean, lastChecked: string}>}
 */
async function checkPpShiTuStatus() {
  try {
    // 通过查询 ppshitu 服务 key 是否存在且活跃来判断服务配置状态
    const result = await db
      .collection('api_keys')
      .where({ serviceName: 'ppshitu', isActive: true })
      .limit(1)
      .get();

    const now = new Date().toISOString();
    return {
      available: result.data && result.data.length > 0,
      lastChecked: now,
    };
  } catch {
    return { available: false, lastChecked: new Date().toISOString() };
  }
}

/**
 * 查询用户的 Hunyuan API Key（解密后脱敏返回）
 * @param {string} openid
 * @returns {Promise<{hasKey: boolean, maskedKey: string|null, lastUsed: string|null}>}
 */
async function getHunyuanKeyInfo(openid) {
  try {
    const result = await db
      .collection('api_keys')
      .where({ openid, serviceName: 'hunyuan' })
      .limit(1)
      .get();

    if (!result.data || result.data.length === 0) {
      // 检查系统级别默认 key
      const systemResult = await db
        .collection('api_keys')
        .where({ openid: 'SYSTEM', serviceName: 'hunyuan', isActive: true })
        .limit(1)
        .get();

      if (!systemResult.data || systemResult.data.length === 0) {
        return { hasKey: false, maskedKey: null, lastUsed: null };
      }

      const doc = systemResult.data[0];
      let decrypted = '';
      try {
        decrypted = decrypt(doc.apiKey);
      } catch {
        decrypted = doc.apiKey || '';
      }
      return { hasKey: true, maskedKey: maskApiKey(decrypted), lastUsed: doc.lastUsed || null };
    }

    const doc = result.data[0];
    let decrypted = '';
    try {
      decrypted = decrypt(doc.apiKey);
    } catch {
      decrypted = doc.apiKey || '';
    }
    return { hasKey: true, maskedKey: maskApiKey(decrypted), lastUsed: doc.lastUsed || null };
  } catch (error) {
    log.error('查询 Hunyuan Key 失败', { error: error.message });
    return { hasKey: false, maskedKey: null, lastUsed: null };
  }
}

/**
 * 保存 Hunyuan API Key（加密后存储）
 * @param {string} openid
 * @param {string} apiKey - 明文 API Key
 * @returns {Promise<object>}
 */
async function saveHunyuanKey(openid, apiKey) {
  if (!apiKey) {
    throw new CustomAppError(1002, '缺少 API Key');
  }
  if (apiKey.length < 8) {
    throw new CustomAppError(1002, 'API Key 长度不足，请检查输入');
  }

  const encrypted = encrypt(apiKey);
  const now = new Date().toISOString();

  const existing = await db
    .collection('api_keys')
    .where({ openid, serviceName: 'hunyuan' })
    .limit(1)
    .get();

  if (existing.data && existing.data.length > 0) {
    await db.collection('api_keys').doc(existing.data[0]._id).update({
      data: {
        apiKey: encrypted,
        isActive: true,
        lastUsed: now,
      },
    });
    log.info('更新 Hunyuan API Key', { openid });
  } else {
    await db.collection('api_keys').add({
      data: {
        openid,
        serviceName: 'hunyuan',
        apiKey: encrypted,
        isActive: true,
        createdAt: now,
        lastUsed: now,
      },
    });
    log.info('创建 Hunyuan API Key', { openid });
  }

  // 清除缓存，使新 key 立即生效
  clearCache('hunyuan');

  return { saved: true, serviceName: 'hunyuan' };
}

/**
 * 删除用户的 Hunyuan API Key
 * @param {string} openid
 * @returns {Promise<object>}
 */
async function deleteHunyuanKey(openid) {
  const existing = await db
    .collection('api_keys')
    .where({ openid, serviceName: 'hunyuan' })
    .limit(1)
    .get();

  if (existing.data && existing.data.length > 0) {
    await db.collection('api_keys').doc(existing.data[0]._id).remove();
    log.info('删除 Hunyuan API Key', { openid });
  }

  clearCache('hunyuan');

  return { deleted: true, serviceName: 'hunyuan' };
}

/**
 * 测试 Hunyuan API Key 连接
 * 向混元 API 发送一个简单请求验证 Key 的有效性
 * @param {string} openid
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function testHunyuanConnection(openid) {
  // 从数据库获取解密后的 Key
  const result = await db
    .collection('api_keys')
    .where({ openid, serviceName: 'hunyuan', isActive: true })
    .limit(1)
    .get();

  let rawKey = '';
  if (result.data && result.data.length > 0) {
    try {
      rawKey = decrypt(result.data[0].apiKey);
    } catch {
      rawKey = result.data[0].apiKey || '';
    }
  }

  if (!rawKey) {
    return { success: false, message: '未找到有效的 API Key，请先保存' };
  }

  log.info('开始测试 Hunyuan 连接');

  try {
    // 调用 Hunyuan API 进行简单验证
    const response = await callHunyuanApi(rawKey);

    if (response.success) {
      // 更新最后使用时间
      if (result.data && result.data.length > 0) {
        await db.collection('api_keys').doc(result.data[0]._id).update({
          data: { lastUsed: new Date().toISOString() },
        });
      }

      return { success: true, message: '连接成功，API Key 有效' };
    }

    if (response.code === 401 || response.code === 403) {
      return { success: false, message: 'API Key 无效或已过期，请检查后重试' };
    }

    return { success: false, message: '连接失败: ' + (response.error || '未知错误') };
  } catch (error) {
    log.error('Hunyuan 连接测试失败', { error: error.message });
    return { success: false, message: '连接失败: ' + error.message };
  }
}

/**
 * 向腾讯混元 API 发送测试请求
 * @param {string} apiKey - 明文 API Key
 * @returns {Promise<object>}
 */
function callHunyuanApi(apiKey) {
  return new Promise((resolve) => {
    const https = require('https');
    const postData = JSON.stringify({
      model: 'hunyuan-lite',
      messages: [
        {
          role: 'user',
          content: '你好',
        },
      ],
      max_tokens: 16,
      stream: false,
    });

    const options = {
      hostname: 'api.hunyuan.cloud.tencent.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 8000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, data: parsed });
          } else {
            resolve({
              success: false,
              code: res.statusCode,
              error: parsed.error?.message || parsed.error || '请求失败',
            });
          }
        } catch {
          resolve({ success: false, code: res.statusCode, error: '响应解析失败' });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ success: false, code: 0, error: error.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, code: 0, error: '连接超时' });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * 云函数入口
 * @param {object} event
 * @param {string} event.action - 'getKey' | 'saveKey' | 'deleteKey' | 'testConnection'
 * @param {object} context - 云函数上下文
 */
exports.main = async (event, context) => {
  return withErrorHandler(
    async () => {
      const { action } = event;

      // 获取调用者 openid
      const wxContext = cloud.getWXContext();
      const openid = wxContext.OPENID || 'SYSTEM';

      log.info('API Key 管理函数被调用', { action, openid });

      switch (action) {
        case 'getKey': {
          // 查询 PP-ShiTuV2 服务状态和 Hunyuan Key 信息
          const [ppshituStatus, hunyuanInfo] = await Promise.all([
            checkPpShiTuStatus(),
            getHunyuanKeyInfo(openid),
          ]);

          return createResponse({
            ppshiTuStatus: {
              available: ppshituStatus.available,
              lastChecked: ppshituStatus.lastChecked,
            },
            hunyuanStatus: {
              hasKey: hunyuanInfo.hasKey,
              maskedKey: hunyuanInfo.maskedKey,
              lastUsed: hunyuanInfo.lastUsed,
              lastChecked: new Date().toISOString(),
            },
          });
        }

        case 'saveKey': {
          const { apiKey } = event;
          if (!apiKey) {
            throw new CustomAppError(1002, '缺少 API Key');
          }
          const result = await saveHunyuanKey(openid, apiKey);
          return createResponse(result);
        }

        case 'deleteKey': {
          const result = await deleteHunyuanKey(openid);
          return createResponse(result);
        }

        case 'testConnection': {
          const result = await testHunyuanConnection(openid);
          return createResponse(result);
        }

        default:
          return createResponse({ action: action || 'unknown', handled: false });
      }
    },
    { functionName: 'manageApiKey' },
  );
};
