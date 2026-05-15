import { create } from 'zustand';

export type CombatStatus = 'none' | 'preparing' | 'inProgress' | 'victory' | 'defeat';

export interface CombatLogEntry {
  turn: number;
  actor: string;
  action: string;
  value: number;
  isCrit: boolean;
}

export interface CombatState {
  status: CombatStatus;
  enemyName: string;
  enemyHp: number;
  enemyMaxHp: number;
  enemyAttack: number;
  enemyDefense: number;
  partyHp: number;
  partyMaxHp: number;
  partyAttack: number;
  partyDefense: number;
  turnNumber: number;
  combatLog: CombatLogEntry[];
  rewards: { gold: number; exp: number; items: string[] };
}

interface CombatActions {
  setStatus: (status: CombatStatus) => void;
  setEnemy: (name: string, hp: number, maxHp: number, atk: number, def: number) => void;
  setParty: (hp: number, maxHp: number, atk: number, def: number) => void;
  damageEnemy: (amount: number) => void;
  damageParty: (amount: number) => void;
  addLog: (entry: CombatLogEntry) => void;
  nextTurn: () => void;
  setRewards: (gold: number, exp: number, items?: string[]) => void;
  reset: () => void;
}

const initialState: CombatState = {
  status: 'none',
  enemyName: '', enemyHp: 0, enemyMaxHp: 0, enemyAttack: 0, enemyDefense: 0,
  partyHp: 0, partyMaxHp: 0, partyAttack: 0, partyDefense: 0,
  turnNumber: 0, combatLog: [], rewards: { gold: 0, exp: 0, items: [] },
};

export const useCombatStore = create<CombatState & CombatActions>((set) => ({
  ...initialState,
  setStatus: (status) => set({ status }),
  setEnemy: (name, hp, maxHp, attack, defense) => set({ enemyName: name, enemyHp: hp, enemyMaxHp: maxHp, enemyAttack: attack, enemyDefense: defense }),
  setParty: (hp, maxHp, attack, defense) => set({ partyHp: hp, partyMaxHp: maxHp, partyAttack: attack, partyDefense: defense }),
  damageEnemy: (amount) => set((s) => ({ enemyHp: Math.max(0, s.enemyHp - amount) })),
  damageParty: (amount) => set((s) => ({ partyHp: Math.max(0, s.partyHp - amount) })),
  addLog: (entry) => set((s) => ({ combatLog: [...s.combatLog, entry] })),
  nextTurn: () => set((s) => ({ turnNumber: s.turnNumber + 1 })),
  setRewards: (gold, exp, items) => set({ rewards: { gold, exp, items: items ?? [] } }),
  reset: () => set(initialState),
}));
