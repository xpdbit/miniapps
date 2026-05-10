import { SeededRandom } from '../../utils/random';

// ---------------------------------------------------------------------------
// 核心类型
// ---------------------------------------------------------------------------

export enum BiomeType {
  Plains = 'plains',
  Forest = 'forest',
  Desert = 'desert',
  Frost = 'frost',
  Volcanic = 'volcanic',
  Mystic = 'mystic',
}

export interface Region {
  id: string;
  name: string;
  description: string;
  biome: BiomeType;
  minLevel: number;
  maxLevel: number;
  difficulty: number;
  enemyPool: string[];
  resourceMultiplier: number;
  specialFeatures: string[];
}

// ---------------------------------------------------------------------------
// 预设区域（6 个，覆盖 Lv1-100）
// ---------------------------------------------------------------------------

const REGIONS: Region[] = [
  {
    id: 'green_plains',
    name: '绿色平原',
    description: '一望无际的草原，适合新手冒险者。',
    biome: BiomeType.Plains,
    minLevel: 1,
    maxLevel: 10,
    difficulty: 1,
    enemyPool: ['slime', 'rabbit', 'skeleton_weak'],
    resourceMultiplier: 1.0,
    specialFeatures: ['野花丛', '小溪', '废弃农场'],
  },
  {
    id: 'whispering_forest',
    name: '低语森林',
    description: '古老而神秘的森林，隐藏着无数秘密。',
    biome: BiomeType.Forest,
    minLevel: 10,
    maxLevel: 25,
    difficulty: 2,
    enemyPool: ['wolf', 'spider', 'treant', 'bandit'],
    resourceMultiplier: 1.5,
    specialFeatures: ['精灵遗迹', '魔法泉水', '树洞藏宝'],
  },
  {
    id: 'sands_of_despair',
    name: '绝望沙海',
    description: '炙热无垠的沙漠，风中夹杂着远古低语。',
    biome: BiomeType.Desert,
    minLevel: 25,
    maxLevel: 40,
    difficulty: 3,
    enemyPool: ['scorpion', 'mummy', 'sand_worm', 'nomad'],
    resourceMultiplier: 2.0,
    specialFeatures: ['绿洲', '金字塔', '流沙陷阱'],
  },
  {
    id: 'frost_peaks',
    name: '冰霜之巅',
    description: '终年积雪的险峻山脉，蕴藏着冰封的宝藏。',
    biome: BiomeType.Frost,
    minLevel: 40,
    maxLevel: 60,
    difficulty: 4,
    enemyPool: ['ice_golem', 'frost_wolf', 'snow_owl', 'yeti'],
    resourceMultiplier: 2.5,
    specialFeatures: ['冰晶洞穴', '温泉', '古代祭坛'],
  },
  {
    id: 'volcanic_pass',
    name: '火山隘口',
    description: '岩浆奔流的炙热通道，勇气与机遇并存。',
    biome: BiomeType.Volcanic,
    minLevel: 60,
    maxLevel: 80,
    difficulty: 5,
    enemyPool: ['fire_elemental', 'lava_giant', 'ash_drake', 'demon'],
    resourceMultiplier: 3.0,
    specialFeatures: ['岩浆瀑布', '硫磺矿脉', '火焰之心'],
  },
  {
    id: 'mystic_realm',
    name: '幻境领域',
    description: '超越物质界的魔法领域，时空界限在此模糊。',
    biome: BiomeType.Mystic,
    minLevel: 80,
    maxLevel: 100,
    difficulty: 6,
    enemyPool: ['void_walker', 'eldritch_horror', 'time_wraith', 'celestial'],
    resourceMultiplier: 3.5,
    specialFeatures: ['时空裂隙', '星辰之门', '混沌之源'],
  },
];

// ---------------------------------------------------------------------------
// RegionGenerator
// ---------------------------------------------------------------------------

export class RegionGenerator {
  /** 获取所有区域配置的深拷贝 */
  static getAllRegions(): Region[] {
    return REGIONS.map((r) => ({ ...r, enemyPool: [...r.enemyPool], specialFeatures: [...r.specialFeatures] }));
  }

  /** 获取指定区域 */
  static getRegion(id: string): Region | undefined {
    const r = REGIONS.find((region) => region.id === id);
    if (!r) return undefined;
    return { ...r, enemyPool: [...r.enemyPool], specialFeatures: [...r.specialFeatures] };
  }

  /** 根据玩家等级获取适合的区域 */
  static getRegionByLevel(level: number): Region | undefined {
    if (level < 1) return undefined;
    if (level > 100) {
      const last = REGIONS[REGIONS.length - 1]!;
      return { ...last, enemyPool: [...last.enemyPool], specialFeatures: [...last.specialFeatures] };
    }
    const candidates = REGIONS.filter((r) => level >= r.minLevel && level <= r.maxLevel);
    if (candidates.length === 0) return undefined;
    const best = candidates.reduce((a, b) =>
      Math.abs(a.difficulty - Math.ceil(level / 20)) <=
      Math.abs(b.difficulty - Math.ceil(level / 20))
        ? a
        : b,
    );
    return { ...best, enemyPool: [...best.enemyPool], specialFeatures: [...best.specialFeatures] };
  }

  /**
   * 基于种子和难度生成区域（可重现结果）
   * @param seed  随机种子
   * @param difficulty 目标难度 1-6
   */
  static generateRegion(seed: number, difficulty: number): Region {
    const rng = new SeededRandom(seed);
    const candidates = REGIONS.filter((r) => Math.abs(r.difficulty - difficulty) <= 1);
    let selected: Region;
    if (candidates.length === 0) {
      selected = REGIONS.reduce((a, b) =>
        Math.abs(a.difficulty - difficulty) < Math.abs(b.difficulty - difficulty) ? a : b,
      );
    } else {
      selected = rng.pick(candidates);
    }
    return { ...selected, enemyPool: [...selected.enemyPool], specialFeatures: [...selected.specialFeatures] };
  }

  /** 获取当前区域可以前往的下一个区域 */
  static getNextRegions(currentRegionId: string): string[] {
    const idx = REGIONS.findIndex((r) => r.id === currentRegionId);
    if (idx === -1 || idx >= REGIONS.length - 1) return [];
    const next = REGIONS[idx + 1];
    return next ? [next.id] : [];
  }

  /** 获取玩家在当前区域的进度百分比 0-100 */
  static getRegionProgress(regionId: string, playerLevel: number): number {
    const region = REGIONS.find((r) => r.id === regionId);
    if (!region) return 0;
    const range = region.maxLevel - region.minLevel;
    if (range <= 0) return 100;
    return Math.min(100, Math.max(0, Math.floor(((playerLevel - region.minLevel) / range) * 100)));
  }
}
