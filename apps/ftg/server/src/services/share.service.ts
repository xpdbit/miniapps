/**
 * 分享卡片生成服务
 *
 * 使用 sharp 在服务端合成分享卡片图片，包含食物图片�?
 * 食物名称、游戏风格描述和主题装饰框�?
 *
 * ⚠️ 注意：不使用 Canvas（服务端无头浏览器开销大、不稳定），
 * 所有合成操作均通过 sharp + SVG overlay 实现�?
 */
import prisma from '../lib/prisma';
import { getStorageProvider, buildStoragePath } from '../lib/storage-factory';
import httpClient from '../lib/http-client';
import sharp from 'sharp';
import logger from '../utils/logger';

// ============================================================
// 常量
// ============================================================

/** 分享卡片宽度 */
const CARD_WIDTH = 600;
/** 分享卡片高度 */
const CARD_HEIGHT = 800;
/** 底部文本面板外边�?*/
const PANEL_MARGIN = 24;
/** 底部文本面板圆角 */
const PANEL_RADIUS = 16;
/** 底部文本面板高度 */
const PANEL_HEIGHT = 210;
/** 品牌标签文字 */
const BRAND_TEXT = '🎨 美食主题生成器';

// ============================================================
// 辅助函数
// ============================================================

/** XML 转义（防�?SVG 注入�?*/
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 截断文本到最大长度（保留末尾省略号） */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * 按单词换行，每行不超�?maxChars 个字�?
 * 对中文等无空格文字做硬截断兜�?
 */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  if (!text) return [''];

  const lines: string[] = [];
  const words = text.split(/\s+/);
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length > maxCharsPerLine && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }
  if (currentLine) lines.push(currentLine);

  // 兜底：如果第一行仍然超长（无空格长文本），强制截断
  if (lines.length === 1 && lines[0].length > maxCharsPerLine) {
    const hardWrapped: string[] = [];
    for (let i = 0; i < lines[0].length; i += maxCharsPerLine) {
      hardWrapped.push(lines[0].substring(i, i + maxCharsPerLine));
    }
    return hardWrapped;
  }

  return lines;
}

/**
 * 生成叠层文本 SVG（底部半透明面板 + 食物名称 + 描述 + 品牌�?
 */
function generateTextSvg(foodName: string, gameDesc: string): Buffer {
  const panelTop = CARD_HEIGHT - PANEL_HEIGHT - PANEL_MARGIN;
  const panelLeft = PANEL_MARGIN;
  const panelWidth = CARD_WIDTH - PANEL_MARGIN * 2;

  // 换行处理
  const nameLines = wrapText(foodName, 18).slice(0, 2);
  const descLines = wrapText(gameDesc, 36).slice(0, 3);

  // 构建描述文本�?<tspan> �?
  const lineHeight = 26;
  let descTspans = '';
  descLines.forEach((line, idx) => {
    const dy = idx === 0 ? '0' : `${lineHeight}`;
    descTspans += `<tspan x="${CARD_WIDTH / 2}" dy="${dy}">${escapeXml(line)}</tspan>`;
  });

  // 名称最�?2 �?
  let nameTspans = '';
  nameLines.forEach((line, idx) => {
    const dy = idx === 0 ? '0' : '36';
    nameTspans += `<tspan x="${CARD_WIDTH / 2}" dy="${dy}">${escapeXml(line)}</tspan>`;
  });

  const svg = `<?xml version="1.0" encoding="utf-8"?>
<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .panel-bg { fill: rgba(0,0,0,0.55); }
      .food-name { fill: #ffffff; font-size: 28px; font-weight: 700; font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif; }
      .game-desc { fill: rgba(255,255,255,0.85); font-size: 15px; font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif; }
      .brand { fill: rgba(255,255,255,0.4); font-size: 12px; font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif; letter-spacing: 2px; }
    </style>
  </defs>

  <!-- 底部半透明面板 -->
  <rect x="${panelLeft}" y="${panelTop}" width="${panelWidth}" height="${PANEL_HEIGHT}" rx="${PANEL_RADIUS}" class="panel-bg"/>

  <!-- 食物名称 -->
  <text x="${CARD_WIDTH / 2}" y="${panelTop + 52}" text-anchor="middle" class="food-name">${nameTspans}</text>

  <!-- 游戏风格描述 -->
  <text x="${CARD_WIDTH / 2}" y="${panelTop + 110}" text-anchor="middle" class="game-desc">${descTspans}</text>

  <!-- 品牌标注 -->
  <text x="${CARD_WIDTH / 2}" y="${panelTop + PANEL_HEIGHT - 18}" text-anchor="middle" class="brand">${BRAND_TEXT}</text>
</svg>`;

  return Buffer.from(svg);
}

