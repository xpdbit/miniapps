/**
 * 分享卡片生成器
 *
 * 使用 Taro.createOffscreenCanvas + Canvas 2D 在客户端合成分享卡片。
 * 输出：PNG 格式临时文件路径，可直接用于 wx.shareAppMessage / wx.previewImage。
 *
 * Canvas 尺寸：750 x 1334 px（微信分享卡片推荐比例）
 */

import Taro from '@tarojs/taro';
import { CANVAS_SIZE } from '@/constants/themeDefaults';
import type { ShareCardConfig } from '@/types/common';

const CANVAS_WIDTH = CANVAS_SIZE.width;   // 750
const CANVAS_HEIGHT = CANVAS_SIZE.height;  // 1334

/** 主色调常量 */
const COLOR_PRIMARY = '#FF6B35';
const COLOR_TEXT_LIGHT = '#FFFFFF';
const COLOR_TEXT_SECONDARY = 'rgba(255, 255, 255, 0.75)';
const COLOR_CTA_BG = 'rgba(255, 255, 255, 0.15)';
const COLOR_QR_PLACEHOLDER = 'rgba(255, 255, 255, 0.2)';

/**
 * 微信小程序 OffscreenCanvas 的扩展接口
 * 标准 canvas 类型不包含 WeChat 特有的 createImage 方法
 */
interface WeChatCanvas {
  createImage(): HTMLImageElement;
  getContext(contextType: '2d'): CanvasRenderingContext2D | null;
}

/**
 * 绘制圆角矩形路径
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * 在画布上绘制图片（含加载容错）
 */
async function drawFoodImage(
  ctx: CanvasRenderingContext2D,
  canvas: WeChatCanvas,
  src: string
): Promise<void> {
  try {
    const imageInfo = await Taro.getImageInfo({ src });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = canvas.createImage();
      image.onload = () => {
        resolve(image);
      };
      image.onerror = () => {
        reject(new Error('图片加载失败'));
      };
      image.src = src;
    });

    const maxSize = 500;
    let drawW: number;
    let drawH: number;

    if (imageInfo.width >= imageInfo.height) {
      drawW = maxSize;
      drawH = (imageInfo.height / imageInfo.width) * maxSize;
    } else {
      drawH = maxSize;
      drawW = (imageInfo.width / imageInfo.height) * maxSize;
    }

    const offsetX = (CANVAS_WIDTH - drawW) / 2;
    const offsetY = 200 + (maxSize - drawH) / 2;

    // 绘制圆角图片
    ctx.save();
    roundRect(ctx, offsetX, offsetY, drawW, drawH, 24);
    ctx.clip();
    // WeChat Image 可安全作为 CanvasImageSource 使用
    ctx.drawImage(img as unknown as CanvasImageSource, offsetX, offsetY, drawW, drawH);
    ctx.restore();

    // 图片边框
    ctx.save();
    roundRect(ctx, offsetX, offsetY, drawW, drawH, 24);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
  } catch {
    // 图片加载失败时绘制占位区域
    const placeholderX = (CANVAS_WIDTH - 400) / 2;
    const placeholderY = 250;

    ctx.save();
    roundRect(ctx, placeholderX, placeholderY, 400, 400, 24);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = COLOR_TEXT_SECONDARY;
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🍽️', CANVAS_WIDTH / 2, 450);
  }
}

/**
 * 简单文本换行：按最大宽度切分行
 */
