import { create } from 'zustand';

export interface GameState {
  // 玩家基础属性
  level: number;
  exp: number;
  expToNext: number;
  gold: number;
  gems: number;
  playerId: number;

  // 游戏状态
  isGameRunning: boolean;
  isInitialized: boolean;

  // 统计
  playTime: number;
  totalMileage: number;
  prestigeCount: number;

  // 旅程脉冲（0-100，每秒增长，满后重置+里程奖励，用于路径条动画）
  journeyProgress: number;

  // 注册信息（UTC 秒）
  createdAt: number;

  // 操作
  setLevel: (level: number) => void;
  setExp: (exp: number) => void;
  setExpToNext: (exp: number) => void;
  addGold: (amount: number) => void;
  spendGold: (amount: number) => boolean;
  addGems: (amount: number) => void;
  spendGems: (amount: number) => boolean;
  addExp: (amount: number) => void;
  addMileage: (amount: number) => void;
  setGameRunning: (running: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  incrementPlayTime: (seconds: number) => void;
  setCreatedAt: (timestamp: number) => void;
  setPlayerId: (id: number) => void;
  setJourneyProgress: (progress: number) => void;
  addJourneyProgress: (amount: number) => void;
  reset: () => void;
}

const initialState = {
  level: 1,
  exp: 0,
  expToNext: 100,
  gold: 0,
  gems: 0,
  playerId: 0,
  isGameRunning: false,
  isInitialized: false,
  playTime: 0,
  totalMileage: 0,
  prestigeCount: 0,
  journeyProgress: 0,
  createdAt: 0,
};

export const useGameStore = create<GameState>((set, get) => ({
  ...initialState,

  setLevel: (level) => set({ level }),
  setExp: (exp) => set({ exp }),
  setExpToNext: (expToNext) => set({ expToNext }),

  addGold: (amount) => set((state) => ({ gold: state.gold + amount })),
  spendGold: (amount) => {
    const state = get();
    if (state.gold < amount) return false;
    set({ gold: state.gold - amount });
    return true;
  },

  addGems: (amount) => set((state) => ({ gems: state.gems + amount })),
  spendGems: (amount) => {
    const state = get();
    if (state.gems < amount) return false;
    set({ gems: state.gems - amount });
    return true;
  },

  addExp: (amount) =>
    set((state) => {
      const newExp = state.exp + amount;
      if (newExp >= state.expToNext) {
        const overflow = newExp - state.expToNext;
        const newLevel = state.level + 1;
        const newExpToNext = Math.floor(100 * 1.15 ** (newLevel - 1));
        return {
          level: newLevel,
          exp: overflow,
          expToNext: newExpToNext,
        };
      }
      return { exp: newExp };
    }),

  addMileage: (amount) =>
    set((state) => ({ totalMileage: state.totalMileage + amount })),

  setGameRunning: (isGameRunning) => set({ isGameRunning }),
  setInitialized: (isInitialized) => set({ isInitialized }),

  incrementPlayTime: (_seconds) => {
    // playTime 改为由 createdAt 计算得出，此方法不再累加
    // 仅当 createdAt 为 0 时使用传入值回退
    const state = get();
    if (state.createdAt > 0) {
      const computed = Math.floor(Date.now() / 1000 - state.createdAt);
      set({ playTime: computed });
    }
  },

  setCreatedAt: (createdAt) => set({ createdAt }),
  setPlayerId: (playerId) => set({ playerId }),

  setJourneyProgress: (journeyProgress) => set({ journeyProgress }),
  addJourneyProgress: (amount) =>
    set((state) => ({ journeyProgress: Math.min(state.journeyProgress + amount, 100) })),

  reset: () => set(initialState),
}));
