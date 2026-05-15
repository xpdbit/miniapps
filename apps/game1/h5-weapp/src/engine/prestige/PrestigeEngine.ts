/**
 * PrestigeEngine — 轮回系统引擎
 *
 * 单例，实现 IModule 接口，管理轮回转生、轮回点数、永久天赋树。
 * 事件：'prestige:completed' | 'prestige:perkPurchased'
 */

import { IModule, SaveData } from '../actor/IModule';
import { globalEventBus } from '../core/EventBus';
import { PlayerActor } from '../actor/PlayerActor';
import constants from '../../config/constants.json';

/* ==================== 接口 ==================== */

/** 天赋定义 */
export interface Perk {
  id: string;
  name: string;
  description: string;
  cost: number;
  maxLevel: number;
  currentLevel: number;
  effect: (level: number) => number;
  effectDescription: string;
}

/** 轮回结果 */
export interface PrestigeResult {
  success: boolean;
  prestigePointsGained: number;
  totalPrestigePoints: number;
  prestigeCount: number;
  oldLevel: number;
}

/** 活跃的轮回加成快照 */
export interface PrestigeBonus {
  attackMultiplier: number;
  defenseMultiplier: number;
  hpMultiplier: number;
  goldMultiplier: number;
  expMultiplier: number;
  speedMultiplier: number;
  critRateBonus: number;
}

/** 天赋购买事件载荷 */
export interface PrestigePerkPurchasedEvent {
  perkId: string;
  perkLevel: number;
  cost: number;
}

/** 轮回完成事件载荷 */
export interface PrestigeCompletedEvent {
  prestigePointsGained: number;
  totalPrestigePoints: number;
  prestigeCount: number;
}

/** 存档格式 */
export interface PrestigeEngineSaveData {
  prestigePoints: number;
  prestigeCount: number;
  totalLevelsAccumulated: number;
  purchasedPerks: Record<string, number>;
}

/* ==================== 天赋成本表 ==================== */

const COST_TABLE: Record<string, readonly number[]> = {
  permanent_atk: [10, 20, 40, 80],
  permanent_def: [10, 20, 40, 80],
  permanent_hp: [15, 30, 60],
  permanent_gold: [20, 40],
  permanent_exp: [20, 40],
  permanent_speed: [15, 30],
  permanent_crit: [25],
};

/* ==================== PrestigeEngine ==================== */

export class PrestigeEngine implements IModule {
  readonly moduleId = 'prestige';

  /* ---- 状态 ---- */

  prestigePoints = 0;
  prestigeCount = 0;
  totalLevelsAccumulated = 0;

  private readonly perkTree: Map<string, Perk>;

  /* ---- 单例 ---- */

  private static _instance: PrestigeEngine;
  static get instance(): PrestigeEngine {
    if (!PrestigeEngine._instance) {
      PrestigeEngine._instance = new PrestigeEngine();
    }
    return PrestigeEngine._instance;
  }

  private constructor() {
    this.perkTree = this.buildPerkTree();
  }

  /* ==================== 天赋定义 ==================== */

  private buildPerkTree(): Map<string, Perk> {
    const tree = new Map<string, Perk>();

    tree.set('permanent_atk', {
      id: 'permanent_atk',
      name: '永久强化·攻击',
      description: '提升所有角色的基础攻击力',
      cost: 10,
      maxLevel: 4,
      currentLevel: 0,
      effect: (level: number) => 1 + level * 0.05,
      effectDescription: '每级 +5% 攻击力',
    });

    tree.set('permanent_def', {
      id: 'permanent_def',
      name: '永久强化·防御',
      description: '提升所有角色的基础防御力',
      cost: 10,
      maxLevel: 4,
      currentLevel: 0,
      effect: (level: number) => 1 + level * 0.05,
      effectDescription: '每级 +5% 防御力',
    });

    tree.set('permanent_hp', {
      id: 'permanent_hp',
      name: '永久强化·生命',
      description: '提升所有角色的基础生命值',
      cost: 15,
      maxLevel: 3,
      currentLevel: 0,
      effect: (level: number) => 1 + level * 0.1,
      effectDescription: '每级 +10% 生命值',
    });

    tree.set('permanent_gold', {
      id: 'permanent_gold',
      name: '永久强化·金币',
      description: '提升金币获取量',
      cost: 20,
      maxLevel: 2,
      currentLevel: 0,
      effect: (level: number) => 1 + level * 0.1,
      effectDescription: '每级 +10% 金币获取',
    });

    tree.set('permanent_exp', {
      id: 'permanent_exp',
      name: '永久强化·经验',
      description: '提升经验获取量',
      cost: 20,
      maxLevel: 2,
      currentLevel: 0,
      effect: (level: number) => 1 + level * 0.1,
      effectDescription: '每级 +10% 经验获取',
    });

    tree.set('permanent_speed', {
      id: 'permanent_speed',
      name: '永久强化·速度',
      description: '提升旅行速度',
      cost: 15,
      maxLevel: 2,
      currentLevel: 0,
      effect: (level: number) => 1 + level * 0.1,
      effectDescription: '每级 +10% 旅行速度',
    });

    tree.set('permanent_crit', {
      id: 'permanent_crit',
      name: '永久强化·暴击',
      description: '提升暴击率',
      cost: 25,
      maxLevel: 1,
      currentLevel: 0,
      effect: (level: number) => level * 0.05,
      effectDescription: '每级 +5% 暴击率',
    });

    return tree;
  }

