/**
 * ============================================================
 * Canvas 2D 主题合成引擎
 * 客户端离线合成：背景 → 食物图 → 边框 → 装饰 → 文字
 * ============================================================
 */

import Taro from '@tarojs/taro';
import type { ComposeRequest, ComposeResult } from '@/types/theme';
import { getTemplateConfig } from './templateLoader';
import type {
  BackgroundConfig,
  FrameConfig,
  TextItemConfig,
  DecorationConfig,
} from './templateLoader';

// ============================================================
// 错误类型
// ============================================================

/** Canvas 合成错误 */
export class ComposeError extends Error {
  constructor(message: string) {
    super(`[CanvasCompose] ${message}`);
    this.name = 'ComposeError';
  }
}

// ============================================================
// 微信小程序 Canvas 类型桥接
// ============================================================

/**
 * 微信小程序的离屏 Canvas 类型（含 createImage）
 * DOM 的 OffscreenCanvas 不包含 createImage，需要单独定义
 */
interface WeappCanvas {
  width: number;
  height: number;
  getContext(contextType: '2d'): CanvasRenderingContext2D | null;
  createImage(): WeappCanvasImage;
}

/**
 * 微信小程序的 Canvas Image 对象
 * 通过 canvas.createImage() 创建，src 设为本地路径后 onload 触发
 */
interface WeappCanvasImage {
  src: string;
  width: number;
  height: number;
  onload: (() => void) | null;
  onerror: ((res: { errMsg: string }) => void) | null;
}

// ============================================================
// 边框绘制函数
// ============================================================

type FrameDrawer = (ctx: CanvasRenderingContext2D, config: FrameConfig) => void;

/**
 * 星露谷物语风格边框 - 木质像素边框
 * 厚实木框 + 内边装饰 + 四角像素化点缀
 */
function drawStardewFrame(ctx: CanvasRenderingContext2D, config: FrameConfig): void {
  const { x, y, width, height } = config;
  const bw = config.borderWidth ?? 24;
  const color = config.color ?? '#5C4033';

  ctx.save();

  // 外层粗木框
  ctx.strokeStyle = color;
  ctx.lineWidth = bw;
  ctx.strokeRect(x, y, width, height);

  // 内层浅木色描边
  ctx.strokeStyle = '#8B6914';
  ctx.lineWidth = 4;
  const inset = bw / 2 + 8;
  ctx.strokeRect(x + inset, y + inset, width - inset * 2, height - inset * 2);

  // 四角像素装饰块
  const cornerSize = 30;
  const gap = 10;
  ctx.fillStyle = '#A0722D';
  // 左上
  ctx.fillRect(x + gap, y + gap, cornerSize, 6);
  ctx.fillRect(x + gap, y + gap, 6, cornerSize);
  // 右上
  ctx.fillRect(x + width - gap - cornerSize, y + gap, cornerSize, 6);
  ctx.fillRect(x + width - gap - 6, y + gap, 6, cornerSize);
  // 左下
  ctx.fillRect(x + gap, y + height - gap - 6, cornerSize, 6);
  ctx.fillRect(x + gap, y + height - gap - cornerSize, 6, cornerSize);
  // 右下
  ctx.fillRect(x + width - gap - cornerSize, y + height - gap - 6, cornerSize, 6);
  ctx.fillRect(x + width - gap - 6, y + height - gap - cornerSize, 6, cornerSize);

  ctx.restore();
}

/**
 * 饥荒风格边框 - 手绘锯齿边框
 * 四边独立锯齿线 + 随机抖动模拟手绘质感
 */
