/**
 * 主题相关类型定义
 */

/** 主题边框配置 */
export interface ThemeFrameConfig {
  /** 边框图片云文件ID */
  frameImageId: string;
  /** 边框宽度 (px) */
  borderWidth: number;
  /** 圆角半径 */
  borderRadius: number;
  /** 叠加层颜色 (rgba) */
  overlayColor: string;
  /** 叠加层透明度 0-1 */
  overlayOpacity: number;
}

/** 主题合成配置 */
export interface ComposeConfig {
  /** 食物图片缩放比例 0-1 */
  imageScale: number;
  /** 食物图片 X 偏移 (px) */
  offsetX: number;
  /** 食物图片 Y 偏移 (px) */
  offsetY: number;
  /** 文案模板 */
  textTemplate: string;
  /** 文案字体颜色 */
  textColor: string;
  /** 文案字体大小 */
  fontSize: number;
  /** 文案 X 位置 */
  textX: number;
  /** 文案 Y 位置 */
  textY: number;
}

/** 主题完整配置 */
export interface ThemeConfig {
  /** 边框配置 */
  frame: ThemeFrameConfig;
  /** 合成配置 */
  compose: ComposeConfig;
}

/** 主题定义 */
export interface Theme {
  /** 主题唯一ID */
  themeId: string;
  /** 主题名称 */
  name: string;
  /** 游戏名称 (如 "塞尔达传说") */
  gameName: string;
  /** 主题合成配置 */
  frameConfig: ThemeConfig;
  /** 预览图云文件ID */
  previewImageUrl: string;
  /** 是否启用 */
  isActive: boolean;
  /** 排序序号 */
  sortOrder: number;
}

/** Canvas 合成请求参数 */
export interface ComposeRequest {
  /** 食物原图云文件ID */
  foodImageFileID: string;
  /** 目标主题ID */
  themeId: string;
  /** 食物名称 */
  foodName: string;
  /** 食物类型 */
  foodType: string;
  /** 游戏化描述文本 */
  gameDescription: string;
}

/** Canvas 合成结果 */
export interface ComposeResult {
  /** 合成结果图片云文件ID */
  resultFileID: string;
  /** 合成耗时 (ms) */
  processingTime: number;
  /** 图片宽度 */
  width: number;
  /** 图片高度 */
  height: number;
}
