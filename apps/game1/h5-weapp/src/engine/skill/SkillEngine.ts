/**
 * SkillEngine — 技能系统核心引擎
 *
 * 单例，实现 IModule 接口，管理技能学习/遗忘/装备/使用/冷却。
 * 事件：'skill:learned' | 'skill:used' | 'skill:cooldownReady'
 */

import { IModule } from '../actor/IModule';
import { globalEventBus } from '../core/EventBus';
import {
  type Skill,
  type SkillEffect,
  type SkillResult,
  type SkillEffectResult,
  type CombatStats,
  type EquipSlot,
  type SkillEngineSaveData,
  SkillType,
  SkillTarget,
  EQUIP_SLOTS,
  slotToSkillType,
  getAllSkillDefinitions,
  getSkillDefinition,
  skillPowerAtLevel,
  effectValueAtLevel,
} from './SkillData';

/** 各类型技能的最大装备数量 */
export const MAX_EQUIP = {
  active: 2,
  passive: 4,
  ultimate: 1,
} as const;

export class SkillEngine implements IModule {
  readonly moduleId = 'skill';

  private static _instance: SkillEngine;
  static get instance(): SkillEngine {
    if (!SkillEngine._instance) {
      SkillEngine._instance = new SkillEngine();
    }
    return SkillEngine._instance;
  }

  /** 已学会的全部技能（runtime 实例，含等级和冷却） */
  knownSkills: Map<string, Skill> = new Map();

  /** 已装备的技能，按类型分组 */
  get equippedSkills(): { active: Skill[]; passive: Skill[]; ultimate: Skill | null } {
    const active: Skill[] = [];
    const passive: Skill[] = [];
    let ultimate: Skill | null = null;

    this.equipped.forEach((skill, slot) => {
      if (skill === null) return;
      const type = slotToSkillType(slot);
      if (type === SkillType.Active) {
        active.push(skill);
      } else if (type === SkillType.Passive) {
        passive.push(skill);
      } else {
        ultimate = skill;
      }
    });

    // 保持插入顺序（按槽位排序）
    active.sort((a, b) => this.skillSlotOrder(a.id) - this.skillSlotOrder(b.id));
    passive.sort((a, b) => this.skillSlotOrder(a.id) - this.skillSlotOrder(b.id));

    return { active, passive, ultimate };
  }

  /** 内部装备槽 <槽位, 技能实例> */
  private equipped: Map<EquipSlot, Skill | null>;

  /** 是否已初始化 */
  private initialized = false;

  private constructor() {
    this.equipped = new Map();
    for (const slot of EQUIP_SLOTS) {
      this.equipped.set(slot, null);
    }
  }

  /* ==================== 初始化 ==================== */

