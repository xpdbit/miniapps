/**
 * IdleRewardEngine — 挂机收益引擎
 *
 * 单例，实现 IModule 接口，管理在线收益累积和离线收益计算。
 * 在线时逐步累积 gold/exp/mileage，离线时根据时间计算一次性大额收益。
 * 发出事件：
 *   'idle:onlineTick'     — 每帧在线累积后，带累积量
 *   'idle:offlineRewards'  — 离线收益计算完（游戏启动时），带 IdleReward
 */

import { IModule, SaveData } from '../actor/IModule';
import { EventBus, globalEventBus } from '../core/EventBus';
import { TimeManager } from '../core/TimeManager';
import { itemRegistry } from '../inventory/ItemRegistry';

// ---------------------------------------------------------------------------
// 内置默认配置
// ---------------------------------------------------------------------------

const IDLE_CONFIG = {
  goldPerSecond: 0.5,
  expPerSecond: 0.1,
  mileagePerSecond: 0.05,
  maxOfflineSeconds: 28800, // 8 小时
};

const ITEM_CHECK_INTERVAL = 300; // 每 300 秒检查一次掉落
const ITEM_DROP_CHANCE = 0.2; // 每次检查 20% 概率

const INACTIVE_THRESHOLD_SECONDS = 48 * 3600; // 离线超过 48 小时视为不活跃

// ---------------------------------------------------------------------------
// 事件载荷类型
// ---------------------------------------------------------------------------

export interface OnlineTickEvent {
  gold: number;
  exp: number;
  mileage: number;
}

export interface OfflineRewardsEvent {
  rewards: IdleReward;
}

// ---------------------------------------------------------------------------
// 核心类型
// ---------------------------------------------------------------------------

export interface IdleReward {
  gold: number;
  exp: number;
  mileage: number;
  /** 随机掉落物品 ID 列表 */
  items: string[];
  /** 离线期间自动战斗通关次数 */
  combatClears: number;
}

// ---------------------------------------------------------------------------
// 存档接口
// ---------------------------------------------------------------------------

interface IdleRewardSaveData {
  onlineGold: number;
  onlineExp: number;
  onlineMileage: number;
  prestigeMultiplier: number;
  activityMultiplier: number;
}

// ---------------------------------------------------------------------------
// IdleRewardEngine
// ---------------------------------------------------------------------------

export class IdleRewardEngine implements IModule {
  readonly moduleId = 'idleReward';

  // ---- 单例 ----
  private static _instance: IdleRewardEngine;
  static get instance(): IdleRewardEngine {
    if (!IdleRewardEngine._instance) {
      IdleRewardEngine._instance = new IdleRewardEngine();
    }
    return IdleRewardEngine._instance;
  }

  // 在线累积收益
  private onlineGold = 0;
  private onlineExp = 0;
  private onlineMileage = 0;

  // 待领取离线收益（游戏启动时计算，由外部消费后调用 claimPendingRewards）
  private pendingRewards: IdleReward | null = null;

  // 倍率
  private prestigeMultiplier = 1;
  private activityMultiplier = 1;

  // 依赖
  private eventBus: EventBus;
  private timeManager: TimeManager;

  private constructor(eventBus?: EventBus, timeManager?: TimeManager) {
    this.eventBus = eventBus ?? globalEventBus;
    this.timeManager = timeManager ?? new TimeManager();
  }

  // -----------------------------------------------------------------------
  // 常用 getter（供外部读取累积收益）
  // -----------------------------------------------------------------------

  get accumulatedGold(): number {
    return this.onlineGold;
  }

  get accumulatedExp(): number {
    return this.onlineExp;
  }

  get accumulatedMileage(): number {
    return this.onlineMileage;
  }

  // -----------------------------------------------------------------------
  // 公共方法
  // -----------------------------------------------------------------------

  /** 在线收益累积（每帧由 tick 调用，也可直接调用） */
  accumulateOnlineRewards(deltaSeconds: number): void {
    this.onlineGold += IDLE_CONFIG.goldPerSecond * deltaSeconds;
    this.onlineExp += IDLE_CONFIG.expPerSecond * deltaSeconds;
    this.onlineMileage += IDLE_CONFIG.mileagePerSecond * deltaSeconds;
  }

  /**
   * 计算离线收益
   * @param offlineSeconds - 实际离线秒数（调用方保证非负）
   */
  calculateOfflineRewards(offlineSeconds: number): IdleReward {
    const clamped = Math.min(offlineSeconds, IDLE_CONFIG.maxOfflineSeconds);
    const decay = this.getTimeDecay(clamped);
    const totalMultiplier = this.prestigeMultiplier * this.activityMultiplier;

    return {
      gold: IDLE_CONFIG.goldPerSecond * clamped * decay * totalMultiplier,
      exp: IDLE_CONFIG.expPerSecond * clamped * decay * totalMultiplier,
      mileage: IDLE_CONFIG.mileagePerSecond * clamped * decay * totalMultiplier,
      items: this.generateRandomItems(clamped),
      combatClears: this.calculateCombatClears(clamped),
    };
  }

