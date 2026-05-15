/**
 * ============================================================
 * CloudBase 数据库初始化云函数
 * ============================================================
 *
 * 功能：
 *   1. 创建 7 个业务集合（若不存在）
 *   2. 为关键查询路径创建复合索引
 *
 * 执行方式：
 *   - 首次部署后手动调用一次
 *   - 小程序管理后台 -> 云开发 -> 云函数 -> db_init -> 测试调用
 *   - 也可通过定时触发器自动执行（每年1月1日 00:00）
 *
 * ============================================================
 * 数据库安全规则（建议在 CloudBase 控制台配置）
 * ============================================================
 *
 * 以下为 CloudBase 安全规则配置（JSON 格式），
 * 需在 云开发控制台 -> 数据库 -> 安全规则 中设置。
 *
 * === users 集合 ===
 * {
 *   "read": "doc._id === auth.openid",
 *   "write": "doc._id === auth.openid",
 *   "create": "auth.openid !== null"
 * }
 *
 * === food_records 集合 ===
 * {
 *   "read": "doc.openid === auth.openid",
 *   "write": "doc.openid === auth.openid",
 *   "create": "auth.openid !== null"
 * }
 *
 * === checkins 集合 ===
 * {
 *   "read": "doc.openid === auth.openid",
 *   "write": "doc.openid === auth.openid",
 *   "create": "auth.openid !== null"
 * }
 *
 * === achievements 集合（系统只读数据）===
 * {
 *   "read": "true",
 *   "write": "false"
 * }
 *
 * === user_achievements 集合 ===
 * {
 *   "read": "doc.openid === auth.openid",
 *   "write": "doc.openid === auth.openid",
 *   "create": "auth.openid !== null"
 * }
 *
 * === themes 集合（系统只读数据）===
 * {
 *   "read": "true",
 *   "write": "false"
 * }
 *
 * === api_keys 集合（敏感数据，严格限制）===
 * {
 *   "read": "doc.openid === auth.openid",
 *   "write": "doc.openid === auth.openid",
 *   "create": "auth.openid !== null"
 * }
 *
 * ============================================================
 * 索引设计说明
 * ============================================================
 *
 * 索引策略：
 *   1. 按 openid 查询的集合均建 (openid: 1) 索引
 *   2. 带排序的查询建复合索引 (openid: 1, createdAt: -1)
 *   3. 按类型的过滤建单字段索引 (foodType: 1)
 *   4. 组合查询建复合索引 (openid: 1, isUnlocked: 1)
 *   5. 唯一约束的字段建唯一索引 (openid: 1, serviceName: 1)
 *
 * 详细索引清单：
 *
 * 集合              | 索引                           | 类型   | 说明
 * ------------------|--------------------------------|--------|--------------------------
 * food_records      | {openid: 1, createdAt: -1}     | 普通   | 用户记录列表（按时间倒序）
 * food_records      | {foodType: 1}                  | 普通   | 按食物类型筛选
 * food_records      | {createdAt: -1}                | 普通   | 全局时间线（可选）
 * checkins          | {openid: 1, timestamp: -1}     | 普通   | 用户打卡列表
 * user_achievements | {openid: 1, isUnlocked: 1}     | 普通   | 用户成就解锁状态查询
 * user_achievements | {openid: 1, achievementId: 1}  | 普通   | 用户特定成就查询
 * user_achievements | {achievementId: 1}             | 普通   | 成就统计
 * api_keys          | {openid: 1, serviceName: 1}    | 唯一   | 用户服务密钥查询
 * achievements      | {achievementId: 1}             | 唯一   | 按逻辑 ID 查询
 * themes            | {themeId: 1}                   | 唯一   | 按逻辑 ID 查询
 * themes            | {isActive: 1, sortOrder: 1}    | 普通   | 启用主题列表排序
 */

// ============================================================
// 引入 wx-server-sdk
// ============================================================
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

// ============================================================
// 集合定义
// ============================================================
const COLLECTIONS = [
  'users',
  'food_records',
  'checkins',
  'achievements',
  'user_achievements',
  'themes',
  'api_keys',
];

/**
 * 创建集合（若已存在则跳过）
 * @param {string} name - 集合名称
 */
