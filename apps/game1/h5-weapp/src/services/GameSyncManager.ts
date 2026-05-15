/**
 * GameSyncManager — 云端同步管理器
 *
 * 职责：
 * 1. 启动时调协（reconcile）：服务端计算离线收益 + 返回权威数据
 * 2. 定期同步：带增速校验的云端同步
 * 3. 冲突处理：版本号冲突时按策略合并
 * 4. 可靠性：状态机 + 指数退避重试 + 在线/离线检测
 *
 * 状态机：
 *   idle → syncing → idle (成功)
 *        → error → backoff → idle (重试)
 *        → offline → idle (恢复网络)
 */

import { useGameStore } from '../stores';
import { saveManager } from '../engine/core/SaveManager';
import { InventoryEngine } from '../engine/inventory/InventoryEngine';
import {
  syncPlayer,
  reconcilePlayer,
  loadSave,
  uploadSave,
  getToken,
  type SyncPayload,
  type SyncResult,
  type ReconcileResult,
  type CloudSaveData,
} from './api';

// ============================================================
// 类型定义
// ============================================================

export type SyncState = 'idle' | 'syncing' | 'error' | 'offline';

interface SyncManagerConfig {
  /** 同步间隔（毫秒） */
  syncIntervalMs: number;
  /** 初始重试延迟（毫秒） */
  baseRetryMs: number;
  /** 最大重试延迟（毫秒） */
  maxRetryMs: number;
  /** 心跳间隔（毫秒，检测网络恢复） */
  heartbeatIntervalMs: number;
  /** 最大重试次数后切换到 offline */
  maxRetriesBeforeOffline: number;
}

const DEFAULT_CONFIG: SyncManagerConfig = {
  syncIntervalMs: 30000, // 每 30 秒同步一次（原为 5s，减少请求频率）
  baseRetryMs: 2000,
  maxRetryMs: 30000,
  heartbeatIntervalMs: 10000,
  maxRetriesBeforeOffline: 3,
};

// ============================================================
// EventBus 兼容的类型定义（避免 import 循环）
// ============================================================

export interface SyncCompleteEvent {
  success: boolean;
  serverData?: SyncResult['player'];
  corrections?: string[];
}

export interface ReconcileCompleteEvent {
  offlineRewards: ReconcileResult['offlineRewards'];
  serverPlayer: ReconcileResult['player'];
}

// ============================================================
// GameSyncManager
// ============================================================

export class GameSyncManager {
  private static _instance: GameSyncManager;
  static get instance(): GameSyncManager {
    if (!GameSyncManager._instance) {
      GameSyncManager._instance = new GameSyncManager();
    }
    return GameSyncManager._instance;
  }

  // ---- 状态 ----
  private state: SyncState = 'idle';
  private playerId = 0;
  private running = false;
  private retryCount = 0;

  // ---- 计时器 ----
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- 配置 ----
  private config: SyncManagerConfig = { ...DEFAULT_CONFIG };

  // ---- 存档版本追踪 ----
  private saveVersion = 0;
  private syncCycleCount = 0;

  // ---- 统计信息（供 UI 使用） ----
  private lastSyncTime = 0;
  private lastSyncLatencyMs = 0;
  private totalSyncCount = 0;
  private totalErrorCount = 0;
  private lastErrorMessage = '';

  // ---- 回调 ----
  private onSyncComplete: ((event: SyncCompleteEvent) => void) | null = null;
  private onReconcileComplete: ((event: ReconcileCompleteEvent) => void) | null = null;

  private constructor() {}

  // ================================================================
  //  配置
  // ================================================================

  setOnSyncComplete(cb: (event: SyncCompleteEvent) => void): void {
    this.onSyncComplete = cb;
  }

  setOnReconcileComplete(cb: (event: ReconcileCompleteEvent) => void): void {
    this.onReconcileComplete = cb;
  }

  setConfig(partial: Partial<SyncManagerConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  // ================================================================
  //  生命周期
  // ================================================================

  getState(): SyncState {
    return this.state;
  }

  isRunning(): boolean {
    return this.running;
  }

  /** 获取同步统计信息（供 UI 显示） */
  getStats(): {
    lastSyncTime: number;
    lastSyncLatencyMs: number;
    totalSyncCount: number;
    totalErrorCount: number;
    lastErrorMessage: string;
    syncCycleCount: number;
    retryCount: number;
    playerId: number;
  } {
    return {
      lastSyncTime: this.lastSyncTime,
      lastSyncLatencyMs: this.lastSyncLatencyMs,
      totalSyncCount: this.totalSyncCount,
      totalErrorCount: this.totalErrorCount,
      lastErrorMessage: this.lastErrorMessage,
      syncCycleCount: this.syncCycleCount,
      retryCount: this.retryCount,
      playerId: this.playerId,
    };
  }

  /** 启动同步循环 */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.state = 'idle';
    this.scheduleNextSync(this.config.syncIntervalMs);
    this.startHeartbeat();
  }

