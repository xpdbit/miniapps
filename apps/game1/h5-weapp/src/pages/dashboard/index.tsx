import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Navigator } from '@tarojs/components';
import { useGameStore, useSettingsStore } from '../../stores';
import { gameSyncManager, type SyncState } from '../../services/GameSyncManager';
import { getToken, API_BASE } from '../../services/api';
import './index.module.scss';

type InfoTab = 'stats' | 'hub' | 'achievements' | 'log' | 'settings';

const TAB_OPTIONS: { key: InfoTab; label: string }[] = [
  { key: 'stats', label: '📊 统计' },
  { key: 'hub', label: '🎮 功能' },
  { key: 'achievements', label: '🏆 成就' },
  { key: 'log', label: '📜 日志' },
  { key: 'settings', label: '⚙️ 设置' },
];

const HUB_ITEMS = [
  { page: '/pages/travel/index', icon: '🚶', title: '旅程', desc: '踏上旅途，探索世界' },
  { page: '/pages/combat/index', icon: '⚔️', title: '战斗', desc: '挑战敌人，获得奖励' },
  { page: '/pages/team/index', icon: '👥', title: '队伍', desc: '管理你的旅伴' },
  { page: '/pages/inventory/index', icon: '🎒', title: '背包', desc: '查看和管理物品' },
  { page: '/pages/skill/index', icon: '✨', title: '技能', desc: '学习和装备技能' },
  { page: '/pages/card/index', icon: '🃏', title: '卡牌', desc: '收集和抽取卡牌' },
  { page: '/pages/prestige/index', icon: '🔄', title: '轮回', desc: '重置一切获得永久加成' },
  { page: '/pages/event/index', icon: '📜', title: '事件', desc: '旅途中触发的各种事件' },
  { page: '/pages/pet/index', icon: '🐾', title: '宠物', desc: '可爱的旅途伙伴' },
];

