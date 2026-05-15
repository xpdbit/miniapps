import { create } from 'zustand';

export interface InventoryItem {
  itemId: string;
  itemName: string;
  quantity: number;
  type: string;
  rarity: string;
  weight: number;
  stats: Record<string, number>;
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

interface InventoryActions {
  setItems: (items: InventoryItem[]) => void;
  /** 添加一个物品条目到列表尾部 */
  addItem: (item: InventoryItem) => void;
  /** 从指定索引移除整个物品条目 */
  removeItemAt: (index: number) => void;
  /** 更新指定索引的物品数量（用于卖出减少等） */
  updateItemQuantity: (index: number, quantity: number) => void;
  setCurrentWeight: (weight: number) => void;
  addGold: (amount: number) => void;
  spendGold: (amount: number) => boolean;
  addGems: (amount: number) => void;
  spendGems: (amount: number) => boolean;
  reset: () => void;
}

const initialState: InventoryState = {
  items: [],
  gold: 0,
  gems: 0,
  currentWeight: 0,
  maxWeight: 50,
};

export const useInventoryStore = create<InventoryState & InventoryActions>((set, get) => ({
  ...initialState,
  setItems: (items) => set({ items }),
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
  removeItemAt: (index) => set((s) => {
    const newItems = [...s.items];
    newItems.splice(index, 1);
    return { items: newItems };
  }),
  updateItemQuantity: (index, quantity) => set((s) => {
    const newItems = [...s.items];
    if (newItems[index]) {
      if (quantity <= 0) {
        newItems.splice(index, 1);
      } else {
        newItems[index] = { ...newItems[index]!, quantity };
      }
    }
    return { items: newItems };
  }),
  setCurrentWeight: (currentWeight) => set({ currentWeight }),
  addGold: (amount) => set((s) => ({ gold: s.gold + amount })),
  spendGold: (amount) => {
    const state = get();
    if (state.gold < amount) return false;
    set({ gold: state.gold - amount });
    return true;
  },
  addGems: (amount) => set((s) => ({ gems: s.gems + amount })),
  spendGems: (amount) => {
    const state = get();
    if (state.gems < amount) return false;
    set({ gems: state.gems - amount });
    return true;
  },
  reset: () => set(initialState),
}));
