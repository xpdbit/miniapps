import { create } from 'zustand';
import Taro from '@tarojs/taro';
import { getToken, removeToken, deleteSave } from '../services/api';

// ============================================================
// 设置数据类型
// ============================================================
export interface SettingsData {
  /** 背景音乐开关 */
  musicEnabled: boolean;
  /** 音效开关 */
  soundEnabled: boolean;
  /** 震动开关 */
  vibrationEnabled: boolean;
}

// ============================================================
// Store 接口
// ============================================================
export interface SettingsState extends SettingsData {
  /** 切换背景音乐 */
  toggleMusic: () => void;
  /** 切换音效 */
  toggleSound: () => void;
  /** 切换震动 */
  toggleVibration: () => void;
  /** 清除所有游戏数据 */
  clearData: () => void;
}

// ============================================================
// 常量
// ============================================================
const STORAGE_KEY = 'g1_settings';

const DEFAULT_SETTINGS: SettingsData = {
  musicEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
};

// ============================================================
// 持久化辅助
// ============================================================
function loadSettings(): SettingsData {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SettingsData;
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.error('[SettingsStore] 加载设置失败:', err);
  }
  return { ...DEFAULT_SETTINGS };
}

function persistSettings(data: SettingsData): void {
  try {
    wx.setStorageSync(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('[SettingsStore] 保存设置失败:', err);
  }
}

// ============================================================
// Store
// ============================================================
const initial = loadSettings();

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...initial,

  toggleMusic: () => {
    const musicEnabled = !get().musicEnabled;
    set({ musicEnabled });
    persistSettings({
      musicEnabled,
      soundEnabled: get().soundEnabled,
      vibrationEnabled: get().vibrationEnabled,
    });
  },

  toggleSound: () => {
    const soundEnabled = !get().soundEnabled;
    set({ soundEnabled });
    persistSettings({
      musicEnabled: get().musicEnabled,
      soundEnabled,
      vibrationEnabled: get().vibrationEnabled,
    });
  },

  toggleVibration: () => {
    const vibrationEnabled = !get().vibrationEnabled;
    set({ vibrationEnabled });
    persistSettings({
      musicEnabled: get().musicEnabled,
      soundEnabled: get().soundEnabled,
      vibrationEnabled,
    });
  },

  clearData: async () => {
    const confirmed = await new Promise<boolean>((resolve) => {
      wx.showModal({
        title: '确认清除',
        content: '确定要清除所有游戏数据吗？此操作不可撤销！',
        success: (res) => resolve(res.confirm),
      });
    });
    if (!confirmed) return;

    try {
      // 1. 尝试删除服务端存档（忽略错误——可能是无网络/未登录）
      const token = getToken();
      if (token) {
        const store = get();
        // 尝试从 local storage 找 playerId
        let playerId = 0;
        try {
          const raw = wx.getStorageSync('g1_save');
          if (raw) {
            const parsed = JSON.parse(raw);
            playerId = parsed.playerId ?? 0;
          }
        } catch { /* 忽略 */ }
        if (playerId > 0) {
          try {
            await deleteSave(playerId);
          } catch { /* 服务端删除非必需 */ }
        }
        // 清除 token
        removeToken();
      }

      // 2. 清除所有 g1_ 前缀的本地存储
      const info = wx.getStorageInfoSync() as { keys: string[] };
      info.keys
        .filter((k) => k.startsWith('g1_'))
        .forEach((k) => wx.removeStorageSync(k));

      // 3. 重置 store
      set({ ...DEFAULT_SETTINGS });

      // 4. 提示并重启小程序（回到干净状态）
      wx.showToast({ title: '已清除', icon: 'success', duration: 1500 });
      setTimeout(() => {
        Taro.reLaunch({ url: '/pages/home/index' });
      }, 1500);
    } catch (err) {
      console.error('[SettingsStore] 清除数据失败:', err);
      wx.showToast({ title: '清除失败', icon: 'error' });
    }
  },
}));