  /** 停止所有定时器 */
  stop(): void {
    this.running = false;
    this.clearAllTimers();
  }

  /** 强制同步一次（含云端存档上传） */
  forceSync(): void {
    this.clearRetryTimer();
    this.performSync();
    this.uploadCurrentSave();
  }

  /**
   * 上传当前游戏状态到云端存档
   * 每 5 次同步循环自动调用一次
   */
  async uploadCurrentSave(): Promise<void> {
    if (!this.playerId || !getToken()) return;
    try {
      const store = useGameStore.getState();
      const saveData = {
        version: 1,
        lastSaveAt: Date.now(),
        player: {
          level: store.level,
          exp: store.exp,
          expToNext: store.expToNext,
          gold: store.gold,
          gems: store.gems,
          totalMileage: store.totalMileage,
          playTime: store.playTime,
          prestigeCount: store.prestigeCount,
          journeyProgress: store.journeyProgress,
          createdAt: store.createdAt,
          playerId: store.playerId,
        },
        inventory: InventoryEngine.instance.onSave(),
        team: {},
        travel: {},
      };
      const res = await uploadSave(this.playerId, saveData, this.saveVersion);
      if (res.success) {
        const data = res.data as Record<string, unknown> | undefined;
        // mergeSaveData 返回 { useServer, mergedData, version } 时
        if (data && data.useServer === true && data.mergedData) {
          // 服务端有更新的数据：应用权威 mergedData
          const merged = data.mergedData as Record<string, unknown>;
          this.saveVersion = (data.version as number) ?? this.saveVersion;
          const mergedPlayer = (merged.player ?? {}) as Record<string, unknown>;
          const store = useGameStore.getState();
          store.setLevel((mergedPlayer.level as number) ?? store.level);
          store.setExp((mergedPlayer.exp as number) ?? store.exp);
          useGameStore.setState({
            gold: (mergedPlayer.gold as number) ?? store.gold,
            gems: (mergedPlayer.gems as number) ?? store.gems,
          });
          // 应用背包
          const mergedInv = merged.inventory;
          if (mergedInv && typeof mergedInv === 'object' && Object.keys(mergedInv as Record<string, unknown>).length > 0) {
            InventoryEngine.instance.onLoad(mergedInv as Record<string, unknown>);
          }
        } else {
          // 正常上传成功
          this.saveVersion++;
        }
      }
    } catch { /* 上传失败不影响游戏运行 */ }
  }

  /** 带重试的上传（1 次重试，用于网络恢复场景） */
  private async uploadCurrentSaveWithRetry(): Promise<void> {
    try {
      await this.uploadCurrentSave();
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
      await this.uploadCurrentSave();
    }
  }

  /** 设置存档版本（从云端加载后调用） */
  setSaveVersion(version: number): void {
    this.saveVersion = version;
  }

  // ================================================================
  //  调协（Reconcile）— 启动时调用一次
  // ================================================================

  /**
   * 登录时调协：服务端计算离线收益 + 返回权威数据
   * 应在 app 启动时，登录完成后调用
   */
  async reconcile(pid: number): Promise<ReconcileResult | null> {
    this.playerId = pid;
    if (!getToken()) return null;

    try {
      const res = await reconcilePlayer(pid);
      if (!res.success || !res.data) return null;

      const { player, offlineRewards, serverTime } = res.data;

      // 应用服务端权威数据（所有值均以服务端为准）
      const store = useGameStore.getState();
      store.setLevel(player.level);
      store.setExp(player.exp);
      useGameStore.setState({
        gold: player.gold ?? 0,
        gems: player.gems ?? 0,
        totalMileage: player.totalMileage,
        prestigeCount: player.prestigeCount,
        playerId: player.id,
        isInitialized: true,
      });

      // 通知外部（app.tsx 用此事件展示离线收益弹窗）
      this.onReconcileComplete?.({
        offlineRewards,
        serverPlayer: player,
      });

      return res.data;
    } catch (err) {
      console.warn('[GameSync] 调协失败（将使用本地存档）:', err);
      return null;
    }
  }

  // ================================================================
  //  加载云端存档
  // ================================================================

  /**
   * 从云端加载完整存档（启动时调用）
   * 返回存档数据，由调用方决定是否覆盖本地
   */
  async loadCloudSave(pid: number): Promise<CloudSaveData | null> {
    this.playerId = pid;
    if (!getToken()) return null;

    try {
      const res = await loadSave(pid);
      if (!res.success || !res.data) return null;
      return res.data;
    } catch (err) {
      console.warn('[GameSync] 云端存档加载失败:', err);
      return null;
    }
  }

  // ================================================================
  //  内部：同步循环
  // ================================================================