function formatPlayTime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)} 秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h} 小时 ${m} 分钟`;
}

export default function InfoPage() {
  const { level, exp, expToNext, gold, gems, totalMileage, playTime, prestigeCount, playerId } =
    useGameStore();
  const { musicEnabled, soundEnabled, vibrationEnabled, toggleMusic, toggleSound, toggleVibration, clearData } =
    useSettingsStore();
  const [activeTab, setActiveTab] = useState<InfoTab>('stats');
  const [syncState, setSyncState] = useState<SyncState>(gameSyncManager.getState());
  const [syncStats, setSyncStats] = useState(gameSyncManager.getStats());

  // 每 3 秒刷新同步状态和统计
  useEffect(() => {
    const timer = setInterval(() => {
      setSyncState(gameSyncManager.getState());
      setSyncStats(gameSyncManager.getStats());
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const progressPct = expToNext > 0 ? Math.round((exp / expToNext) * 100) : 0;

  // 同步状态显示
  const syncDisplay: Record<SyncState, { label: string; color: string }> = {
    idle: { label: '已连接', color: '#52c41a' },
    syncing: { label: '同步中…', color: '#1890ff' },
    error: { label: '连接异常', color: '#faad14' },
    offline: { label: '离线', color: '#ff4d4f' },
  };
  const isLoggedIn = !!getToken();
  const currentSync = syncDisplay[syncState];

  /** 格式化时间戳 */
  const formatTime = (ts: number): string => {
    if (!ts) return '--';
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  return (
    <View className='info-page fade-in'>
      {/* 页面标题 */}
      <View className='info-header'>
        <Text className='info-header-title'>信息</Text>
        <Text className='info-header-sub'>旅人档案</Text>
      </View>

      {/* Tab 切换 */}
      <View className='info-tabs'>
        {TAB_OPTIONS.map((tab) => (
          <View
            key={tab.key}
            className={`info-tab ${activeTab === tab.key ? 'info-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <Text className='info-tab-text'>{tab.label}</Text>
          </View>
        ))}
      </View>

      {/* 内容区 */}
      <ScrollView className='info-content' scrollY enhanced bounces={false}>
        {activeTab === 'stats' && (
          <View className='stats-section'>
            {/* 等级卡片 */}
            <View className='stat-block'>
              <View className='stat-block-header'>
                <Text className='stat-block-label'>等 级</Text>
                <Text className='stat-block-value'>Lv.{level}</Text>
              </View>
              <View className='stat-bar-track'>
                <View
                  className='stat-bar-fill'
                  style={{ width: `${progressPct}%` }}
                />
              </View>
              <Text className='stat-bar-label'>
                {exp.toLocaleString()} / {expToNext.toLocaleString()} ({progressPct}%)
              </Text>
            </View>

            {/* 资源列表 */}
            <View className='stat-row'>
              <View className='stat-cell'>
                <Text className='stat-cell-label'>🪙 金币</Text>
                <Text className='stat-cell-value'>{gold.toLocaleString()}</Text>
              </View>
              <View className='stat-cell'>
                <Text className='stat-cell-label'>💎 钻石</Text>
                <Text className='stat-cell-value'>{gems.toLocaleString()}</Text>
              </View>
            </View>

            <View className='stat-row'>
              <View className='stat-cell'>
                <Text className='stat-cell-label'>📏 总里程</Text>
                <Text className='stat-cell-value'>{totalMileage.toFixed(1)} km</Text>
              </View>
              <View className='stat-cell'>
                <Text className='stat-cell-label'>⏱ 游玩时间</Text>
                <Text className='stat-cell-value'>{formatPlayTime(playTime)}</Text>
              </View>
            </View>

            <View className='stat-row'>
              <View className='stat-cell'>
                <Text className='stat-cell-label'>🔄 轮回次数</Text>
                <Text className='stat-cell-value'>{prestigeCount}</Text>
              </View>
              <View className='stat-cell'>
                <Text className='stat-cell-label'>🏅 成就</Text>
                <Text className='stat-cell-value'>0</Text>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'hub' && (
          <View className='hub-section'>
            <Text className='hub-section-title'>🎮 游戏功能</Text>
            <View className='hub-grid'>
              {HUB_ITEMS.map((item, i) => (
                <Navigator key={i} url={item.page} className='hub-card' openType='navigate'>
                  <Text className='hub-card-icon'>{item.icon}</Text>
                  <Text className='hub-card-title'>{item.title}</Text>
                  <Text className='hub-card-desc'>{item.desc}</Text>
                </Navigator>
              ))}
            </View>
          </View>
        )}

        {activeTab === 'achievements' && (
          <View className='empty-section'>
            <Text className='empty-icon'>🏆</Text>
            <Text className='empty-title'>暂无成就</Text>
            <Text className='empty-desc'>踏上旅途，成就自会解锁</Text>
          </View>
        )}

        {activeTab === 'log' && (
          <View className='empty-section'>
            <Text className='empty-icon'>📜</Text>
            <Text className='empty-title'>暂无日志</Text>
            <Text className='empty-desc'>旅途中的故事将记录于此</Text>
          </View>
        )}

        {activeTab === 'settings' && (
          <View className='settings-section'>
            {/* 音频设置 */}
            <View className='settings-group'>
              <Text className='settings-group-title'>🔊 音频</Text>
              <View className='settings-item'>
                <View className='settings-item-info'>
                  <Text className='settings-item-label'>背景音乐</Text>
                  <Text className='settings-item-desc'>播放旅途背景音乐</Text>
                </View>
                <View
                  className={`settings-toggle ${musicEnabled ? 'settings-toggle--on' : ''}`}
                  onClick={toggleMusic}
                >
                  <View className='settings-toggle-knob' />
                </View>
              </View>
              <View className='settings-item'>
                <View className='settings-item-info'>
                  <Text className='settings-item-label'>音效</Text>
                  <Text className='settings-item-desc'>战斗、交互等音效</Text>
                </View>
                <View
                  className={`settings-toggle ${soundEnabled ? 'settings-toggle--on' : ''}`}
                  onClick={toggleSound}
                >
                  <View className='settings-toggle-knob' />
                </View>
              </View>
            </View>

            {/* 其他设置 */}
            <View className='settings-group'>
              <Text className='settings-group-title'>📱 其他</Text>
              <View className='settings-item'>
                <View className='settings-item-info'>
                  <Text className='settings-item-label'>震动反馈</Text>
                  <Text className='settings-item-desc'>操作时震动提示</Text>
                </View>
                <View
                  className={`settings-toggle ${vibrationEnabled ? 'settings-toggle--on' : ''}`}
                  onClick={toggleVibration}
                >
                  <View className='settings-toggle-knob' />
                </View>
              </View>
            </View>

            {/* 服务器状态 */}
            <View className='settings-group'>
              <Text className='settings-group-title'>🌐 服务器</Text>
              <View className='settings-item'>
                <View className='settings-item-info'>
                  <Text className='settings-item-label'>连接状态</Text>
                  <Text className='settings-item-desc'>
                    {isLoggedIn ? '已登录，数据自动同步' : '未登录，仅本地存档'}
                  </Text>
                </View>
                <View className='settings-sync-status'>
                  <View
                    className='settings-sync-dot'
                    style={{ backgroundColor: currentSync.color }}
                  />
                  <Text
                    className='settings-sync-text'
                    style={{ color: currentSync.color }}
                  >
                    {currentSync.label}
                  </Text>
                </View>
              </View>
              {isLoggedIn && (
                <>
                  {/* 服务器地址 */}
                  <View className='settings-info-row'>
                    <Text className='settings-info-label'>服务器</Text>
                    <Text className='settings-info-value'>{API_BASE}</Text>
                  </View>
                  {/* 玩家 ID */}
                  <View className='settings-info-row'>
                    <Text className='settings-info-label'>玩家 ID</Text>
                    <Text className='settings-info-value'>#{playerId || syncStats.playerId || '--'}</Text>
                  </View>
                  {/* 上次同步 */}
                  <View className='settings-info-row'>
                    <Text className='settings-info-label'>上次同步</Text>
                    <Text className='settings-info-value'>{formatTime(syncStats.lastSyncTime)}</Text>
                  </View>
                  {/* 延迟 */}
                  <View className='settings-info-row'>
                    <Text className='settings-info-label'>延迟</Text>
                    <Text className='settings-info-value'>
                      {syncStats.lastSyncLatencyMs > 0 ? `${syncStats.lastSyncLatencyMs}ms` : '--'}
                    </Text>
                  </View>
                  {/* 同步统计 */}
                  <View className='settings-info-row'>
                    <Text className='settings-info-label'>同步次数</Text>
                    <Text className='settings-info-value'>
                      成功 {syncStats.totalSyncCount} / 失败 {syncStats.totalErrorCount}
                    </Text>
                  </View>
                  {/* 同步周期 */}
                  <View className='settings-info-row'>
                    <Text className='settings-info-label'>存档上传</Text>
                    <Text className='settings-info-value'>每 {syncStats.syncCycleCount % 5} / 5 次同步</Text>
                  </View>
                  {/* 错误信息 */}
                  {syncStats.lastErrorMessage && (
                    <View className='settings-info-row'>
                      <Text className='settings-info-label'>错误</Text>
                      <Text className='settings-info-value' style={{ color: '#ff4d4f', fontSize: '12px' }}>
                        {syncStats.lastErrorMessage}
                      </Text>
                    </View>
                  )}
                </>
              )}
              {!isLoggedIn && (
                <View className='settings-item'>
                  <Text className='settings-item-desc' style={{ color: '#999', fontSize: '12px' }}>
                    登录后数据将自动同步到云端
                  </Text>
                </View>
              )}
            </View>

            {/* 危险操作 */}
            <View className='settings-group settings-group--danger'>
              <Text className='settings-group-title'>⚠️ 数据管理</Text>
              <View className='settings-item'>
                <View className='settings-item-info'>
                  <Text className='settings-item-label'>清除所有数据</Text>
                  <Text className='settings-item-desc'>重置游戏进度，此操作不可撤销</Text>
                </View>
              </View>
              <View className='settings-danger-btn' onClick={clearData}>
                <Text className='settings-danger-btn-text'>清除数据</Text>
              </View>
            </View>

            {/* 关于 */}
            <View className='settings-group'>
              <Text className='settings-group-title'>ℹ️ 关于</Text>
              <View className='settings-about'>
                <Text className='settings-about-app-name'>旅途 — 挂机放置游戏</Text>
                <Text className='settings-about-version'>版本 1.0.0</Text>
                <Text className='settings-about-desc'>
                  踏上旅途，探索未知世界。收集资源，招募伙伴，不断变强。
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
