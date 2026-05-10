/** 限制值在 [min, max] 区间 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 线性插值 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 将值从 [inMin, inMax] 映射到 [outMin, outMax] */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

/** 浮点数近似相等 */
export function approxEqual(a: number, b: number, epsilon = 0.0001): boolean {
  return Math.abs(a - b) < epsilon;
}

/** 四舍五入到指定小数位 */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** 百分比计算 */
export function percent(value: number, total: number): number {
  if (total === 0) return 0;
  return (value / total) * 100;
}

/** 需要多少经验升级（通用曲线：100 * 1.15^(level-1)） */
export function expToNextLevel(level: number, baseExp = 100, growth = 1.15): number {
  return Math.floor(baseExp * growth ** (level - 1));
}

/** 获取两个值之间的随机整数 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
