import { create } from 'zustand';

export type TravelStatus = 'idle' | 'traveling' | 'arrived' | 'event';

export interface TravelLogEntry {
  time: number;
  message: string;
  type: 'info' | 'event' | 'reward' | 'system';
}

export interface TravelState {
  status: TravelStatus;
  progress: number;
  currentRouteId: string;
  mileage: number;
  stamina: number;
  maxStamina: number;
  food: number;
  maxFood: number;
  morale: number;
  travelLog: TravelLogEntry[];
}

interface TravelActions {
  setStatus: (status: TravelStatus) => void;
  setProgress: (progress: number) => void;
  setRoute: (routeId: string) => void;
  addMileage: (amount: number) => void;
  setStamina: (val: number) => void;
  setFood: (val: number) => void;
  setMorale: (val: number) => void;
  addLog: (entry: TravelLogEntry) => void;
  clearLog: () => void;
  reset: () => void;
}

const initialState: TravelState = {
  status: 'idle',
  progress: 0,
  currentRouteId: '',
  mileage: 0,
  stamina: 100,
  maxStamina: 100,
  food: 100,
  maxFood: 100,
  morale: 100,
  travelLog: [],
};

export const useTravelStore = create<TravelState & TravelActions>((set) => ({
  ...initialState,
  setStatus: (status) => set({ status }),
  setProgress: (progress) => set({ progress }),
  setRoute: (currentRouteId) => set({ currentRouteId }),
  addMileage: (amount) => set((s) => ({ mileage: s.mileage + amount })),
  setStamina: (stamina) => set({ stamina }),
  setFood: (food) => set({ food }),
  setMorale: (morale) => set({ morale }),
  addLog: (entry) => set((s) => ({ travelLog: [...s.travelLog, entry] })),
  clearLog: () => set({ travelLog: [] }),
  reset: () => set(initialState),
}));
