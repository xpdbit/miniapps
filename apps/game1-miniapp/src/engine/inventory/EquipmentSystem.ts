import { globalEventBus } from '../core/EventBus';
import { TeamEngine } from '../team/TeamEngine';
import { InventoryEngine } from './InventoryEngine';

// ---------------------------------------------------------------------------
// 事件载荷类型
// ---------------------------------------------------------------------------

export interface EquipmentChangedEvent {
  memberId: string;
  slot: EquipmentSlot;
  itemId: string | null;
}

// ---------------------------------------------------------------------------
// 枚举 & 接口
// ---------------------------------------------------------------------------

/**
 * 装备槽位
 */
export enum EquipmentSlot {
  Weapon = 'weapon',
  Armor = 'armor',
  Accessory1 = 'accessory1',
  Accessory2 = 'accessory2',
  Mount = 'mount',
}

/**
 * 物品类型 → 装备槽位映射表
 * 用于 equipItem 时自动判断目标槽位
 */
const TYPE_TO_SLOT: Record<string, EquipmentSlot> = {
  weapon: EquipmentSlot.Weapon,
  armor: EquipmentSlot.Armor,
  accessory: EquipmentSlot.Accessory1,
  mount: EquipmentSlot.Mount,
};

/**
 * 装备效果（每个已装备的物品对应一个 EquipmentEffect）
 */
export interface EquipmentEffect {
  slot: EquipmentSlot;
  itemId: string;
  stats: {
    attack: number;
    defense: number;
    speed: number;
  };
  specialEffects: string[];
}

/**
 * 装备统计（由 calculateEquipStats 返回）
 */
export interface EquipmentStats {
  attack: number;
  defense: number;
  speed: number;
}

// ---------------------------------------------------------------------------
// 物品属性注册 — 在没有完整物品数据库前的临时方案
// ---------------------------------------------------------------------------

interface ItemStatData {
  attack: number;
  defense: number;
  speed: number;
  specialEffects: string[];
}

// ---------------------------------------------------------------------------
// EquipmentManager
// ---------------------------------------------------------------------------

/**
 * 装备管理器
 *
 * 职责：
 * - 为队员装备/卸下物品
 * - 检查物品类型与槽位是否匹配
 * - 计算队员身上的装备总属性加成
 * - 与 TeamEngine（队员装备槽）和 InventoryEngine（物品来源/去向）协作
 */
export class EquipmentManager {
  /** 物品属性注册表（itemId → 基础属性） */
  private itemRegistry: Map<string, ItemStatData> = new Map();

  // ---- 依赖（直接引用单例） ----
  private teamEngine = TeamEngine.instance;
  private inventoryEngine = InventoryEngine.instance;

  // ---- 单例 ----
  private static _instance: EquipmentManager;
  static get instance(): EquipmentManager {
    if (!EquipmentManager._instance) {
      EquipmentManager._instance = new EquipmentManager();
    }
    return EquipmentManager._instance;
  }

  private constructor() {}

  // ========================================================================
  //  物品属性注册
  // ========================================================================

  /**
   * 注册/更新一件物品的基础属性
   * 在没有完整物品数据库前，由外部系统调用
   */
  registerItemStats(
    itemId: string,
    stats: ItemStatData,
  ): void {
    this.itemRegistry.set(itemId, {
      attack: stats.attack,
      defense: stats.defense,
      speed: stats.speed,
      specialEffects: [...stats.specialEffects],
    });
  }

  /** 批量注册 */
  registerItemStatsBatch(entries: Array<{ itemId: string; data: ItemStatData }>): void {
    for (const { itemId, data } of entries) {
      this.registerItemStats(itemId, data);
    }
  }

  /** 获取已注册的物品属性 */
  getRegisteredStats(itemId: string): ItemStatData | undefined {
    return this.itemRegistry.get(itemId);
  }

  // ========================================================================
  //  核心操作
  // ========================================================================

