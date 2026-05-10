/**
 * GameSyncManager — 游戏同步管理器
 *
 * 职责：
 * 1. 本地游戏逻辑每 1 秒计算（游玩时间、挂机收益等）
 * 2. 每 5 秒与服务器通信同步纠偏
 * 3. 管理 createdAt 和 playTime 的计算
 * 4. 断线重连与冲突处理
 * 5. 物品掉落（每 tick 累积计时，达到间隔按权重掉落）
 */

import { useGameStore } from '../stores';
import { syncPlayer, getMe, type PlayerData } from './api';
import { itemRegistry, InventoryEngine, globalEventBus } from '../engine';

/** 同步间隔（毫秒） */
const SYNC_INTERVAL_MS = 5000;

/** 本地 tick 间隔（毫秒） */
const TICK_INTERVAL_MS = 1000;

/** 最大离线秒数 */
const MAX_OFFLINE_SECONDS = 8 * 3600;

export class GameSyncManager {
  private static _instance: GameSyncManager;
  static get instance(): GameSyncManager {
    if (!GameSyncManager._instance) {
      GameSyncManager._instance = new GameSyncManager();
    }
    return GameSyncManager._instance;
  }

  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private syncTimer: ReturnType<typeof setInterval> | null = null;

  /** 玩家注册时间（UTC 时间戳，秒） */
  private createdAt: number = 0;

  /** 上次同步时的服务器 playTime */
  private lastSyncedPlayTime: number = 0;

  /** 上次同步时的本地时间戳 */
  private lastSyncTimestamp: number = 0;

  /** 是否已初始化（服务器或存档数据） */
  private initialized = false;

  /** 是否正在运行 */
  private running = false;

  /** 玩家 ID（用于同步请求） */
  private playerId = 0;

  // ============================================================
  // 小数累积器（解决 Math.floor 导致永不增长的问题）
  // ============================================================

  /** 金币小数累积 */
  private goldAccumulator = 0;
  /** 经验小数累积 */
  private expAccumulator = 0;
  /** 里程小数累积 */
  private mileageAccumulator = 0;

  // ============================================================
  // 物品掉落
  // ============================================================

  /** 掉落计时累积器（秒） */
  private dropTimer = 0;

  /** 掉落检查间隔（秒） */
  private static readonly DROP_INTERVAL = 25;

  /** 每次检查的基础掉落概率 */
  private static readonly BASE_DROP_CHANCE = 0.30;

  /** 累计掉落计数（用于提示） */
  private totalDrops = 0;

  /** InventoryEngine 引用 */
  private inventoryEngine = InventoryEngine.instance;

  // ============================================================
  // 初始化
  // ============================================================

  /**
   * 初始化同步管理器
   * @param playerId 玩家 ID
   * @param createdAt 注册时间（UTC 秒）
   */
  init(playerId: number, createdAt: number): void {
    this.playerId = playerId;
    this.createdAt = createdAt > 0 ? createdAt : this.createdAt;
    this.lastSyncedPlayTime = 0;
    this.lastSyncTimestamp = Date.now();
    this.initialized = true;

    // 初始化后立刻更新 playTime（如果之前是 0 现在有值了）
    if (this.createdAt > 0) {
      const store = useGameStore.getState();
      store.setCreatedAt(this.createdAt);
      store.setPlayerId(this.playerId);
      store.incrementPlayTime(0);
    }
  }

  /**
   * 从服务器数据初始化
   */
  initWithPlayerData(data: PlayerData): void {
    this.playerId = data.id;
    this.createdAt = Math.floor(new Date(data.createdAt).getTime() / 1000);
    this.lastSyncedPlayTime = data.playTime;
    this.lastSyncTimestamp = Date.now();
    this.initialized = true;

    // 写入 store
    const store = useGameStore.getState();
    store.setLevel(data.level);
    store.setExp(data.exp);
    store.setExpToNext(calcExpToNext(data.level));
    store.setCreatedAt(this.createdAt);
    store.setPlayerId(this.playerId);
    store.setInitialized(true);

    // 触发 playTime 更新
    store.incrementPlayTime(0);
  }

  // ============================================================
  // 游玩时间计算
  // ============================================================