// ============================================================
// 主服务函�?
// ============================================================

/**
 * 生成食物记录的分享卡�?
 *
 * 流程�?
 * 1. 校验食物记录所有权
 * 2. 下载食物图片�? 主题装饰图）
 * 3. 使用 sharp 合成卡片（food image �?theme frame �?text overlay�?
 * 4. 上传至存储服�?
 * 5. 返回可公开访问�?URL
 *
 * @param foodRecordId - 食物记录 ID
 * @param userUuid       - 当前用户 ID
 * @returns 包含分享卡片图片 URL 的对�?
 * @throws 记录不存�?/ 无权操作 / 无图片时抛出 Error
 */
export async function generateShareCard(
  foodRecordId: number,
  userUuid: number,
): Promise<{ shareImageUrl: string }> {
  // 1. 校验所有权
  const record = await prisma.ftgFoodRecord.findFirst({
    where: { id: foodRecordId, userUuid, isDeleted: false },
    select: {
      id: true,
      imageUrl: true,
      themeImageUrl: true,
      foodName: true,
      gameDescription: true,
      aiDescGameStyle: true,
    },
  });

  if (!record) {
    throw new Error('记录不存在或无权操作');
  }

  if (!record.imageUrl) {
    throw new Error('该记录没有图片，无法生成分享卡片');
  }

  // 2. 下载图片资源
  const fetchImage = async (url: string): Promise<Buffer> => {
    const response = await httpClient.get(url, {
      responseType: 'arraybuffer',
      timeout: 15_000,
    });
    return Buffer.from(response.data);
  };

  const [foodImageBuffer] = await Promise.all([fetchImage(record.imageUrl)]);

  // 可选：下载主题装饰图（失败不回退�?
  let themeOverlayBuffer: Buffer | null = null;
  if (record.themeImageUrl) {
    try {
      themeOverlayBuffer = await fetchImage(record.themeImageUrl);
    } catch (error) {
      logger.warn('主题装饰图下载失败，跳过合成', {
        url: record.themeImageUrl,
        error: (error as Error).message,
      });
    }
  }

  // 3. 准备文本内容
  const foodName = record.foodName || '美食';
  const gameDesc = truncateText(
    record.gameDescription || record.aiDescGameStyle || '',
    150,
  );

  // 生成 SVG 文本叠层
  const textSvgBuffer = generateTextSvg(foodName, gameDesc);

  // 4. 合成分享卡片
  // 图层顺序（从下到上）:
  //   a. 食物图片（缩放填�?600×800�?
  //   b. 主题装饰框（可选）
  //   c. SVG 文本叠层（底部面�?+ 名称 + 描述 + 品牌�?
  const compositeLayers: sharp.OverlayOptions[] = [
    ...(themeOverlayBuffer
      ? [{ input: themeOverlayBuffer, top: 0, left: 0 } as sharp.OverlayOptions]
      : []),
    { input: textSvgBuffer, top: 0, left: 0 },
  ];

  try {
    const compositedBuffer = await sharp(foodImageBuffer)
      .resize(CARD_WIDTH, CARD_HEIGHT, { fit: 'cover', position: 'centre' })
      .composite(compositeLayers)
      .jpeg({ quality: 92, progressive: true })
      .toBuffer();

    // 5. 上传至存�?
    const storage = getStorageProvider();
    const key = buildStoragePath(userUuid, 'share-card', 'jpg');
    const shareImageUrl = await storage.upload(key, compositedBuffer, 'image/jpeg');

    logger.info('分享卡片生成成功', { foodRecordId, userUuid, shareImageUrl });

    return { shareImageUrl };
  } catch (error) {
    logger.error('分享卡片合成失败', {
      foodRecordId,
      userUuid,
      error: (error as Error).message,
    });
    throw new Error('分享卡片生成失败');
  }
}