function drawDontStarveFrame(ctx: CanvasRenderingContext2D, config: FrameConfig): void {
  const { x, y, width, height } = config;
  const color = config.color ?? '#4A0E0E';
  const secondaryColor = config.secondaryColor ?? '#6B1D1D';

  ctx.save();

  const segments = 32;
  const segW = width / segments;
  const segH = height / segments;

  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 上边
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const px = x + i * segW;
    const jitter = Math.sin(i * 1.5) * 5 + (i % 3) * 2 - 3;
    if (i === 0) {
      ctx.moveTo(px, y + jitter);
    } else {
      ctx.lineTo(px, y + jitter);
    }
  }
  ctx.stroke();

  // 下边
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const px = x + i * segW;
    const jitter = Math.sin(i * 1.5 + 2) * 5 + (i % 3) * 2 - 3;
    if (i === 0) {
      ctx.moveTo(px, y + height + jitter);
    } else {
      ctx.lineTo(px, y + height + jitter);
    }
  }
  ctx.stroke();

  // 左边
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const py = y + i * segH;
    const jitter = Math.sin(i * 1.5 + 1) * 5 + (i % 3) * 2 - 3;
    if (i === 0) {
      ctx.moveTo(x + jitter, py);
    } else {
      ctx.lineTo(x + jitter, py);
    }
  }
  ctx.stroke();

  // 右边
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const py = y + i * segH;
    const jitter = Math.sin(i * 1.5 + 3) * 5 + (i % 3) * 2 - 3;
    if (i === 0) {
      ctx.moveTo(x + width + jitter, py);
    } else {
      ctx.lineTo(x + width + jitter, py);
    }
  }
  ctx.stroke();

  // 内层暗红描边
  ctx.strokeStyle = secondaryColor;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 20, y + 20, width - 40, height - 40);

  ctx.restore();
}

/**
 * 塞尔达烹饪风格边框 - 金色古典边框
 * 双重描边 + 四角三角力量装饰 + 侧边菱形点缀
 */
function drawZeldaFrame(ctx: CanvasRenderingContext2D, config: FrameConfig): void {
  const { x, y, width, height } = config;
  const bw = config.borderWidth ?? 6;
  const color = config.color ?? '#8B6914';
  const secondaryColor = config.secondaryColor ?? '#F5C842';

  ctx.save();

  // 外层金边
  ctx.strokeStyle = color;
  ctx.lineWidth = bw;
  ctx.strokeRect(x, y, width, height);

  // 内层亮金色描边
  ctx.strokeStyle = secondaryColor;
  ctx.lineWidth = 3;
  const inset = bw + 6;
  ctx.strokeRect(x + inset, y + inset, width - inset * 2, height - inset * 2);

  // 四角三角力量装饰
  const cornerSize = 40;
  ctx.strokeStyle = secondaryColor;
  ctx.lineWidth = 2;

  drawTriForce(ctx, x + 24, y + 24, cornerSize, 0);
  drawTriForce(ctx, x + width - 24, y + 24, cornerSize, 1);
  drawTriForce(ctx, x + width - 24, y + height - 24, cornerSize, 2);
  drawTriForce(ctx, x + 24, y + height - 24, cornerSize, 3);

  // 四边中点菱形
  ctx.fillStyle = secondaryColor;
  drawDiamond(ctx, x + width / 2, y + 16, 10);
  drawDiamond(ctx, x + width / 2, y + height - 16, 10);
  drawDiamond(ctx, x + 16, y + height / 2, 10);
  drawDiamond(ctx, x + width - 16, y + height / 2, 10);

  ctx.restore();
}

/**
 * 默认边框 - 简单矩形描边
 */
function drawDefaultFrame(ctx: CanvasRenderingContext2D, config: FrameConfig): void {
  ctx.save();
  ctx.strokeStyle = config.color ?? '#FFFFFF';
  ctx.lineWidth = config.borderWidth ?? 4;
  ctx.strokeRect(config.x, config.y, config.width, config.height);
  ctx.restore();
}

// ============================================================
// 几何辅助函数
// ============================================================

/**
 * 绘制三角力量（三个嵌套三角形）
 * @param corner - 0=左上, 1=右上, 2=右下, 3=左下
 */
