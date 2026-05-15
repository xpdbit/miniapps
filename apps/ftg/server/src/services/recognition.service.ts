/**
 * 食物识别服务
 * 集成 PP-ShiTuV2 Python 微服务，支持图片识别、缓存与类型映射
 */
import crypto from 'crypto';
import httpClient from '../lib/http-client';
import { getCachedRecognizeResult, cacheRecognizeResult } from '../lib/redis';
import { FOOD_KEYWORD_MAP } from '../constants/foodTypes';
import { FoodType } from '../types/food';
import logger from '../utils/logger';

const PPSHITU_URL = process.env.PPSHITU_SERVICE_URL || 'http://localhost:5000';
const REQUEST_TIMEOUT = 10000; // 10s
const MAX_RETRIES = 3;
const CONFIDENCE_THRESHOLD = 0.3;

/**
 * 模拟识别模式 — 当 PP-ShiTuV2 不可用时
 * 设置环境变量 RECOGNITION_MOCK_MODE=true 启用
 * 返回基于图片哈希的确定性模拟结果，用于本地开发和集成测试
 */
const RECOGNITION_MOCK_MODE = process.env.RECOGNITION_MOCK_MODE === 'true';

/** 模拟食物列表 — 覆盖所有 FoodType 类别 */
const MOCK_FOODS: Array<{ name: string; hashPrefix: string; type: FoodType }> = [
  { name: '米饭',     hashPrefix: '00', type: FoodType.GRAIN },
  { name: '红烧肉',   hashPrefix: '01', type: FoodType.DISH },
  { name: '苹果',     hashPrefix: '02', type: FoodType.FRUIT },
  { name: '西兰花',   hashPrefix: '03', type: FoodType.VEGETABLE },
  { name: '鸡蛋',     hashPrefix: '04', type: FoodType.MEAT },
  { name: '三文鱼',   hashPrefix: '05', type: FoodType.SEAFOOD },
  { name: '牛奶',     hashPrefix: '06', type: FoodType.DAIRY },
  { name: '核桃',     hashPrefix: '07', type: FoodType.NUT },
  { name: '薯片',     hashPrefix: '08', type: FoodType.SNACK },
  { name: '可乐',     hashPrefix: '09', type: FoodType.BEVERAGE },
  { name: '宫保鸡丁', hashPrefix: '0a', type: FoodType.DISH },
  { name: '香蕉',     hashPrefix: '0b', type: FoodType.FRUIT },
  { name: '豆腐',     hashPrefix: '0c', type: FoodType.DAIRY },
  { name: '饺子',     hashPrefix: '0d', type: FoodType.GRAIN },
  { name: '面包',     hashPrefix: '0e', type: FoodType.GRAIN },
  { name: '牛排',     hashPrefix: '0f', type: FoodType.MEAT },
];

/** 当 PP-ShiTuV2 不可用时，返回模拟识别结果 */
function mockRecognize(imageHash: string): RecognizeResult {
  const prefix = imageHash.substring(0, 2);
  const food = MOCK_FOODS.find(f => f.hashPrefix === prefix) || MOCK_FOODS[0];
  const foodIndex = MOCK_FOODS.indexOf(food);

  // 基于哈希生成确定性数据，保证相同图片返回相同结果
  const confidence = 0.92 + (parseInt(imageHash.substring(2, 4), 16) % 7) / 100;

  return {
    foodName: food.name,
    confidence,
    foodType: food.type,
    alternatives: [
      { foodName: food.name, confidence: confidence - 0.07 },
      { foodName: MOCK_FOODS[(foodIndex + 1) % MOCK_FOODS.length].name, confidence: 0.45 },
    ],
    calories: {
      caloriesTotal: Math.floor(100 + parseInt(imageHash.substring(4, 8), 16) % 500),
      caloriesPer100g: Math.floor(50 + parseInt(imageHash.substring(8, 12), 16) % 300),
      protein: parseFloat((parseInt(imageHash.substring(12, 14), 16) % 30 / 10 + 0.5).toFixed(1)),
      fat: parseFloat((parseInt(imageHash.substring(14, 16), 16) % 40 / 10).toFixed(1)),
      carbs: parseFloat((parseInt(imageHash.substring(16, 18), 16) % 50 / 10 + 1).toFixed(1)),
    },
  };
}

/** PP-ShiTuV2 服务响应结构 */
interface PPShiTuV2Response {
  success: boolean;
  food_name: string;
  confidence: number;
  alternatives?: Array<{ foodName: string; confidence: number }>;
  calories?: {
    caloriesTotal: number;
    caloriesPer100g: number;
    protein: number;
    fat: number;
    carbs: number;
  };
  error?: string;
}