  /* ==================== 状态查询 ==================== */

  /**
   * 检查是否可以轮回（玩家等级 >= 100）
   */
  canPrestige(): boolean {
    const minLevel = constants.prestige.minLevelRequired as number;
    return PlayerActor.instance.level >= minLevel;
  }

  /**
   * 计算轮回点数
   * points = (currentLevel - 100) * 0.1 + totalLevels * 0.5
   */
  calculatePrestigePoints(currentLevel: number, totalLevels: number): number {
    const minLevel = constants.prestige.minLevelRequired as number;
    const pointsPerLevelAbove = constants.prestige.pointsPerLevelAbove as number;
    const totalLevelsMultiplier = constants.prestige.totalLevelsMultiplier as number;

    const levelAbove = Math.max(0, currentLevel - minLevel);
    return levelAbove * pointsPerLevelAbove + totalLevels * totalLevelsMultiplier;
  }

  /* ==================== 轮回执行 ==================== */

  /**
   * 执行轮回：
   * - 判断是否满足条件
   * - 结算轮回点数
   * - 重置玩家所有进度
   * - 保留并增加轮回状态
   */
  executePrestige(): PrestigeResult {
    if (!this.canPrestige()) {
      return {
        success: false,
        prestigePointsGained: 0,
        totalPrestigePoints: this.prestigePoints,
        prestigeCount: this.prestigeCount,
        oldLevel: PlayerActor.instance.level,
      };
    }

    const player = PlayerActor.instance;
    const currentLevel = player.level;

    // 提前计算点数
    const pointsGained = this.calculatePrestigePoints(currentLevel, this.totalLevelsAccumulated);

    // 在玩家重置之前保存轮回状态快照
    const savedPoints = this.prestigePoints;
    const savedCount = this.prestigeCount;
    const savedAccumulated = this.totalLevelsAccumulated;
    const savedPerkLevels = new Map<string, number>();
    for (const perk of this.perkTree.values()) {
      if (perk.currentLevel > 0) {
        savedPerkLevels.set(perk.id, perk.currentLevel);
      }
    }

    // 重置玩家（这会级联调用所有模块的 reset，包括本引擎）
    player.reset();

    // 恢复并更新轮回状态
    this.prestigePoints = savedPoints + pointsGained;
    this.prestigeCount = savedCount + 1;
    this.totalLevelsAccumulated = savedAccumulated + currentLevel;
    for (const [id, level] of savedPerkLevels) {
      const perk = this.perkTree.get(id);
      if (perk) {
        perk.currentLevel = level;
      }
    }

    const result: PrestigeResult = {
      success: true,
      prestigePointsGained: pointsGained,
      totalPrestigePoints: this.prestigePoints,
      prestigeCount: this.prestigeCount,
      oldLevel: currentLevel,
    };

    globalEventBus.emit<PrestigeCompletedEvent>('prestige:completed', {
      prestigePointsGained: pointsGained,
      totalPrestigePoints: this.prestigePoints,
      prestigeCount: this.prestigeCount,
    });

    return result;
  }

  /* ==================== 天赋系统 ==================== */

