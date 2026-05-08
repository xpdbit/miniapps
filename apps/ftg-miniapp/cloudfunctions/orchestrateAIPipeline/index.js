/**
 * orchestrateAIPipeline 云函数 — AI 流水线编排
 *
 * 全自动管理 AI 处理工作流：
 *   1. 预处理图像（验证云文件 ID）
 *   2. 调用 foodRecognize 识别食物
 *   3. 调用 textGenerate 生成文本
 *   4. 等待客户端完成 Canvas 合成
 *   5. 前端轮询获取聚合结果
 *
 * 支持两种调用模式：
 *   - 主编排：传入 imageFileID，按状态机逐步执行
 *   - 状态查询：传入 action='getStatus' + pipelineId
 *   - 完成确认：传入 action='complete' + pipelineId + composeResult
 *
 * 每个步骤最多重试 3 次（指数退避：1s / 2s / 4s），
 * 所有状态变更实时写入 pipeline_status 集合供前端轮询。
 *
 * 触发方式: CloudCallFunction
 * 超时: 60s  |  内存: 512MB
 */

const cloud = require('wx-server-sdk');
cloud.init();

const { createResponse } = require('../shared/response');
const { withErrorHandler, CustomAppError } = require('../shared/errorHandler');
const { logger } = require('../shared/logger');

const log = logger.createNamedLogger('orchestrateAIPipeline');

// ============================================================
// 数据库
// ============================================================
const db = cloud.database();
const PIPELINE_COLLECTION = 'pipeline_status';

