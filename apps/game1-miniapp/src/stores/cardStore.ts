import { create } from 'zustand';

export interface CardData {
  id: string;
  name: string;
  rarity: string;
  description: string;
  attackBonus: number;
  defenseBonus: number;
  hpBonus: number;
  speedBonus: number;
}

export interface CardState {
  collection: CardData[];
  totalPulls: number;
  pitySR: number; // 10 pulls guarantee SR+
  pitySSR: number; // 50 pulls guarantee SSR+
  pityUR: number; // 300 pulls guarantee UR
}

interface CardActions {
  setCollection: (cards: CardData[]) => void;
  addCard: (card: CardData) => void;
  incrementPulls: (count: number) => void;
  resetPity: (rarity: 'sr' | 'ssr' | 'ur') => void;
  reset: () => void;
}

const initialState: CardState = {
  collection: [],
  totalPulls: 0,
  pitySR: 0,
  pitySSR: 0,
  pityUR: 0,
};

export const useCardStore = create<CardState & CardActions>((set) => ({
  ...initialState,
  setCollection: (collection) => set({ collection }),
  addCard: (card) => set((s) => ({ collection: s.collection.find(c => c.id === card.id) ? s.collection : [...s.collection, card] })),
  incrementPulls: (count) => set((s) => ({ totalPulls: s.totalPulls + count, pitySR: s.pitySR + count, pitySSR: s.pitySSR + count, pityUR: s.pityUR + count })),
  resetPity: (rarity) => set((s) => (rarity === 'sr' ? { pitySR: 0 } : rarity === 'ssr' ? { pitySSR: 0 } : { pityUR: 0 })),
  reset: () => set(initialState),
}));
