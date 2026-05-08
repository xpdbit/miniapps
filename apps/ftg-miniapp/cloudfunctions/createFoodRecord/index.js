/**
 * createFoodRecord 云函数
 * 三种操作模式：
 *   - create:    原子保存食物记录 + 创建打卡 + 更新用户统计
 *   - getRecord: 根据 ID 获取单条食物记录
 *   - softDelete: 软删除食物记录 (isDeleted: true)
 *
 * 调用方式: Taro.cloud.callFunction (前端 → 云函数 → 数据库)
 * 超时: 3s  |  内存: 256MB
 */

const cloud = require('wx-server-sdk');
const { createResponse, createErrorResponse } = require('../shared/response');
const { withErrorHandler, CustomAppError } = require('../shared/errorHandler');
const { logger } = require('../shared/logger');

cloud.init();
const db = cloud.database();
const _ = db.command;

const log = logger.createNamedLogger('createFoodRecord');

// ============================================================
// 集合引用
// ============================================================
const foodRecordsCollection = db.collection('food_records');
const checkinsCollection = db.collection('checkins');
const usersCollection = db.collection('users');

// ============================================================
// 字段验证
// ============================================================

/**
 * 验证创建记录所需的必填字段
 * @param {object} data - 前端传入的记录数据
 * @throws {CustomAppError} 当必填字段缺失时抛出
 */
function validateCreateFields(data) {
  if (!data) {
    throw new CustomAppError(1002, '请求数据不能为空');
  }

  const requiredFields = [
    { key: 'foodName', label: '食物名称' },
    { key: 'foodType', label: '食物类型' },
    { key: 'imageFileID', label: '食物图片' },
    { key: 'themeImageFileID', label: '主题合成图' },
    { key: 'themeId', label: '主题ID' },
  ];

  const missingFields = [];
  for (const field of requiredFields) {
    if (!data[field.key]) {
      missingFields.push(field.label);
    }
  }

  if (missingFields.length > 0) {
    throw new CustomAppError(
      1002,
      `缺少必填字段: ${missingFields.join(', ')}`,
    );
  }

  // 验证 foodType 是否为有效字符串
  const validFoodTypes = [
    'grain', 'vegetable', 'fruit', 'meat', 'seafood',
    'dairy', 'nut', 'snack', 'beverage', 'seasoning',
    'dish', 'other',
  ];
  if (!validFoodTypes.includes(data.foodType)) {
    throw new CustomAppError(1001, '无效的食物类型');
  }
}

// ============================================================
// 操作处理
// ============================================================

/**
 * 创建食物记录 + 打卡 + 更新用户统计（原子操作序列）
 *
 * 由于 CloudBase 暂不支持多文档事务，采用先主记录、再关联记录的
 * 顺序策略。任一失败时记录错误日志，前端收到响应后可决定重试策略。
 *
 * @param {object} eventData - 前端传入的记录数据
 * @param {string} openid - 用户 openid
 * @returns {object} 包含 recordId 的响应
 */
async function handleCreate(eventData, openid) {
  const now = new Date().toISOString();

  const recordData = {
    openid,
    imageFileID: eventData.imageFileID,
    themeImageFileID: eventData.themeImageFileID,
    foodName: eventData.foodName.trim(),
    foodType: eventData.foodType,
    calories: eventData.calories || {
      total: 0, per100g: 0, protein: 0, fat: 0, carbs: 0,
    },
    aiDescription: eventData.aiDescription || {
      short: '', gameStyle: '', detail: '',
    },
    gameDescription: eventData.gameDescription || '',
    latitude: typeof eventData.latitude === 'number' ? eventData.latitude : 0,
    longitude: typeof eventData.longitude === 'number' ? eventData.longitude : 0,
    locationName: eventData.locationName || '',
    ipLocation: eventData.ipLocation || '',
    themeId: eventData.themeId || '',
    remark: eventData.remark || '',
    isDeleted: false,
    createdAt: now,
  };

  log.info('开始创建食物记录', { foodName: recordData.foodName });

  // Step 1: 创建食物记录
  let recordId;
  try {
    const addResult = await foodRecordsCollection.add({
      data: recordData,
    });
    recordId = addResult._id;
    log.info('食物记录创建成功', { recordId });
  } catch (err) {
    log.error('食物记录创建失败', { error: err.message });
    throw new CustomAppError(7000, '食物记录创建失败，请重试');
  }

  // Step 2: 创建打卡记录
  try {
    const checkinData = {
      openid,
      foodRecordId: recordId,
      locationName: recordData.locationName,
      latitude: recordData.latitude,
      longitude: recordData.longitude,
      timestamp: now,
      streakCount: 1,
    };
    await checkinsCollection.add({ data: checkinData });
    log.info('打卡记录创建成功', { recordId });
  } catch (err) {
    // 打卡创建失败不应阻塞主记录保存，仅记录警告
    log.warn('打卡记录创建失败（非致命）', {
      recordId,
      error: err.message,
    });
  }

  // Step 3: 更新用户统计（原子递增）
  try {
    await usersCollection.doc(openid).update({
      data: {
        totalRecords: _.inc(1),
        totalCheckins: _.inc(1),
      },
    });
    log.info('用户统计更新成功', { openid });
  } catch (err) {
    // 用户统计更新失败仅记录警告
    log.warn('用户统计更新失败（非致命）', {
      openid,
      error: err.message,
    });
  }

  return createResponse({ recordId });
}

