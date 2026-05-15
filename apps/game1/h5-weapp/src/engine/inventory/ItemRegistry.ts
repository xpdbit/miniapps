/**
 * ItemRegistry — 物品注册表
 *
 * 从 items.json 加载物品模板数据，提供查找和查询功能。
 * 在游戏启动时将装备属性注册到 EquipmentSystem。
 */

import itemsData from '../../config/items.json';
import { EquipmentManager } from './EquipmentSystem';

// ============================================================
// 物品模板类型
// ============================================================

export interface ItemTemplate {
  id: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  weight: number;
  stats: Record<string, number>;
  foodValue: number;
  staminaRestore: number;
  moraleRestore: number;
  travelBuffFactor: number;
  description: string;
  buyPrice: number;
  sellPrice: number;
  maxStack: number;
  /** 掉落权重（0 = 不掉落） */
  dropWeight: number;
}

export type ItemType =
  | 'currency'
  | 'weapon'
  | 'armor'
  | 'accessory'
  | 'mount'
  | 'consumable'
  | 'food'
  | 'material';

export type ItemRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary';

// ============================================================
// ItemRegistry
// ============================================================

class ItemRegistryImpl {
  private templates: Map<string, ItemTemplate> = new Map();
  private initialized = false;

  /** 初始化：加载物品数据并注册到 EquipmentSystem */
  init(): void {
    if (this.initialized) return;

    const items = itemsData.items as ItemTemplate[];
    for (const item of items) {
      this.templates.set(item.id, item);
    }

    // 将装备类物品注册到 EquipmentSystem
    const eqManager = EquipmentManager.instance;
    for (const item of items) {
      if (item.type === 'weapon' || item.type === 'armor' || item.type === 'accessory' || item.type === 'mount') {
        eqManager.registerItemStats(item.id, {
          attack: item.stats['attack'] ?? 0,
          defense: item.stats['defense'] ?? 0,
          speed: item.stats['speed'] ?? item.stats['travelSpeed'] ?? 0,
          specialEffects: [],
        });
      }
    }

    this.initialized = true;
    console.log(`[ItemRegistry] 已加载 ${items.length} 个物品模板`);
  }

  /** 获取物品模板 */
  getTemplate(id: string): ItemTemplate | undefined {
    return this.templates.get(id);
  }

  /** 按类型筛选物品 */
  getByType(type: ItemType): ItemTemplate[] {
    const result: ItemTemplate[] = [];
    this.templates.forEach((item) => {
      if (item.type === type) result.push(item);
    });
    return result;
  }

  /** 按稀有度筛选物品 */
  getByRarity(rarity: ItemRarity): ItemTemplate[] {
    const result: ItemTemplate[] = [];
    this.templates.forEach((item) => {
      if (item.rarity === rarity) result.push(item);
    });
    return result;
  }

  /** 获取所有物品 */
  getAll(): ItemTemplate[] {
    return Array.from(this.templates.values());
  }

  /** 获取可用于掉落池的物品（dropWeight > 0） */
  getDroppableItems(): ItemTemplate[] {
    const result: ItemTemplate[] = [];
    this.templates.forEach((item) => {
      if (item.dropWeight > 0) result.push(item);
    });
    return result;
  }

  /**
   * 根据稀有度筛选掉落池中的物品
   * @param rarities 稀有度列表
   */
  getDroppableByRarity(rarities: ItemRarity[]): ItemTemplate[] {
    const result: ItemTemplate[] = [];
    this.templates.forEach((item) => {
      if (item.dropWeight > 0 && rarities.includes(item.rarity)) {
        result.push(item);
      }
    });
    return result;
  }

  /** 获取物品名 */
  getName(id: string): string {
    return this.templates.get(id)?.name ?? id;
  }

  /** 获取物品类型 */
  getType(id: string): ItemType {
    return this.templates.get(id)?.type ?? 'material';
  }
}

/** 全局单例 */
export const itemRegistry = new ItemRegistryImpl();
