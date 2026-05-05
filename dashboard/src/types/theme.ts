/** 主题配置 - frame 部分（旧版兼容） */
export interface ThemeFrameConfig {
  frameImageId: string
  borderWidth: number
  borderRadius: number
  overlayColor: string
  overlayOpacity: number
}

/** 主题配置 - compose 部分（旧版兼容） */
export interface ThemeComposeConfig {
  imageScale: number
  offsetX: number
  offsetY: number
  textTemplate: string
  textColor: string
  fontSize: number
  textX: number
  textY: number
}

/** 旧版主题完整配置 */
export interface ThemeConfig {
  frame: ThemeFrameConfig
  compose: ThemeComposeConfig
}

/** 主题状态 */
export type ThemeStatus = 'active' | 'inactive'

/** 主题（新版） */
export interface Theme {
  id: number
  themeId: string
  projectId: string
  name: string
  description: string | null
  shortName: string | null
  gameName: string
  previewImageUrl: string | null
  status: ThemeStatus
  sortOrder: number
  usageCount: number
  config: ThemeConfig
  templateMarkup: string | null
  cssClasses: string[]
  createdAt?: string
  updatedAt?: string
}

/** 主题表单数据（编辑/创建用） */
export interface ThemeFormData {
  name: string
  description?: string
  shortName?: string
  gameName: string
  previewImageUrl: string
  status: ThemeStatus
  templateMarkup: string
  cssClasses: string[]
  configJson?: string // 旧版兼容
}

/** Theme Class */
export interface ThemeClassItem {
  classId: string
  name: string
  cssProperties: Record<string, string>
  category: 'official' | 'community'
  description: string | null
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

/** Theme Class 表单数据 */
export interface ThemeClassFormData {
  name: string
  cssProperties: Record<string, string>
  category: 'official' | 'community'
  description?: string
}
