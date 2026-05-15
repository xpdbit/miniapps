import Taro from '@tarojs/taro';
import type { ChartSize } from './types';

/**
 * Canvas 节点查询结果
 */
interface CanvasNodeResult {
  node: HTMLCanvasElement;
  width: number;
  height: number;
}

/**
 * 初始化 Canvas 2D 上下文
 * 通过 Taro.createSelectorQuery 获取 Canvas 节点，处理像素比缩放
 */
export async function initCanvas(
  canvasId: string,
): Promise<{ ctx: CanvasRenderingContext2D; size: ChartSize } | null> {
  try {
    const sysInfo = Taro.getSystemInfoSync();
    const dpr = sysInfo.pixelRatio;

    const res = await new Promise<CanvasNodeResult>(
      (resolve, reject) => {
        Taro.createSelectorQuery()
          .select(`#${canvasId}`)
          .fields({ node: true, size: true })
          .exec((queryRes) => {
            const first = queryRes[0] as CanvasNodeResult | undefined;
            if (first !== undefined && first !== null) {
              resolve(first);
            } else {
              reject(new Error('Canvas node not found'));
            }
          });
      },
    );

    const canvas = res.node;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return null;

    const width = res.width;
    const height = res.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    return { ctx, size: { width, height } };
  } catch {
    return null;
  }
}

/**
 * 将颜色 hex 值转为 rgba 字符串
 */
export function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '');
  let r: number, g: number, b: number;

  if (cleaned.length === 3) {
    const c0 = cleaned[0] ?? '0';
    const c1 = cleaned[1] ?? '0';
    const c2 = cleaned[2] ?? '0';
    r = parseInt(c0 + c0, 16);
    g = parseInt(c1 + c1, 16);
    b = parseInt(c2 + c2, 16);
  } else {
    r = parseInt(cleaned.substring(0, 2) || '0', 16);
    g = parseInt(cleaned.substring(2, 4) || '0', 16);
    b = parseInt(cleaned.substring(4, 6) || '0', 16);
  }

  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 获取过去 N 天的日期列表（含今天）
 */
export function getLastNDays(n: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(formatDate(d));
  }
  return dates;
}
