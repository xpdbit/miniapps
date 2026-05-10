/** 格式化数字（中文单位：万/亿） */
export function formatNumber(value: number): string {
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(2)}亿`;
  }
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万`;
  }
  return Math.floor(value).toLocaleString();
}

/** 格式化金币 */
export function formatGold(value: number): string {
  return `🪙 ${formatNumber(value)}`;
}

/** 格式化钻石 */
export function formatGems(value: number): string {
  return `💎 ${formatNumber(value)}`;
}

/** 格式化秒数为可读时间 */
export function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${Math.floor(seconds % 60)}秒`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}小时${mins}分`;
}

/** 格式化短时间（不显示秒） */
export function formatTimeShort(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/** 格式化经验值 */
export function formatExp(current: number, needed: number): string {
  return `${current.toLocaleString()} / ${needed.toLocaleString()}`;
}

/** 格式化进度百分比 */
export function formatPercent(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}
