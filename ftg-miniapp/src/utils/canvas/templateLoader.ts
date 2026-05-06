/**
 * ============================================================
 * 主题模板加载器
 * 负责加载、缓存和降级处理主题绘制配置
 * ============================================================
 */

import Taro from '@tarojs/taro';

// ============================================================
// 内置模板
// ============================================================

// 使用 resolveJsonModule 直接导入 JSON 配置
import stardewValleyConfig from './themes/stardew_valley.json';
import dontStarveConfig from './themes/dont_starve.json';
import zeldaCookingConfig from './themes/zelda_cooking.json';

// ============================================================
// 类型定义 - 主题绘制配置
// ============================================================

/** 画布尺寸 */
export interface CanvasSize {
  width: number;
  height: number;
}

/** 背景配置 */
export interface BackgroundConfig {
  type: 'gradient' | 'solid';
  colors: string[];
  angle?: number;
}

/** 食物图片配置 */
export interface FoodImageConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius: number;
}

/** 边框配置 */
export interface FrameConfig {
  type: 'image' | 'draw';
  source: string;
  x: number;
  y: number;
  width: number;
  height: number;
  borderWidth?: number;
  color?: string;
  secondaryColor?: string;
}

/** 文字绘制配置 */
export interface TextItemConfig {
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  textAlign: CanvasTextAlign;
  strokeColor?: string;
  strokeWidth?: number;
}

/** 文字配置组 */
export interface TextConfig {
  foodName: TextItemConfig;
  gameDesc: TextItemConfig;
}

/** 装饰元素配置 */
export interface DecorationConfig {
  type: 'rect' | 'circle' | 'image';
  x: number;
  y: number;
  w?: number;
  h?: number;
  color?: string;
  source?: string;
  rotation?: number;
}

/** 完整主题绘制配置 */
export interface ThemeDrawConfig {
  themeId: string;
  name: string;
  canvasSize: CanvasSize;
  background: BackgroundConfig;
  foodImage: FoodImageConfig;
  frame: FrameConfig;
  text: TextConfig;
  decorations: DecorationConfig[];
}

/** 内置模板映射表 */
const BUILT_IN_TEMPLATES: Record<string, ThemeDrawConfig> = {
  stardew_valley: stardewValleyConfig as ThemeDrawConfig,
  dont_starve: dontStarveConfig as ThemeDrawConfig,
  zelda_cooking: zeldaCookingConfig as ThemeDrawConfig,
};

// ============================================================
// 默认配置（降级用）
// ============================================================

/** 当加载失败时的默认绘制配置 */
const DEFAULT_DRAW_CONFIG: ThemeDrawConfig = {
  themeId: 'default',
  name: '默认模板',
  canvasSize: { width: 750, height: 1334 },
  background: {
    type: 'gradient',
    colors: ['#2c3e50', '#3498db'],
    angle: 180,
  },
  foodImage: {
    x: 125,
    y: 300,
    width: 500,
    height: 500,
    borderRadius: 16,
  },
  frame: {
    type: 'draw',
    source: 'default_frame',
    x: 20,
    y: 20,
    width: 710,
    height: 1294,
    borderWidth: 4,
    color: '#FFFFFF',
    secondaryColor: '#CCCCCC',
  },
  text: {
    foodName: {
      x: 375,
      y: 900,
      fontSize: 40,
      color: '#FFFFFF',
      fontFamily: 'sans-serif',
      textAlign: 'center',
      strokeColor: '#000000',
      strokeWidth: 3,
    },
    gameDesc: {
      x: 375,
      y: 970,
      fontSize: 26,
      color: '#DDDDDD',
      fontFamily: 'sans-serif',
      textAlign: 'center',
    },
  },
  decorations: [],
};

// ============================================================
// 缓存
// ============================================================

/** 模板配置内存缓存 */
const configCache = new Map<string, ThemeDrawConfig>();

// 预热缓存：启动时将内置模板载入缓存
for (const [themeId, config] of Object.entries(BUILT_IN_TEMPLATES)) {
  configCache.set(themeId, config);
}

// ============================================================
// 公开 API
// ============================================================

/**
 * 获取主题绘制配置
 *
 * 查找顺序：
 * 1. 内存缓存（包含预热的内置模板）
 * 2. 云存储远程配置（动态更新）
 * 3. 降级使用默认配置
 *
 * @param themeId - 主题唯一标识
 * @returns 主题绘制配置
 */
export async function getTemplateConfig(themeId: string): Promise<ThemeDrawConfig> {
  // 1. 检查缓存
  const cached = configCache.get(themeId);
  if (cached) {
    return cached;
  }

  // 2. 尝试从云存储加载远程配置
  try {
    const remoteConfig = await loadRemoteConfig(themeId);
    configCache.set(themeId, remoteConfig);
    return remoteConfig;
  } catch {
    console.warn(`[templateLoader] 远程模板加载失败，使用默认配置: ${themeId}`);
  }

  // 3. 降级：返回默认配置（themeId 替换为请求的 ID）
  const fallback: ThemeDrawConfig = {
    ...DEFAULT_DRAW_CONFIG,
    themeId,
    name: themeId,
  };
  configCache.set(themeId, fallback);
  return fallback;
}

/**
 * 预加载指定主题配置到缓存
 * @param themeId - 主题标识
 */
export async function preloadTemplate(themeId: string): Promise<void> {
  await getTemplateConfig(themeId);
}

/**
 * 清除指定主题的缓存
 * @param themeId - 主题标识（不传则清除全部）
 */
export function clearCache(themeId?: string): void {
  if (themeId) {
    configCache.delete(themeId);
  } else {
    configCache.clear();
  }
}

// ============================================================
// 内部辅助
// ============================================================

/** 远程模板下载超时 (ms) */
const REMOTE_TEMPLATE_TIMEOUT = 15000;

/**
 * 从云存储加载远程模板配置
 *
 * 约定路径: theme-templates/{themeId}.json
 * 格式与本地 JSON 配置一致
 *
 * @param themeId - 主题标识
 * @returns 主题绘制配置
 */
async function loadRemoteConfig(themeId: string): Promise<ThemeDrawConfig> {
  const cloudPath = `theme-templates/${themeId}.json`;

  // 带超时的云存储下载
  const res = await Promise.race([
    new Promise<{ tempFilePath: string }>((resolve, reject) => {
      Taro.cloud.downloadFile({
        fileID: cloudPath,
        success: (downloadRes) => {
          resolve({ tempFilePath: downloadRes.tempFilePath });
        },
        fail: (err) => {
          reject(new Error(`模板文件下载失败: ${err.errMsg}`));
        },
      });
    }),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `模板文件下载超时（${REMOTE_TEMPLATE_TIMEOUT / 1000}秒）: ${cloudPath}`,
          ),
        );
      }, REMOTE_TEMPLATE_TIMEOUT);
    }),
  ]);

  if (!res.tempFilePath) {
    throw new Error('云存储文件下载结果为空');
  }

  const fs = Taro.getFileSystemManager();
  const rawContent = fs.readFileSync(res.tempFilePath, 'utf-8');
  const content = typeof rawContent === 'string' ? rawContent : '';
  const config = JSON.parse(content) as ThemeDrawConfig;

  // 基础校验
  if (!config.themeId || !config.canvasSize) {
    throw new Error('远程模板配置格式无效');
  }

  return config;
}
