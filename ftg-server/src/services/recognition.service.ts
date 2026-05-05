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

  // 2. 调用 PP-ShiTuV2
  const imageBase64 = imageBuffer.toString('base64');
  const ppResult = await callPPShiTuV2(imageBase64);

  if (!ppResult.success) {
    const errorMsg = ppResult.error || 'recognition_failed';
    const errCode = errorMsg === 'non_food' ? 3001 : 3000;
    throw Object.assign(new Error(errorMsg), { errCode });
  }

  if (ppResult.confidence < CONFIDENCE_THRESHOLD) {
    throw Object.assign(new Error('识别置信度过低'), { errCode: 3003 });
  }

  // 3. 映射为 FoodType
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

  // 4. 缓存结果 24h
  await cacheRecognizeResult(hash, result);

  return result;
}

/** 批量识别 */
export async function batchRecognize(buffers: Buffer[]): Promise<RecognizeResult[]> {
  return Promise.all(buffers.map(buf => recognizeFood(buf)));
}
