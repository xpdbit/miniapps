/**
 * 主题相关类型定义
 */

/** 主题边框配置（旧版兼容） */
export interface ThemeFrameConfig {
  frameImageId: string;
  borderWidth: number;
  borderRadius: number;
  overlayColor: string;
  overlayOpacity: number;
}

/** 主题合成配置（旧版兼容） */
export interface ComposeConfig {
  imageScale: number;
  offsetX: number;
  offsetY: number;
  textTemplate: string;
  textColor: string;
  fontSize: number;
  textX: number;
  textY: number;
}

/** 旧版主题完整配置 */
export interface ThemeConfig {
  frame: ThemeFrameConfig;
  compose: ComposeConfig;
}

/** 主题数据库模型 */
export interface Theme {
  id: number;
  themeId: string;
  projectId: string;
  name: string;
  description: string | null;
  shortName: string | null;
  gameName: string;
  configJson: Record<string, unknown> | null;
  templateMarkup: string | null;
  cssClasses: string[];
  previewImageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}
