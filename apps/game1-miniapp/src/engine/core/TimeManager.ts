export class TimeManager {
  static readonly instance = new TimeManager();

  private lastSaveTimestamp: number = 0;
  private isAppInBackground: boolean = false;
  private static readonly MAX_OFFLINE_SECONDS = 8 * 3600; // 最多 8 小时

  /** 获取当前游戏时间戳（秒） */
  getNow(): number {
    return Math.floor(Date.now() / 1000);
  }

  /** 计算离线时长（秒），启动时调用 */
  getOfflineDuration(): number {
    try {
      const lastSave = wx.getStorageSync('lastSaveTime');
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
      wx.setStorageSync('lastSaveTime', Date.now());
    } catch {
      // 存储失败时静默处理
    }
  }

  /** 获取最后保存时间戳 */
  getLastSaveTimestamp(): number {
    return this.lastSaveTimestamp;
  }

  /** 小程序切前台时调用 */
  onAppShow(): void {
    this.isAppInBackground = false;
  }

  /** 小程序切后台时调用 */
  onAppHide(): void {
    this.isAppInBackground = true;
    this.markSaveTime();
  }

  /** 是否在后台 */
  getIsInBackground(): boolean {
    return this.isAppInBackground;
  }

  /** 获取当前游戏内时间（总游戏秒数模拟） */

  // 从存档恢复
  loadFromSave(savedTimestamp: number): void {
    this.lastSaveTimestamp = savedTimestamp || Date.now();
  }
}
