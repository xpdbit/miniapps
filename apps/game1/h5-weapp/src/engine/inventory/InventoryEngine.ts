import { IModule, SaveData } from '../actor/IModule';
import { globalEventBus } from '../core/EventBus';
import constants from '../../config/constants.json';

// ---------------------------------------------------------------------------
// 事件载荷类型
// ---------------------------------------------------------------------------

export interface InventoryChangedEvent {
  itemIndex: number;
  item: InventoryItem | null;
}

export interface InventoryFullEvent {
  itemId: string;
  quantity: number;
}

// ---------------------------------------------------------------------------
// 核心类型
// ---------------------------------------------------------------------------

export interface InventoryItem {
  itemId: string;
  itemName: string;
  quantity: number;
  type: string;
  rarity: string;
  /** 单个物品重量 */
  weight: number;
  /** 是否可堆叠，默认 true */
  stackable?: boolean;
}

export interface InventoryState {
  /** 动态物品列表，逐个增加，无空位概念 */
  items: InventoryItem[];
  gold: number;
  gems: number;
  /** 当前总重量 */
  currentWeight: number;
  /** 最大负重 */
  maxWeight: number;
}

// ---------------------------------------------------------------------------
// 存档接口
// ---------------------------------------------------------------------------

interface InventorySaveData {
  items: InventoryItem[];
  gold: number;
  gems: number;
  maxWeight: number;
  currentWeight: number;
}

// ---------------------------------------------------------------------------
// 排序选项
// ---------------------------------------------------------------------------

export type SortCriteria = 'name' | 'type' | 'rarity' | 'quantity';

const RARITY_ORDER: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
};

const MAX_STACK = constants.inventory.maxStackSize ?? 999;
const MAX_WEIGHT = constants.inventory.maxWeight ?? 50;

// ---------------------------------------------------------------------------
// InventoryEngine
// ---------------------------------------------------------------------------

export class InventoryEngine implements IModule {
  readonly moduleId = 'InventoryEngine';

  // ---- 单例 ----
  private static _instance: InventoryEngine;
  static get instance(): InventoryEngine {
    if (!InventoryEngine._instance) {
      InventoryEngine._instance = new InventoryEngine();
    }
    return InventoryEngine._instance;
  }

  // ---- 状态：动态列表，无固定格子 ----
  private items: InventoryItem[] = [];
  private gold = 0;
  private gems = 0;
  private currentWeight = 0;
  private maxWeight = MAX_WEIGHT;

  // ---- 私有构造 ----
  private constructor() {}

  // ========================================================================
  //  公开只读访问
  // ========================================================================

  /** 返回背包当前状态快照 */
  getState(): InventoryState {
    return {
      items: [...this.items],
      gold: this.gold,
      gems: this.gems,
      currentWeight: this.currentWeight,
      maxWeight: this.maxWeight,
    };
  }

  // ========================================================================
  //  金币 / 宝石
  // ========================================================================

  getGold(): number {
    return this.gold;
  }

  addGold(amount: number): void {
    this.gold += Math.floor(amount);
    globalEventBus.emit<InventoryChangedEvent>('inventory:changed', {
      itemIndex: -1,
      item: null,
    });
  }

  spendGold(amount: number): boolean {
    if (this.gold < amount) return false;
    this.gold -= Math.floor(amount);
    globalEventBus.emit<InventoryChangedEvent>('inventory:changed', {
      itemIndex: -1,
      item: null,
    });
    return true;
  }

  getGems(): number {
    return this.gems;
  }

  addGems(amount: number): void {
    this.gems += Math.floor(amount);
    globalEventBus.emit<InventoryChangedEvent>('inventory:changed', {
      itemIndex: -1,
      item: null,
    });
  }

  spendGems(amount: number): boolean {
    if (this.gems < amount) return false;
    this.gems -= Math.floor(amount);
    globalEventBus.emit<InventoryChangedEvent>('inventory:changed', {
      itemIndex: -1,
      item: null,
    });
    return true;
  }

  // ========================================================================
  //  物品操作
  // ========================================================================

  /**
   * 逐件添加物品到背包
   * - 可堆叠物品追加到同 itemId 的已有条目
   * - 不可堆叠或没有已有条目时，新建一个条目
   * - 检查重量容量是否足够
   * @param weight 单个物品重量
   * @returns 是否成功添加
   */
  addItem(itemId: string, quantity: number, itemName?: string, type?: string, rarity?: string, weight?: number): boolean {
    if (quantity <= 0) return false;

    const itemWeight = weight ?? 1;
    const weightToAdd = itemWeight * quantity;
    const availableWeight = this.maxWeight - this.currentWeight;

    // 重量容量检查
    if (weightToAdd > availableWeight) {
      globalEventBus.emit<InventoryFullEvent>('inventory:full', {
        itemId,
        quantity,
      });
      return false;
    }

    let remaining = quantity;

    // 1) 尝试堆叠到已有条目（同 itemId 且可堆叠）
    const stackableIdx = this.findStackableIndex(itemId, type ?? '');
    if (stackableIdx !== -1) {
      const entry = this.items[stackableIdx];
      if (entry) {
        const space = MAX_STACK - entry.quantity;
        const add = Math.min(remaining, space);
        entry.quantity += add;
        this.currentWeight += itemWeight * add;
        remaining -= add;

        globalEventBus.emit<InventoryChangedEvent>('inventory:changed', {
          itemIndex: stackableIdx,
          item: { ...entry },
        });

        if (remaining <= 0) return true;
      }
    }

    // 2) 剩余的逐条新加
    while (remaining > 0) {
      const add = Math.min(remaining, MAX_STACK);
      const newEntry: InventoryItem = {
        itemId,
        itemName: itemName ?? itemId,
        quantity: add,
        type: type ?? 'misc',
        rarity: rarity ?? 'common',
        weight: itemWeight,
        stackable: true,
      };
      this.items.push(newEntry);
      this.currentWeight += itemWeight * add;
      remaining -= add;

      globalEventBus.emit<InventoryChangedEvent>('inventory:changed', {
        itemIndex: this.items.length - 1,
        item: { ...newEntry },
      });
    }

    return true;
  }

