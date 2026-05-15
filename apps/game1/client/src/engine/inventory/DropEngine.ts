/**
 * DropEngine — 掉落系统引擎
 *
 * 管理旅途/战斗过程中的随机物品掉落。
 * 支持：
 * - 定时掉落：旅途每 N 秒检查一次掉落概率
 * - 事件掉落：事件选择后奖励物品
 * - 里程宝箱：每 X 里程触发一次宝箱掉落
 * - 权重随机：根据物品的 dropWeight 加权选择
 */

import { IModule, SaveData } from '../actor/IModule';
import { globalEventBus } from '../core/EventBus';
import { itemRegistry, type ItemTemplate } from './ItemRegistry';
import { InventoryEngine } from './InventoryEngine';

// ============================================================
// 常量
// ============================================================

/** 旅途掉落检查间隔（秒） */
const TRAVEL_DROP_INTERVAL = 30;

/** 基础掉落概率（每次检查） */
const BASE_DROP_CHANCE = 0.35;

/** 里程宝箱间隔（公里） */
const CHEST_INTERVAL_KM = 50;

/** 里程宝箱掉落保底稀有度 */
const CHEST_RARITY_MAP: Record<string, Array<{ rarity: string; weight: number }>> = {
  common: [
    { rarity: 'common', weight: 70 },
    { rarity: 'uncommon', weight: 25 },
    { rarity: 'rare', weight: 5 },
  ],
  rare: [
    { rarity: 'uncommon', weight: 40 },
    { rarity: 'rare', weight: 35 },
    { rarity: 'epic', weight: 20 },
    { rarity: 'legendary', weight: 5 },
  ],
  legendary: [
    { rarity: 'rare', weight: 30 },
    { rarity: 'epic', weight: 40 },
    { rarity: 'legendary', weight: 30 },
  ],
};

// ============================================================
// 事件载荷
// ============================================================

export interface ItemDroppedPayload {
  itemId: string;
  itemName: string;
  quantity: number;
  rarity: string;
  source: 'travel_drop' | 'travel_chest' | 'event_reward' | 'milestone';
}

export interface ChestRewardPayload {
  chestNumber: number;
  items: Array<{ itemId: string; quantity: number }>;
  gold: number;
}

// ============================================================
// 存档
// ============================================================

interface DropEngineSaveData {
  lastDropCheckTime: number;
  totalChestsOpened: number;
  lastChestMileage: number;
}

// ============================================================
// DropEngine
// ============================================================

export class DropEngine implements IModule {
  readonly moduleId = 'DropEngine';

  private static _instance: DropEngine;
  static get instance(): DropEngine {
    if (!DropEngine._instance) {
      DropEngine._instance = new DropEngine();
    }
    return DropEngine._instance;
  }

  private lastDropCheckTime = 0;
  private totalChestsOpened = 0;
  private lastChestMileage = 0;

  /** 当前旅途累计里程（用于宝箱判断） */
  private sessionMileage = 0;

  private inventoryEngine = InventoryEngine.instance;

  private constructor() {}

  // ============================================================
  // 旅途掉落
  // ============================================================

  /**
   * 旅途落物检查（每 30 秒检查一次）
   * 由 TravelEngine 在 tick 中调用
   * @param deltaSeconds 时间增量
   * @param currentProgress 旅途进度（0~1）
   * @param routeDifficulty 路线难度倍率（1~5）
   */
  tickTravelDrop(deltaSeconds: number, currentProgress: number, routeDifficulty: number): void {
    // 累积时间
    this.lastDropCheckTime += deltaSeconds;

    // 检查是否到达掉落间隔
    if (this.lastDropCheckTime < TRAVEL_DROP_INTERVAL) return;
    this.lastDropCheckTime = 0;

    // 旅途前 10% 不掉落
    if (currentProgress < 0.1) return;

    // 概率随进度提升
    const progressBonus = currentProgress * 0.3;
    const dropChance = Math.min(BASE_DROP_CHANCE + progressBonus, 0.7);

    if (Math.random() >= dropChance) return;

    // 选择稀有度（路程越远，高稀有度概率越高）
    const rarityRoll = Math.random();
    const difficultyBonus = (routeDifficulty - 1) * 0.05;
    let rarity: string;
    if (rarityRoll < 0.5 - difficultyBonus) {
      rarity = 'common';
    } else if (rarityRoll < 0.8 - difficultyBonus) {
      rarity = 'uncommon';
    } else if (rarityRoll < 0.95 - difficultyBonus) {
      rarity = 'rare';
    } else {
      rarity = 'epic';
    }

    // 选择物品并掉落
    const item = this.selectRandomDrop([rarity]);
    if (!item) return;

    const quantity = item.type === 'consumable' || item.type === 'food' || item.type === 'material'
      ? Math.floor(Math.random() * 3) + 1
      : 1;

    const added = this.inventoryEngine.addItem(item.id, quantity, item.name, item.type, item.rarity, item.weight);
    if (!added) return;

    globalEventBus.emit<ItemDroppedPayload>('drop:itemDropped', {
      itemId: item.id,
      itemName: item.name,
      quantity,
      rarity: item.rarity,
      source: 'travel_drop',
    });
  }

  // ============================================================
  // 里程宝箱
  // ============================================================

