import { create } from 'zustand';

export interface TeamMemberData {
  id: string;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  job: string;
}

export interface TeamState {
  members: TeamMemberData[];
  formation: string;
  maxMembers: number;
}

interface TeamActions {
  setMembers: (members: TeamMemberData[]) => void;
  addMember: (member: TeamMemberData) => void;
  removeMember: (id: string) => void;
  updateMember: (id: string, data: Partial<TeamMemberData>) => void;
  setFormation: (formation: string) => void;
  healMember: (id: string, amount: number) => void;
  damageMember: (id: string, amount: number) => void;
  reset: () => void;
}

const initialState: TeamState = {
  members: [],
  formation: 'standard',
  maxMembers: 4,
};

export const useTeamStore = create<TeamState & TeamActions>((set) => ({
  ...initialState,
  setMembers: (members) => set({ members }),
  addMember: (member) => set((s) => ({ members: [...s.members, member] })),
  removeMember: (id) => set((s) => ({ members: s.members.filter(m => m.id !== id) })),
  updateMember: (id, data) => set((s) => ({ members: s.members.map(m => m.id === id ? { ...m, ...data } : m) })),
  setFormation: (formation) => set({ formation }),
  healMember: (id, amount) => set((s) => ({ members: s.members.map(m => m.id === id ? { ...m, hp: Math.min(m.maxHp, m.hp + amount) } : m) })),
  damageMember: (id, amount) => set((s) => ({ members: s.members.map(m => m.id === id ? { ...m, hp: Math.max(0, m.hp - amount) } : m) })),
  reset: () => set(initialState),
}));
