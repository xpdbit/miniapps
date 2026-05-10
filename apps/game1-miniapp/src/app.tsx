import { PropsWithChildren, useEffect } from 'react';
import { useLaunch, useDidShow, useDidHide } from '@tarojs/taro';
import { GameLoop, TimeManager, saveManager, itemRegistry, InventoryEngine } from './engine';
import { useGameStore } from './stores';
import { gameSyncManager } from './services/GameSyncManager';
import './app.scss';

function App({ children }: PropsWithChildren<object>) {
  useLaunch(() => {
    console.log('[Game1] 应用启动');

    // 初始化物品注册表（注册装备属性到 EquipmentSystem）
    itemRegistry.init();

    // 加载存档
    const saveData = saveManager.load();
    if (saveData) {
      try {
        const playerData = saveData.player as Record<string, unknown>;
        if (playerData) {
          useGameStore.getState().setLevel((playerData.level as number) ?? 1);
          useGameStore.getState().setExp((playerData.exp as number) ?? 0);
          useGameStore.getState().setExpToNext((playerData.expToNext as number) ?? 100);
          if (playerData.gold !== undefined) {
            useGameStore.setState({
              gold: playerData.gold as number,
              gems: (playerData.gems as number) ?? 0,
              totalMileage: (playerData.totalMileage as number) ?? 0,
              playTime: (playerData.playTime as number) ?? 0,
              prestigeCount: (playerData.prestigeCount as number) ?? 0,
              journeyProgress: (playerData.journeyProgress as number) ?? 0,
              createdAt: (playerData.createdAt as number) ?? 0,
              isInitialized: true,
            });

            // 读取背包存档
            const invData = saveData.inventory;
            if (invData && typeof invData === 'object' && Object.keys(invData as Record<string, unknown>).length > 0) {
              InventoryEngine.instance.onLoad(invData as Record<string, unknown>);
            }

            // 初始化同步管理器（有 ca/pid 则传值，否则自动填充）
            const ca = (playerData.createdAt as number) ?? 0;
            const pid = (playerData.playerId as number) ?? 0;
            if (pid > 0) {
              gameSyncManager.init(pid, ca);
            } else if (ca > 0) {
              gameSyncManager.init(0, ca);
            }
            gameSyncManager.start();
          }
        } else {
          // 存档存在但 playerData 为空 → 也启动
          useGameStore.getState().setInitialized(true);
          gameSyncManager.start();
        }
      } catch (err) {
        console.error('[Game1] 存档加载失败:', err);
        useGameStore.getState().setInitialized(true);
        gameSyncManager.start();
      }
    } else {
      // 没有存档：初始化 store 并启动同步管理器（自动填充 createdAt）
      useGameStore.getState().setInitialized(true);
      gameSyncManager.start();
    }
  });

  // 页面显示时（包括从后台切回）
  useDidShow(() => {
    console.log('[Game1] 页面显示');
    TimeManager.instance.onAppShow();

    // 计算离线收益（委托给 GameSyncManager）
    const offlineSeconds = TimeManager.instance.getOfflineDuration();
    if (offlineSeconds > 5) {
      gameSyncManager.processOfflineTime(offlineSeconds);
    }

    // 启动同步管理器（如果还没启动）
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

    // 自动保存
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

  // 定时自动存档
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