  /** 初始化已知技能表（从配置填充） */
  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    // 预填充技能定义（不自动学会）
    // 初始时 knownSkills 为空，玩家需通过 learnSkill 学会
  }

  /* ==================== 技能学习/遗忘 ==================== */

  /**
   * 学会一个技能
   * @param skillId 技能 ID
   * @param level 初始等级（默认 1）
   * @returns 是否学习成功（已学会返回 false）
   */
  learnSkill(skillId: string, level = 1): boolean {
    if (this.knownSkills.has(skillId)) {
      console.warn(`[SkillEngine] 技能已学会: ${skillId}`);
      return false;
    }

    const skillInstance = this.createSkillData(skillId, level);
    if (!skillInstance) {
      console.warn(`[SkillEngine] 技能不存在: ${skillId}`);
      return false;
    }

    this.knownSkills.set(skillId, skillInstance);
    globalEventBus.emit('skill:learned', { skillId, skill: skillInstance });
    return true;
  }

  /**
   * 遗忘一个技能（也会解除装备）
   * @param skillId 技能 ID
   */
  forgetSkill(skillId: string): void {
    if (!this.knownSkills.has(skillId)) return;

    // 解除装备
    this.unequipSkillById(skillId);

    this.knownSkills.delete(skillId);
  }

  /* ==================== 装备/卸下 ==================== */

  /**
   * 装备技能到指定槽位
   * @param skillId 技能 ID（必须在 knownSkills 中）
   * @param slot 目标槽位
   * @returns 是否装备成功
   */
  equipSkill(skillId: string, slot: EquipSlot): boolean {
    const skill = this.knownSkills.get(skillId);
    if (!skill) {
      console.warn(`[SkillEngine] 技能未学会: ${skillId}`);
      return false;
    }

    const expectedType = slotToSkillType(slot);
    if (skill.type !== expectedType && expectedType !== SkillType.Ultimate) {
      console.warn(`[SkillEngine] 技能类型不匹配: ${skill.type} → ${expectedType}`);
      return false;
    }

    // Ultimate 槽位可以接受任何非 Passive 技能
    if (expectedType === SkillType.Ultimate && skill.type === SkillType.Passive) {
      console.warn('[SkillEngine] 被动技能不能装备到终极技能槽');
      return false;
    }

    // 检查是否已装备在其他位置
    if (this.isSkillEquipped(skillId)) {
      console.warn(`[SkillEngine] 技能已装备: ${skillId}`);
      return false;
    }

    // 检查该类型槽位已满
    const slotType = slotToSkillType(slot);
    const slotCount = this.countEquippedByType(slotType);
    const maxCount = slotType === SkillType.Active
      ? MAX_EQUIP.active
      : slotType === SkillType.Passive
        ? MAX_EQUIP.passive
        : MAX_EQUIP.ultimate;

    if (slotCount >= maxCount) {
      console.warn(`[SkillEngine] ${slotType} 槽位已满`);
      return false;
    }

    this.equipped.set(slot, skill);
    return true;
  }

  /**
   * 从指定槽位卸下技能
   * @param slot 槽位
   */
  unequipSkill(slot: EquipSlot): void {
    this.equipped.set(slot, null);
  }

  /**
   * 按技能 ID 解除所有装备
   */
  private unequipSkillById(skillId: string): void {
    for (const [slot, skill] of this.equipped.entries()) {
      if (skill !== null && skill.id === skillId) {
        this.equipped.set(slot, null);
      }
    }
  }

  /** 检查技能是否已装备 */
  private isSkillEquipped(skillId: string): boolean {
    for (const [, skill] of this.equipped.entries()) {
      if (skill !== null && skill.id === skillId) return true;
    }
    return false;
  }

  /** 统计某类型已装备的技能数量 */
  private countEquippedByType(type: SkillType): number {
    let count = 0;
    for (const [slot, skill] of this.equipped.entries()) {
      if (skill !== null && slotToSkillType(slot) === type) {
        count++;
      }
    }
    return count;
  }

  /** 获取技能在装备槽中的排序位置 */
  private skillSlotOrder(skillId: string): number {
    for (let i = 0; i < EQUIP_SLOTS.length; i++) {
      const slot = EQUIP_SLOTS[i]!;
      const skill = this.equipped.get(slot);
      if (skill !== null && skill !== undefined && skill.id === skillId) {
        return i;
      }
    }
    return 999;
  }

  /* ==================== 查询 ==================== */

  /** 获取已知技能 */
  getSkill(skillId: string): Skill | undefined {
    return this.knownSkills.get(skillId);
  }

  /** 获取已装备的某类型技能列表 */
  getEquippedSkills(type: SkillType): Skill[] {
    const result: Skill[] = [];
    for (const [slot, skill] of this.equipped.entries()) {
      if (skill !== null && slotToSkillType(slot) === type) {
        result.push(skill);
      }
    }
    return result;
  }

  /** 获取所有已学会的技能 */
  getLearnedSkills(): Skill[] {
    return Array.from(this.knownSkills.values());
  }

  /** 获取所有可学习的技能（含未学会的） */
  getAllAvailableSkills(): Skill[] {
    return getAllSkillDefinitions();
  }

  /* ==================== 技能使用 ==================== */

  /**
   * 使用技能
   * @param skillId 技能 ID
   * @param user 施法者属性快照
   * @param targets 目标属性快照列表
   * @returns 技能效果结果
   */
  useSkill(skillId: string, user: CombatStats, targets: CombatStats[]): SkillResult {
    const skill = this.knownSkills.get(skillId);
    if (!skill) {
      return this.failureResult(skillId, user.actorId, '技能未学会');
    }

    if (skill.type === SkillType.Passive) {
      return this.failureResult(skillId, user.actorId, '被动技能不能主动使用');
    }

    if (skill.currentCooldown > 0) {
      return this.failureResult(skillId, user.actorId, `技能冷却中: ${skill.currentCooldown.toFixed(1)}s`);
    }

    // 确定目标
    const affectedTargets = this.resolveTargets(skill.target, user, targets);

    // 计算效果
    const effectResults: SkillEffectResult[] = [];
    for (const target of affectedTargets) {
      for (const effect of skill.effects) {
        const result = this.calculateEffect(effect, skill, user, target);
        effectResults.push(result);
      }
    }

    // 设置冷却
    skill.currentCooldown = skill.cooldown;

    const result: SkillResult = {
      success: true,
      skillId: skill.id,
      casterId: user.actorId,
      targetIds: affectedTargets.map((t) => t.actorId),
      effects: effectResults,
    };

    globalEventBus.emit('skill:used', result);
    return result;
  }

  /** 根据 SkillTarget 解析目标列表 */
  private resolveTargets(
    target: SkillTarget,
    user: CombatStats,
    targets: CombatStats[],
  ): CombatStats[] {
    switch (target) {
      case SkillTarget.Self:
        return [user];
      case SkillTarget.SingleEnemy:
        return targets.length > 0 ? [targets[0]!] : [];
      case SkillTarget.AllEnemies:
        return targets;
      case SkillTarget.SingleAlly:
        // SingleAlly 目标也包括自己
        return [user];
      case SkillTarget.AllAllies:
        return [user];
      default:
        return [user];
    }
  }

  /** 计算单个效果的实际值 */
  private calculateEffect(
    effect: SkillEffect,
    skill: Skill,
    user: CombatStats,
    target: CombatStats,
  ): SkillEffectResult {
    const effectType = effect.effectType;
    let value = 0;
    let isCrit = false;

    switch (effectType) {
      case 'damage': {
        const rawDamage = user.attack * skill.power;
        // 暴击判定
        isCrit = Math.random() < user.critRate;
        const critMultiplier = isCrit ? user.critDamage : 1.0;
        // 防御减伤（递减公式）
        const defenseMultiplier = 100 / (100 + target.defense);
        value = Math.round(rawDamage * critMultiplier * defenseMultiplier);
        break;
      }
      case 'heal': {
        const baseHeal = effect.isPercent
          ? target.maxHp * (effect.value / 100)
          : effect.value;
        value = Math.round(baseHeal * skill.power);
        break;
      }
      case 'shield': {
        const baseShield = effect.isPercent
          ? target.maxHp * (effect.value / 100)
          : effect.value;
        value = Math.round(baseShield * skill.power);
        break;
      }
      case 'statBuff':
      case 'statDebuff':
        value = effect.value;
        break;
      case 'dot':
        value = Math.round((user.attack * skill.power * (effect.value / 100)));
        break;
      case 'hot':
        value = Math.round((target.maxHp * (effect.value / 100)));
        break;
    }

    return {
      effectType,
      targetId: target.actorId,
      value,
      isCrit,
      applied: true,
    };
  }

  private failureResult(skillId: string, casterId: string, errorMessage: string): SkillResult {
    return {
      success: false,
      skillId,
      casterId,
      targetIds: [],
      effects: [],
      errorMessage,
    };
  }

  /* ==================== 等级成长 ==================== */

  /**
   * 创建技能实例（含等级成长）
   * @param skillId 技能定义 ID
   * @param level 等级（1+）
   * @returns 技能实例，或 undefined（定义不存在时）
   */
  createSkillData(skillId: string, level: number): Skill | undefined {
    const definition = getSkillDefinition(skillId);
    if (!definition) return undefined;

    const clampedLevel = Math.max(1, level);

    return {
      ...definition,
      power: skillPowerAtLevel(definition.power, clampedLevel),
      effects: definition.effects.map((e) => ({
        ...e,
        value: effectValueAtLevel(e.value, clampedLevel),
      })),
      currentCooldown: 0,
    };
  }

  /**
   * 提升已学会技能的等级
   * @param skillId 技能 ID
   * @returns 是否提升成功
   */
  upgradeSkill(skillId: string): boolean {
    const skill = this.knownSkills.get(skillId);
    if (!skill) return false;

    // 从定义获取基础 power
    const definition = getSkillDefinition(skillId);
    if (!definition) return false;

    // 暂时无法知道当前等级，通过 power 反推
    const currentLevel = Math.round((skill.power / definition.power - 1) / 0.1) + 1;
    const newLevel = currentLevel + 1;

    const upgraded = this.createSkillData(skillId, newLevel);
    if (!upgraded) return false;

    this.knownSkills.set(skillId, upgraded);
    return true;
  }

  /* ==================== IModule 接口 ==================== */

  tick(deltaSeconds: number): void {
    let anyReady = false;

    for (const [, skill] of this.knownSkills) {
      if (skill.type === SkillType.Passive) continue;
      if (skill.currentCooldown <= 0) continue;

      const previous = skill.currentCooldown;
      skill.currentCooldown = Math.max(0, skill.currentCooldown - deltaSeconds);

      if (previous > 0 && skill.currentCooldown <= 0) {
        anyReady = true;
        globalEventBus.emit('skill:cooldownReady', { skillId: skill.id });
      }
    }

    if (anyReady) {
      // 可以在这里做额外的批量通知
    }
  }

  onSave(): SkillEngineSaveData {
    const knownSkills: Array<{ id: string; level: number; currentCooldown: number }> = [];
    this.knownSkills.forEach((skill) => {
      // 通过 power 反推等级
      const definition = getSkillDefinition(skill.id);
      let level = 1;
      if (definition && definition.power > 0) {
        level = Math.round((skill.power / definition.power - 1) / 0.1) + 1;
      }
      knownSkills.push({ id: skill.id, level, currentCooldown: skill.currentCooldown });
    });

    const equipped: Array<{ slot: EquipSlot; skillId: string }> = [];
    this.equipped.forEach((skill, slot) => {
      if (skill !== null) {
        equipped.push({ slot, skillId: skill.id });
      }
    });

    return { knownSkills, equipped };
  }

  onLoad(data: SkillEngineSaveData): void {
    this.reset();

    // 恢复已学会的技能
    for (const entry of data.knownSkills) {
      const skill = this.createSkillData(entry.id, entry.level);
      if (skill) {
        skill.currentCooldown = entry.currentCooldown;
        this.knownSkills.set(entry.id, skill);
      }
    }

    // 恢复装备
    for (const entry of data.equipped) {
      if (EQUIP_SLOTS.includes(entry.slot)) {
        const skill = this.knownSkills.get(entry.skillId);
        if (skill) {
          this.equipped.set(entry.slot, skill);
        }
      }
    }
  }

  reset(): void {
    this.knownSkills.clear();
    for (const slot of EQUIP_SLOTS) {
      this.equipped.set(slot, null);
    }
    this.initialized = false;
  }
}

/** 全局单例 */
export const skillEngine = SkillEngine.instance;
