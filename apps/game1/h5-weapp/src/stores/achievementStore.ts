import { create } from 'zustand';

export interface AchievementData {
  id: string;
  name: string;
  description: string;
  category: string;
  isUnlocked: boolean;
  unlockedAt?: number;
  progress: number;
  target: number;
}

export interface TaskData {
  id: string;
  name: string;
  description: string;
  type: 'daily' | 'weekly';
  progress: number;
  target: number;
  reward: { gold: number; exp: number; gems?: number };
  isCompleted: boolean;
  isClaimed: boolean;
  expiresAt: number;
}

export interface AchievementState {
  achievements: AchievementData[];
  tasks: TaskData[];
  recentUnlocks: string[];
}

interface AchievementActions {
  setAchievements: (achievements: AchievementData[]) => void;
  unlockAchievement: (id: string) => void;
  updateProgress: (id: string, progress: number) => void;
  setTasks: (tasks: TaskData[]) => void;
  updateTaskProgress: (id: string, progress: number) => void;
  claimTask: (id: string) => void;
  clearRecentUnlocks: () => void;
  reset: () => void;
}

const initialState: AchievementState = {
  achievements: [],
  tasks: [],
  recentUnlocks: [],
};

export const useAchievementStore = create<AchievementState & AchievementActions>((set) => ({
  ...initialState,
  setAchievements: (achievements) => set({ achievements }),
  unlockAchievement: (id) => set((s) => ({
    achievements: s.achievements.map(a => a.id === id ? { ...a, isUnlocked: true, unlockedAt: Date.now() } : a),
    recentUnlocks: [...s.recentUnlocks, id],
  })),
  updateProgress: (id, progress) => set((s) => ({ achievements: s.achievements.map(a => a.id === id ? { ...a, progress: Math.min(a.target, progress) } : a) })),
  setTasks: (tasks) => set({ tasks }),
  updateTaskProgress: (id, progress) => set((s) => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, progress: Math.min(t.target, progress), isCompleted: progress >= t.target } : t) })),
  claimTask: (id) => set((s) => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, isClaimed: true } : t) })),
  clearRecentUnlocks: () => set({ recentUnlocks: [] }),
  reset: () => set(initialState),
}));
