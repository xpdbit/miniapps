import { IModule, SaveData } from '../actor/IModule';
import { globalEventBus } from '../core/EventBus';

/** 里程里程碑定义 */
export interface MileageMilestone {
  threshold: number;
  claimed: boolean;
}

/** 里程宝箱奖励 */
export interface MileageChestReward {
  gold: number;
  exp: number;
  staminaRestore: number;
}

/** 里程管理器存档数据 */
export interface MileageSaveData {
  totalMileage: number;
  sessionMileage: number;
  milestoneClaimed: Record<number, boolean>;
  lastChestMileage: number;
}

/** 里程更新事件载荷 */
export interface MileageUpdatedPayload {
  totalMileage: number;
  sessionMileage: number;
}

/** 里程碑达成事件载荷 */
export interface MileageMilestoneReachedPayload {
  threshold: number;
  totalMileage: number;
}

/** 宝箱奖励事件载荷 */
export interface MileageChestRewardPayload {
  mileage: number;
  chestNumber: number;
  rewards: MileageChestReward;
}

/** 里程碑阈值（公里） */
const MILESTONE_THRESHOLDS: number[] = [10, 50, 100, 500, 1000];

/** 宝箱间隔（公里） */
const CHEST_INTERVAL_KM: number = 50;

/** 基础里程速率（公里/秒/倍率） */
const BASE_MILEAGE_RATE: number = 0.1;

/** 宝箱基础奖励 */
const BASE_CHEST_REWARDS: Omit<MileageChestReward, 'staminaRestore'> = {
  gold: 50,
  exp: 30,
};

export class MileageManager implements IModule {
  readonly moduleId = 'MileageManager';

  private static _instance: MileageManager;
  static get instance(): MileageManager {
    if (!MileageManager._instance) {
      MileageManager._instance = new MileageManager();
    }
    return MileageManager._instance;
  }

  private totalMileage: number = 0;
  private sessionMileage: number = 0;
  private milestoneClaimed: Map<number, boolean> = new Map();
  private lastChestMileage: number = 0;

  private constructor() {
    this.initMilestones();
  }

  get totalMileageValue(): number {
    return this.totalMileage;
  }

  get sessionMileageValue(): number {
    return this.sessionMileage;
  }

  get milestones(): MileageMilestone[] {
    return MILESTONE_THRESHOLDS.map((threshold) => ({
      threshold,
      claimed: this.milestoneClaimed.get(threshold) ?? false,
    }));
  }

  get unclaimedMilestones(): MileageMilestone[] {
    return this.milestones.filter(
      (m) => !m.claimed && this.totalMileage >= m.threshold,
    );
  }

  get nextChestMileage(): number {
    return this.lastChestMileage + CHEST_INTERVAL_KM;
  }

  /** 里程管理器不自立 tick，由 TravelEngine 调用 trackMileage */
  tick(_deltaSeconds: number): void {
    // no-op
  }

  /**
   * 里程追踪
   * @param deltaSeconds 时间增量（秒）
   * @param speedMultiplier 速度倍率（含基础速度 * 路线倍率 * 增益）
   */
  trackMileage(deltaSeconds: number, speedMultiplier: number): void {
    const mileageGain = deltaSeconds * speedMultiplier * BASE_MILEAGE_RATE;
    this.totalMileage += mileageGain;
    this.sessionMileage += mileageGain;

    this.checkMilestones();
    this.checkChestRewards();

    globalEventBus.emit<MileageUpdatedPayload>('mileage:updated', {
      totalMileage: this.totalMileage,
      sessionMileage: this.sessionMileage,
    });
  }

  /** 重置会话里程（新旅行开始时调用） */
  resetSessionMileage(): void {
    this.sessionMileage = 0;
    this.lastChestMileage = 0;
  }

  /** 标记某里程碑为已领取 */
  claimMilestone(threshold: number): boolean {
    const milestone = this.milestones.find((m) => m.threshold === threshold);
    if (!milestone || milestone.claimed || this.totalMileage < threshold) {
      return false;
    }
    this.milestoneClaimed.set(threshold, true);
    return true;
  }

  onSave(): SaveData {
    const milestoneClaimed: Record<number, boolean> = {};
    this.milestoneClaimed.forEach((claimed, threshold) => {
      milestoneClaimed[threshold] = claimed;
    });
    return {
      totalMileage: this.totalMileage,
      sessionMileage: this.sessionMileage,
      milestoneClaimed,
      lastChestMileage: this.lastChestMileage,
    };
  }

  onLoad(data: SaveData): void {
    const d = data as unknown as MileageSaveData;
    this.totalMileage = d.totalMileage ?? 0;
    this.sessionMileage = d.sessionMileage ?? 0;
    this.lastChestMileage = d.lastChestMileage ?? 0;
    this.milestoneClaimed.clear();
    if (d.milestoneClaimed) {
      for (const [key, value] of Object.entries(d.milestoneClaimed)) {
        this.milestoneClaimed.set(Number(key), Boolean(value));
      }
    }
    this.initMilestones();
  }

  reset(): void {
    this.totalMileage = 0;
    this.sessionMileage = 0;
    this.lastChestMileage = 0;
    this.milestoneClaimed.clear();
    this.initMilestones();
  }

  private initMilestones(): void {
    for (const threshold of MILESTONE_THRESHOLDS) {
      if (!this.milestoneClaimed.has(threshold)) {
        this.milestoneClaimed.set(threshold, false);
      }
    }
  }

  private checkMilestones(): void {
    for (const threshold of MILESTONE_THRESHOLDS) {
      const isClaimed = this.milestoneClaimed.get(threshold) ?? false;
      if (this.totalMileage >= threshold && !isClaimed) {
        globalEventBus.emit<MileageMilestoneReachedPayload>('mileage:milestone', {
          threshold,
          totalMileage: this.totalMileage,
        });
      }
    }
  }

  private checkChestRewards(): void {
    while (this.sessionMileage >= this.lastChestMileage + CHEST_INTERVAL_KM) {
      this.lastChestMileage += CHEST_INTERVAL_KM;
      const chestNumber = Math.floor(this.lastChestMileage / CHEST_INTERVAL_KM);
      const rewards = this.generateChestReward(chestNumber);
      globalEventBus.emit<MileageChestRewardPayload>('mileage:chest', {
        mileage: this.lastChestMileage,
        chestNumber,
        rewards,
      });
    }
  }

  private generateChestReward(chestNumber: number): MileageChestReward {
    const scale = 1 + chestNumber * 0.1;
    return {
      gold: Math.floor(BASE_CHEST_REWARDS.gold * scale),
      exp: Math.floor(BASE_CHEST_REWARDS.exp * scale),
      staminaRestore: Math.floor(10 * scale),
    };
  }
}