async function createCollectionIfNotExists(name) {
  try {
    await db.createCollection(name);
    console.log(`[OK] 集合创建成功: ${name}`);
    return true;
  } catch (err) {
    // -502001: 集合已存在
    if (err.errCode === -502001) {
      console.log(`[SKIP] 集合已存在: ${name}`);
      return false;
    }
    console.error(`[FAIL] 集合创建失败: ${name}`, err);
    throw err;
  }
}

/**
 * 创建索引
 *
 * 注意：wx-server-sdk 的部分版本可能不直接支持 createIndex API。
 * 若以下方法报错，请手动在 CloudBase 控制台 -> 数据库 -> 对应集合 -> 索引管理 中创建。
 *
 * @param {string} collectionName - 集合名称
 * @param {object} indexConfig - 索引配置 { name, keys, unique }
 */
async function createIndex(collectionName, indexConfig) {
  try {
    // wx-server-sdk 2.x+ 索引创建 API
    await db.collection(collectionName).createIndex({
      name: indexConfig.name,
      keys: indexConfig.keys,
      unique: indexConfig.unique || false,
    });
    console.log(`[OK] 索引创建成功: ${collectionName}.${indexConfig.name}`);
  } catch (err) {
    // 若 API 不存在，打印指导信息
    console.warn(
      `[WARN] 索引创建失败或 API 不支持: ${collectionName}.${indexConfig.name}`,
    );
    console.warn(
      `       ${JSON.stringify(indexConfig)}`,
    );
    console.warn(
      '       请在 CloudBase 控制台手动创建该索引。',
    );
  }
}

// ============================================================
// 主函数
// ============================================================
exports.main = async (event, context) => {
  console.log('[db_init] 开始数据库初始化...');
  const startTime = Date.now();

  // ---- 1. 创建集合 ----
  console.log('\n=== 1. 创建集合 ===');
  for (const name of COLLECTIONS) {
    await createCollectionIfNotExists(name);
  }

  // ---- 2. 创建索引 ----
  console.log('\n=== 2. 创建索引 ===');

  // food_records 索引
  await createIndex('food_records', {
    name: 'idx_openid_createdAt',
    keys: [
      { name: 'openid', direction: '1' },
      { name: 'createdAt', direction: '-1' },
    ],
    unique: false,
  });

  await createIndex('food_records', {
    name: 'idx_foodType',
    keys: [{ name: 'foodType', direction: '1' }],
    unique: false,
  });

  await createIndex('food_records', {
    name: 'idx_createdAt',
    keys: [{ name: 'createdAt', direction: '-1' }],
    unique: false,
  });

  // checkins 索引
  await createIndex('checkins', {
    name: 'idx_openid_timestamp',
    keys: [
      { name: 'openid', direction: '1' },
      { name: 'timestamp', direction: '-1' },
    ],
    unique: false,
  });

  // user_achievements 索引
  await createIndex('user_achievements', {
    name: 'idx_openid_isUnlocked',
    keys: [
      { name: 'openid', direction: '1' },
      { name: 'isUnlocked', direction: '1' },
    ],
    unique: false,
  });

  await createIndex('user_achievements', {
    name: 'idx_openid_achievementId',
    keys: [
      { name: 'openid', direction: '1' },
      { name: 'achievementId', direction: '1' },
    ],
    unique: false,
  });

  await createIndex('user_achievements', {
    name: 'idx_achievementId',
    keys: [{ name: 'achievementId', direction: '1' }],
    unique: false,
  });

  // api_keys 索引
  await createIndex('api_keys', {
    name: 'idx_openid_serviceName',
    keys: [
      { name: 'openid', direction: '1' },
      { name: 'serviceName', direction: '1' },
    ],
    unique: true,
  });

  // achievements 索引
  await createIndex('achievements', {
    name: 'idx_achievementId',
    keys: [{ name: 'achievementId', direction: '1' }],
    unique: true,
  });

  // themes 索引
  await createIndex('themes', {
    name: 'idx_themeId',
    keys: [{ name: 'themeId', direction: '1' }],
    unique: true,
  });

  await createIndex('themes', {
    name: 'idx_isActive_sortOrder',
    keys: [
      { name: 'isActive', direction: '1' },
      { name: 'sortOrder', direction: '1' },
    ],
    unique: false,
  });

  const elapsed = Date.now() - startTime;
  console.log(`\n=== 初始化完成 (耗时 ${elapsed}ms) ===`);

  return {
    success: true,
    elapsed,
    collections: COLLECTIONS,
  };
};
