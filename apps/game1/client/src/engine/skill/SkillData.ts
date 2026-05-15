/**
 * SkillData — 技能核心类型定义与静态配置
 *
 * 包含所有技能枚举、接口、效果定义，以及 12 个预定义技能。
 * SkillEngine 从本模块获取技能定义并管理运行时状态。
 */

import type { SaveData } from '../actor/IModule';

/* ==================== 枚举 ==================== */

export enum SkillType {
  Active = 'active',
  Passive = 'passive',
  Ultimate = 'ultimate',
}

export enum SkillTarget {
  Self = 'self',
  SingleEnemy = 'singleEnemy',
  AllEnemies = 'allEnemies',
  SingleAlly = 'singleAlly',
  AllAllies = 'allAllies',
}

export enum CardRarity {
  N = 'N',
  R = 'R',
  SR = 'SR',
  SSR = 'SSR',
  UR = 'UR',
  GR = 'GR',
}

/* ==================== 类型别名 ==================== */

/** 技能效果类型 */
export type SkillEffectType = 'damage' | 'heal' | 'shield' | 'statBuff' | 'statDebuff' | 'dot' | 'hot';

/** 可受 Buff/Debuff 影响的属性 */
export type SkillStat =
  | 'attack'
  | 'defense'
  | 'speed'
  | 'maxHp'
  | 'critRate'
  | 'critDamage'
  | 'goldGain'
  | 'expGain';

/* ==================== 接口定义 ==================== */

/** 技能效果参数 */
export interface SkillEffect {
  /** 效果类型 */
  effectType: SkillEffectType;
  /** 受影响的属性（buff/debuff 需要） */
  stat?: SkillStat;
  /** 效果数值（绝对值或百分比） */
  value: number;
  /** true 表示百分比（如 50 = 50%），false 表示绝对值 */
  isPercent: boolean;
  /** 持续 tick 数（0 表示即时生效） */
  duration: number;
  /** DOT/HOT 的 tick 间隔秒数 */
  tickInterval: number;
}

/** 技能数据 */
export interface Skill {
  /** 唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 技能类型 */
  type: SkillType;
  /** 目标类型 */
  target: SkillTarget;
  /** 说明文本 */
  description: string;
  /** 冷却时间（秒），被动技能为 0 */
  cooldown: number;
  /** 当前剩余冷却（秒） */
  currentCooldown: number;
  /** 威力系数（伤害/治疗倍率，1.0 = 100%） */
  power: number;
  /** 效果持续 tick 数 */
  duration: number;
  /** 技能图标 CSS 类名 */
  icon: string;
  /** 技能包含的效果列表 */
  effects: SkillEffect[];
}

/** 战斗统计快照（用于技能伤害计算） */
export interface CombatStats {
  actorId: string;
  attack: number;
  defense: number;
  maxHp: number;
  currentHp: number;
  speed: number;
  critRate: number;
  critDamage: number;
}

/** 单个效果的计算结果 */
export interface SkillEffectResult {
  effectType: SkillEffectType;
  targetId: string;
  value: number;
  isCrit: boolean;
  applied: boolean;
}

/** 技能使用结果 */
export interface SkillResult {
  success: boolean;
  skillId: string;
  casterId: string;
  targetIds: string[];
  effects: SkillEffectResult[];
  errorMessage?: string;
}

/* ==================== 装备槽位 ==================== */

export type EquipSlot =
  | 'active_0'
  | 'active_1'
  | 'passive_0'
  | 'passive_1'
  | 'passive_2'
  | 'passive_3'
  | 'ultimate';

export const EQUIP_SLOTS: EquipSlot[] = [
  'active_0',
  'active_1',
  'passive_0',
  'passive_1',
  'passive_2',
  'passive_3',
  'ultimate',
];