function drawTriForce(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  corner: number,
): void {
  const rotation = (corner * Math.PI) / 2;
  const halfSize = size / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  // 外三角形
  ctx.beginPath();
  ctx.moveTo(0, -halfSize);
  ctx.lineTo(-halfSize, halfSize);
  ctx.lineTo(halfSize, halfSize);
  ctx.closePath();
  ctx.stroke();

  // 内三角形
  ctx.beginPath();
  ctx.moveTo(0, -halfSize / 3);
  ctx.lineTo(-halfSize / 3, halfSize / 3);
  ctx.lineTo(halfSize / 3, halfSize / 3);
  ctx.closePath();
  ctx.stroke();

  ctx.restore();
}

/**
 * 绘制菱形填充
 */
function drawDiamond(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx + size, cy);
  ctx.lineTo(cx, cy + size);
  ctx.lineTo(cx - size, cy);
  ctx.closePath();
  ctx.fill();
}

// ============================================================
// 边框绘制器注册表
// ============================================================

const FRAME_DRAWERS: Record<string, FrameDrawer> = {
  stardew_frame: drawStardewFrame,
  dont_starve_frame: drawDontStarveFrame,
  zelda_frame: drawZeldaFrame,
  default_frame: drawDefaultFrame,
};

// ============================================================
// 核心合成入口
// ============================================================

/**
 * 合成主题图片
 *
 * 执行流程：
 * 1. 加载主题绘制配置
 * 2. 创建离屏 Canvas
 * 3. 逐层绘制：背景 → 食物图片 → 边框 → 装饰 → 文字
 * 4. 导出为临时文件
 * 5. 上传到云存储
 *
 * @param request - 合成请求参数
 * @returns 合成结果（云文件ID、耗时、尺寸）
 * @throws {ComposeError} 合成过程中的任何错误
 */
