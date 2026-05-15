import { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { useGameStore } from '../../stores/gameStore';
import { useInventoryStore, InventoryItem } from '../../stores/inventoryStore';
import { InventoryEngine, globalEventBus } from '../../engine';
import ProgressBar from '../../components/ProgressBar';
import ITEMS_DATA from '../../config/items.json';
import './index.module.scss';

// ============================================================
// 类型定义
// ============================================================
type CategoryTab = 'all' | 'equipment' | 'consumable' | 'material';
type SortMode = 'rarity' | 'name' | 'quantity';

interface ItemDef {
  id: string;
  name: string;
  type: string;
  rarity: string;
  weight: number;
  stats: Record<string, number>;
  foodValue?: number;
  staminaRestore?: number;
  moraleRestore?: number;
  travelBuffFactor?: number;
  dropWeight?: number;
  description: string;
  buyPrice: number;
  sellPrice: number;
  maxStack: number;
}

const CATEGORY_TABS: { key: CategoryTab; label: string; icon: string }[] = [
  { key: 'all', label: '全部', icon: '📦' },
  { key: 'equipment', label: '装备', icon: '⚔️' },
  { key: 'consumable', label: '消耗', icon: '🧪' },
  { key: 'material', label: '材料', icon: '⛏️' },
];

const RARITY_ORDER: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

const RARITY_COLORS: Record<string, string> = {
  common: 'var(--rarity-common)',
  uncommon: 'var(--rarity-uncommon)',
  rare: 'var(--rarity-rare)',
  epic: 'var(--rarity-epic)',
  legendary: 'var(--rarity-legendary)',
};

const RARITY_LABELS: Record<string, string> = {
  common: '普通',
  uncommon: '优秀',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
};

const TYPE_LABELS: Record<string, string> = {
  weapon: '武器',
  armor: '防具',
  accessory: '饰品',
  consumable: '消耗品',
  material: '材料',
  currency: '货币',
};

const TYPE_ICONS: Record<string, string> = {
  weapon: '⚔️',
  armor: '🛡️',
  accessory: '💍',
  consumable: '🧪',
  material: '⛏️',
  currency: '🪙',
};

const EQUIPMENT_TYPES = new Set(['weapon', 'armor', 'accessory']);

const EMPTY_MESSAGES: Record<CategoryTab, { icon: string; text: string; hint: string }> = {
  all: { icon: '🎒', text: '库存空空如也', hint: '踏上旅途，收集物资吧' },
  equipment: { icon: '⚔️', text: '未拥有任何装备', hint: '击败敌人或打开宝箱获取装备' },
  consumable: { icon: '🧪', text: '未拥有任何消耗品', hint: '在城镇商店可以购买药水' },
  material: { icon: '⛏️', text: '未拥有任何材料', hint: '采集和探索可以获得各类材料' },
};

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'rarity', label: '稀有度' },
  { key: 'name', label: '名称' },
  { key: 'quantity', label: '数量' },
];

// ============================================================
// 工具函数
// ============================================================

function getItemEmoji(itemId: string): string {
  const emojiMap: Record<string, string> = {
    'Core.Item.ShortBlade': '🗡️',
    'Core.Item.IronSword': '⚔️',
    'Core.Item.SteelBlade': '🔪',
    'Core.Item.FlameBrand': '🔥',
    'Core.Item.ShadowReaper': '🌑',
    'Core.Item.LeatherArmor': '👕',
    'Core.Item.ChainMail': '🛡️',
    'Core.Item.PlateArmor': '🛡️',
    'Core.Item.MithrilVest': '✨',
    'Core.Item.DragonScale': '🐉',
    'Core.Item.RingOfPower': '💍',
    'Core.Item.AmuletOfWisdom': '📿',
    'Core.Item.HealthPotion': '❤️',
    'Core.Item.ManaElixir': '💙',
    'Core.Item.WarpScroll': '📜',
    'Core.Item.IronOre': '⛏️',
    'Core.Item.MagicCrystal': '💎',
    'Core.Item.DragonScaleShard': '🔷',
    'Core.Item.HealingHerb': '🌿',
    'Core.Item.GoldCoin': '🪙',
  };
  return emojiMap[itemId] || '📦';
}

