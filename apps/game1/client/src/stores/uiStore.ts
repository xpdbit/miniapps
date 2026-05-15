import { create } from 'zustand';

export interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration: number;
}

export interface UiState {
  activeModal: string | null;
  activeTab: string;
  notifications: Notification[];
  sidebarOpen: boolean;
}

interface UiActions {
  showModal: (modalId: string) => void;
  hideModal: () => void;
  setActiveTab: (tab: string) => void;
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  dismissNotification: (id: string) => void;
  dismissAllNotifications: () => void;
  toggleSidebar: () => void;
}

let notifId = 0;

export const useUiStore = create<UiState & UiActions>((set) => ({
  activeModal: null,
  activeTab: 'home',
  notifications: [],
  sidebarOpen: false,

  showModal: (activeModal) => set({ activeModal }),
  hideModal: () => set({ activeModal: null }),
  setActiveTab: (activeTab) => set({ activeTab }),
  addNotification: (notif) => set((s) => ({ notifications: [...s.notifications, { ...notif, id: `n_${notifId++}` }] })),
  dismissNotification: (id) => set((s) => ({ notifications: s.notifications.filter(n => n.id !== id) })),
  dismissAllNotifications: () => set({ notifications: [] }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
