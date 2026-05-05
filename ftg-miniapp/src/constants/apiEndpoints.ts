/**
 * 云函数名称常量
 */

/** 云函数名称 */
export const CLOUD_FUNCTIONS = {
  /** 食物识别 - PP-ShiTuV2 */
  FOOD_RECOGNIZE: 'foodRecognize',
  /** Canvas 主题合成 (服务端备选) */
  THEME_COMPOSE: 'themeCompose',
  /** 混元AI文本生成 */
  TEXT_GENERATE: 'textGenerate',
  /** IP定位解析 */
  GET_LOCATION_BY_IP: 'getLocationByIP',
  /** API Key管理 */
  MANAGE_API_KEY: 'manageApiKey',
  /** 创建食物记录 */
  CREATE_FOOD_RECORD: 'createFoodRecord',
  /** 获取用户统计 */
  GET_USER_STATS: 'getUserStats',
  /** 检查成就 */
  CHECK_ACHIEVEMENT: 'checkAchievement',
  /** 生成分享卡片 */
  GENERATE_SHARE_CARD: 'generateShareCard',
} as const;

/** 云函数配置 */
export const CLOUD_FUNCTION_CONFIG = {
  /** 默认超时时间 (ms) */
  defaultTimeout: 3000,
  /** AI识别超时 (ms) - 需要更长时间 */
  aiTimeout: 60000,
  /** 默认内存 (MB) */
  defaultMemory: 256,
  /** AI处理内存 (MB) */
  aiMemory: 512,
};

/** API 端点 (通过云函数代理) */
export const API_ENDPOINTS = {
  /** 混元AI 文本生成 */
  hunyuan: 'https://your-hunyuan-endpoint/v1/chat/completions',
  /** PP-ShiTuV2 食物识别 */
  ppshitu: 'https://your-ppshitu-endpoint/recognize',
  /** IP定位 */
  ipLocation: 'https://apis.map.qq.com/ws/location/v1/ip',
} as const;
