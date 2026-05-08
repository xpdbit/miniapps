/**
 * AI 流水线编排服务
 * 状态机: pending(0%) → recognizing(30%) → generating(55%) → completed(100%) / failed
 * 异步执行，不阻塞 HTTP 响应
 */
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { recognizeFood } from './recognition.service';
import { generateDescription } from './textgen.service';
import logger from '../utils/logger';
import type { PipelineStatus, Prisma } from '@prisma/client';

// ============================================================
// 流水线并发控制 — 防止过多并行任务耗尽连接资源
// ============================================================

const pendingQueue: Array<() => void> = [];
let activeCount = 0;
const MAX_CONCURRENT = (() => {
  const env = parseInt(process.env.PIPELINE_MAX_CONCURRENT || '2', 10);
  return Number.isFinite(env) && env > 0 ? env : 2;
})();

function schedulePipeline<T>(executor: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      activeCount++;
      executor()
        .then(resolve, reject)
        .finally(() => {
          activeCount--;
          // 触发队列中下一个任务
          if (pendingQueue.length > 0) {
            pendingQueue.shift()!();
          }
        });
    };

    if (activeCount < MAX_CONCURRENT) {
      run();
    } else {
      pendingQueue.push(run);
    }
  });
}

// ============================================================
// 常量
// ============================================================

/** 流水线每一步的最大超时时间（毫秒） */
const STEP_TIMEOUT_MS = 30_000;

/** 最终组装结果结构 */
interface PipelineResult {
  foodName: string;
  foodType: string;
  confidence: number;
  calories?: {
    caloriesTotal: number;
    caloriesPer100g: number;
    protein: number;
    fat: number;
    carbs: number;
  };
  description: {
    short: string;
    gameStyle: string;
    detail: string;
  };
  themeId: string;
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 为 Promise 添加超时控制，超时则 reject
 * Promise.race + timer cleanup
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Operation timed out')), ms);
    }),
  ]).finally(() => clearTimeout(timer!));
}

/**
 * 更新流水线记录的状态与进度百分比
 */
async function updateStatus(recordId: number, status: PipelineStatus, progress: number): Promise<void> {
  await prisma.pipelineRecord.update({
    where: { id: recordId },
    data: { status, progress, updatedAt: new Date() },
  });
}

// ============================================================
// 状态机执行器
// ============================================================

/**
 * 异步执行流水线状态机（仅供 startPipeline 内部使用）
 *
 * 流程: pending(0%) → recognizing(30%) → generating(55%) → completed(100%)
 * 异常: 任何步骤失败或超时 → failed(0%) + resultJson.error
 */
async function runStateMachine(
  recordId: number,
  imageBuffer: Buffer,
  themeId: string,
): Promise<void> {
  try {
    // === Step 1: 食物识别 (30%) ===
    await updateStatus(recordId, 'recognizing', 30);
    const recognition = await withTimeout(recognizeFood(imageBuffer), STEP_TIMEOUT_MS);

    // === Step 2: AI 文本生成 (55%) ===
    await updateStatus(recordId, 'generating', 55);
    const description = await withTimeout(
      generateDescription({
        foodName: recognition.foodName,
        foodType: recognition.foodType,
        themeId,
      }),
      STEP_TIMEOUT_MS,
    );

    // === Step 3: 结果组装 & 完成 (100%) ===
    const result: PipelineResult = {
      foodName: recognition.foodName,
      foodType: recognition.foodType,
      confidence: recognition.confidence,
      calories: recognition.calories && {
        caloriesTotal: recognition.calories.caloriesTotal,
        caloriesPer100g: recognition.calories.caloriesPer100g,
        protein: recognition.calories.protein,
        fat: recognition.calories.fat,
        carbs: recognition.calories.carbs,
      },
      description: {
        short: description.short,
        gameStyle: description.gameStyle,
        detail: description.detail,
      },
      themeId,
    };

    await prisma.pipelineRecord.update({
      where: { id: recordId },
      data: {
        status: 'completed',
        progress: 100,
        resultJson: result as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Pipeline #${recordId} failed: ${errorMessage}`);

    await prisma.pipelineRecord.update({
      where: { id: recordId },
      data: {
        status: 'failed',
        progress: 0,
        resultJson: { error: errorMessage } as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });
  }
}

// ============================================================
// 公开 API
// ============================================================

/**
 * 启动 AI 流水线
 * 创建记录后立即返回 pipelineId，后台异步执行状态机
 */
export async function startPipeline(
  userId: number,
  imageBuffer: Buffer,
  themeId: string,
): Promise<{ pipelineId: string; id: number }> {
  const pipelineId = uuidv4();

  const record = await prisma.pipelineRecord.create({
    data: {
      userId,
      pipelineId,
      status: 'pending',
      progress: 0,
      themeId,
    },
  });

  // 后台执行（通过并发限制队列），不 await
  schedulePipeline(() => runStateMachine(record.id, imageBuffer, themeId))
    .catch((err: unknown) => {
      logger.error(`Unhandled pipeline error for record #${record.id}:`, err);
    });

  return { pipelineId, id: record.id };
}

/**
 * 查询流水线状态
 * 返回 public 字段（不暴露 userId 等敏感信息）
 */
export async function getPipelineStatus(pipelineId: string, userId: number) {
  return prisma.pipelineRecord.findFirst({
    where: { pipelineId, userId },
    select: {
      pipelineId: true,
      status: true,
      progress: true,
      resultJson: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