  /**
   * 从指定索引移除此物品（或减少数量）
   * @param index 物品在 items 数组中的索引
   * @param quantity 移除数量
   * @throws 索引无效或数量不足
   */
  removeItem(index: number, quantity: number): void {
    const entry = this.items[index];
    if (!entry) {
      throw new Error(`物品索引无效: ${index}`);
    }
    if (entry.quantity < quantity) {
      throw new Error(`物品数量不足: 需要 ${quantity}，当前 ${entry.quantity}`);
    }

    const removedWeight = entry.weight * quantity;
    entry.quantity -= quantity;
    this.currentWeight = Math.max(0, this.currentWeight - removedWeight);

    if (entry.quantity <= 0) {
      this.items.splice(index, 1);
      globalEventBus.emit<InventoryChangedEvent>('inventory:changed', {
        itemIndex: index,
        item: null,
      });
    } else {
      globalEventBus.emit<InventoryChangedEvent>('inventory:changed', {
        itemIndex: index,
        item: { ...entry },
      });
    }
  }

  /** 获取指定索引的物品（浅拷贝） */
  getItem(index: number): InventoryItem | null {
    const entry = this.items[index];
    return entry ? { ...entry } : null;
  }

  /** 获取所有物品 */
  getAllItems(): InventoryItem[] {
    return [...this.items];
  }

  /** 按类型筛选物品 */
  getItemsByType(type: string): InventoryItem[] {
    return this.items.filter((item) => item.type === type);
  }

  /** 按稀有度筛选物品 */
  getItemsByRarity(rarity: string): InventoryItem[] {
    return this.items.filter((item) => item.rarity === rarity);
  }

  /**
   * 对物品排序
   * @param criteria 排序依据
   */
  sortItems(criteria: SortCriteria): void {
    this.items.sort((a, b) => {
      switch (criteria) {
        case 'name':
          return a.itemName.localeCompare(b.itemName);
        case 'type':
          return a.type.localeCompare(b.type);
        case 'rarity': {
          const ra = RARITY_ORDER[a.rarity] ?? -1;
          const rb = RARITY_ORDER[b.rarity] ?? -1;
          return rb - ra; // 稀有度高的在前
        }
        case 'quantity':
          return b.quantity - a.quantity; // 数量多的在前
        default:
          return 0;
      }
    });
  }

  /** 是否已达负重上限 */
  isFull(): boolean {
    return this.currentWeight >= this.maxWeight;
  }

  /** 计算当前总重量 */
  getTotalWeight(): number {
    return this.items.reduce((total, item) => total + item.weight * item.quantity, 0);
  }

  /** 获取剩余负重容量 */
  getRemainingWeight(): number {
    return Math.max(0, this.maxWeight - this.currentWeight);
  }

  /** 获取负重使用百分比 (0~100) */
  getWeightPercent(): number {
    if (this.maxWeight <= 0) return 0;
    return Math.min(100, (this.currentWeight / this.maxWeight) * 100);
  }

  /** 获取某物品在所有条目中的总量 */
  getItemCount(itemId: string): number {
    return this.items.reduce((total, item) => {
      if (item.itemId === itemId) return total + item.quantity;
      return total;
    }, 0);
  }

  /** 获取物品总条目数 */
  getItemCountEntries(): number {
    return this.items.length;
  }

  /**
   * 扩容负重
   * @param additionalWeight 增加的负重值
   * @returns 扩容后的最大负重
   */
  expandWeight(additionalWeight: number): number {
    this.maxWeight += additionalWeight;
    return this.maxWeight;
  }

  // ========================================================================
  //  内部工具
  // ========================================================================

  /**
   * 查找可堆叠的条目索引（同 itemId、同 type、未满堆叠上限）
   */
  private findStackableIndex(itemId: string, type: string): number {
    return this.items.findIndex(
      (item) => item.itemId === itemId && item.type === type && item.quantity < MAX_STACK,
    );
  }

  // ========================================================================
  //  IModule
  // ========================================================================

  tick(_deltaSeconds: number): void {
    // 背包引擎无 tick 逻辑
  }

  onSave(): SaveData {
    const data: InventorySaveData = {
      items: this.items,
      gold: this.gold,
      gems: this.gems,
      maxWeight: this.maxWeight,
      currentWeight: this.currentWeight,
    };
    return data as unknown as SaveData;
  }

  onLoad(data: SaveData): void {
    const save = data as unknown as InventorySaveData;
    this.items = save.items ?? [];
    this.gold = save.gold ?? 0;
    this.gems = save.gems ?? 0;
    this.maxWeight = save.maxWeight ?? MAX_WEIGHT;
    this.currentWeight = save.currentWeight ?? 0;
  }

  reset(): void {
    this.items = [];
    this.gold = 0;
    this.gems = 0;
    this.currentWeight = 0;
    this.maxWeight = MAX_WEIGHT;
  }
}
