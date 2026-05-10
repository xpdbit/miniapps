/** 秒转毫秒 */
export function secondsToMs(seconds: number): number {
  return seconds * 1000;
}

/** 毫秒转秒 */
export function msToSeconds(ms: number): number {
  return ms / 1000;
}

/** 分钟转秒 */
export function minutesToSeconds(minutes: number): number {
  return minutes * 60;
}

/** 小时转秒 */
export function hoursToSeconds(hours: number): number {
  return hours * 3600;
}

/** 秒转分钟（取整） */
export function secondsToMinutes(seconds: number): number {
  return Math.floor(seconds / 60);
}

/** 获取当前时间戳（秒） */
export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** 检查是否在同一天 */
export function isSameDay(timestamp1: number, timestamp2: number): boolean {
  const d1 = new Date(timestamp1 * 1000);
  const d2 = new Date(timestamp2 * 1000);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/** 获取今日零点的时间戳（秒） */
export function todayStartSeconds(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor(start.getTime() / 1000);
}