// ============================================================
// 状态常量
// ============================================================
const STATUS = {
  QUEUED: 'queued',
  PREPROCESSING: 'preprocessing',
  RECOGNIZING: 'recognizing',
  GENERATING: 'generating',
  COMPOSING: 'composing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

/** 进度映射（每个阶段对应的百分比） */
const PROGRESS_MAP = {
  [STATUS.QUEUED]: 0,
  [STATUS.PREPROCESSING]: 10,
  [STATUS.RECOGNIZING]: 30,
  [STATUS.GENERATING]: 55,
  [STATUS.COMPOSING]: 80,
  [STATUS.COMPLETED]: 100,
  [STATUS.FAILED]: 0,
};

// ============================================================
// 重试配置
// ============================================================
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // 指数退避: 1s, 2s, 4s

// ============================================================
// 入口
// ============================================================

/**
 * 云函数入口
 *
 * @param {object} event
 * @param {string} event.imageFileID - 待处理图片的云文件 ID（主编排模式）
 * @param {string} event.action      - 操作类型: 'getStatus' | 'complete'
 * @param {string} event.pipelineId  - 管道 ID（查询 / 完成模式必需）
 * @param {object} event.composeResult - 客户端合成结果（complete 模式必需）
 * @param {object} context           - 云函数上下文
 */
exports.main = async (event, context) => {
  return withErrorHandler(
    async () => {
      const { imageFileID, action, pipelineId, composeResult } = event;

      // ---- 模式 1：状态查询 ----
      if (action === 'getStatus') {
        return handleGetStatus(pipelineId);
      }

      // ---- 模式 2：完成确认（客户端 Canvas 合成完毕） ----
      if (action === 'complete') {
        return handleComplete(pipelineId, composeResult);
      }

      // ---- 模式 3：主编排 ----
      if (!imageFileID) {
        throw new CustomAppError(1002, '缺少必要参数: imageFileID');
      }

      return handleOrchestration(imageFileID);
    },
    { functionName: 'orchestrateAIPipeline' },
  );
};

// ============================================================
// 状态查询处理
// ============================================================

/**
 * 查询管道当前状态
 * @param {string} pipelineId
 */
async function handleGetStatus(pipelineId) {
  if (!pipelineId) {
    throw new CustomAppError(1002, '缺少必要参数: pipelineId');
  }

  const doc = await db.collection(PIPELINE_COLLECTION).doc(pipelineId).get();
  const data = doc.data;

  if (!data) {
    throw new CustomAppError(1003, '管道记录不存在');
  }

  log.info('状态查询', { pipelineId, status: data.status });
  return createResponse(data);
}

// ============================================================
// 完成确认处理
// ============================================================

/**
 * 客户端完成 Canvas 合成后确认完成
 * @param {string} pipelineId
 * @param {object} composeResult - { resultFileID: string, width: number, height: number, processingTime: number }
 */
async function handleComplete(pipelineId, composeResult) {
  if (!pipelineId) {
    throw new CustomAppError(1002, '缺少必要参数: pipelineId');
  }

  // 校验当前状态
  const doc = await db.collection(PIPELINE_COLLECTION).doc(pipelineId).get();
  const data = doc.data;

  if (!data) {
    throw new CustomAppError(1003, '管道记录不存在');
  }

  if (data.status !== STATUS.COMPOSING) {
    throw new CustomAppError(1001, `当前状态不允许完成操作: ${data.status}`);
  }

  const now = db.serverDate();

  await db.collection(PIPELINE_COLLECTION).doc(pipelineId).update({
    data: {
      status: STATUS.COMPLETED,
      progress: PROGRESS_MAP[STATUS.COMPLETED],
      step: '主题合成完成',
      result: composeResult || null,
      updatedAt: now,
    },
  });

  log.info('管道完成', { pipelineId, composeResult });

  return createResponse({
    pipelineId,
    status: STATUS.COMPLETED,
    composeResult: composeResult || null,
  });
}

// ============================================================
// 主编排逻辑
// ============================================================

/**
 * 执行完整的 AI 流水线编排
 * @param {string} imageFileID
 */
async function handleOrchestration(imageFileID) {
  // ---- 初始化管道 ----
  const pipelineId = generatePipelineId();
  const now = db.serverDate();

  await db.collection(PIPELINE_COLLECTION).add({
    data: {
      pipelineId,
      status: STATUS.QUEUED,
      progress: PROGRESS_MAP[STATUS.QUEUED],
      step: '任务已加入队列',
      imageFileID,
      result: null,
      error: null,
      startedAt: now,
      updatedAt: now,
    },
  });

  log.info('管道初始化完成', { pipelineId, imageFileID });

  try {
    // ========================================
    // Step 1 - 图像预处理
    // ========================================
    await updatePipelineStatus(pipelineId, STATUS.PREPROCESSING, '验证图像文件中...');
    const preprocessed = await withRetry(
      () => preprocessImage(imageFileID),
      '图像预处理',
      pipelineId,
    );
    log.info('Step 1 完成: 图像预处理', { pipelineId });

    // ========================================
    // Step 2 - 食物识别
    // ========================================
    await updatePipelineStatus(pipelineId, STATUS.RECOGNIZING, 'AI 正在识别食物...');
    const recognized = await withRetry(
      () => callCloudFunction('foodRecognize', { imageFileID }),
      '食物识别',
      pipelineId,
    );
    log.info('Step 2 完成: 食物识别', {
      pipelineId,
      foodName: recognized.foodName,
    });

    // ========================================
    // Step 3 - AI 文本生成（依赖 Step 2 结果）
    // ========================================
    await updatePipelineStatus(pipelineId, STATUS.GENERATING, 'AI 正在生成描述...');
    const generated = await withRetry(
      () =>
        callCloudFunction('textGenerate', {
          foodName: recognized.foodName,
          foodType: recognized.foodType,
        }),
      '文本生成',
      pipelineId,
    );
    log.info('Step 3 完成: 文本生成', { pipelineId });

    // ========================================
    // Step 4 - 返回聚合结果，等待客户端 Canvas 合成
    // ========================================
    const aggregatedResult = {
      pipelineId,
      foodName: recognized.foodName,
      foodType: recognized.foodType,
      confidence: recognized.confidence,
      alternatives: recognized.alternatives || [],
      nutrition: recognized.nutrition || null,
      aiDescription: generated,
      imageFileID,
    };

    await db.collection(PIPELINE_COLLECTION).doc(pipelineId).update({
      data: {
        status: STATUS.COMPOSING,
        progress: PROGRESS_MAP[STATUS.COMPOSING],
        step: '等待客户端主题合成...',
        foodName: recognized.foodName,
        foodType: recognized.foodType,
        confidence: recognized.confidence,
        alternatives: recognized.alternatives || [],
        nutrition: recognized.nutrition || null,
        aiDescription: generated,
        updatedAt: db.serverDate(),
      },
    });

    log.info('Step 4 完成: 等待客户端合成', { pipelineId });

    return createResponse(aggregatedResult);
  } catch (error) {
    // ---- 任一步骤重试耗尽 → 标记失败 ----
    const errorInfo = {
      message: error.message || '未知错误',
      errCode: error.errCode || 1000,
      step: error.step || null,
    };

    await db
      .collection(PIPELINE_COLLECTION)
      .doc(pipelineId)
      .update({
        data: {
          status: STATUS.FAILED,
          progress: PROGRESS_MAP[STATUS.FAILED],
          step: '处理失败',
          error: errorInfo,
          updatedAt: db.serverDate(),
        },
      });

    log.error('管道执行失败', { pipelineId, error: errorInfo });

    // 重新抛出，让 withErrorHandler 生成标准错误响应
    throw new CustomAppError(error.errCode || 1000, error.message || '管道处理失败');
  }
}

// ============================================================
// 子步骤
// ============================================================

/**
 * 图像预处理：验证云文件 ID 是否有效并可访问
 * @param {string} imageFileID
 * @returns {Promise<{fileID: string, size: number}>}
 */
async function preprocessImage(imageFileID) {
  const fileResult = await cloud.getTempFileURL({
    fileList: [imageFileID],
  });

  const fileInfo = fileResult.fileList[0];
  if (!fileInfo || !fileInfo.tempFileURL) {
    throw new CustomAppError(6001, '图片文件不存在或已过期');
  }

  // 检查文件是否存在且非空（通过 HEAD 请求验证）
  const https = require('https');
  const http = require('http');
  const protocol = fileInfo.tempFileURL.startsWith('https') ? https : http;

  await new Promise((resolve, reject) => {
    const req = protocol.request(
      fileInfo.tempFileURL,
      { method: 'HEAD', timeout: 10000 },
      (res) => {
        if (res.statusCode === 200 || res.statusCode === 302) {
          resolve();
        } else {
          reject(new CustomAppError(6001, `图片文件不可访问: HTTP ${res.statusCode}`));
        }
        res.resume();
      },
    );
    req.on('error', (err) => reject(new CustomAppError(6001, `图片验证失败: ${err.message}`)));
    req.on('timeout', () => {
      req.destroy();
      reject(new CustomAppError(4001, '图片验证超时'));
    });
    req.end();
  });

  return { fileID: imageFileID };
}

/**
 * 调用其他云函数
 * @param {string} functionName - 目标云函数名称
 * @param {object} data - 传递给目标云函数的参数
 * @returns {Promise<object>} 目标云函数返回的 data 字段
 */
async function callCloudFunction(functionName, data) {
  const res = await cloud.callFunction({
    name: functionName,
    data,
  });

  const result = res.result;

  // 标准响应格式检查
  if (result && result.success === false) {
    throw new CustomAppError(result.errCode || 1000, `[${functionName}] ${result.errMsg}`);
  }

  // 如果返回的是标准响应格式，提取 data
  if (result && typeof result === 'object' && 'success' in result) {
    return result.data;
  }

  // 直接返回值
  return result;
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 生成唯一管道 ID (32 位字符串)
 * @returns {string}
 */
function generatePipelineId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'pipe_';
  for (let i = 0; i < 26; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // 追加时间戳后缀避免碰撞
  id += '_' + Date.now().toString(36);
  return id;
}

/**
 * 更新管道状态并写入数据库
 * @param {string} pipelineId
 * @param {string} status - 新状态
 * @param {string} step - 步骤描述
 */
async function updatePipelineStatus(pipelineId, status, step) {
  const progress = PROGRESS_MAP[status] !== undefined ? PROGRESS_MAP[status] : 0;

  await db.collection(PIPELINE_COLLECTION).doc(pipelineId).update({
    data: {
      status,
      progress,
      step,
      updatedAt: db.serverDate(),
    },
  });

  log.info('状态更新', { pipelineId, status, progress, step });
}

/**
 * 带指数退避重试的执行包装
 *
 * @param {Function} fn - 异步执行函数
 * @param {string} stepName - 步骤名称（用于日志）
 * @param {string} pipelineId - 管道 ID
 * @returns {Promise<*>} fn 的返回值
 */
async function withRetry(fn, stepName, pipelineId) {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[attempt] || 4000;
        log.warn(`[${stepName}] 执行失败，${delay}ms 后重试`, {
          pipelineId,
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES + 1,
          error: error.message,
        });
        await sleep(delay);
      }
    }
  }

  // 所有重试耗尽
  log.error(`[${stepName}] 所有重试均已耗尽`, {
    pipelineId,
    error: lastError.message,
  });

  const err = new Error(`[${stepName}] ${lastError.message}`);
  err.errCode = lastError.errCode || 1000;
  err.step = stepName;
  throw err;
}

/**
 * 延时工具
 * @param {number} ms - 毫秒
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