/**
 * 获取单条食物记录
 *
 * @param {string} recordId - 记录 ID
 * @param {string} openid - 用户 openid（用于权限校验）
 * @returns {object} 食物记录文档
 */
async function handleGetRecord(recordId, openid) {
  if (!recordId) {
    throw new CustomAppError(1002, '缺少记录 ID');
  }

  let doc;
  try {
    const result = await foodRecordsCollection.doc(recordId).get();
    doc = result.data;
  } catch (err) {
    log.warn('获取记录失败', { recordId, error: err.message });
    throw new CustomAppError(1003, '记录不存在');
  }

  if (!doc) {
    throw new CustomAppError(1003, '记录不存在');
  }

  // 权限校验：只允许查看自己的记录
  if (doc.openid !== openid) {
    log.warn('权限校验失败', { recordId, requestOpenid: openid, ownerOpenid: doc.openid });
    throw new CustomAppError(1004, '无权查看此记录');
  }

  return createResponse(doc);
}

/**
 * 软删除食物记录
 *
 * 不物理删除，仅设置 isDeleted = true 并记录删除时间。
 *
 * @param {string} recordId - 记录 ID
 * @param {string} openid - 用户 openid（用于权限校验）
 * @returns {object} 删除结果
 */
async function handleSoftDelete(recordId, openid) {
  if (!recordId) {
    throw new CustomAppError(1002, '缺少记录 ID');
  }

  let doc;
  try {
    const result = await foodRecordsCollection.doc(recordId).get();
    doc = result.data;
  } catch (err) {
    log.warn('删除前查询失败', { recordId, error: err.message });
    throw new CustomAppError(1003, '记录不存在');
  }

  if (!doc) {
    throw new CustomAppError(1003, '记录不存在');
  }

  // 权限校验
  if (doc.openid !== openid) {
    log.warn('删除权限校验失败', { recordId, requestOpenid: openid });
    throw new CustomAppError(1004, '无权删除此记录');
  }

  // 已删除则幂等返回成功
  if (doc.isDeleted) {
    return createResponse({ recordId, alreadyDeleted: true });
  }

  try {
    await foodRecordsCollection.doc(recordId).update({
      data: {
        isDeleted: true,
        deletedAt: new Date().toISOString(),
      },
    });
    log.info('记录软删除成功', { recordId });
  } catch (err) {
    log.error('软删除失败', { recordId, error: err.message });
    throw new CustomAppError(7000, '删除失败，请重试');
  }

  return createResponse({ recordId, deleted: true });
}

// ============================================================
// 云函数入口
// ============================================================

exports.main = async (event, context) => {
  return withErrorHandler(
    async () => {
      const { action, data, recordId } = event;

      log.info('云函数被调用', { action });

      // 获取调用者身份
      const wxContext = cloud.getWXContext();
      const openid = wxContext.OPENID;

      if (!openid) {
        throw new CustomAppError(2000, '无法获取用户身份');
      }

      switch (action) {
        case 'create': {
          validateCreateFields(data);
          return await handleCreate(data, openid);
        }

        case 'getRecord': {
          return await handleGetRecord(recordId, openid);
        }

        case 'softDelete': {
          return await handleSoftDelete(recordId, openid);
        }

        default: {
          throw new CustomAppError(1001, `未知操作: ${action}`);
        }
      }
    },
    { functionName: 'createFoodRecord' },
  );
};
