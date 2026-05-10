/** 种族属性修正系数 */
export interface StatModifiers {
  attack: number;
  defense: number;
  speed: number;
  wisdom: number;
}

/** 种族特性 */
export interface SpecialTrait {
  name: string;
  description: string;
  /** 特性效果映射，如 { critRate: 0.05, maxHp: 0.15 } */
  effects: Record<string, number>;
}

/** 种族配置 */
export interface RaceConfig {
  id: string;
  name: string;
  description: string;
  statModifiers: StatModifiers;
  specialTrait: SpecialTrait;
  availableJobs: string[];
}

/** 基础属性（应用种族修正前） */
export interface BaseStats {
  attack: number;
  defense: number;
  speed: number;
  wisdom: number;
  maxHp: number;
}

/** 种族修正后的最终属性 */
export interface ModifiedStats extends BaseStats {
  /** 应用了乘算修正后的数值 */
  attack: number;
  defense: number;
  speed: number;
  wisdom: number;
  maxHp: number;
}

/** 所有可用种族 ID */
export type RaceId = 'human' | 'elf' | 'dwarf' | 'orc' | 'halfling';

/**
 * 种族引擎（纯静态数据）
 * - 管理所有可用种族配置
 * - 提供属性修正计算
 */
export class RaceEngine {
  private static races: RaceConfig[] = [
    {
      id: 'human',
      name: '人类',
      description: '均衡发展，适应性最强的种族，可从事任何职业。',
      statModifiers: { attack: 1.0, defense: 1.0, speed: 1.0, wisdom: 1.0 },
      specialTrait: {
        name: '多面手',
        description: '所有职业均可选择。',
        effects: {},
      },
      availableJobs: [
        'warrior', 'mage', 'archer', 'rogue', 'paladin', 'druid', 'berserker',
      ],
    },
    {
      id: 'elf',
      name: '精灵',
      description: '敏捷灵巧，拥有敏锐感知，擅长暴击。',
      statModifiers: { attack: 0.9, defense: 0.9, speed: 1.2, wisdom: 1.1 },
      specialTrait: {
        name: '敏锐感知',
        description: '暴击率 +5%。',
        effects: { critRate: 0.05 },
      },
      availableJobs: ['mage', 'archer', 'rogue', 'druid'],
    },
    {
      id: 'dwarf',
      name: '矮人',
      description: '体格强壮，坚韧不拔，拥有额外生命值。',
      statModifiers: { attack: 1.1, defense: 1.2, speed: 0.8, wisdom: 1.0 },
      specialTrait: {
        name: '坚如磐石',
        description: '最大生命值 +15%。',
        effects: { maxHp: 0.15 },
      },
      availableJobs: ['warrior', 'paladin', 'berserker'],
    },
    {
      id: 'orc',
      name: '兽人',
      description: '力量至上，血量越低伤害越高。',
      statModifiers: { attack: 1.2, defense: 1.1, speed: 0.9, wisdom: 0.8 },
      specialTrait: {
        name: '嗜血狂怒',
        description: '生命值低于 30% 时伤害 +10%。',
        effects: { lowHpDamage: 0.1 },
      },
      availableJobs: ['warrior', 'berserker', 'rogue'],
    },
    {
      id: 'halfling',
      name: '半身人',
      description: '体型小巧但运气极佳，擅长闪避与暴击。',
      statModifiers: { attack: 0.8, defense: 0.9, speed: 1.1, wisdom: 1.0 },
      specialTrait: {
        name: '幸运儿',
        description: '闪避率 +5%，暴击率 +3%。',
        effects: { dodgeRate: 0.05, critRate: 0.03 },
      },
      availableJobs: ['rogue', 'archer', 'mage'],
    },
  ];

  /**
   * 获取指定种族的配置
   * @param raceId 种族 ID
   * @returns 种族配置，不存在则返回 undefined
   */
  static getRaceConfig(raceId: RaceId | string): RaceConfig | undefined {
    return RaceEngine.races.find(r => r.id === raceId);
  }

  /**
   * 获取所有种族配置
   */
  static getAllRaces(): RaceConfig[] {
    return [...RaceEngine.races];
  }

  /**
   * 应用种族属性修正
   * @param baseStats 基础属性
   * @param raceId 种族 ID
   * @returns 修正后的属性（包含特性效果）
   */
  static applyRaceStats(baseStats: BaseStats, raceId: string): ModifiedStats {
    const race = RaceEngine.getRaceConfig(raceId);
    if (!race) {
      return { ...baseStats };
    }

    const modifiers = race.statModifiers;
    const effects = race.specialTrait.effects;

    // 先应用乘算修正
    const modified: ModifiedStats = {
      attack: Math.round(baseStats.attack * modifiers.attack),
      defense: Math.round(baseStats.defense * modifiers.defense),
      speed: Math.round(baseStats.speed * modifiers.speed),
      wisdom: Math.round(baseStats.wisdom * modifiers.wisdom),
      maxHp: baseStats.maxHp,
    };

    // 再应用特性效果
    if (effects.maxHp) {
      modified.maxHp = Math.round(baseStats.maxHp * (1 + effects.maxHp));
    }

    return modified;
  }
}