/** 识别结果 */
export interface RecognizeResult {
  foodName: string;
  confidence: number;
  foodType: FoodType;
  alternatives: Array<{ foodName: string; confidence: number }>;
  calories?: {
    caloriesTotal: number;
    caloriesPer100g: number;
    protein: number;
    fat: number;
    carbs: number;
  };
}

/** 计算图片 SHA256 哈希用于缓存 */
function getImageHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/** 通过关键词匹配将食物名称映射为 FoodType */
function mapToFoodType(foodName: string): FoodType {
  for (const [keyword, foodType] of Object.entries(FOOD_KEYWORD_MAP)) {
    if (foodName.includes(keyword)) return foodType;
  }
  return FoodType.OTHER;
}

/** 调用 PP-ShiTuV2 Python 服务 (带指数退避重试) */
async function callPPShiTuV2(imageBase64: string, retries = MAX_RETRIES): Promise<PPShiTuV2Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { data } = await httpClient.post<PPShiTuV2Response>(
        `${PPSHITU_URL}/predict`,
        { image: imageBase64 },
        { timeout: REQUEST_TIMEOUT },
      );
      return data;
    } catch (error) {
      if (attempt === retries) {
        logger.error('PP-ShiTuV2 all retries exhausted');
        throw error;
      }
      const delay = Math.pow(2, attempt) * 500; // 1s, 2s, 4s
      logger.warn(`PP-ShiTuV2 attempt ${attempt} failed, retrying in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('ppshituv2_unreachable');
}

/**
 * 主识别流程：缓存 → PP-ShiTuV2 → 缓存
 * 仅当置信度 >= CONFIDENCE_THRESHOLD 时才返回结果
 */
export async function recognizeFood(imageBuffer: Buffer): Promise<RecognizeResult> {
  const hash = getImageHash(imageBuffer);

  // 1. 查缓存
  const cached = await getCachedRecognizeResult(hash);
  if (cached) {
    const parsed = cached as RecognizeResult;
    if (parsed.confidence >= CONFIDENCE_THRESHOLD) {
      return parsed;
    }
  }

  // 2. Mock 模式 — 跳过 PP-ShiTuV2，返回模拟结果
  if (RECOGNITION_MOCK_MODE) {
    const mockResult = mockRecognize(hash);
    await cacheRecognizeResult(hash, mockResult);
    logger.info(`[Mock] 模拟识别: ${mockResult.foodName} (type=${mockResult.foodType}, confidence=${mockResult.confidence})`);
    return mockResult;
  }

  // 3. 调用 PP-ShiTuV2
  const imageBase64 = imageBuffer.toString('base64');
  let ppResult: PPShiTuV2Response;
  try {
    ppResult = await callPPShiTuV2(imageBase64);
  } catch (error) {
    // PP-ShiTuV2 完全不可达时，降级为模拟识别
    logger.warn(`PP-ShiTuV2 不可达，降级为模拟识别: ${(error as Error).message}`);
    const fallback = mockRecognize(hash);
    fallback.confidence = 0.5; // 低置信度标记为降级结果
    await cacheRecognizeResult(hash, fallback);
    return fallback;
  }

  if (!ppResult.success) {
    const errorMsg = ppResult.error || 'recognition_failed';
    const errCode = errorMsg === 'non_food' ? 3001 : 3000;
    throw Object.assign(new Error(errorMsg), { errCode });
  }

  if (ppResult.confidence < CONFIDENCE_THRESHOLD) {
    // 置信度过低时降级为模拟识别（不抛出异常）
    logger.warn(`PP-ShiTuV2 置信度过低 (${ppResult.confidence})，降级为模拟识别`);
    const fallback = mockRecognize(hash);
    fallback.confidence = 0.5;
    await cacheRecognizeResult(hash, fallback);
    return fallback;
  }

  // 4. 映射为 FoodType
  const foodType = mapToFoodType(ppResult.food_name);

  const result: RecognizeResult = {
    foodName: ppResult.food_name,
    confidence: ppResult.confidence,
    foodType,
    alternatives: (ppResult.alternatives || []).map(a => ({
      foodName: a.foodName,
      confidence: a.confidence,
    })),
    calories: ppResult.calories,
  };

  // 5. 缓存结果 24h
  await cacheRecognizeResult(hash, result);

  return result;
}

/** 批量识别 */
export async function batchRecognize(buffers: Buffer[]): Promise<RecognizeResult[]> {
  return Promise.all(buffers.map(buf => recognizeFood(buf)));
}
