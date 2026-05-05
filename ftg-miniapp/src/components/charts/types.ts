/**
 * 图表组件通用类型定义
 */

/** Canvas 绘制尺寸 */
export interface ChartSize {
  width: number
  height: number
}

/** 折线图数据点 */
export interface LineChartData {
  date: string
  value: number
}

/** 饼图/环形图数据项 */
export interface PieChartData {
  label: string
  value: number
  color: string
}

/** 条形图数据项 */
export interface BarChartData {
  label: string
  value: number
}

/** 日历热力图数据点 */
export interface CalendarHeatmapData {
  date: string
  count: number
}
