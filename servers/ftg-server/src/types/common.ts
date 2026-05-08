/**
 * 通用类型定义
 */

/** 分页参数 */
export interface PageParams {
  page: number;
  pageSize: number;
}

/** 排序方向 */
export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

/** 时间范围 */
export interface DateRange {
  start: Date;
  end: Date;
}
