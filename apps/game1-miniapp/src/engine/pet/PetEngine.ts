/**
 * PetEngine — 宠物系统引擎
 * 单例，实现 IModule 接口，管理宠物收养、培养、进化。
 * 事件：
 *   'pet:adopted'   — 领养新宠物
 *   'pet:levelUp'   — 宠物升级
 *   'pet:evolved'   — 宠物进化
 *   'pet:activeSet' — 切换活跃宠物
 *   'pet:fed'       — 喂食宠物
 */
import { IModule, SaveData } from '../actor/IModule';
import { globalEventBus } from '../core/EventBus';
// ---------------------------------------------------------------------------
// 事件载荷类型
// ---------------------------------------------------------------------------

export interface PetAdoptedEvent {
  petId: string;
  name: string;
  templateId: string;
}

export interface PetLevelUpEvent {
  petId: string;
  newLevel: number;
}

export interface PetEvolvedEvent {
  petId: string;
  newTemplateId: string;
}

export interface PetActiveSetEvent {
  petId: string | null;
}

export interface PetFedEvent {
  petId: string;
  expGained: number;
  newExp: number;
}

// ---------------------------------------------------------------------------
// 核心类型
// ---------------------------------------------------------------------------

export type PetRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface Pet {
  id: string;
  templateId: string;
  name: string;
  rarity: PetRarity;
  level: number;
  exp: number;
  expToNext: number;
  attackBonus: number;
  defenseBonus: number;
  hpBonus: number;
  speedBonus: number;
  passiveSkill: string;
  description: string;
  evolutionStage: number;
  isActive: boolean;
}

interface PetDefinition {
  id: string;
  name: string;
  rarity: PetRarity;
  attackBonus: number;
  defenseBonus: number;
  hpBonus: number;
  speedBonus: number;
  passiveSkill: string;
  description: string;
}

const PET_DEFINITIONS: PetDefinition[] = [
  { id: 'pet_rabbit', name: '兔子', rarity: 'common', attackBonus: 0, defenseBonus: 0, hpBonus: 0, speedBonus: 2, passiveSkill: 'quick_foot', description: '敏捷的小兔子，提升移动速度' },
  { id: 'pet_cat', name: '猫咪', rarity: 'common', attackBonus: 0, defenseBonus: 0, hpBonus: 0, speedBonus: 0, passiveSkill: 'precision', description: '优雅的猫咪，增加暴击伤害' },
  { id: 'pet_dog', name: '小狗', rarity: 'common', attackBonus: 0, defenseBonus: 2, hpBonus: 5, speedBonus: 0, passiveSkill: 'tough_skin', description: '忠诚的小狗，提升防御' },
  { id: 'pet_fox', name: '狐狸', rarity: 'uncommon', attackBonus: 3, defenseBonus: 0, hpBonus: 0, speedBonus: 3, passiveSkill: 'merchant_gift', description: '聪明的狐狸，增加金币收益' },
  { id: 'pet_owl', name: '猫头鹰', rarity: 'uncommon', attackBonus: 2, defenseBonus: 0, hpBonus: 0, speedBonus: 0, passiveSkill: 'scholar_wisdom', description: '睿智的猫头鹰，增加经验收益' },
  { id: 'pet_hawk', name: '苍鹰', rarity: 'uncommon', attackBonus: 5, defenseBonus: 0, hpBonus: 0, speedBonus: 4, passiveSkill: 'precision', description: '锐利的苍鹰，提升攻击' },
  { id: 'pet_wolf', name: '狼', rarity: 'rare', attackBonus: 8, defenseBonus: 2, hpBonus: 10, speedBonus: 5, passiveSkill: 'power_strike', description: '凶猛的战狼，全面提升战斗力' },
  { id: 'pet_panther', name: '黑豹', rarity: 'rare', attackBonus: 6, defenseBonus: 0, hpBonus: 5, speedBonus: 10, passiveSkill: 'quick_foot', description: '迅捷的黑豹，极致速度' },
  { id: 'pet_bear', name: '熊', rarity: 'rare', attackBonus: 5, defenseBonus: 8, hpBonus: 25, speedBonus: 0, passiveSkill: 'tough_skin', description: '厚实的熊，坚不可摧' },
  { id: 'pet_phoenix', name: '凤凰', rarity: 'epic', attackBonus: 12, defenseBonus: 5, hpBonus: 20, speedBonus: 8, passiveSkill: 'vitality_boost', description: '浴火重生的凤凰，拥有复活之力' },
  { id: 'pet_dragon', name: '幼龙', rarity: 'epic', attackBonus: 15, defenseBonus: 10, hpBonus: 30, speedBonus: 5, passiveSkill: 'berserk', description: '传说中的龙裔，毁灭之力' },
  { id: 'pet_kirin', name: '麒麟', rarity: 'legendary', attackBonus: 20, defenseBonus: 15, hpBonus: 40, speedBonus: 12, passiveSkill: 'merchant_gift', description: '祥瑞之兽，全方位的守护者' },
];