export async function composeThemeImage(request: ComposeRequest): Promise<ComposeResult> {
  const startTime = Date.now();

  // 参数校验
  if (!request.foodImageFileID) {
    throw new ComposeError('缺少必要参数: foodImageFileID');
  }
  if (!request.themeId) {
    throw new ComposeError('缺少必要参数: themeId');
  }

  // 1. 加载模板配置
  const config = await getTemplateConfig(request.themeId);
  const { width, height } = config.canvasSize;

  // 2. 创建离屏 Canvas
  const rawCanvas = wx.createOffscreenCanvas({ type: '2d', width, height });
  const canvas = rawCanvas as unknown as WeappCanvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new ComposeError('无法获取 Canvas 2D 渲染上下文');
  }

  // 开启图像平滑
  ctx.imageSmoothingEnabled = true;

  try {
    // Layer 1: 背景
    drawBackground(ctx, config.background, width, height);

    // Layer 2: 食物图片（缩放居中 + 圆角裁剪）
    const foodImg = await loadImageFromCloud(request.foodImageFileID, canvas);
    drawRoundedImage(
      ctx,
      foodImg,
      config.foodImage.x,
      config.foodImage.y,
      config.foodImage.width,
      config.foodImage.height,
      config.foodImage.borderRadius,
    );

    // Layer 3: 主题边框
    drawFrameByConfig(ctx, config.frame);

    // Layer 4: 装饰元素
    drawDecorations(ctx, config.decorations);

    // Layer 5: 文字叠加
    const displayName = request.foodName || '未知美食';
    drawTextWithShadow(ctx, displayName, config.text.foodName.x, config.text.foodName.y, config.text.foodName);

    if (request.gameDescription) {
      drawTextWithShadow(
        ctx,
        request.gameDescription,
        config.text.gameDesc.x,
        config.text.gameDesc.y,
        config.text.gameDesc,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ComposeError(`合成绘制异常: ${message}`);
  }

  // 导出到临时文件
  const tempFilePath = await exportCanvas(canvas, width, height);

  // 上传到云存储
  const resultFileID = await uploadResultFile(tempFilePath, request.themeId);

  const processingTime = Date.now() - startTime;

  return {
    resultFileID,
    processingTime,
    width,
    height,
  };
}

// ============================================================
// 图片加载
// ============================================================

/**
 * 从云存储加载图片到 Canvas Image 对象
 *
 * 流程：云文件ID → 下载到本地临时路径 → canvas.createImage()
 *
 * @param fileID - 云文件 ID
 * @param canvas - 用于创建 Image 的 Canvas
 * @returns 加载完成的 Image 对象
 */
export function loadImageFromCloud(
  fileID: string,
  canvas: WeappCanvas,
): Promise<WeappCanvasImage> {
  return new Promise<WeappCanvasImage>((resolve, reject) => {
    let retryCount = 0;
    const maxRetries = 1;

    function doDownload(): void {
      Taro.cloud.downloadFile({
        fileID,
        success: (downloadRes) => {
          const tempPath = downloadRes.tempFilePath;
          if (!tempPath) {
            reject(new ComposeError('图片下载结果为空'));
            return;
          }

          const img = canvas.createImage();
          img.onload = (): void => {
            resolve(img);
          };
          img.onerror = (): void => {
            if (retryCount < maxRetries) {
              retryCount++;
              setTimeout(doDownload, 500);
            } else {
              reject(new ComposeError(`图片加载失败（已重试）: ${fileID}`));
            }
          };
          img.src = tempPath;
        },
        fail: (err) => {
          reject(new ComposeError(`云文件下载失败: ${err.errMsg}`));
        },
      });
    }

    doDownload();
  });
}

// ============================================================
// 绘制函数
// ============================================================

/**
 * 绘制圆角图片
 * 使用 clip 路径截取圆角矩形区域后绘制图片
 */
export function drawRoundedImage(
  ctx: CanvasRenderingContext2D,
  img: WeappCanvasImage,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  ctx.save();

  // 创建圆角矩形裁剪路径
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
  ctx.clip();

  // 在裁剪区域内绘制图片
  ctx.drawImage(img as unknown as CanvasImageSource, x, y, w, h);

  ctx.restore();
}

/**
 * 绘制带阴影和描边的文字
 *
 * 绘制顺序：阴影 → 描边（可选） → 填充
 */
export function drawTextWithShadow(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  config: TextItemConfig,
): void {
  ctx.save();

  ctx.font = `${config.fontSize}px ${config.fontFamily}`;
  ctx.textAlign = config.textAlign;
  ctx.textBaseline = 'middle';

  // 阴影
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  // 描边
  if (config.strokeColor && config.strokeWidth && config.strokeWidth > 0) {
    ctx.strokeStyle = config.strokeColor;
    ctx.lineWidth = config.strokeWidth;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
  }

  // 填充
  ctx.fillStyle = config.color;
  ctx.fillText(text, x, y);

  ctx.restore();
}

/**
 * 绘制背景
 * 支持纯色填充和线性渐变
 */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  config: BackgroundConfig,
  width: number,
  height: number,
): void {
  ctx.save();

  if (config.type === 'solid') {
    ctx.fillStyle = config.colors[0] ?? '#000000';
    ctx.fillRect(0, 0, width, height);
  } else if (config.type === 'gradient') {
    const angle = config.angle ?? 0;
    const { x0, y0, x1, y1 } = calculateGradientPoints(angle, width, height);

    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
    const colorCount = config.colors.length;

    if (colorCount === 0) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
    } else if (colorCount === 1) {
      const singleColor = config.colors[0] ?? '#000000';
      gradient.addColorStop(0, singleColor);
      gradient.addColorStop(1, singleColor);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    } else {
      const step = 1 / (colorCount - 1);
      for (let i = 0; i < colorCount; i++) {
        const color = config.colors[i];
        if (color) {
          gradient.addColorStop(i * step, color);
        }
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
  }

  ctx.restore();
}

/**
 * 绘制装饰元素
 * 支持矩形和圆形装饰，可设置旋转和透明度
 */
export function drawDecorations(
  ctx: CanvasRenderingContext2D,
  decorations: DecorationConfig[],
): void {
  for (const deco of decorations) {
    ctx.save();

    if (deco.type === 'rect' && deco.color) {
      const rectW = deco.w;
      const rectH = deco.h;
      if (rectW === undefined || rectH === undefined) {
        ctx.restore();
        continue;
      }
      ctx.fillStyle = deco.color;

      if (deco.rotation !== undefined && deco.rotation !== 0) {
        const rad = (deco.rotation * Math.PI) / 180;
        const halfW = rectW / 2;
        const halfH = rectH / 2;
        ctx.translate(deco.x + halfW, deco.y + halfH);
        ctx.rotate(rad);
        ctx.fillRect(-halfW, -halfH, rectW, rectH);
      } else {
        ctx.fillRect(deco.x, deco.y, rectW, rectH);
      }
    } else if (deco.type === 'circle' && deco.color) {
      ctx.fillStyle = deco.color;
      ctx.beginPath();
      ctx.arc(deco.x, deco.y, 30, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

/**
 * 绘制主题边框
 * 根据 frame.type 选择绘制方式：
 * - 'draw': 从注册表中查找绘制函数
 * - 'image': 当前版本暂不支持（需预加载图片）
 */
export function drawFrameByConfig(
  ctx: CanvasRenderingContext2D,
  config: FrameConfig,
): void {
  if (config.type === 'draw') {
    const drawer = FRAME_DRAWERS[config.source];
    if (drawer) {
      drawer(ctx, config);
    } else {
      drawDefaultFrame(ctx, config);
    }
  }
  // type === 'image' 需要预加载图片覆盖层，初始版本暂不实现
}

// ============================================================
// Canvas 导出 & 上传
// ============================================================

/**
 * 将 Canvas 内容导出为 PNG 临时文件
 */
function exportCanvas(
  canvas: WeappCanvas,
  width: number,
  height: number,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvas: canvas as unknown as WechatMiniprogram.OffscreenCanvas,
      x: 0,
      y: 0,
      width,
      height,
      destWidth: width,
      destHeight: height,
      fileType: 'png',
      success: (res) => {
        resolve(res.tempFilePath);
      },
      fail: (err) => {
        reject(new ComposeError(`Canvas 导出失败: ${err.errMsg}`));
      },
    });
  });
}

/**
 * 将临时文件上传到云存储
 * 路径: theme-images/{themeId}_{timestamp}_{random}.png
 */
function uploadResultFile(
  tempPath: string,
  themeId: string,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    const cloudPath = `theme-images/${themeId}_${timestamp}_${random}.png`;

    Taro.cloud.uploadFile({
      cloudPath,
      filePath: tempPath,
      success: (res) => {
        resolve(res.fileID);
      },
      fail: (err) => {
        reject(new ComposeError(`云存储上传失败: ${err.errMsg}`));
      },
    });
  });
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 根据角度计算线性渐变的起止点坐标
 *
 * 角度参考 CSS linear-gradient：
 * - 0deg = 从上到下（默认）
 * - 90deg = 从左到右
 * - 180deg = 从下到上
 * - 270deg = 从右到左
 */
function calculateGradientPoints(
  angle: number,
  width: number,
  height: number,
): { x0: number; y0: number; x1: number; y1: number } {
  const normalizedAngle = ((angle % 360) + 360) % 360;

  // 优化常见角度，避免浮点计算误差
  if (normalizedAngle === 0) {
    return { x0: width / 2, y0: 0, x1: width / 2, y1: height };
  }
  if (normalizedAngle === 90) {
    return { x0: 0, y0: height / 2, x1: width, y1: height / 2 };
  }
  if (normalizedAngle === 180) {
    return { x0: width / 2, y0: height, x1: width / 2, y1: 0 };
  }
  if (normalizedAngle === 270) {
    return { x0: width, y0: height / 2, x1: 0, y1: height / 2 };
  }

  // 通用角度计算
  const rad = (normalizedAngle * Math.PI) / 180;
  const centerX = width / 2;
  const centerY = height / 2;
  const len = Math.sqrt(width * width + height * height) / 2;
  const dx = Math.sin(rad) * len;
  const dy = -Math.cos(rad) * len;

  return {
    x0: centerX - dx,
    y0: centerY - dy,
    x1: centerX + dx,
    y1: centerY + dy,
  };
}