  /**
   * 获取计算后的游玩时间（秒）
   * 游玩时间 = 当前 UTC 时间 - 注册 UTC 时间
   */
  getComputedPlayTime(): number {
    const ca = this.createdAt > 0 ? this.createdAt : Math.floor(Date.now() / 1000);
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, now - ca);
  }

  /**
   * 获取客户端估算的 playTime（考虑本地 tick 增量，用于同步）
   */
  getEstimatedPlayTime(): number {
    return this.getComputedPlayTime();
  }

  // ============================================================
  // 启动 / 停止
  // ============================================================

  /**
   * 启动本地 tick 和同步循环
   * 不再强依赖 initialized——没有玩家数据时也可独立运行（本地单机模式）
   */
  start(): void {
    if (this.running) return;

    // 没有初始化数据时，自动填充 createdAt 为当前时间
    if (this.createdAt <= 0) {
      this.createdAt = Math.floor(Date.now() / 1000);
    }

    this.running = true;

    // 启动时给路径条一个初始可见进度（用户立即可见）
    const store = useGameStore.getState();
    if (store.journeyProgress <= 0) {
      store.setJourneyProgress(3);
    }

    // 每 1 秒：本地游戏逻辑计算
    this.tickTimer = setInterval(() => {
      this.onTick();
    }, TICK_INTERVAL_MS);

    // 每 5 秒：与服务器同步（仅在 playerId 有效时）
    if (this.playerId > 0) {
      this.syncTimer = setInterval(() => {
        this.onSync();
      }, SYNC_INTERVAL_MS);
    }

    console.log('[GameSync] 同步管理器已启动' + (this.playerId > 0 ? '（含服务器同步）' : '（本地单机模式）'));
  }

  /** 停止同步 */
  stop(): void {
    this.running = false;

    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    if (this.syncTimer !== null) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    // 重置累积器
    this.goldAccumulator = 0;
    this.expAccumulator = 0;
    this.mileageAccumulator = 0;

    console.log('[GameSync] 同步管理器已停止');
  }

  /** 是否正在运行 */
  isRunning(): boolean {
    return this.running;
  }

  // ============================================================
  // 立即强制同步
  // ============================================================

  /** 强制同步一次 */
  async forceSync(): Promise<void> {
    await this.onSync();
  }

  // ============================================================
  // 内部逻辑
  // ============================================================

  /** 每 1 秒本地 tick */
  private onTick(): void {
    const store = useGameStore.getState();
    if (!store.isInitialized) return;

    // ── 更新游玩时间（每秒更新，UI 实时反映） ──
    if (this.createdAt > 0) {
      store.setCreatedAt(this.createdAt);
      store.incrementPlayTime(0);
    }

    // ── 挂机收益：小数累积投递 ──
    // 每 1 秒向累积器加 0.5/0.1/0.05
    const goldPerSec = 0.5;
    const expPerSec = 0.1;
    const mileagePerSec = 0.5;

    this.goldAccumulator += goldPerSec;
    this.expAccumulator += expPerSec;
    this.mileageAccumulator += mileagePerSec;

    // 当累积达到>=1时投递，保留余数
    if (this.goldAccumulator >= 1) {
      const grant = Math.floor(this.goldAccumulator);
      store.addGold(grant);
      this.goldAccumulator -= grant;
    }

    if (this.expAccumulator >= 1) {
      const grant = Math.floor(this.expAccumulator);
      store.addExp(grant);
      this.expAccumulator -= grant;
    }

    if (this.mileageAccumulator >= 1) {
      const grant = Math.floor(this.mileageAccumulator);
      store.addMileage(grant);
      this.mileageAccumulator -= grant;
    }

    // ── 旅程脉冲：路径条动画（每秒增长，约20秒满一圈） ──
    // 满一圈时重置并加里程奖励，让用户看到里程数字跳动
    const journeyPerSec = 5; // 每秒 5%，20秒满一圈
    const current = store.journeyProgress;
    const next = current + journeyPerSec;
    if (next >= 100) {
      // 满一圈：重置脉冲 + 里程奖励
      store.setJourneyProgress(next - 100);
      store.addMileage(5);
    } else {
      store.setJourneyProgress(next);
    }

    // ── 物品掉落：每 DROP_INTERVAL 秒检查一次 ──
    this.dropTimer += 1; // 每秒 +1
    if (this.dropTimer >= GameSyncManager.DROP_INTERVAL) {
      this.dropTimer = 0;

      // 概率判定（基础 30%，随游戏时间略微提升）
      const playHours = store.playTime / 3600;
      const hourBonus = Math.min(playHours * 0.02, 0.2); // 每小时 +2%，最多 +20%
      const dropChance = GameSyncManager.BASE_DROP_CHANCE + hourBonus;

      if (Math.random() < dropChance) {
        this.tryGenerateDrop();
      }
    }
  }

  /**
   * 尝试生成一次物品掉落（加权随机）
   * @returns 是否成功添加物品到背包
   */
  private tryGenerateDrop(): boolean {
    // 从掉落池中获取所有可掉落物品
    const droppable = itemRegistry.getDroppableItems();
    if (droppable.length === 0) return false;

    // 加权随机选择
    const totalWeight = droppable.reduce((sum, item) => sum + item.dropWeight, 0);
    if (totalWeight <= 0) return false;

    let roll = Math.random() * totalWeight;
    let selected = droppable[droppable.length - 1]!;
    for (const item of droppable) {
      roll -= item.dropWeight;
      if (roll <= 0) {
        selected = item;
        break;
      }
    }

    // 确定数量（消耗品/食物/材料 多掉几个）
    const quantity =
      selected.type === 'consumable' || selected.type === 'food' || selected.type === 'material'
        ? Math.floor(Math.random() * 3) + 1
        : 1;

    // 添加到背包引擎
    const added = this.inventoryEngine.addItem(
      selected.id,
      quantity,
      selected.name,
      selected.type,
      selected.rarity,
      selected.weight,
    );

    if (added) {
      this.totalDrops++;
      globalEventBus.emit('drop:itemDropped', {
        itemId: selected.id,
        itemName: selected.name,
        quantity,
        rarity: selected.rarity,
        source: 'idle_drop',
      });
    }

    return added;
  }

  /** 每 5 秒与服务器同步 */
  private async onSync(): Promise<void> {
    try {
      const store = useGameStore.getState();
      if (!store.isInitialized || this.playerId <= 0) return;

      const computedPlayTime = this.getEstimatedPlayTime();

      // 发送同步请求
      const res = await syncPlayer(this.playerId, {
        level: store.level,
        exp: Math.floor(store.exp),
        totalMileage: Math.floor(store.totalMileage),
        playTime: Math.floor(computedPlayTime),
        prestigeCount: store.prestigeCount,
      });

      if (res.success && res.data) {
        // 纠偏：以服务器数据为准
        this.applyServerCorrection(res.data);
        this.lastSyncTimestamp = Date.now();
      }
    } catch (err) {
      console.warn('[GameSync] 同步失败:', err);
      // 同步失败不阻塞游戏，下次继续
    }
  }

  /**
   * 应用服务器纠偏
   * 采用"信任服务器"策略：以服务器端存储的最高进度为准
   */
  private applyServerCorrection(data: PlayerData): void {
    const store = useGameStore.getState();

    // 等级/经验：取较大值（经验可能本地刚获得但还没同步）
    if (data.level > store.level) {
      store.setLevel(data.level);
      store.setExp(data.exp);
      store.setExpToNext(calcExpToNext(data.level));
    } else if (data.level === store.level && data.exp > store.exp) {
      store.setExp(data.exp);
    }

    // 里程：取较大值
    if (data.totalMileage > store.totalMileage) {
      store.addMileage(data.totalMileage - store.totalMileage);
    }
  }

  // ============================================================
  // 离线收益处理
  // ============================================================

  /**
   * 处理登录时的离线收益
   * @param offlineSeconds 离线秒数
   */
  processOfflineTime(offlineSeconds: number): void {
    const clamped = Math.min(offlineSeconds, MAX_OFFLINE_SECONDS);
    const timeFactor = clamped < 3600 ? 1 : clamped < 21600 ? 0.8 : clamped < 86400 ? 0.5 : 0.2;

    const goldReward = Math.floor(clamped * 0.5 * timeFactor);
    const expReward = Math.floor(clamped * 0.1 * timeFactor);
    const mileageReward = clamped * 0.05 * timeFactor;

    const store = useGameStore.getState();
    store.addGold(goldReward);
    store.addExp(expReward);
    store.addMileage(mileageReward);

    // ── 离线期间物品掉落 ──
    // 每 25 秒检查一次（与在线一致），基础概率 30%
    const dropChecks = Math.floor(clamped / GameSyncManager.DROP_INTERVAL);
    let offlineDrops = 0;
    for (let i = 0; i < dropChecks; i++) {
      if (Math.random() < GameSyncManager.BASE_DROP_CHANCE) {
        const added = this.tryGenerateDrop();
        if (added) offlineDrops++;
      }
    }

    console.log(
      `[GameSync] 离线收益: ${goldReward}金, ${expReward}经验, ${mileageReward.toFixed(1)}里程, ${offlineDrops}件物品`,
    );
  }
}

// ============================================================
// 工具函数
// ============================================================

function calcExpToNext(level: number): number {
  return Math.floor(100 * 1.15 ** (level - 1));
}

/** 全局单例 */
export const gameSyncManager = GameSyncManager.instance;
