// ─── 条件类型映射 ──────────────────────────────────────────

export const CONDITION_TYPE_MAP: Record<string, { label: string; color: string }> = {
  checkin_count: { label: '打卡次数', color: 'blue' },
  consecutive_days: { label: '连续天数', color: 'cyan' },
  food_type_count: { label: '食物类型数', color: 'green' },
  theme_count: { label: '主题数', color: 'purple' },
  morning_checkin: { label: '早起打卡', color: 'orange' },
  night_checkin: { label: '夜间打卡', color: 'geekblue' },
  shared_count: { label: '分享次数', color: 'magenta' },
  unique_food_count: { label: '不同食物数', color: 'lime' },
  daily_checkin_count: { label: '单日打卡次数', color: 'gold' },
  week_full_attendance: { label: '周全勤', color: 'volcano' },
}

export const CONDITION_VALUE_LABELS: Record<string, string> = {
  checkin_count: '累计打卡',
  consecutive_days: '连续',
  food_type_count: '尝试',
  theme_count: '收集',
  morning_checkin: '早起打卡',
  night_checkin: '夜间打卡',
  shared_count: '分享',
  unique_food_count: '不同食物',
  daily_checkin_count: '单日打卡',
  week_full_attendance: '要求天数',
}

export const getConditionTypeConfig = (type: string): { label: string; color: string } =>
  CONDITION_TYPE_MAP[type] ?? { label: type || '未知', color: 'default' }

export const getConditionValueLabel = (type: string): string =>
  CONDITION_VALUE_LABELS[type] ?? '目标值'

// ─── 工具函数 ──────────────────────────────────────────────

export const maskOpenId = (openId: string): string => {
  if (!openId) return '-'
  if (openId.length <= 6) return openId.slice(0, 3) + '***'
  return openId.slice(0, 3) + '****' + openId.slice(-4)
}