  /**
   * 检查并触发里程宝箱
   * @param totalMileage 总里程
   * @param sessionMileage 当前旅途里程增量
   */
  checkChestReward(totalMileage: number, sessionMileage: number): void {
    this.sessionMileage = sessionMileage;

    while (this.sessionMileage >= this.lastChestMileage + CHEST_INTERVAL_KM) {
      this.lastChestMileage += CHEST_INTERVAL_KM;
      this.totalChestsOpened++;

      const chestNumber = Math.floor(this.lastChestMileage / CHEST_INTERVAL_KM);
      const reward = this.generateChestReward(chestNumber, totalMileage);

      // 将物品添加到背包
      for (const item of reward.items) {
        const template = itemRegistry.getTemplate(item.itemId);
        if (template) {
          this.inventoryEngine.addItem(
            item.itemId,
            item.quantity,
            template.name,
            template.type,
            template.rarity,
            template.weight,
          );
        }
      }

      // 金币直接发
      this.inventoryEngine.addGold(reward.gold);

      globalEventBus.emit<ChestRewardPayload>('drop:chestReward', reward);
    }
  }

  // ============================================================
  // 事件奖励
  // ============================================================

  /**
   * 获取事件的随机物品奖励
   * @returns itemId 或 null
   */
  getEventItemReward(): string | null {
    // 30% 概率获得物品
    if (Math.random() > 0.3) return null;

    // 从 common/uncommon 池中随机选取
    const items = itemRegistry.getDroppableByRarity(['common', 'uncommon']);
    if (items.length === 0) return null;

    // 加权选择
    const totalWeight = items.reduce((sum, item) => sum + item.dropWeight, 0);
    let roll = Math.random() * totalWeight;
    for (const item of items) {
      roll -= item.dropWeight;
      if (roll <= 0) return item.id;
    }

    return items[items.length - 1]?.id ?? null;
  }

  /**
   * 添加事件物品奖励到背包
   */
  addEventItemReward(itemId: string): boolean {
    const template = itemRegistry.getTemplate(itemId);
    if (!template) return false;

    const quantity = template.type === 'consumable' || template.type === 'food' || template.type === 'material'
      ? Math.floor(Math.random() * 2) + 1
      : 1;

    const added = this.inventoryEngine.addItem(itemId, quantity, template.name, template.type, template.rarity, template.weight);
    if (added) {
      globalEventBus.emit<ItemDroppedPayload>('drop:itemDropped', {
        itemId,
        itemName: template.name,
        quantity,
        rarity: template.rarity,
        source: 'event_reward',
      });
    }
    return added;
  }

  // ============================================================
  // 工具方法
  // ============================================================

  /**
   * 加权随机选择物品
   */
  private selectRandomDrop(rarities: string[]): ItemTemplate | null {
    const candidates = itemRegistry.getDroppableByRarity(rarities as any);
    if (candidates.length === 0) return null;

    const totalWeight = candidates.reduce((sum, item) => sum + item.dropWeight, 0);
    let roll = Math.random() * totalWeight;

    for (const item of candidates) {
      roll -= item.dropWeight;
      if (roll <= 0) return item;
    }

    return candidates[candidates.length - 1] ?? null;
  }

  /**
   * 生成宝箱奖励内容
   */
  private generateChestReward(chestNumber: number, totalMileage: number): ChestRewardPayload {
    // 根据总里程决定宝箱品质
    let pool: string;
    if (totalMileage < 1000) pool = 'common';
    else if (totalMileage < 5000) pool = 'rare';
    else pool = 'legendary';

    // 稀有度权重随机
    const rarityMap = CHEST_RARITY_MAP[pool] ?? CHEST_RARITY_MAP.common!;
    let rarityRoll = Math.random();
    let selectedRarity = 'common';
    for (const entry of rarityMap) {
      rarityRoll -= entry.weight / 100;
      if (rarityRoll <= 0) {
        selectedRarity = entry.rarity;
        break;
      }
    }

    // 物品数量
    const itemCount = pool === 'legendary' ? 2 : 1;
    const items: Array<{ itemId: string; quantity: number }> = [];

    for (let i = 0; i < itemCount; i++) {
      const item = this.selectRandomDrop([selectedRarity]);
      if (item) {
        items.push({
          itemId: item.id,
          quantity: item.type === 'consumable' || item.type === 'material' ? Math.floor(Math.random() * 3) + 1 : 1,
        });
      }
    }

    // 金币奖励随宝箱编号增长
    const gold = Math.floor((50 + chestNumber * 10) * (pool === 'legendary' ? 2 : pool === 'rare' ? 1.5 : 1));

    return { chestNumber, items, gold };
  }

  // ============================================================
  // IModule 接口
  // ============================================================

  tick(_deltaSeconds: number): void {
    // DropEngine 不自立 tick，由 TravelEngine 驱动
  }

  onSave(): SaveData {
    return {
      lastDropCheckTime: this.lastDropCheckTime,
      totalChestsOpened: this.totalChestsOpened,
      lastChestMileage: this.lastChestMileage,
    } as unknown as SaveData;
  }

  onLoad(data: SaveData): void {
    const d = data as unknown as DropEngineSaveData;
    this.lastDropCheckTime = d.lastDropCheckTime ?? 0;
    this.totalChestsOpened = d.totalChestsOpened ?? 0;
    this.lastChestMileage = d.lastChestMileage ?? 0;
  }

  reset(): void {
    this.lastDropCheckTime = 0;
    this.totalChestsOpened = 0;
    this.lastChestMileage = 0;
    this.sessionMileage = 0;
  }
}

/** 全局单例 */
export const dropEngine = DropEngine.instance;
