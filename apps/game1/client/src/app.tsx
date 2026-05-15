import { PropsWithChildren, useEffect } from 'react';
import { useLaunch, useDidShow, useDidHide } from '@tarojs/taro';
import {
  GameLoop,
  TimeManager,
  saveManager,
  itemRegistry,
  InventoryEngine,
} from './engine';
import { useGameStore } from './stores';
import { gameSyncManager } from './services/GameSyncManager';
import { getToken, getMe, type PlayerData } from './services/api';
import './app.scss';

function App({ children }: PropsWithChildren<object>) {
  useLaunch(async () => {
    console.log('[Game1] 应用启动');

    // 1. 初始化物品注册表
    itemRegistry.init();

    // 2. 检查登录态
    const token = getToken();
    let playerData: PlayerData | null = null;

    if (token) {
      try {
        const meRes = await getMe();
        if (meRes.success && meRes.data) {
          playerData = meRes.data;
        }
      } catch {
        // 网络错误或 token 失效，走本地存档
      }
    }

    if (playerData) {
      // ---- 在线模式：从云端同步 ----

      const { id: pid, level, exp, totalMileage, playTime, prestigeCount, createdAt } = playerData;

      // 2a. 加载云端存档
      const cloudSave = await gameSyncManager.loadCloudSave(pid);

      if (cloudSave) {
        // 记录存档版本（后续上传时必须匹配）
        gameSyncManager.setSaveVersion(cloudSave.version);

        // 用云端存档覆盖本地状态
        const saveData = cloudSave.saveData as Record<string, unknown>;
        const player = (saveData.player ?? {}) as Record<string, unknown>;

        useGameStore.setState({
          level: (player.level as number) ?? level,
          exp: (player.exp as number) ?? exp,
          gold: (player.gold as number) ?? 0,
          gems: (player.gems as number) ?? 0,
          totalMileage: (player.totalMileage as number) ?? totalMileage,
          playTime: (player.playTime as number) ?? Math.floor(playTime),
          prestigeCount: (player.prestigeCount as number) ?? prestigeCount,
          journeyProgress: (player.journeyProgress as number) ?? 0,
          createdAt: (player.createdAt as number) ?? Math.floor(new Date(createdAt).getTime() / 1000),
          playerId: pid,
          isInitialized: true,
        });

        // 加载背包
        const invData = saveData.inventory;
        if (invData && typeof invData === 'object' && Object.keys(invData as Record<string, unknown>).length > 0) {
          InventoryEngine.instance.onLoad(invData as Record<string, unknown>);
        }

        // 存一份到本地作为离线缓存
        saveManager.save({
          version: 1,
          timestamp: Date.now(),
          player: player,
          inventory: (saveData.inventory ?? {}) as Record<string, unknown>,
          team: {},
          travel: {},
        });
      } else {
        // 云端无存档，用服务器 player 数据
        useGameStore.setState({
          level,
          exp,
          gold: playerData.gold,
          gems: playerData.gems,
          totalMileage,
          playTime: Math.floor(Date.now() / 1000 - new Date(createdAt).getTime() / 1000),
          prestigeCount,
          createdAt: Math.floor(new Date(createdAt).getTime() / 1000),
          playerId: pid,
          isInitialized: true,
        });
      }

      // 2b. 调协：服务端计算离线收益
      // GameSyncManager.reconcile() 已将 store 设置为服务端权威值（含离线收益）
      const reconcileResult = await gameSyncManager.reconcile(pid);

      if (reconcileResult?.offlineRewards) {
        const { gold, exp: expReward, mileage, combatClears } = reconcileResult.offlineRewards;
        console.log(
          `[Game1] 离线收益: +${Math.floor(gold ?? 0)}金, +${Math.floor(expReward ?? 0)}经验, ` +
          `+${(mileage ?? 0).toFixed(1)}里程, ${combatClears ?? 0}次战斗`,
        );
      }

      // 2c. 启动定时同步
      gameSyncManager.start();

    } else {
      // ---- 离线模式：用本地存档 ----

      const saveData = saveManager.load();
      if (saveData) {
        try {
          const playerData_ = saveData.player as Record<string, unknown>;
          if (playerData_) {
            useGameStore.getState().setLevel((playerData_.level as number) ?? 1);
            useGameStore.getState().setExp((playerData_.exp as number) ?? 0);
            useGameStore.getState().setExpToNext((playerData_.expToNext as number) ?? 100);
            if (playerData_.gold !== undefined) {
              useGameStore.setState({
                gold: playerData_.gold as number,
                gems: (playerData_.gems as number) ?? 0,
                totalMileage: (playerData_.totalMileage as number) ?? 0,
                playTime: (playerData_.playTime as number) ?? 0,
                prestigeCount: (playerData_.prestigeCount as number) ?? 0,
                journeyProgress: (playerData_.journeyProgress as number) ?? 0,
                createdAt: (playerData_.createdAt as number) ?? 0,
                isInitialized: true,
              });

              const invData = saveData.inventory;
              if (invData && typeof invData === 'object' && Object.keys(invData as Record<string, unknown>).length > 0) {
                InventoryEngine.instance.onLoad(invData as Record<string, unknown>);
              }
            }
          } else {
            useGameStore.getState().setInitialized(true);
          }
        } catch (err) {
          console.error('[Game1] 本地存档加载失败:', err);
          useGameStore.getState().setInitialized(true);
        }
      } else {
        // 完全新用户
        useGameStore.getState().setInitialized(true);
      }

      // 离线模式也启动 GameSyncManager（它会自动检测无 token 并跳过同步）
      gameSyncManager.start();
    }
  });

  // 页面显示时（包括从后台切回）
  useDidShow(() => {
    console.log('[Game1] 页面显示');
    TimeManager.instance.onAppShow();

    // 计算离线时长（本地 fallback，服务端 reconcile 更准确）
    const offlineSeconds = TimeManager.instance.getOfflineDuration();
    if (offlineSeconds > 30 && !getToken()) {
      // 仅离线模式下计算本地离线收益
      const store = useGameStore.getState();
      const clamped = Math.min(offlineSeconds, 8 * 3600);
      const decay =
        clamped < 3600 ? 1 : clamped < 21600 ? 0.8 : clamped < 86400 ? 0.5 : 0.2;

      store.addGold(Math.floor(clamped * 0.5 * decay));
      store.addExp(Math.floor(clamped * 0.1 * decay));
      store.addMileage(clamped * 0.05 * decay);
    }

    if (!gameSyncManager.isRunning()) {
      gameSyncManager.start();
    }
  });

  // 页面隐藏时（切到后台）
  useDidHide(() => {
    console.log('[Game1] 页面隐藏');
    TimeManager.instance.onAppHide();

    // 强制同步一次
    if (gameSyncManager.isRunning()) {
      gameSyncManager.forceSync();
    }

    // 自动保存到本地（离线缓存）
    const store = useGameStore.getState();
    saveManager.save({
      version: 1,
      timestamp: Date.now(),
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
    });
  });

  // 定时自动存档（每 30 秒）
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      const store = useGameStore.getState();
      if (!store.isInitialized) return;
      saveManager.requestSave({
        version: 1,
        timestamp: Date.now(),
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
      });
    }, 30000);

    return () => clearInterval(autoSaveInterval);
  }, []);

  return children;
}

export default App;