  /**
   * 购买轮回天赋
   * @returns 是否购买成功
   */
  purchasePerk(perkId: string): boolean {
    const perk = this.perkTree.get(perkId);
    if (!perk) return false;
    if (perk.currentLevel >= perk.maxLevel) return false;

    const cost = this.getPerkCost(perkId);
    if (this.prestigePoints < cost) return false;

    this.prestigePoints -= cost;
    perk.currentLevel += 1;

    globalEventBus.emit<PrestigePerkPurchasedEvent>('prestige:perkPurchased', {
      perkId,
      perkLevel: perk.currentLevel,
      cost,
    });

    return true;
  }

  /**
   * 获取指定天赋的当前升级成本
   * 天赋满级时返回 Infinity
   */
  getPerkCost(perkId: string): number {
    const perk = this.perkTree.get(perkId);
    if (!perk) return Infinity;

    const costs = COST_TABLE[perkId];
    if (!costs) return Infinity;

    const index = perk.currentLevel;
    if (index >= costs.length) return Infinity;

    return costs[index]!;
  }

  /**
   * 获取已购买的所有天赋（含等级）
   */
  getPurchasedPerks(): Perk[] {
    const purchased: Perk[] = [];
    for (const perk of this.perkTree.values()) {
      if (perk.currentLevel > 0) {
        purchased.push({ ...perk });
      }
    }
    return purchased;
  }

  /**
   * 获取指定天赋的当前等级
   */
  getPerkLevel(perkId: string): number {
    const perk = this.perkTree.get(perkId);
    return perk ? perk.currentLevel : 0;
  }

  /**
   * 获取全部活跃的轮回加成
   */
  getActiveBonuses(): PrestigeBonus {
    const atkLevel = this.getPerkLevel('permanent_atk');
    const defLevel = this.getPerkLevel('permanent_def');
    const hpLevel = this.getPerkLevel('permanent_hp');
    const goldLevel = this.getPerkLevel('permanent_gold');
    const expLevel = this.getPerkLevel('permanent_exp');
    const speedLevel = this.getPerkLevel('permanent_speed');
    const critLevel = this.getPerkLevel('permanent_crit');

    return {
      attackMultiplier: 1 + atkLevel * 0.05,
      defenseMultiplier: 1 + defLevel * 0.05,
      hpMultiplier: 1 + hpLevel * 0.1,
      goldMultiplier: 1 + goldLevel * 0.1,
      expMultiplier: 1 + expLevel * 0.1,
      speedMultiplier: 1 + speedLevel * 0.1,
      critRateBonus: critLevel * 0.05,
    };
  }

  /**
   * 获取所有天赋（含未购买的，深拷贝）
   */
  getAvailablePerks(): Perk[] {
    return Array.from(this.perkTree.values()).map((p) => ({ ...p }));
  }

  /* ==================== IModule ==================== */

  tick(_deltaSeconds: number): void {
    // 轮回引擎无需 tick 逻辑
  }

  onSave(): SaveData {
    const purchasedPerks: Record<string, number> = {};
    for (const perk of this.perkTree.values()) {
      if (perk.currentLevel > 0) {
        purchasedPerks[perk.id] = perk.currentLevel;
      }
    }

    return {
      prestigePoints: this.prestigePoints,
      prestigeCount: this.prestigeCount,
      totalLevelsAccumulated: this.totalLevelsAccumulated,
      purchasedPerks,
    } as unknown as SaveData;
  }

  onLoad(data: SaveData): void {
    this.reset();

    const save = data as unknown as PrestigeEngineSaveData;
    this.prestigePoints = save.prestigePoints ?? 0;
    this.prestigeCount = save.prestigeCount ?? 0;
    this.totalLevelsAccumulated = save.totalLevelsAccumulated ?? 0;

    if (save.purchasedPerks) {
      for (const [id, level] of Object.entries(save.purchasedPerks)) {
        const perk = this.perkTree.get(id);
        if (perk) {
          perk.currentLevel = level;
        }
      }
    }
  }

  reset(): void {
    this.prestigePoints = 0;
    this.prestigeCount = 0;
    this.totalLevelsAccumulated = 0;

    for (const perk of this.perkTree.values()) {
      perk.currentLevel = 0;
    }
  }
}

/** 全局单例 */
export const prestigeEngine = PrestigeEngine.instance;
