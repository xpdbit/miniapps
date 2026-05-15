/**
 * 种子随机数生成器（Mulberry32 算法）
 * 用于可重现的随机结果（如地图生成、掉落判定）
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /** 返回 [0, 1) 区间的伪随机数 */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** 返回 [min, max] 区间的随机整数 */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** 按概率返回 true */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** 从数组中随机选一个元素 */
  pick<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)]!;
  }
}

/** 从数组中随机选一个元素 */
export function pickRandom<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]!;
}

/** 带权重的随机选择 */
export function weightedRandom<T extends { weight: number }>(items: T[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item;
  }
  return items[items.length - 1]!;
}