/** 根据槽位返回对应的技能类型 */
export function slotToSkillType(slot: EquipSlot): SkillType {
  if (slot === 'ultimate') return SkillType.Ultimate;
  if (slot.startsWith('active_')) return SkillType.Active;
  return SkillType.Passive;
}

/** 获取槽位索引（用于排序显示） */
export function slotIndex(slot: EquipSlot): number {
  return EQUIP_SLOTS.indexOf(slot);
}

/* ==================== 技能引擎存档格式 ==================== */

export interface SkillEngineSaveData extends SaveData {
  knownSkills: Array<{ id: string; level: number; currentCooldown: number }>;
  equipped: Array<{ slot: EquipSlot; skillId: string }>;
}

/* ==================== 12 个预定义技能 ==================== */

const SKILL_DEFINITIONS: Skill[] = [
  // --- 主动技能 ---
  {
    id: 'basic_attack',
    name: '普通攻击',
    type: SkillType.Active,
    target: SkillTarget.SingleEnemy,
    description: '对单个敌人造成 100% 攻击力的伤害',
    cooldown: 0,
    currentCooldown: 0,
    power: 1.0,
    duration: 0,
    icon: 'skill-basic-attack',
    effects: [
      {
        effectType: 'damage',
        value: 100,
        isPercent: true,
        duration: 0,
        tickInterval: 0,
      },
    ],
  },
  {
    id: 'defend',
    name: '防御',
    type: SkillType.Active,
    target: SkillTarget.Self,
    description: '减少 50% 受到的伤害，持续 1 次行动',
    cooldown: 3,
    currentCooldown: 0,
    power: 0.5,
    duration: 1,
    icon: 'skill-defend',
    effects: [
      {
        effectType: 'statBuff',
        stat: 'defense',
        value: 50,
        isPercent: true,
        duration: 1,
        tickInterval: 0,
      },
    ],
  },
  {
    id: 'power_strike',
    name: '猛击',
    type: SkillType.Active,
    target: SkillTarget.SingleEnemy,
    description: '对单个敌人造成 150% 攻击力的伤害',
    cooldown: 5,
    currentCooldown: 0,
    power: 1.5,
    duration: 0,
    icon: 'skill-power-strike',
    effects: [
      {
        effectType: 'damage',
        value: 150,
        isPercent: true,
        duration: 0,
        tickInterval: 0,
      },
    ],
  },
  {
    id: 'heal',
    name: '治疗术',
    type: SkillType.Active,
    target: SkillTarget.SingleAlly,
    description: '恢复自身或一个友军 30% 最大生命值',
    cooldown: 8,
    currentCooldown: 0,
    power: 1.0,
    duration: 0,
    icon: 'skill-heal',
    effects: [
      {
        effectType: 'heal',
        value: 30,
        isPercent: true,
        duration: 0,
        tickInterval: 0,
      },
    ],
  },
  {
    id: 'berserk',
    name: '狂暴',
    type: SkillType.Active,
    target: SkillTarget.SingleEnemy,
    description: '对敌人造成 200% 攻击力的伤害，但自身受到的伤害增加 20%',
    cooldown: 10,
    currentCooldown: 0,
    power: 2.0,
    duration: 0,
    icon: 'skill-berserk',
    effects: [
      {
        effectType: 'damage',
        value: 200,
        isPercent: true,
        duration: 0,
        tickInterval: 0,
      },
      {
        effectType: 'statDebuff',
        stat: 'defense',
        value: -20,
        isPercent: true,
        duration: 2,
        tickInterval: 0,
      },
    ],
  },
  {
    id: 'shield_wall',
    name: '盾墙',
    type: SkillType.Active,
    target: SkillTarget.AllAllies,
    description: '全体友军防御力提升 30%，持续 3 次行动',
    cooldown: 15,
    currentCooldown: 0,
    power: 0.3,
    duration: 3,
    icon: 'skill-shield-wall',
    effects: [
      {
        effectType: 'statBuff',
        stat: 'defense',
        value: 30,
        isPercent: true,
        duration: 3,
        tickInterval: 0,
      },
    ],
  },
  // --- 被动技能 ---
  {
    id: 'precision',
    name: '精准',
    type: SkillType.Passive,
    target: SkillTarget.Self,
    description: '暴击率永久提升 10%',
    cooldown: 0,
    currentCooldown: 0,
    power: 0.1,
    duration: -1,
    icon: 'skill-precision',
    effects: [
      {
        effectType: 'statBuff',
        stat: 'critRate',
        value: 10,
        isPercent: true,
        duration: -1,
        tickInterval: 0,
      },
    ],
  },
  {
    id: 'tough_skin',
    name: '坚韧皮肤',
    type: SkillType.Passive,
    target: SkillTarget.Self,
    description: '防御力永久提升 15%',
    cooldown: 0,
    currentCooldown: 0,
    power: 0.15,
    duration: -1,
    icon: 'skill-tough-skin',
    effects: [
      {
        effectType: 'statBuff',
        stat: 'defense',
        value: 15,
        isPercent: true,
        duration: -1,
        tickInterval: 0,
      },
    ],
  },
  {
    id: 'vitality_boost',
    name: '活力充沛',
    type: SkillType.Passive,
    target: SkillTarget.Self,
    description: '最大生命值永久提升 20%',
    cooldown: 0,
    currentCooldown: 0,
    power: 0.2,
    duration: -1,
    icon: 'skill-vitality-boost',
    effects: [
      {
        effectType: 'statBuff',
        stat: 'maxHp',
        value: 20,
        isPercent: true,
        duration: -1,
        tickInterval: 0,
      },
    ],
  },
  {
    id: 'quick_foot',
    name: '疾步',
    type: SkillType.Passive,
    target: SkillTarget.Self,
    description: '速度永久提升 15%',
    cooldown: 0,
    currentCooldown: 0,
    power: 0.15,
    duration: -1,
    icon: 'skill-quick-foot',
    effects: [
      {
        effectType: 'statBuff',
        stat: 'speed',
        value: 15,
        isPercent: true,
        duration: -1,
        tickInterval: 0,
      },
    ],
  },
  {
    id: 'merchant_gift',
    name: '商人的馈赠',
    type: SkillType.Passive,
    target: SkillTarget.Self,
    description: '金币获得量永久提升 20%',
    cooldown: 0,
    currentCooldown: 0,
    power: 0.2,
    duration: -1,
    icon: 'skill-merchant-gift',
    effects: [
      {
        effectType: 'statBuff',
        stat: 'goldGain',
        value: 20,
        isPercent: true,
        duration: -1,
        tickInterval: 0,
      },
    ],
  },
  {
    id: 'scholar_wisdom',
    name: '学者智慧',
    type: SkillType.Passive,
    target: SkillTarget.Self,
    description: '经验获得量永久提升 15%',
    cooldown: 0,
    currentCooldown: 0,
    power: 0.15,
    duration: -1,
    icon: 'skill-scholar-wisdom',
    effects: [
      {
        effectType: 'statBuff',
        stat: 'expGain',
        value: 15,
        isPercent: true,
        duration: -1,
        tickInterval: 0,
      },
    ],
  },
];

/** 获取所有技能定义 */
export function getAllSkillDefinitions(): Skill[] {
  return SKILL_DEFINITIONS;
}

/** 按 ID 获取单个技能定义 */
export function getSkillDefinition(id: string): Skill | undefined {
  return SKILL_DEFINITIONS.find((s) => s.id === id);
}

/** 技能等级成长——威力系数随等级提升 */
export function skillPowerAtLevel(basePower: number, level: number): number {
  return basePower * (1 + (level - 1) * 0.1);
}

/** 技能效果值等级成长 */
export function effectValueAtLevel(baseValue: number, level: number): number {
  return Math.round(baseValue * (1 + (level - 1) * 0.08));
}
