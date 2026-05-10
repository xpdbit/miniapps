import { View, Text, ScrollView } from '@tarojs/components';
import { useState, useEffect } from 'react';
import { useAchievementStore, useGameStore } from '../../stores';
import type { AchievementData, TaskData } from '../../stores';
import './index.module.scss';

/* ============================================================
   演示数据 — 成就
   ============================================================ */

const DEMO_ACHIEVEMENTS: AchievementData[] = [
  {
    id: 'travel_1',
    name: '初次启程',
    description: '完成第一次旅行',
    category: 'travel',
    isUnlocked: true,
    unlockedAt: Date.now() - 86400000 * 5,
    progress: 1,
    target: 1,
  },
  {
    id: 'travel_2',
    name: '旅途达人',
    description: '累计旅行 10 次',
    category: 'travel',
    isUnlocked: false,
    progress: 4,
    target: 10,
  },
  {
    id: 'travel_3',
    name: '千里之行',
    description: '累计里程达到 100',
    category: 'travel',
    isUnlocked: false,
    progress: 35,
    target: 100,
  },
  {
    id: 'combat_1',
    name: '初露锋芒',
    description: '赢得第一场战斗',
    category: 'combat',
    isUnlocked: true,
    unlockedAt: Date.now() - 86400000 * 3,
    progress: 1,
    target: 1,
  },
  {
    id: 'combat_2',
    name: '百战勇士',
    description: '累计赢得 10 场战斗',
    category: 'combat',
    isUnlocked: false,
    progress: 3,
    target: 10,
  },
  {
    id: 'combat_3',
    name: '无双战将',
    description: '累计赢得 50 场战斗',
    category: 'combat',
    isUnlocked: false,
    progress: 3,
    target: 50,
  },
  {
    id: 'collect_1',
    name: '收藏家',
    description: '收集 5 种不同物品',
    category: 'collection',
    isUnlocked: false,
    progress: 2,
    target: 5,
  },
  {
    id: 'collect_2',
    name: '宝库',
    description: '收集 20 种不同物品',
    category: 'collection',
    isUnlocked: false,
    progress: 2,
    target: 20,
  },
  {
    id: 'prestige_1',
    name: '新生',
    description: '完成第一次轮回',
    category: 'prestige',
    isUnlocked: false,
    progress: 0,
    target: 1,
  },
  {
    id: 'prestige_2',
    name: '不朽',
    description: '完成 5 次轮回',
    category: 'prestige',
    isUnlocked: false,
    progress: 0,
    target: 5,
  },
];

/* ============================================================
   演示数据 — 任务
   ============================================================ */

const DAILY_TASKS: TaskData[] = [
  {
    id: 'daily_1',
    name: '旅途',
    description: '完成 3 次旅行',
    type: 'daily',
    progress: 1,
    target: 3,
    reward: { gold: 30, exp: 20 },
    isCompleted: false,
    isClaimed: false,
    expiresAt: Date.now() + 86400000,
  },
  {
    id: 'daily_2',
    name: '战斗',
    description: '赢得 2 场战斗',
    type: 'daily',
    progress: 0,
    target: 2,
    reward: { gold: 40, exp: 25, gems: 5 },
    isCompleted: false,
    isClaimed: false,
    expiresAt: Date.now() + 86400000,
  },
  {
    id: 'daily_3',
    name: '收集',
    description: '收集 5 个资源',
    type: 'daily',
    progress: 3,
    target: 5,
    reward: { gold: 20, exp: 15 },
    isCompleted: false,
    isClaimed: false,
    expiresAt: Date.now() + 86400000,
  },
];