function getRarityBorderClass(rarity: string): string {
  const map: Record<string, string> = {
    common: 'item-slot--common',
    uncommon: 'item-slot--uncommon',
    rare: 'item-slot--rare',
    epic: 'item-slot--epic',
    legendary: 'item-slot--legendary',
  };
  return map[rarity] || 'item-slot--common';
}

function isEquipmentType(itemType: string): boolean {
  return EQUIPMENT_TYPES.has(itemType);
}

function getCategoryFromType(itemType: string): CategoryTab {
  if (isEquipmentType(itemType)) return 'equipment';
  if (itemType === 'consumable') return 'consumable';
  if (itemType === 'material') return 'material';
  return 'all';
}

function formatStatLabel(key: string): string {
  const map: Record<string, string> = {
    attack: '攻击',
    defense: '防御',
    speed: '速度',
    wisdom: '智慧',
    maxHp: '生命上限',
    hpRestore: '生命恢复',
    energyRestore: '能量恢复',
  };
  return map[key] || key;
}

// ============================================================
// 页面组件
// ============================================================
export default function InventoryPage() {
  const gold = useGameStore((state) => state.gold);
  const gems = useGameStore((state) => state.gems);
  const addGold = useGameStore((state) => state.addGold);

  const items = useInventoryStore((state) => state.items) ?? [];
  const maxWeight = useInventoryStore((state) => state.maxWeight) ?? 50;
  const removeItemAt = useInventoryStore((state) => state.removeItemAt);
  const setItems = useInventoryStore((state) => state.setItems);
  const setCurrentWeight = useInventoryStore((state) => state.setCurrentWeight);

  // InventoryEngine → Zustand store 数据同步
  useEffect(() => {
    const syncFromEngine = () => {
      const engineState = InventoryEngine.instance.getState();
      setItems(
        engineState.items.map((eItem) => ({
          itemId: eItem.itemId,
          itemName: eItem.itemName,
          quantity: eItem.quantity,
          type: eItem.type,
          rarity: eItem.rarity,
          weight: eItem.weight,
          stats: {} as Record<string, number>,
        })),
      );
      setCurrentWeight(engineState.currentWeight);
    };

    // 初始同步
    syncFromEngine();

    // 监听引擎变化
    globalEventBus.on('inventory:changed', syncFromEngine);
    return () => {
      globalEventBus.off('inventory:changed', syncFromEngine);
    };
  }, [setItems, setCurrentWeight]);

  const [activeTab, setActiveTab] = useState<CategoryTab>('all');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>(-1);
  const [sortBy, setSortBy] = useState<SortMode>('rarity');
  const [equippedIds, setEquippedIds] = useState<Set<string>>(new Set());
  const [showSellConfirm, setShowSellConfirm] = useState(false);
  const [sellTarget, setSellTarget] = useState<InventoryItem | null>(null);

  // 构建物品定义表
  const itemDefs = useMemo<Record<string, ItemDef>>(() => {
    const map: Record<string, ItemDef> = {};
    (ITEMS_DATA as unknown as { items: ItemDef[] }).items.forEach((item) => {
      map[item.id] = item;
    });
    return map;
  }, []);

  // 物品条目数
  const totalItems = items.length;

  // 当前总重量（从 items 实时计算）
  const currentWeight = useMemo(
    () => items.reduce((total, item) => total + (item.weight || 1) * item.quantity, 0),
    [items],
  );

  // 分类过滤+保留原始索引（用于卖出/操作时定位）
  const filteredItems = useMemo(() => {
    const result: Array<{ item: InventoryItem; index: number }> = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      if (activeTab === 'all' || getCategoryFromType(item.type) === activeTab) {
        result.push({ item, index: i });
      }
    }
    return result;
  }, [items, activeTab]);

  // 排序
  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    switch (sortBy) {
      case 'rarity':
        list.sort((a, b) => (RARITY_ORDER[b.item.rarity] || 0) - (RARITY_ORDER[a.item.rarity] || 0));
        break;
      case 'name':
        list.sort((a, b) => a.item.itemName.localeCompare(b.item.itemName, 'zh-CN'));
        break;
      case 'quantity':
        list.sort((a, b) => b.item.quantity - a.item.quantity);
        break;
    }
    return list;
  }, [filteredItems, sortBy]);

  // 处理物品点击
  const handleItemClick = (item: InventoryItem, index: number) => {
    setSelectedItem(item);
    setSelectedItemIndex(index);
  };

  // 关闭详情
  const closeDetail = () => {
    setSelectedItem(null);
    setSelectedItemIndex(-1);
    setShowSellConfirm(false);
    setSellTarget(null);
  };

  // 装备/卸下
  const toggleEquip = (itemId: string) => {
    setEquippedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
    setSelectedItem(null);
  };

  // 卖出
  const handleSell = (item: InventoryItem, index: number) => {
    setSellTarget(item);
    setSelectedItemIndex(index);
    setShowSellConfirm(true);
  };

  const confirmSell = () => {
    if (!sellTarget) return;
    const def = itemDefs[sellTarget.itemId];
    if (!def) return;

    const totalGold = def.sellPrice * sellTarget.quantity;

    // 先移除物品，再增加金币（防止移除失败时金币已计入）
    const engine = InventoryEngine.instance;
    const engineItems = engine.getAllItems();
    const engineIdx = engineItems.findIndex((ei) => ei.itemId === sellTarget.itemId);
    if (engineIdx !== -1) {
      engine.removeItem(engineIdx, sellTarget.quantity);
      addGold(totalGold);
    } else {
      // 回退：引擎中找不到时直接操作 store（例如引擎尚未初始化）
      const storeItems = useInventoryStore.getState().items;
      const storeIdx = storeItems.findIndex((si) => si.itemId === sellTarget.itemId);
      if (storeIdx !== -1) {
        removeItemAt(storeIdx);
        addGold(totalGold);
      }
    }

    setShowSellConfirm(false);
    setSellTarget(null);
    setSelectedItem(null);
    setSelectedItemIndex(-1);
  };

  const cancelSell = () => {
    setShowSellConfirm(false);
    setSellTarget(null);
    setSelectedItemIndex(-1);
  };

  // 切换排序
  const cycleSort = () => {
    const modes: SortMode[] = ['rarity', 'name', 'quantity'];
    const idx = modes.indexOf(sortBy);
    const nextIdx = (idx + 1) % modes.length;
    setSortBy(modes[nextIdx]!);
  };

  // 获取当前排序标签
  const getSortLabel = () => {
    const opt = SORT_OPTIONS.find((o) => o.key === sortBy);
    return opt ? opt.label : '稀有度';
  };

  // 渲染物品卡片（逐个显示）
  const renderItem = (item: InventoryItem, index: number) => {
    const isEquipped = equippedIds.has(item.itemId);
    const borderClass = getRarityBorderClass(item.rarity);
    const equippedClass = isEquipped ? 'item-slot--equipped' : '';

    return (
      <View
        key={`${index}-${item.itemId}`}
        className={`item-slot ${borderClass} ${equippedClass}`}
        onClick={() => handleItemClick(item, index)}
      >
        <Text className='item-icon'>{getItemEmoji(item.itemId)}</Text>
        <Text className='item-name'>{item.itemName}</Text>
        <Text className='item-weight'>{item.weight}kg</Text>
        {item.quantity > 1 && (
          <Text className='item-quantity-badge'>x{item.quantity}</Text>
        )}
      </View>
    );
  };

  // 检查是否有当前分类的物品
  const hasItemsInCategory = sortedItems.length > 0;

  // ============================================================
  // Render
  // ============================================================
  return (
    <View className='inventory-page fade-in'>
      {/* 页面标题 */}
      <View className='inventory-header'>
        <Text className='inventory-header-title'>🎒 背包</Text>
        <Text className='inventory-header-sub'>{totalItems} 件物品</Text>
      </View>

      {/* 负重进度条 */}
      <View className='weight-bar-container'>
        <ProgressBar
          value={currentWeight}
          max={maxWeight}
          label={`负重 ${currentWeight}/${maxWeight} kg`}
          showPercent
          height={14}
          color='var(--color-primary)'
        />
      </View>

      {/* 货币栏 */}
      <View className='currency-bar'>
        <View className='currency-item'>
          <Text className='currency-icon'>🪙</Text>
          <View className='currency-info'>
            <Text className='currency-label'>金币</Text>
            <Text className='currency-value'>{gold.toLocaleString()}</Text>
          </View>
        </View>
        <View className='currency-item'>
          <Text className='currency-icon'>💎</Text>
          <View className='currency-info'>
            <Text className='currency-label'>宝石</Text>
            <Text className='currency-value'>{gems.toLocaleString()}</Text>
          </View>
        </View>
      </View>

      {/* 分类标签 */}
      <View className='inventory-tabs'>
        {CATEGORY_TABS.map((tab) => (
          <View
            key={tab.key}
            className={`inventory-tab ${activeTab === tab.key ? 'inventory-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <Text className='inventory-tab-text'>{tab.icon} {tab.label}</Text>
          </View>
        ))}
      </View>

      {/* 排序工具栏 */}
      {hasItemsInCategory && (
        <View className='inventory-toolbar'>
          <View className='sort-btn' onClick={cycleSort}>
            <Text className='sort-btn-icon'>↕</Text>
            <Text className='sort-btn-text'>{getSortLabel()}</Text>
          </View>
        </View>
      )}

      {/* 物品列表 - 逐件显示，无空占位格 */}
      <ScrollView className='inventory-grid-scroll' scrollY enhanced bounces={false}>
        <View className='inventory-grid'>
          {sortedItems.map(({ item, index }) => renderItem(item, index))}
        </View>

        {/* 空状态 */}
        {!hasItemsInCategory && (
          <View className='inventory-empty'>
            <Text className='inventory-empty-icon'>{EMPTY_MESSAGES[activeTab].icon}</Text>
            <Text className='inventory-empty-text'>{EMPTY_MESSAGES[activeTab].text}</Text>
            <Text className='inventory-empty-hint'>{EMPTY_MESSAGES[activeTab].hint}</Text>
          </View>
        )}
      </ScrollView>

      {/* 物品详情弹窗 */}
      {selectedItem && (
        <View className='item-detail-overlay' onClick={closeDetail}>
          <View
            className='item-detail-card'
            onClick={(e) => e.stopPropagation()}
          >
            {/* 稀有度色条 */}
            <View
              className='detail-rarity-bar'
              style={{ background: RARITY_COLORS[selectedItem.rarity] || 'var(--rarity-common)' }}
            />

            <View className='detail-content'>
              {/* 头部：图标 + 名称 + 关闭 */}
              <View className='detail-header-row'>
                <View className='detail-icon-name'>
                  <Text className='detail-item-icon'>
                    {getItemEmoji(selectedItem.itemId)}
                  </Text>
                  <View className='detail-name-rarity'>
                    <Text className='detail-item-name'>{selectedItem.itemName}</Text>
                    <View
                      className='detail-rarity-tag'
                      style={{
                        background: RARITY_COLORS[selectedItem.rarity] || 'var(--rarity-common)',
                      }}
                    >
                      <Text>{RARITY_LABELS[selectedItem.rarity] || selectedItem.rarity}</Text>
                    </View>
                  </View>
                </View>
                <View className='detail-close-btn' onClick={closeDetail}>
                  <Text className='detail-close-btn-text'>✕</Text>
                </View>
              </View>

              {/* 类型标签 */}
              <View className='detail-type-tag'>
                <Text className='detail-type-icon'>
                  {TYPE_ICONS[selectedItem.type] || '📦'}
                </Text>
                <Text className='detail-type-name'>
                  {TYPE_LABELS[selectedItem.type] || selectedItem.type}
                </Text>
              </View>

              {/* 分割线 */}
              <View className='detail-divider' />

              {/* 属性列表 */}
              {Object.keys(selectedItem.stats).length > 0 && (
                <View className='detail-stats-section'>
                  <Text className='detail-stats-title'>属性</Text>
                  <View className='detail-stats-grid'>
                    {Object.entries(selectedItem.stats).map(([key, value]) => (
                      <View key={key} className='detail-stat-chip'>
                        <Text className='detail-stat-chip-label'>
                          {formatStatLabel(key)}
                        </Text>
                        <Text className={`detail-stat-chip-value detail-stat-chip-value--${key}`}>
                          +{value}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* 无属性提示 */}
              {Object.keys(selectedItem.stats).length === 0 && (
                <View className='detail-no-stats'>
                  <Text className='detail-no-stats'>无特殊属性</Text>
                </View>
              )}

              {/* 重量 */}
              <View className='detail-weight-section'>
                <Text className='detail-stats-title'>重量</Text>
                <Text className='detail-description-text'>{selectedItem.weight} kg / 个</Text>
              </View>

              {/* 描述 */}
              <View className='detail-description-section'>
                <Text className='detail-description-label'>说明</Text>
                <Text className='detail-description-text'>
                  {itemDefs[selectedItem.itemId]?.description || '暂无描述'}
                </Text>
              </View>

              {/* 数量 */}
              {selectedItem.quantity > 1 && (
                <View className='detail-quantity'>
                  <Text className='detail-quantity-label'>持有数量:</Text>
                  <Text className='detail-quantity-value'>x{selectedItem.quantity}</Text>
                </View>
              )}

              {/* 分割线 */}
              <View className='detail-divider' />

              {/* 售出价格 */}
              {itemDefs[selectedItem.itemId] && (
                <View>
                  <Text className='detail-stats-title'>
                    出售价格: 🪙 {itemDefs[selectedItem.itemId]!.sellPrice} / 个
                  </Text>
                </View>
              )}

              {/* 操作按钮 */}
              <View className='detail-actions'>
                {/* 装备/卸下按钮（仅装备类物品） */}
                {isEquipmentType(selectedItem.type) && (
                  <View
                    className={`action-btn ${equippedIds.has(selectedItem.itemId) ? 'action-btn--unequip' : 'action-btn--equip'}`}
                    onClick={() => toggleEquip(selectedItem.itemId)}
                  >
                    <Text className='action-btn-icon'>
                      {equippedIds.has(selectedItem.itemId) ? '📤' : '📥'}
                    </Text>
                    <Text className='action-btn-text'>
                      {equippedIds.has(selectedItem.itemId) ? '卸下' : '装备'}
                    </Text>
                  </View>
                )}

                {/* 使用按钮（消耗品） */}
                {selectedItem.type === 'consumable' && (
                  <View className='action-btn action-btn--use'>
                    <Text className='action-btn-icon'>✨</Text>
                    <Text className='action-btn-text'>使用</Text>
                  </View>
                )}

                {/* 出售按钮 */}
                {itemDefs[selectedItem.itemId]?.sellPrice != null && itemDefs[selectedItem.itemId]!.sellPrice > 0 && (
                  <View
                    className='action-btn action-btn--sell'
                    onClick={() => handleSell(selectedItem, selectedItemIndex)}
                  >
                    <Text className='action-btn-icon'>💰</Text>
                    <Text className='action-btn-text'>出售</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 出售确认弹窗 */}
      {showSellConfirm && sellTarget && (
        <View className='item-detail-overlay' onClick={cancelSell}>
          <View
            className='item-detail-card'
            style={{ maxWidth: 360 }}
            onClick={(e) => e.stopPropagation()}
          >
            <View className='detail-content'>
              <Text className='detail-item-name' style={{ textAlign: 'center' }}>
                确认出售
              </Text>
              <View className='detail-divider' />
              <Text
                className='detail-description-text'
                style={{ textAlign: 'center', padding: 'var(--spacing-sm) 0' }}
              >
                确定出售「{sellTarget.itemName}」x{sellTarget.quantity}？
                {'\n'}
                获得 🪙 {(itemDefs[sellTarget.itemId]?.sellPrice || 0) * sellTarget.quantity}
              </Text>
              <View className='detail-actions'>
                <View className='action-btn action-btn--unequip' onClick={cancelSell}>
                  <Text className='action-btn-text'>取消</Text>
                </View>
                <View className='action-btn action-btn--equip' onClick={confirmSell}>
                  <Text className='action-btn-text'>确定出售</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
