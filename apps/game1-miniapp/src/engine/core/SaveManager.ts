export interface SaveData {
  version: number;
  timestamp: number;
  player: Record<string, unknown>;
  inventory: Record<string, unknown>;
  team: Record<string, unknown>;
  travel: Record<string, unknown>;
  [key: string]: unknown;
}

export const SAVE_KEYS = {
  PROFILE: 'g1_profile',
  TRAVEL: 'g1_travel',
  INVENTORY: 'g1_inventory',
  TEAM: 'g1_team',
  ACHIEVEMENT: 'g1_achievement',
  MAP: 'g1_map',
  TIMESTAMP: 'lastSaveTime',
} as const;

export class SaveManager {
  private static readonly SAVE_KEY = 'g1_save';
  private static readonly VERSION = 1;
  private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private saveDebounceDelay = 2000;

  /** 保存全部存档 */
  save(data: SaveData): void {
    try {
      wx.setStorageSync(
        SaveManager.SAVE_KEY,
        JSON.stringify({
          ...data,
          version: SaveManager.VERSION,
          timestamp: Date.now(),
        }),
      );
      wx.setStorageSync('lastSaveTime', Date.now());
    } catch (err) {
      console.error('[SaveManager] 保存存档失败:', err);
    }
  }

  /** 读取存档 */
  load(): SaveData | null {
    try {
      const raw = wx.getStorageSync(SaveManager.SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as SaveData;
      return this.migrate(data);
    } catch (err) {
      console.error('[SaveManager] 读取存档失败:', err);
      return null;
    }
  }

  /** 保存指定 key 的数据 */
  saveByKey<T>(key: string, data: T): void {
    try {
      wx.setStorageSync(
        key,
        JSON.stringify({
          version: SaveManager.VERSION,
          timestamp: Date.now(),
          data,
        }),
      );
    } catch (err) {
      console.error(`[SaveManager] 保存 ${key} 失败:`, err);
    }
  }

  /** 读取指定 key 的数据 */
  loadByKey<T>(key: string): T | null {
    try {
      const raw = wx.getStorageSync(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { data: T };
      return parsed.data;
    } catch {
      return null;
    }
  }

  /** 清除存档 */
  clear(): void {
    try {
      wx.removeStorageSync(SaveManager.SAVE_KEY);
      Object.values(SAVE_KEYS).forEach((key) => {
        wx.removeStorageSync(key);
      });
    } catch (err) {
      console.error('[SaveManager] 清除存档失败:', err);
    }
  }

  /** 防抖保存 */
  requestSave(data: SaveData): void {
    if (this.saveDebounceTimer !== null) {
      clearTimeout(this.saveDebounceTimer);
    }
    this.saveDebounceTimer = setTimeout(() => {
      this.save(data);
      this.saveDebounceTimer = null;
    }, this.saveDebounceDelay);
  }

  /** 立即保存 */
  forceSave(data: SaveData): void {
    if (this.saveDebounceTimer !== null) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
    this.save(data);
  }

  /** 版本迁移 */
  private migrate(data: SaveData): SaveData {
    let current = { ...data };
    while (current.version < SaveManager.VERSION) {
      current = this.applyMigration(current, current.version);
      current.version += 1;
    }
    return current;
  }

  private applyMigration(data: SaveData, fromVersion: number): SaveData {
    // 后续版本迁移在此添加
    console.log(`[SaveManager] 存档迁移: v${fromVersion} → v${fromVersion + 1}`);
    return data;
  }

  /** 获取存储使用情况 */
  getStorageInfo(): Record<string, unknown> | null {
    try {
      return wx.getStorageInfoSync() as unknown as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

export const saveManager = new SaveManager();