  /**
   * 游戏启动时处理离线收益
   * - 从 TimeManager 获取离线时长
   * - 根据离线时长判断是否"不活跃"（≥48h → activityMultiplier = 2）
   * - 计算收益并存入 pendingRewards
   * - 发出 'idle:offlineRewards' 事件
   * @returns IdleReward | null（无离线收益时返回 null）
   */
  processOfflineRewards(): IdleReward | null {
    const offlineSeconds = this.timeManager.getOfflineDuration();
    if (offlineSeconds <= 0) return null;

    // 不活跃判定：离线超过阈值则启动 +100% 奖励
    if (offlineSeconds >= INACTIVE_THRESHOLD_SECONDS) {
      this.activityMultiplier = 2;
    }

    const rewards = this.calculateOfflineRewards(offlineSeconds);
    this.pendingRewards = rewards;

    this.eventBus.emit('idle:offlineRewards', { rewards });
    return rewards;
  }

  /** 获取待领取的离线收益 */
  getPendingRewards(): IdleReward | null {
    return this.pendingRewards;
  }

  /** 领取离线收益（清空待领取） */
  claimPendingRewards(): void {
    this.pendingRewards = null;
  }

  /** 设置轮回（prestige）倍率 */
  setPrestigeMultiplier(multiplier: number): void {
    this.prestigeMultiplier = Math.max(1, multiplier);
  }

  /** 设置活跃度倍率（1 = 正常, 2 = 不活跃 +100%） */
  setActivityMultiplier(multiplier: number): void {
    this.activityMultiplier = Math.max(1, multiplier);
  }

  // -----------------------------------------------------------------------
  // IModule 接口实现
  // -----------------------------------------------------------------------

  tick(deltaSeconds: number): void {
    this.accumulateOnlineRewards(deltaSeconds);

    this.eventBus.emit('idle:onlineTick', {
      gold: this.onlineGold,
      exp: this.onlineExp,
      mileage: this.onlineMileage,
    } satisfies OnlineTickEvent);
  }

  onSave(): SaveData {
    return {
      onlineGold: this.onlineGold,
      onlineExp: this.onlineExp,
      onlineMileage: this.onlineMileage,
      prestigeMultiplier: this.prestigeMultiplier,
      activityMultiplier: this.activityMultiplier,
    } satisfies IdleRewardSaveData;
  }

  onLoad(data: SaveData): void {
    this.onlineGold = (data.onlineGold as number) ?? 0;
    this.onlineExp = (data.onlineExp as number) ?? 0;
    this.onlineMileage = (data.onlineMileage as number) ?? 0;
    this.prestigeMultiplier = Math.max(1, (data.prestigeMultiplier as number) ?? 1);
    this.activityMultiplier = Math.max(1, (data.activityMultiplier as number) ?? 1);
  }

  reset(): void {
    this.onlineGold = 0;
    this.onlineExp = 0;
    this.onlineMileage = 0;
    this.pendingRewards = null;
    this.prestigeMultiplier = 1;
    this.activityMultiplier = 1;
  }

  // -----------------------------------------------------------------------
  // 内部方法
  // -----------------------------------------------------------------------

  /**
   * 根据离线时长获取时间衰减系数
   *   < 1 小时 → 1.0x（全额）
   *   1～6 小时 → 0.8x
   *   6～24 小时 → 0.5x
   *   > 24 小时 → 0.2x
   */
  private getTimeDecay(seconds: number): number {
    const hours = seconds / 3600;
    if (hours < 1) return 1.0;
    if (hours < 6) return 0.8;
    if (hours < 24) return 0.5;
    return 0.2;
  }

  /** 根据离线时长随机生成掉落物品（使用 ItemRegistry 中的真实物品） */
  private generateRandomItems(seconds: number): string[] {
    const items: string[] = [];
    const checks = Math.floor(seconds / ITEM_CHECK_INTERVAL);
    if (!itemRegistry) return items;
    const droppable = itemRegistry.getDroppableItems();
    if (droppable.length === 0) return items;
    for (let i = 0; i < checks; i++) {
      if (Math.random() < ITEM_DROP_CHANCE) {
        const totalWeight = droppable.reduce((sum, item) => sum + item.dropWeight, 0);
        let roll = Math.random() * totalWeight;
        let selected = droppable[droppable.length - 1]!;
        for (const item of droppable) {
          roll -= item.dropWeight;
          if (roll <= 0) {
            selected = item;
            break;
          }
        }
        items.push(selected.id);
      }
    }
    return items;
  }

  /** 计算离线期间自动战斗通关次数（每 60 秒 1 次） */
  private calculateCombatClears(seconds: number): number {
    return Math.floor(seconds / 60);
  }
}

/** 全局单例 */
export const idleRewardEngine = IdleRewardEngine.instance;
