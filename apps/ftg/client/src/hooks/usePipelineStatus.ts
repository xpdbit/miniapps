/**
 * ============================================================
 * usePipelineStatus — AI 流水线状态轮询 Hook
 * ============================================================
 *
 * 提供对 orchestrateAIPipeline 云函数的实时状态追踪。
 * 每 2 秒轮询一次，到达终态（completed / failed）后自动停止。
 *
 * @example
 * ```tsx
 * const { status, progress, error, isCompleted } = usePipelineStatus('pipe_xxx...');
 * ```
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ============================================================
// 类型定义
// ============================================================

/** 可识别的食物备选结果 */
interface RecognitionAlternative {
  foodName: string;
  confidence: number;
}

/** 营养信息 */
interface CalorieInfo {
  total: number;
  per100g: number;
  protein: number;
  fat: number;
  carbs: number;
}

/** AI 生成的食物描述 */
interface AIFoodDescription {
  short: string;
  gameStyle: string;
  detail: string;
}

/** Canvas 合成结果 */
interface ComposeResult {
  resultFileID: string;
  processingTime: number;
  width: number;
  height: number;
}

/** 管道错误信息 */
interface PipelineError {
  message: string;
  errCode: number;
  step: string | null;
}

/** 管道状态值 */
export type PipelineStatusValue =
  | 'queued'
  | 'preprocessing'
  | 'recognizing'
  | 'generating'
  | 'composing'
  | 'completed'
  | 'failed';

/** pipeline_status 集合文档结构 */
export interface PipelineStatusDoc {
  pipelineId: string;
  status: PipelineStatusValue;
  progress: number;
  step: string;
  imageFileID: string;
  foodName?: string;
  foodType?: string;
  confidence?: number;
  alternatives?: RecognitionAlternative[];
  nutrition?: CalorieInfo | null;
  aiDescription?: AIFoodDescription;
  result?: ComposeResult | null;
  error?: PipelineError | null;
  startedAt: string;
  updatedAt: string;
}

/** 通用 API 响应（与后端对齐） */
interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  errCode: number;
  errMsg: string;
  elapsed: number;
}

/** usePipelineStatus 返回值类型 */
export interface UsePipelineStatusResult {
  /** 当前管道状态（首次加载为 null） */
  status: PipelineStatusValue | null;
  /** 当前进度 0-100 */
  progress: number;
  /** 当前步骤描述 */
  step: string;
  /** 完整的管道文档数据 */
  result: PipelineStatusDoc | null;
  /** 错误消息（失败时） */
  error: string | null;
  /** 是否已完成 */
  isCompleted: boolean;
  /** 是否已失败 */
  isFailed: boolean;
  /** 是否首次加载中 */
  isLoading: boolean;
}

// ============================================================
// 常量
// ============================================================

/** 轮询间隔 (ms) */
const POLL_INTERVAL = 2000;

/** 最大轮询时长 (ms) — 超过此时间视为超时 */
const MAX_POLLING_DURATION = 120000; // 2 分钟

/** 管道云函数名称 */
const CLOUD_FUNCTION_NAME = 'orchestrateAIPipeline';

/**
 * 终态集合 — 到达这些状态后停止轮询
 */
const TERMINAL_STATUSES: ReadonlySet<PipelineStatusValue> = new Set([
  'completed',
  'failed',
]);

// ============================================================
// 初始状态
// ============================================================

const INITIAL_STATE: UsePipelineStatusResult = {
  status: null,
  progress: 0,
  step: '',
  result: null,
  error: null,
  isCompleted: false,
  isFailed: false,
  isLoading: true,
};

// ============================================================
// Hook
// ============================================================

/**
 * 轮询追踪 AI 流水线状态
 *
 * @param pipelineId - 管道 ID（为空时不发起请求）
 * @returns 管道状态和进度信息
 */
export function usePipelineStatus(
  pipelineId: string,
): UsePipelineStatusResult {
  const [state, setState] = useState<UsePipelineStatusResult>(INITIAL_STATE);

  // 用 ref 追踪已卸载状态，防止卸载后 setState
  const unmountedRef = useRef(false);

  // 缓存最新的 pipelineId 避免闭包问题
  const pipelineIdRef = useRef<string>(pipelineId);
  pipelineIdRef.current = pipelineId;

  // 用 ref 存储当前定时器 ID
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 记录轮询开始时间（用于超时判断）
  const pollingStartRef = useRef<number>(0);

  /**
   * 单次轮询请求
   */
  const poll = useCallback(async () => {
    const currentPipelineId = pipelineIdRef.current;

    if (!currentPipelineId) {
      return;
    }

    // 检查是否超时
    const elapsed = Date.now() - pollingStartRef.current;
    if (elapsed > MAX_POLLING_DURATION) {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setState((prev) => ({
        ...prev,
        status: 'failed',
        error: 'AI 处理超时，请稍后重试',
        isFailed: true,
        isLoading: false,
      }));
      return;
    }

    try {
      // 云函数仅在微信小程序环境可用，H5 跳过轮询
      if (process.env.TARO_ENV !== 'weapp') {
        return;
      }
      const res = await wx.cloud.callFunction({
        name: CLOUD_FUNCTION_NAME,
        data: {
          action: 'getStatus',
          pipelineId: currentPipelineId,
        },
      });

      // 组件已卸载则丢弃结果
      if (unmountedRef.current) {
        return;
      }

      const response = res.result as ApiResponse<PipelineStatusDoc>;

      if (!response.success) {
        setState((prev) => ({
          ...prev,
          error: response.errMsg || '获取管道状态失败',
          isLoading: false,
        }));
        return;
      }

      const doc = response.data;
      const currentStatus = doc.status;
      const isTerminal = TERMINAL_STATUSES.has(currentStatus);

      setState({
        status: currentStatus,
        progress: doc.progress,
        step: doc.step,
        result: doc,
        error: doc.error?.message ?? null,
        isCompleted: currentStatus === 'completed',
        isFailed: currentStatus === 'failed',
        isLoading: false,
      });

      // 到达终态 → 停止轮询
      if (isTerminal && timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } catch (err) {
      if (unmountedRef.current) {
        return;
      }

      const message =
        err instanceof Error ? err.message : '网络异常，请检查连接';

      setState((prev) => ({
        ...prev,
        error: message,
        isLoading: false,
      }));
    }
  }, []);

  useEffect(() => {
    // 重置标记
    unmountedRef.current = false;

    // 重置状态（可能切换了 pipelineId）
    setState(INITIAL_STATE);

    if (!pipelineId) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    // 记录轮询开始时间
    pollingStartRef.current = Date.now();

    // 立即执行一次
    poll();

    // 启动定时轮询
    timerRef.current = setInterval(poll, POLL_INTERVAL);

    // 清理
    return () => {
      unmountedRef.current = true;

      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [pipelineId, poll]);

  return state;
}