const WEEKLY_TASKS: TaskData[] = [
  {
    id: 'weekly_1',
    name: '长途跋涉',
    description: '完成 15 次旅行',
    type: 'weekly',
    progress: 4,
    target: 15,
    reward: { gold: 150, exp: 100, gems: 10 },
    isCompleted: false,
    isClaimed: false,
    expiresAt: Date.now() + 604800000,
  },
  {
    id: 'weekly_2',
    name: '战争机器',
    description: '赢得 10 场战斗',
    type: 'weekly',
    progress: 3,
    target: 10,
    reward: { gold: 200, exp: 150 },
    isCompleted: false,
    isClaimed: false,
    expiresAt: Date.now() + 604800000,
  },
  {
    id: 'weekly_3',
    name: '收藏大师',
    description: '收集 30 个资源',
    type: 'weekly',
    progress: 8,
    target: 30,
    reward: { gold: 100, exp: 80, gems: 15 },
    isCompleted: false,
    isClaimed: false,
    expiresAt: Date.now() + 604800000,
  },
  {
    id: 'weekly_4',
    name: '成长之路',
    description: '达到 10 级',
    type: 'weekly',
    progress: 5,
    target: 10,
    reward: { gold: 300, exp: 200, gems: 20 },
    isCompleted: false,
    isClaimed: false,
    expiresAt: Date.now() + 604800000,
  },
  {
    id: 'weekly_5',
    name: '轮回试炼',
    description: '完成一次轮回',
    type: 'weekly',
    progress: 0,
    target: 1,
    reward: { gold: 0, exp: 0, gems: 50 },
    isCompleted: false,
    isClaimed: false,
    expiresAt: Date.now() + 604800000,
  },
];

/* ============================================================
   分类元数据
   ============================================================ */

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  travel: { label: '旅行', icon: '🗺️' },
  combat: { label: '战斗', icon: '⚔️' },
  collection: { label: '收集', icon: '📦' },
  prestige: { label: '轮回', icon: '🔄' },
};