/** 每级属性倍率 */
const STATS_PER_LEVEL = 0.1; // +10%/级

/** 计算升级所需经验 */
function expToNext(level: number): number {
  return Math.floor(100 * 1.2 ** (level - 1));
}

/** 从定义计算等级加成 */
function applyLevelBonus(baseValue: number, level: number): number {
  return Math.floor(baseValue * (1 + (level - 1) * STATS_PER_LEVEL));
}

interface PetSaveData {
  owned: Pet[];
  activePetId: string | null;
  nextId: number;
}

export class PetEngine implements IModule {
  readonly moduleId = 'PetEngine';
  private static _instance: PetEngine;
  static get instance(): PetEngine {
    if (!PetEngine._instance) PetEngine._instance = new PetEngine();
    return PetEngine._instance;
  }

  private ownedPets: Pet[] = [];
  private activePetId: string | null = null;
  private nextId = 1;

  private constructor() {}

  // ========================================================================
  //  状态查询
  // ========================================================================

  getState(): { ownedPets: Pet[]; activePetId: string | null } {
    return { ownedPets: [...this.ownedPets], activePetId: this.activePetId };
  }

  /** 获取所有宠物模板定义 */
  getAllTemplates(): PetDefinition[] {
    return PET_DEFINITIONS.map((d) => ({ ...d }));
  }

  /** 获取指定模板 */
  getTemplate(templateId: string): PetDefinition | undefined {
    const def = PET_DEFINITIONS.find((d) => d.id === templateId);
    return def ? { ...def } : undefined;
  }

  // ========================================================================
  //  宠物管理
  // ========================================================================

  /**
   * 领养宠物
   * @param templateId 模板 ID
   * @returns 领养的宠物实例，失败返回 null
   */
  adoptPet(templateId: string): Pet | null {
    const def = PET_DEFINITIONS.find((p) => p.id === templateId);
    if (!def) return null;
    // 检查是否已拥有该模板的宠物
    if (this.ownedPets.find((p) => p.templateId === templateId)) return null;

    const pet: Pet = {
      id: `pet_${this.nextId++}`,
      templateId: def.id,
      name: def.name,
      rarity: def.rarity,
      level: 1,
      exp: 0,
      expToNext: expToNext(1),
      attackBonus: def.attackBonus,
      defenseBonus: def.defenseBonus,
      hpBonus: def.hpBonus,
      speedBonus: def.speedBonus,
      passiveSkill: def.passiveSkill,
      description: def.description,
      evolutionStage: 0,
      isActive: this.ownedPets.length === 0, // 第一个自动设为活跃
    };
    this.ownedPets.push(pet);

    globalEventBus.emit<PetAdoptedEvent>('pet:adopted', {
      petId: pet.id,
      name: pet.name,
      templateId: pet.templateId,
    });

    if (pet.isActive) {
      this.activePetId = pet.id;
    }

    return { ...pet };
  }

  /**
   * 设置活跃宠物
   * @param petId 宠物 ID 或 null（取消激活）
   */
  setActivePet(petId: string | null): void {
    if (petId === null) {
      this.activePetId = null;
      for (const p of this.ownedPets) p.isActive = false;
      globalEventBus.emit<PetActiveSetEvent>('pet:activeSet', { petId: null });
      return;
    }
    const pet = this.ownedPets.find((p) => p.id === petId);
    if (!pet) return;
    for (const p of this.ownedPets) p.isActive = false;
    pet.isActive = true;
    this.activePetId = petId;
    globalEventBus.emit<PetActiveSetEvent>('pet:activeSet', { petId });
  }

