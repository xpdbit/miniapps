/**
 * 模板引擎相关类型定义
 */

/** CSS Class 数据 */
export interface ThemeClassData {
  classId: string;
  projectId: string;
  name: string;
  cssProperties: Record<string, string>;
  category: 'official' | 'community';
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Class 列表输出项 */
export interface ClassListItem {
  classId: string;
  name: string;
  cssProperties: Record<string, string>;
  category: string;
  description: string | null;
  isActive: boolean;
}

/** CSS 属性校验结果 */
export interface CssValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** 模板渲染输入 */
export interface RenderInput {
  templateMarkup: string;
  cssClasses: ThemeClassData[];
  data: Record<string, string>;
  mode: 'miniapp' | 'h5';
}

/** 模板渲染输出 */
export interface RenderResult {
  html: string;
  css: string;
  usedClasses: string[];
}

/** 创建 ThemeClass 输入 */
export interface CreateClassInput {
  name: string;
  cssProperties: Record<string, string>;
  category?: 'official' | 'community';
  description?: string;
  projectId?: string;
}

/** 更新 ThemeClass 输入 */
export interface UpdateClassInput {
  name?: string;
  cssProperties?: Record<string, string>;
  category?: 'official' | 'community';
  description?: string;
  isActive?: boolean;
}