  /**
   * 为队员装备一件物品
   *
   * 流程：
   * 1. 从 InventoryEngine 查找物品
   * 2. 根据物品类型确定目标槽位
   * 3. 验证类型与槽位匹配
   * 4. 如果目标槽位已有物品，先卸下旧物品回背包
   * 5. 将装备信息写入 TeamMember
   * 6. 从背包移除该物品
   *
   * @throws 队员/物品不存在、类型不匹配
   */
  equipItem(memberId: string, itemId: string): void {
    // 1) 查找队员
    const member = this.teamEngine.getMember(memberId);
    if (!member) {
      throw new Error(`装备失败：队员不存在 ${memberId}`);
    }

    // 2) 从背包中获取物品信息（类型决定槽位）
    const inventoryInfo = this.findInventoryItem(itemId);
    if (!inventoryInfo) {
      throw new Error(`装备失败：物品不存在 ${itemId}`);
    }

    const { type: itemType } = inventoryInfo;

    // 3) 确定目标槽位
    const targetSlot = TYPE_TO_SLOT[itemType];
    if (!targetSlot) {
      throw new Error(
        `装备失败：物品类型 "${itemType}" 无法对应任何装备槽位`,
      );
    }

    // Accessory 特殊处理：如果 Accessory1 被占用则尝试 Accessory2
    let finalSlot = targetSlot;
    if (targetSlot === EquipmentSlot.Accessory1) {
      const acc1Occupied = member.equipment[EquipmentSlot.Accessory1] !== null;
      if (acc1Occupied) {
        const acc2Occupied = member.equipment[EquipmentSlot.Accessory2] !== null;
        if (!acc2Occupied) {
          finalSlot = EquipmentSlot.Accessory2;
        }
        // 都占满则继续用 Accessory1（会触发下面的槽位已占用逻辑）
      }
    }

    // 4) 如果目标槽位已装备同物品，直接跳过
    const existingItemId = member.equipment[finalSlot];
    if (existingItemId === itemId) {
      return;
    }

    // 5) 如果目标槽位已被其他物品占用，先卸下并归还背包
    if (existingItemId !== null && existingItemId !== undefined) {
      this.unequipSlot(memberId, finalSlot);
    }

    // 6) 从背包移除物品（重新查找索引，避免 auto-unequip 干扰）
    const finalSlotIndex = this.findInventoryIndex(itemId);
    if (finalSlotIndex === -1) {
      throw new Error(`装备失败：物品 ${itemId} 在背包中丢失`);
    }
    this.inventoryEngine.removeItem(finalSlotIndex, 1);

    // 7) 写入装备
    member.equipment[finalSlot] = itemId;

    globalEventBus.emit<EquipmentChangedEvent>('equipment:changed', {
      memberId,
      slot: finalSlot,
      itemId,
    });
  }

  /**
   * 卸下指定槽位的装备并归还到背包
   * @throws 队员不存在、槽位无装备
   */
  unequipSlot(memberId: string, slot: EquipmentSlot): void {
    const member = this.teamEngine.getMember(memberId);
    if (!member) {
      throw new Error(`卸下装备失败：队员不存在 ${memberId}`);
    }

    const itemId = member.equipment[slot];
    if (!itemId) {
      throw new Error(`卸下装备失败：槽位 ${slot} 无装备`);
    }

    // 清空槽位
    member.equipment[slot] = null;

    // 归还到背包（从物品注册表获取类型/稀有度信息）
    let itemType = 'misc';
    let itemRarity = 'common';
    const registered = this.itemRegistry.get(itemId);
    if (registered) {
      // 根据基础属性推断类型
      itemType = this.inferTypeFromSlot(slot);
    }

    this.inventoryEngine.addItem(itemId, 1, itemId, itemType, itemRarity);

    globalEventBus.emit<EquipmentChangedEvent>('equipment:changed', {
      memberId,
      slot,
      itemId: null,
    });
  }

  /**
   * 获取队员所有已装备物品的效果
   */
  getEquipped(memberId: string): EquipmentEffect[] {
    const member = this.teamEngine.getMember(memberId);
    if (!member) {
      throw new Error(`队员不存在 ${memberId}`);
    }

    const effects: EquipmentEffect[] = [];

    for (const [slotKey, equippedItemId] of Object.entries(member.equipment)) {
      if (!equippedItemId) continue;

      const slot = slotKey as EquipmentSlot;
      const registered = this.itemRegistry.get(equippedItemId);

      effects.push({
        slot,
        itemId: equippedItemId,
        stats: {
          attack: registered?.attack ?? 0,
          defense: registered?.defense ?? 0,
          speed: registered?.speed ?? 0,
        },
        specialEffects: registered ? [...registered.specialEffects] : [],
      });
    }

    return effects;
  }

  /**
   * 计算队员装备提供的总属性加成
   */
  calculateEquipStats(memberId: string): EquipmentStats {
    const effects = this.getEquipped(memberId);

    const total: EquipmentStats = { attack: 0, defense: 0, speed: 0 };

    for (const effect of effects) {
      total.attack += effect.stats.attack;
      total.defense += effect.stats.defense;
      total.speed += effect.stats.speed;
    }

    return total;
  }

  // ========================================================================
  //  工具方法
  // ========================================================================

  /** 在背包中查找第一个符合 itemId 的物品信息（type / rarity） */
  private findInventoryItem(itemId: string): { type: string; rarity: string } | null {
    const items = this.inventoryEngine.getAllItems();
    for (const slot of items) {
      if (slot.itemId === itemId) {
        return { type: slot.type, rarity: slot.rarity };
      }
    }
    return null;
  }

  /** 在背包中查找第一个符合 itemId 的槽位索引 */
  private findInventoryIndex(itemId: string): number {
    const items = this.inventoryEngine.getAllItems();
    return items.findIndex((s) => s.itemId === itemId);
  }

  /** 根据槽位推断物品类型（用于卸下时归还背包） */
  private inferTypeFromSlot(slot: EquipmentSlot): string {
    switch (slot) {
      case EquipmentSlot.Weapon:
        return 'weapon';
      case EquipmentSlot.Armor:
        return 'armor';
      case EquipmentSlot.Accessory1:
      case EquipmentSlot.Accessory2:
        return 'accessory';
      case EquipmentSlot.Mount:
        return 'mount';
      default:
        return 'misc';
    }
  }

  /**
   * 清除所有注册的物品属性
   */
  clearRegistry(): void {
    this.itemRegistry.clear();
  }
}

/**
 * 兼容旧引用：Engine index.ts 期望的命名导出
 * 指向 EquipmentManager 单例
 */
export const EquipmentSystem = EquipmentManager;