/* ============================================================
   工具函数
   ============================================================ */

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days} 天前`;
  return `${Math.floor(days / 7)} 周前`;
}

function sortAchievements(achs: AchievementData[]): AchievementData[] {
  return [...achs].sort((a, b) => {
    if (a.isUnlocked !== b.isUnlocked) {
      return a.isUnlocked ? -1 : 1;
    }
    const aPct = a.target > 0 ? a.progress / a.target : 0;
    const bPct = b.target > 0 ? b.progress / b.target : 0;
    return bPct - aPct;
  });
}

/* ============================================================
   组件
   ============================================================ */

export default function AchievementPage() {
  const [activeTab, setActiveTab] = useState<
    'achievements' | 'tasks'
  >('achievements');

  const {
    achievements,
    tasks,
    recentUnlocks,
    setAchievements,
    setTasks,
    claimTask,
    clearRecentUnlocks,
  } = useAchievementStore();
  const { addGold, addExp, addGems } = useGameStore();

  /* ============================================================
     初始化演示数据
     ============================================================ */

  useEffect(() => {
    if (achievements.length === 0) {
      setAchievements(DEMO_ACHIEVEMENTS);
    }
    if (tasks.length === 0) {
      setTasks([...DAILY_TASKS, ...WEEKLY_TASKS]);
    }
  }, [achievements.length, tasks.length, setAchievements, setTasks]);

  /* ============================================================
     领取任务奖励
     ============================================================ */

  const handleClaim = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !task.isCompleted || task.isClaimed) return;

    claimTask(taskId);
    addGold(task.reward.gold);
    addExp(task.reward.exp);
    if (task.reward.gems) {
      addGems(task.reward.gems);
    }
  };

  /* ============================================================
     计算属性
     ============================================================ */

  const dailyTasks = tasks.filter((t) => t.type === 'daily');
  const weeklyTasks = tasks.filter((t) => t.type === 'weekly');

  const groupedAchievements: Record<string, AchievementData[]> = {};
  for (const ach of achievements) {
    const cat = ach.category || 'other';
    if (!groupedAchievements[cat]) {
      groupedAchievements[cat] = [];
    }
    groupedAchievements[cat].push(ach);
  }

  const recentAchievementNames = achievements
    .filter((a) => recentUnlocks.includes(a.id))
    .map((a) => a.name);

  const hasUnlockedAchievements = achievements.some((a) => a.isUnlocked);

  const dailyClaimedCount = dailyTasks.filter((t) => t.isClaimed).length;
  const weeklyClaimedCount = weeklyTasks.filter((t) => t.isClaimed).length;

  /* ============================================================
     渲染
     ============================================================ */

  return (
    <View className='achievement-page'>
      {/* ===== 标签栏 ===== */}
      <View className='tab-bar'>
        <View
          className={`tab ${activeTab === 'achievements' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('achievements')}
        >
          <Text className='tab-text'>
            成就 ({achievements.filter((a) => a.isUnlocked).length}
            /{achievements.length})
          </Text>
        </View>
        <View
          className={`tab ${activeTab === 'tasks' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          <Text className='tab-text'>
            任务 ({dailyClaimedCount + weeklyClaimedCount}/
            {dailyTasks.length + weeklyTasks.length})
          </Text>
        </View>
        <View
          className='tab-indicator'
          style={{
            left: activeTab === 'achievements' ? '0%' : '50%',
          }}
        />
      </View>

      {/* ===== 内容 ===== */}
      <ScrollView className='content-scroll' scrollY>
        {activeTab === 'achievements' ? (
          /* ---- 成就列表 ---- */
          <>
            {/* 最近解锁 */}
            {recentAchievementNames.length > 0 && (
              <View className='recent-section'>
                <View className='recent-header'>
                  <Text className='recent-label'>✨ 新解锁</Text>
                  <Text
                    className='recent-clear'
                    onClick={clearRecentUnlocks}
                  >
                    清除
                  </Text>
                </View>
                {recentAchievementNames.map((name) => (
                  <Text key={name} className='recent-chip'>
                    {name}
                  </Text>
                ))}
              </View>
            )}

            {/* 分组成就 */}
            {achievements.length === 0 ? (
              <View className='empty-state'>
                <Text className='empty-icon'>🗺️</Text>
                <Text className='empty-text'>
                  踏上旅途，解锁属于你的成就！
                </Text>
              </View>
            ) : (
              Object.entries(groupedAchievements).map(
                ([category, achs]) => {
                  const meta = CATEGORY_META[category] || {
                    label: category,
                    icon: '🏷️',
                  };
                  const unlockedCount = achs.filter(
                    (a) => a.isUnlocked,
                  ).length;

                  if (sortAchievements(achs).length === 0) return null;

                  return (
                    <View key={category} className='achievement-group'>
                      <View className='category-header'>
                        <Text className='category-icon'>{meta.icon}</Text>
                        <Text className='category-title'>{meta.label}</Text>
                        <Text className='category-count'>
                          {unlockedCount}/{achs.length}
                        </Text>
                      </View>

                      {sortAchievements(achs).map((ach) => {
                        const pct =
                          ach.target > 0
                            ? Math.min((ach.progress / ach.target) * 100, 100)
                            : 0;
                        const isLocked = !ach.isUnlocked;

                        return (
                          <View
                            key={ach.id}
                            className={`achievement-card ${ach.isUnlocked ? 'achievement-card--unlocked' : ''}`}
                          >
                            <View
                              className={`ach-left-border ach-left-border--${category}`}
                            />

                            <View className='ach-icon-area'>
                              <Text
                                className={`ach-icon ${isLocked ? 'ach-icon--locked' : ''}`}
                              >
                                {ach.isUnlocked
                                  ? meta.icon
                                  : '🔒'}
                              </Text>
                            </View>

                            <View className='ach-info'>
                              <View className='ach-top'>
                                <Text className='ach-name'>
                                  {ach.name}
                                </Text>
                                <Text
                                  className={`ach-badge ${ach.isUnlocked ? 'ach-badge--unlocked' : 'ach-badge--locked'}`}
                                >
                                  {ach.isUnlocked ? '✓ 已解锁' : '未解锁'}
                                </Text>
                              </View>

                              {!ach.isUnlocked && (
                                <Text className='ach-desc'>
                                  {ach.description}
                                </Text>
                              )}
                              {ach.isUnlocked && ach.unlockedAt && (
                                <Text className='ach-desc'>
                                  {formatTime(ach.unlockedAt)} 解锁
                                </Text>
                              )}

                              {!ach.isUnlocked && (
                                <View className='ach-progress-area'>
                                  <Text className='ach-progress-text'>
                                    {ach.progress}/{ach.target}
                                  </Text>
                                  <View className='ach-progress-track'>
                                    <View
                                      className='ach-progress-fill'
                                      style={{ width: `${pct}%` }}
                                    />
                                  </View>
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  );
                },
              )
            )}

            {/* 全部解锁的祝贺 */}
            {hasUnlockedAchievements &&
              achievements.every((a) => a.isUnlocked) && (
                <View className='empty-state'>
                  <Text className='empty-icon'>🌟</Text>
                  <Text className='empty-text'>
                    太棒了！你解锁了所有成就！
                  </Text>
                </View>
              )}
          </>
        ) : (
          /* ---- 任务列表 ---- */
          <>
            {/* 每日任务 */}
            <Text className='task-section-title'>
              每日任务
              {dailyTasks.length > 0 &&
                ` (${dailyTasks.filter((t) => t.isCompleted).length}/${dailyTasks.length})`}
            </Text>

            {dailyTasks.length === 0 ? (
              <View className='empty-state'>
                <Text className='empty-icon'>📋</Text>
                <Text className='empty-text'>
                  暂无每日任务，请稍后再来查看。
                </Text>
              </View>
            ) : (
              dailyTasks.map((task) => renderTaskCard(task, handleClaim))
            )}

            {/* 每周任务 */}
            <Text className='task-section-title'>
              每周任务
              {weeklyTasks.length > 0 &&
                ` (${weeklyTasks.filter((t) => t.isCompleted).length}/${weeklyTasks.length})`}
            </Text>

            {weeklyTasks.length === 0 ? (
              <View className='empty-state'>
                <Text className='empty-icon'>📅</Text>
                <Text className='empty-text'>
                  暂无每周任务，请稍后再来查看。
                </Text>
              </View>
            ) : (
              weeklyTasks.map((task) => renderTaskCard(task, handleClaim))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* ============================================================
   渲染任务卡片（独立渲染函数）
   ============================================================ */

function renderTaskCard(
  task: TaskData,
  onClaim: (id: string) => void,
) {
  const pct =
    task.target > 0
      ? Math.min((task.progress / task.target) * 100, 100)
      : 0;
  const isClaimable = task.isCompleted && !task.isClaimed;

  return (
    <View
      key={task.id}
      className={`task-card ${task.isCompleted ? 'task-card--completed' : ''} ${task.isClaimed ? 'task-card--claimed' : ''}`}
    >
      {/* 顶部：名称 + 奖励 */}
      <View className='task-top'>
        <View className='task-info'>
          <Text className='task-name'>{task.name}</Text>
          <Text className='task-desc'>{task.description}</Text>
        </View>

        <View className='task-rewards'>
          <Text className='task-reward-tag'>✦{task.reward.gold}</Text>
          <Text className='task-reward-tag'>✧{task.reward.exp}</Text>
          {task.reward.gems && (
            <Text className='task-reward-tag task-reward-tag--gems'>
              ◇{task.reward.gems}
            </Text>
          )}
        </View>
      </View>

      {/* 进度条 */}
      <View className='task-middle'>
        <View className='task-progress'>
          <Text className='task-progress-text'>
            {task.progress}/{task.target}
          </Text>
          <View className='task-progress-track'>
            <View
              className='task-progress-fill'
              style={{ width: `${pct}%` }}
            />
          </View>
        </View>
      </View>

      {/* 领取按钮 */}
      <View className='task-claim-area'>
        {isClaimable ? (
          <View
            className='task-claim-btn task-claim-btn--ready'
            onClick={() => onClaim(task.id)}
          >
            <Text>领取奖励</Text>
          </View>
        ) : task.isClaimed ? (
          <View className='task-claim-btn task-claim-btn--done'>
            <Text>✓ 已领取</Text>
          </View>
        ) : (
          <View className='task-claim-btn task-claim-btn--done'>
            <Text>进行中</Text>
          </View>
        )}
      </View>
    </View>
  );
}
