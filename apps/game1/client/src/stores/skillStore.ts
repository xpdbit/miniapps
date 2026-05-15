import { create } from 'zustand';

export interface SkillData {
  id: string;
  name: string;
  type: 'active' | 'passive';
  description: string;
  isUnlocked: boolean;
  cooldown: number;
}

export interface SkillState {
  knownSkills: SkillData[];
  activeSlots: (string | null)[]; // max 2
  passiveSlots: (string | null)[]; // max 4
  skillPoints: number;
}

interface SkillActions {
  setKnownSkills: (skills: SkillData[]) => void;
  learnSkill: (skill: SkillData) => void;
  equipActive: (slot: number, skillId: string) => void;
  unequipActive: (slot: number) => void;
  equipPassive: (slot: number, skillId: string) => void;
  unequipPassive: (slot: number) => void;
  addSkillPoints: (amount: number) => void;
  reset: () => void;
}

const initialState: SkillState = {
  knownSkills: [],
  activeSlots: [null, null],
  passiveSlots: [null, null, null, null],
  skillPoints: 0,
};

export const useSkillStore = create<SkillState & SkillActions>((set) => ({
  ...initialState,
  setKnownSkills: (knownSkills) => set({ knownSkills }),
  learnSkill: (skill) => set((s) => ({ knownSkills: s.knownSkills.find(k => k.id === skill.id) ? s.knownSkills : [...s.knownSkills, { ...skill, isUnlocked: true }] })),
  equipActive: (slot, skillId) => set((s) => { const slots = [...s.activeSlots]; slots[slot] = skillId; return { activeSlots: slots }; }),
  unequipActive: (slot) => set((s) => { const slots = [...s.activeSlots]; slots[slot] = null; return { activeSlots: slots }; }),
  equipPassive: (slot, skillId) => set((s) => { const slots = [...s.passiveSlots]; slots[slot] = skillId; return { passiveSlots: slots }; }),
  unequipPassive: (slot) => set((s) => { const slots = [...s.passiveSlots]; slots[slot] = null; return { passiveSlots: slots }; }),
  addSkillPoints: (amount) => set((s) => ({ skillPoints: s.skillPoints + amount })),
  reset: () => set(initialState),
}));
