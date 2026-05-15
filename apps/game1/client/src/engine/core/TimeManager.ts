import Taro from '@tarojs/taro';

export class TimeManager {
  static readonly instance = new TimeManager();

  private lastSaveTimestamp: number = 0;
  private isAppInBackground: boolean = false;
  private static readonly MAX_OFFLINE_SECONDS = 8 * 3600; // 最�?8 小时

  /** 获取当前游戏时间戳（秒） */
  getNow(): number {
    return Math.floor(Date.now() / 1000);
  }

  /** 计算离线时长（秒），启动时调�?*/
  getOfflineDuration(): number {
    try {
      const lastSave = Taro.getStorageSync('lastSaveTime');
      if (!lastSave) return 0;
      const offlineMs = Date.now() - lastSave;
      return Math.min(Math.floor(offlineMs / 1000), TimeManager.MAX_OFFLINE_SECONDS);
    } catch {
      return 0;
    }
  }

  /** 记录存档时间 */
  markSaveTime(): void {
    this.lastSaveTimestamp = Date.now();
    try {
      Taro.setStorageSync('lastSaveTime', Date.now());
    } catch {
      // 存储失败时静默处�?
    }
  }

  /** 获取最后保存时间戳 */
  getLastSaveTimestamp(): number {
    return this.lastSaveTimestamp;
  }

  /** 小程序切前台时调�?*/
  onAppShow(): void {
    this.isAppInBackground = false;
  }

  /** 小程序切后台时调�?*/
  onAppHide(): void {
    this.isAppInBackground = true;
    this.markSaveTime();
  }

  /** 是否在后�?*/
  getIsInBackground(): boolean {
    return this.isAppInBackground;
  }

  /** 获取当前游戏内时间（总游戏秒数模拟） */

  // 从存档恢�?
  loadFromSave(savedTimestamp: number): void {
    this.lastSaveTimestamp = savedTimestamp || Date.now();
  }
}

