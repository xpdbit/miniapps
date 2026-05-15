/**
 * cn() — 类名合并工具（参考 shadcn/ui 的 clsx + twMerge 模式）
 * 在 Taro 环境下替代 clsx：过滤 falsy 值并合并类名
 */
export function cn(...inputs: (string | undefined | null | false | 0)[]): string {
  return inputs.filter(Boolean).join(' ')
}

/**
 * 格式化数字（如 1234 → "1.2k"）
 */
export function formatCount(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + 'w'
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(n)
}

/**
 * 格式化时间为相对时间
 */
export function formatRelativeTime(dateStr: string | number): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
