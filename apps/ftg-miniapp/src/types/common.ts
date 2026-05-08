/**
 * 通用类型定义
 */

/** 可空类型 */
export type Nullable<T> = T | null;

/** 可选部分字段 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** 必选部分字段 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/** 时间范围 */
export interface TimeRange {
  /** 开始时间 (ISO格式) */
  start: string;
  /** 结束时间 (ISO格式) */
  end: string;
}

/** 排序方向 */
export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

/** 排序配置 */
export interface SortConfig {
  /** 排序字段 */
  field: string;
  /** 排序方向 */
  order: SortOrder;
}

/** 微信云数据库查询条件 */
export type QueryCondition = Record<string, unknown>;

/** 进度信息 */
export interface Progress {
  /** 当前进度 */
  current: number;
  /** 目标值 */
  target: number;
  /** 百分比 */
  percentage: number;
}

/** 图片尺寸 */
export interface ImageSize {
  width: number;
  height: number;
}

/** 分享卡片配置 */
export interface ShareCardConfig {
  /** 零食图云文件ID */
  foodImageId: string;
  /** 食物名称 */
  foodName: string;
  /** 游戏化描述 */
  gameDescription: string;
  /** 位置名称 */
  locationName: string;
  /** 主题ID */
  themeId: string;
  /** 用户昵称 */
  nickname: string;
  /** 用户头像 */
  avatarUrl: string;
}
