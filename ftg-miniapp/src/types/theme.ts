/**
 * 主题相关类型定义（服务端对齐）
 */

/** 旧版主题边框配置（兼容） */
export interface ThemeFrameConfig {
  frameImageId: string;
  borderWidth: number;
  borderRadius: number;
  overlayColor: string;
  overlayOpacity: number;
}

/** 旧版主题合成配置（兼容） */
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

/** Theme Class 数据 */
export interface ThemeClassData {
  classId: string;
  name: string;
  cssProperties: Record<string, string>;
  category: 'official' | 'community';
  description: string | null;
}

/** 主题定义（服务端新版） */
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
  createdAt: string;
  updatedAt: string;
}

/** 模板渲染结果 */
export interface RenderResult {
  html: string;
  css: string;
  usedClasses: string[];
}

/** 主题使用统计 */
export interface ThemeUsageStats {
  totalUsage: number;
  uniqueUsers: number;
  recentUsage: { date: string; count: number }[];
}