  private scheduleNextSync(delayMs: number): void {
    this.clearSyncTimer();
    if (!this.running) return;
    this.syncTimer = setTimeout(() => {
      this.performSync();
    }, delayMs);
  }

  private async performSync(): Promise<void> {
    if (this.state === 'syncing') return;
    if (!this.playerId || !getToken()) {
      this.scheduleNextSync(this.config.syncIntervalMs);
      return;
    }

    const prevState = this.state;
    this.state = 'syncing';
    const store = useGameStore.getState();
    if (!store.isInitialized) {
      this.state = 'idle';
      this.scheduleNextSync(this.config.syncIntervalMs);
      return;
    }

    const syncStartTime = Date.now();

    try {
      const payload: SyncPayload = {
        level: store.level,
        exp: Math.floor(store.exp),
        gold: Math.floor(store.gold),
        gems: store.gems,
        totalMileage: Math.floor(store.totalMileage),
        playTime: Math.floor(store.playTime),
        prestigeCount: store.prestigeCount,
      };

      const res = await syncPlayer(this.playerId, payload);

      this.lastSyncLatencyMs = Date.now() - syncStartTime;

      if (res.success && res.data) {
        // 应用服务端权威纠偏（无条件覆盖，服务端始终是权威）
        const serverPlayer = res.data.player;
        store.setLevel(serverPlayer.level);
        store.setExp(serverPlayer.exp);
        // 服务端现在也管理 gold/gems，应用权威值
        useGameStore.setState({ gold: serverPlayer.gold ?? 0, gems: serverPlayer.gems ?? 0 });

        this.retryCount = 0;
        this.state = 'idle';
        this.lastSyncTime = Date.now();
        this.totalSyncCount++;
        this.lastErrorMessage = '';

        // 网络恢复检测：之前处于 offline/error，现在同步成功
        if (prevState === 'offline' || prevState === 'error') {
          await this.onNetworkRecovered();
        }

        this.onSyncComplete?.({
          success: true,
          serverData: serverPlayer,
          corrections: res.data.corrections,
        });

        if (res.data.corrected) {
          console.warn('[GameSync] 增速纠偏:', res.data.corrections.join('; '));
        }

        // 每 5 次同步上传一次云端存档（背包/完整状态）
        this.syncCycleCount++;
        if (this.syncCycleCount % 5 === 0) {
          this.uploadCurrentSave();
        }
      } else {
        throw new Error(res.errMsg || '同步失败');
      }
    } catch (err) {
      this.handleSyncError(err);
    }

    this.scheduleNextSync(this.config.syncIntervalMs);
  }

  // ================================================================
  //  错误处理 & 退避
  // ================================================================

  private handleSyncError(err: unknown): void {
    this.retryCount++;
    this.totalErrorCount++;
    this.lastErrorMessage = err instanceof Error ? err.message : String(err);
    this.lastSyncTime = Date.now();
    console.warn(`[GameSync] 同步失败 (第${this.retryCount}次):`, err);

    if (this.retryCount >= this.config.maxRetriesBeforeOffline) {
      this.state = 'offline';
      this.startHeartbeat(); // 加速心跳检测网络恢复
    } else {
      this.state = 'error';
      const delay = Math.min(
        this.config.baseRetryMs * Math.pow(2, this.retryCount - 1),
        this.config.maxRetryMs,
      );
      this.scheduleRetry(delay);
    }
  }

  private scheduleRetry(delayMs: number): void {
    this.clearRetryTimer();
    this.retryTimer = setTimeout(() => {
      if (this.state === 'error') {
        this.performSync();
      }
    }, delayMs);
  }

  // ================================================================
  //  心跳检测（离线模式 → 自动恢复）
  // ================================================================

  private startHeartbeat(): void {
    this.clearHeartbeatTimer();
    if (!this.running) return;
    this.heartbeatTimer = setInterval(() => {
      if (this.state !== 'offline') return;
      // 尝试一次简单同步来检测网络
      this.performSync();
    }, this.config.heartbeatIntervalMs);
  }

  /** 检测到网络恢复时触发 */
  private async onNetworkRecovered(): Promise<void> {
    console.log('[GameSync] 网络已恢复');
    this.state = 'idle';
    this.retryCount = 0;
    // 网络恢复时上传一次完整存档（补传离线期间的背包变化）
    await this.uploadCurrentSaveWithRetry();
  }

  // ================================================================
  //  计时器清理
  // ================================================================

  private clearAllTimers(): void {
    this.clearSyncTimer();
    this.clearRetryTimer();
    this.clearHeartbeatTimer();
  }

  private clearSyncTimer(): void {
    if (this.syncTimer !== null) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
  }

  private clearRetryTimer(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

/** 全局单例 */
export const gameSyncManager = GameSyncManager.instance;
