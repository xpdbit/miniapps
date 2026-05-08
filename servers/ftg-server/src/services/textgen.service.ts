/**
 * AI 文本生成服务 - 使用 DashScope（通义千问）API
 */

import httpClient from '../lib/http-client';
import { env } from '../config/env';
import { cacheTextGen, getCachedTextGen } from '../lib/redis';
import { getPrompt } from './prompts';
import logger from '../utils/logger';
import type { AIFoodDescription } from '../types/food';

const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

interface GenerateParams {
  foodName: string;
  foodType: string;
  themeId: string;
}

/**
 * 为食物生成 AI 文本描述
 * - 先查 Redis 缓存（1小时 TTL）
 * - 缓存未命中则调 DashScope API
 * - API 不可用时返回模板兜底
 */
export async function generateDescription({ foodName, foodType, themeId }: GenerateParams): Promise<AIFoodDescription> {
  // 1. Check cache (1h TTL)
  const cached = await getCachedTextGen(foodName, themeId);
  if (cached) return cached as AIFoodDescription;

  // 2. If DashScope API key not set, return fallback
  if (!env.DASHSCOPE_API_KEY) {
    return generateFallback(foodName, themeId);
  }

  // 3. Call DashScope
  try {
    const prompt = getPrompt(themeId);
    const { data } = await httpClient.post(DASHSCOPE_URL, {
      model: 'qwen-turbo',
      input: {
        messages: [
          { role: 'system', content: prompt.systemPrompt },
          { role: 'user', content: `食物名称：${foodName}\n食物类型：${foodType}` },
        ],
      },
      parameters: {
        temperature: prompt.temperature,
        max_tokens: 300,
        result_format: 'message',
      },
    }, {
      headers: {
        'Authorization': `Bearer ${env.DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    const content = data?.output?.choices?.[0]?.message?.content || '';
    const result = parseAIResponse(content, foodName, themeId);

    // 4. Cache result
    await cacheTextGen(foodName, themeId, result);

    return result;
  } catch (error) {
    logger.error('DashScope API call failed:', (error as Error).message);
    return generateFallback(foodName, themeId);
  }
}

/** 解析 AI 返回的 JSON */
function parseAIResponse(content: string, foodName: string, themeId: string): AIFoodDescription {
  try {
    const parsed = JSON.parse(content);
    return {
      short: parsed.short || `${foodName}看起来非常美味`,
      gameStyle: parsed.gameStyle || `获得道具：${foodName}`,
      detail: parsed.detail || `这是一份精心准备的${foodName}，色香味俱全。`,
    };
  } catch {
    return generateFallback(foodName, themeId);
  }
}

/** 生成模板兜底描述（API 不可用时） */
function generateFallback(foodName: string, themeId: string): AIFoodDescription {
  const emojis = ['🍽️', '✨', '🔥', '👨‍🍳', '🍳', '🥘'];
  const emoji = emojis[themeId.length % emojis.length] || '🍽️';

  return {
    short: `新鲜出炉的${foodName}`,
    gameStyle: `获得道具：${emoji} ${foodName}！`,
    detail: `这是一份精心准备的${foodName}，食材新鲜，烹饪手法独到。无论是口感还是外观，都令人满意。适合与朋友分享，享受美好时光。`,
  };
}