function wrapText(
  text: string,
  fontSize: number,
  maxWidth: number
): string[] {
  if (text.length === 0) return [''];

  const charWidthMap = (char: string): number => {
    const code = char.charCodeAt(0);
    if (code >= 0x4e00 && code <= 0x9fff) {
      return fontSize;
    }
    return fontSize * 0.6;
  };

  const lines: string[] = [];
  let currentLine = '';
  let currentWidth = 0;

  for (const char of text) {
    const charWidth = charWidthMap(char);
    if (currentWidth + charWidth > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = char;
      currentWidth = charWidth;
    } else {
      currentLine += char;
      currentWidth += charWidth;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * 生成分享卡片
 *
 * @param config - 分享卡片配置
 * @returns 临时文件路径
 */
export async function generateShareCard(
  config: ShareCardConfig
): Promise<string> {
  // 创建离屏 Canvas
  // Taro 4.x 返回的 OffscreenCanvas 在运行时是 WeChat OffscreenCanvas
  const rawCanvas = Taro.createOffscreenCanvas({
    type: '2d',
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  });

  // 获取 Canvas 2D 上下文
  const ctx = (
    rawCanvas as unknown as WeChatCanvas
  ).getContext('2d') as CanvasRenderingContext2D;

  // ============================================================
  // 1. 绘制渐变背景
  // ============================================================
  const bgGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  bgGradient.addColorStop(0, COLOR_PRIMARY);
  bgGradient.addColorStop(0.5, '#E55A2B');
  bgGradient.addColorStop(1, '#1A1A2E');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 装饰性圆形光晕
  ctx.save();
  const glowGradient = ctx.createRadialGradient(
    CANVAS_WIDTH / 2,
    300,
    0,
    CANVAS_WIDTH / 2,
    300,
    400
  );
  glowGradient.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
  glowGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glowGradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, 700);
  ctx.restore();

  // ============================================================
  // 2. 绘制食物图片
  // ============================================================
  await drawFoodImage(
    ctx,
    rawCanvas as unknown as WeChatCanvas,
    config.foodImageId
  );

  // ============================================================
  // 3. 绘制食物名称
  // ============================================================
  ctx.save();
  ctx.fillStyle = COLOR_TEXT_LIGHT;
  ctx.font = 'bold 56px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 8;
  ctx.fillText(config.foodName, CANVAS_WIDTH / 2, 780);
  ctx.restore();

  // ============================================================
  // 4. 绘制游戏化描述
  // ============================================================
  ctx.fillStyle = COLOR_TEXT_SECONDARY;
  ctx.font = '28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const descLines = wrapText(config.gameDescription, 28, CANVAS_WIDTH - 120);
  const descStartY = 860;
  descLines.forEach((line, idx) => {
    ctx.fillText(line, CANVAS_WIDTH / 2, descStartY + idx * 44);
  });

  // ============================================================
  // 5. 绘制位置信息
  // ============================================================
  if (config.locationName && config.locationName.length > 0) {
    ctx.fillStyle = COLOR_TEXT_SECONDARY;
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `📍 ${config.locationName}`,
      CANVAS_WIDTH / 2,
      descStartY + descLines.length * 44 + 50
    );
  }

  // ============================================================
  // 6. 绘制 CTA 按钮
  // ============================================================
  const ctaY = 1060;
  const ctaWidth = 400;
  const ctaHeight = 64;
  const ctaX = (CANVAS_WIDTH - ctaWidth) / 2;

  ctx.save();
  roundRect(ctx, ctaX, ctaY, ctaWidth, ctaHeight, 32);
  ctx.fillStyle = COLOR_CTA_BG;
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = COLOR_TEXT_LIGHT;
  ctx.font = '28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('扫码体验更多', CANVAS_WIDTH / 2, ctaY + ctaHeight / 2);

  // ============================================================
  // 7. 绘制二维码占位区域
  // ============================================================
  const qrSize = 120;
  const qrX = (CANVAS_WIDTH - qrSize) / 2;
  const qrY = 1160;

  ctx.save();
  roundRect(ctx, qrX, qrY, qrSize, qrSize, 12);
  ctx.fillStyle = COLOR_QR_PLACEHOLDER;
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = COLOR_TEXT_SECONDARY;
  ctx.font = '40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('📱', CANVAS_WIDTH / 2, qrY + qrSize / 2);

  // ============================================================
  // 8. 导出为临时文件
  // ============================================================
  // 使用 wx.canvasToTempFilePath（WeChat 原生 API），
  // Taro.createOffscreenCanvas 返回的 canvas 可在运行时直接传入
  const tempRes = await new Promise<{
    tempFilePath: string;
  }>((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvas: rawCanvas as unknown as WechatMiniprogram.IAnyObject,
      x: 0,
      y: 0,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      destWidth: CANVAS_WIDTH,
      destHeight: CANVAS_HEIGHT,
      fileType: 'png',
      quality: 1,
      success: (res) => {
        resolve(res);
      },
      fail: (err) => {
        reject(err);
      },
    });
  });

  return tempRes.tempFilePath;
}