  /** 获取当前活跃宠物 */
  getActivePet(): Pet | null {
    if (!this.activePetId) return null;
    return this.ownedPets.find((p) => p.id === this.activePetId) ?? null;
  }

  /** 获取所有已拥有宠物 */
  getAllPets(): Pet[] {
    return this.ownedPets.map((p) => ({ ...p }));
  }

  /** 获取宠物总数 */
  getPetCount(): number {
    return this.ownedPets.length;
  }

  // ========================================================================
  //  培养系统
  // ========================================================================

  /**
   * 喂食宠物增加经验
   * @param petId 宠物 ID
   * @param expAmount 经验量
   */
  feedPet(petId: string, expAmount: number): void {
    const pet = this.ownedPets.find((p) => p.id === petId);
    if (!pet || expAmount <= 0) return;

    pet.exp += expAmount;
    let leveled = false;

    while (pet.exp >= pet.expToNext && pet.level < 50) {
      pet.exp -= pet.expToNext;
      pet.level += 1;
      pet.expToNext = expToNext(pet.level);
      leveled = true;
      globalEventBus.emit<PetLevelUpEvent>('pet:levelUp', { petId: pet.id, newLevel: pet.level });
    }

    if (leveled || expAmount > 0) {
      globalEventBus.emit<PetFedEvent>('pet:fed', {
        petId,
        expGained: expAmount,
        newExp: pet.exp,
      });
    }
  }

  /**
   * 直接提升宠物 1 级
   * @param petId 宠物 ID
   * @returns 是否成功
   */
  levelUpPet(petId: string): boolean {
    const pet = this.ownedPets.find((p) => p.id === petId);
    if (!pet || pet.level >= 50) return false;
    pet.level += 1;
    pet.exp = 0;
    pet.expToNext = expToNext(pet.level);
    globalEventBus.emit<PetLevelUpEvent>('pet:levelUp', { petId: pet.id, newLevel: pet.level });
    return true;
  }

  /**
   * 进化宠物到新模板
   * 保留等级和经验，更换模板属性
   * @param petId 宠物 ID
   * @param targetTemplateId 目标模板 ID
   * @returns 是否成功
   */
  evolvePet(petId: string, targetTemplateId: string): boolean {
    const pet = this.ownedPets.find((p) => p.id === petId);
    if (!pet) return false;

    const target = PET_DEFINITIONS.find((p) => p.id === targetTemplateId);
    if (!target) return false;

    // 更新模板属性
    pet.templateId = target.id;
    pet.name = target.name;
    pet.rarity = target.rarity;
    pet.attackBonus = target.attackBonus;
    pet.defenseBonus = target.defenseBonus;
    pet.hpBonus = target.hpBonus;
    pet.speedBonus = target.speedBonus;
    pet.passiveSkill = target.passiveSkill;
    pet.description = target.description;
    pet.evolutionStage += 1;

    globalEventBus.emit<PetEvolvedEvent>('pet:evolved', {
      petId,
      newTemplateId: targetTemplateId,
    });

    return true;
  }

  // ========================================================================
  //  战斗加成
  // ========================================================================

  /** 获取活跃宠物的战斗加成 */
  getActiveBonuses(): { attack: number; defense: number; hp: number; speed: number } {
    const pet = this.getActivePet();
    if (!pet) return { attack: 0, defense: 0, hp: 0, speed: 0 };
    return {
      attack: applyLevelBonus(pet.attackBonus, pet.level),
      defense: applyLevelBonus(pet.defenseBonus, pet.level),
      hp: applyLevelBonus(pet.hpBonus, pet.level),
      speed: applyLevelBonus(pet.speedBonus, pet.level),
    };
  }

  // ========================================================================
  //  IModule
  // ========================================================================

  tick(_deltaSeconds: number): void {}

  onSave(): SaveData {
    return {
      owned: this.ownedPets.map(p => ({ ...p })),
      activePetId: this.activePetId,
      nextId: this.nextId,
    } as unknown as SaveData;
  }

  onLoad(data: SaveData): void {
    const save = data as unknown as PetSaveData;
    this.ownedPets = (save.owned ?? []).map((p) => ({ ...p }));
    this.activePetId = save.activePetId ?? null;
    this.nextId = save.nextId ?? 1;
  }

  reset(): void {
    this.ownedPets = [];
    this.activePetId = null;
    this.nextId = 1;
  }
}
