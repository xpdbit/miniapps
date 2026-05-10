/**
 * DamageCalculator — 纯函数工具集
 *
 * 包含伤害、暴击、闪避、防御减伤等战斗数值计算。
 * 所有函数为纯函数，不依赖外部状态。
 */

/** 伤害计算结果 */
export interface DamageResult {
  /** 最终伤害值（>= 1） */
  damage: number;
  /** 是否暴击 */
  isCrit: boolean;
  /** 是否被闪避 */
  isDodged: boolean;
}

/** 暴击判定结果 */
export interface CritResult {
  /** 是否触发暴击 */
  isCrit: boolean;
  /** 暴击倍率 */
  critMultiplier: number;
}

/**
 * 完整伤害计算
 * 公式: damage = max(1, attack * skillMultiplier - defense * 0.5)
 *
 * @param attack 攻击力
 * @param defense 防御力
 * @param skillMultiplier 技能倍率（默认 1.0）
 * @param isCrit 是否暴击
 * @param critMultiplier 暴击倍率（默认 2.0）
 * @param isDodged 是否被闪避
 */
export function calculateDamage(
  attack: number,
  defense: number,
  skillMultiplier: number = 1,
  isCrit: boolean = false,
  critMultiplier: number = 2.0,
  isDodged: boolean = false,
): DamageResult {
  if (isDodged) {
    return { damage: 0, isCrit: false, isDodged: true };
  }

  const baseDamage = attack * skillMultiplier;
  let damage = Math.round(linearDefenseReduction(baseDamage, defense));

  if (isCrit) {
    damage = Math.round(damage * critMultiplier);
  }

  return { damage: Math.max(1, damage), isCrit, isDodged: false };
}

/**
 * 暴击判定
 * 公式: critRate = min(50%, wisdom / 100 + equipmentBonus)
 *       critDamage = ATK * 2.0
 *
 * @param wisdom 角色的智慧/灵巧属性
 * @param equipmentBonus 装备提供的额外暴击率加成（0~1 之间，默认 0）
 */
export function calculateCrit(wisdom: number, equipmentBonus: number = 0): CritResult {
  const critRate = Math.min(0.5, wisdom / 100 + equipmentBonus);
  const isCrit = Math.random() < critRate;
  return { isCrit, critMultiplier: 2.0 };
}

/**
 * 闪避判定
 * 公式: dodgeRate = speed / (speed + 100)
 *
 * @param speed 角色的速度属性
 */
export function calculateDodge(speed: number): boolean {
  const dodgeRate = speed / (speed + 100);
  return Math.random() < dodgeRate;
}

/**
 * 防御减伤率
 * 公式: damageReduction = defense / (defense + 50)
 * 用于显示或外部计算的减伤百分比参考。
 *
 * @param defense 防御力
 */
export function calculateDefenseReduction(defense: number): number {
  return defense / (defense + 50);
}

/**
 * 线性防御穿透
 * 公式: max(1, attack - defense * 0.5)
 * 作为 calculateDamage 的内部步骤，也暴露为独立工具函数。
 *
 * @param attack 攻击力
 * @param defense 防御力
 */
export function linearDefenseReduction(attack: number, defense: number): number {
  return Math.max(1, attack - defense * 0.5);
}

/** 统一命名空间导出，方便集中引用 */
export const DamageCalculator = {
  calculateDamage,
  calculateCrit,
  calculateDodge,
  calculateDefenseReduction,
  linearDefenseReduction,
};
