import { useState, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import './index.module.scss';

// ============================================================
// 类型定义
// ============================================================

type EventType = 'battle' | 'discovery' | 'trade' | 'story' | 'rest' | 'treasure' | 'choice';

interface EventChoice {
  id: string;
  text: string;
  outcome: string;
  rewards?: EventReward[];
  nextEventId?: string;
}

interface EventReward {
  icon: string;
  label: string;
  value: number;
}

interface GameEvent {
  id: string;
  title: string;
  icon: string;
  type: EventType;
  description: string;
  narrative: string;
  choices: EventChoice[];
}

interface PendingEvent {
  id: string;
  title: string;
  icon: string;
  type: EventType;
  description: string;
}

interface HistoryEntry {
  id: string;
  title: string;
  icon: string;
  type: EventType;
  choice: string;
  outcome: string;
  timestamp: string;
  rewards?: EventReward[];
}

// ============================================================
// 常量配置
// ============================================================

const TYPE_CONFIG: Record<EventType, { label: string; color: string }> = {
  battle: { label: '战斗', color: 'var(--color-error)' },
  discovery: { label: '探索', color: 'var(--color-success)' },
  trade: { label: '交易', color: 'var(--color-primary)' },
  story: { label: '剧情', color: 'var(--color-info)' },
  rest: { label: '休息', color: 'var(--rarity-uncommon)' },
  treasure: { label: '寻宝', color: 'var(--color-warning)' },
  choice: { label: '抉择', color: 'var(--color-primary)' },
};

const TYPE_BG: Record<EventType, string> = {
  battle: 'var(--color-error-bg)',
  discovery: 'var(--color-success-bg)',
  trade: 'var(--color-primary-bg)',
  story: 'var(--color-info-bg)',
  rest: 'rgba(122, 158, 107, 0.10)',
  treasure: 'var(--color-warning-bg)',
  choice: 'var(--color-primary-bg)',
};

// ============================================================
// 占位数据
// ============================================================

const PLACEHOLDER_EVENT: GameEvent = {
  id: 'event_001',
  title: '神秘商人',
  icon: '🧳',
  type: 'trade',
  description: '一位旅行商人出现在路边',
  narrative:
    '你沿着蜿蜒的小路前行，忽然看到路边停着一辆装饰华丽的马车。\n\n车旁站着一位身披斗篷的商人，他的面前摆放着各种闪闪发光的商品。\n\n「旅行者，我看你风尘仆仆，想必需要一些补给吧？」商人微笑着向你招手。',
  choices: [
    {
      id: 'c1',
      text: '购买补给品（花费 50 金币）',
      outcome: '你用金币换取了充足的补给，士气提振！',
      rewards: [{ icon: '❤️', label: '士气', value: 20 }, { icon: '🍞', label: '食物', value: 30 }],
    },
    {
      id: 'c2',
      text: '打听消息',
      outcome: '商人告诉你前方有一座废弃神庙，据说藏有宝物。新的目的地已标注在地图上。',
      rewards: [{ icon: '🗺️', label: '情报', value: 1 }],
    },
    {
      id: 'c3',
      text: '无视，继续前进',
      outcome: '你谢绝了商人的好意，继续踏上旅途。前方似乎有动静……',
    },
  ],
};

const PLACEHOLDER_PENDING: PendingEvent[] = [
  { id: 'pend_1', title: '废弃神庙', icon: '🏛️', type: 'discovery', description: '一座古老的神庙遗迹，可能藏有宝藏' },
  { id: 'pend_2', title: '强盗伏击', icon: '🗡️', type: 'battle', description: '前方道路有强盗出没，需小心应对' },
  { id: 'pend_3', title: '迷路的小猫', icon: '🐱', type: 'story', description: '路边有一只迷路的小猫，似乎在求救' },
];

const PLACEHOLDER_HISTORY: HistoryEntry[] = [
  {
    id: 'hist_1', title: '穿越密林', icon: '🌲', type: 'discovery',
    choice: '谨慎前行', outcome: '你成功地穿过了密林，发现了一片隐蔽的果园。',
    timestamp: '2小时前',
    rewards: [{ icon: '🍎', label: '食物', value: 15 }, { icon: '✨', label: '经验', value: 50 }],
  },
  {
    id: 'hist_2', title: '山贼来袭', icon: '⚔️', type: 'battle',
    choice: '迎战', outcome: '你击退了山贼，缴获了一些财物。', timestamp: '5小时前',
    rewards: [{ icon: '💰', label: '金币', value: 80 }],
  },
  {
    id: 'hist_3', title: '河边休憩', icon: '🏞️', type: 'rest',
    choice: '休息恢复', outcome: '你在河边扎营休息，队伍恢复了体力。', timestamp: '昨天',
    rewards: [{ icon: '❤️', label: '士气', value: 30 }],
  },
];

// ============================================================
// 子组件
// ============================================================

function EventTypeBadge({ type }: { type: EventType }) {
  const config = TYPE_CONFIG[type];
  return (
    <View className='event-type-badge' style={{ background: config.color }}>
      <Text className='event-type-badge-text'>{config.label}</Text>
    </View>
  );
}

function RewardsRow({ rewards }: { rewards: EventReward[] }) {
  if (!rewards || rewards.length === 0) return null;
  return (
    <View className='event-rewards'>
      {rewards.map((r, i) => (
        <View key={i} className='reward-item'>
          <Text className='reward-icon'>{r.icon}</Text>
          <Text className='reward-value'>+{r.value}</Text>
        </View>
      ))}
    </View>
  );
}

// ============================================================
// 页面组件
// ============================================================

export default function EventPage() {
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [currentEvent, setCurrentEvent] = useState<GameEvent | null>(PLACEHOLDER_EVENT);
  const [pendingEvents, setPendingEvents] = useState<PendingEvent[]>(PLACEHOLDER_PENDING);
  const [history, setHistory] = useState<HistoryEntry[]>(PLACEHOLDER_HISTORY);
  const [selectedChoice, setSelectedChoice] = useState<EventChoice | null>(null);
  const [detailEvent, setDetailEvent] = useState<HistoryEntry | null>(null);

  const handleChoose = useCallback((choice: EventChoice) => {
    setSelectedChoice(choice);
    if (!currentEvent) return;
    const entry: HistoryEntry = {
      id: `h_${Date.now()}`,
      title: currentEvent.title,
      icon: currentEvent.icon,
      type: currentEvent.type,
      choice: choice.text,
      outcome: choice.outcome,
      timestamp: '刚刚',
      rewards: choice.rewards,
    };
    setHistory((prev) => [entry, ...prev]);
  }, [currentEvent]);

  const handleContinue = useCallback(() => {
    setSelectedChoice(null);
    setCurrentEvent(null);
  }, []);

  const handleBatchResolve = useCallback(() => {
    if (pendingEvents.length === 0) return;
    const entries: HistoryEntry[] = pendingEvents.map((pe) => ({
      id: `h_batch_${pe.id}_${Date.now()}`,
      title: pe.title,
      icon: pe.icon,
      type: pe.type,
      choice: '自动处理',
      outcome: `事件「${pe.title}」已完成。`,
      timestamp: '刚刚',
      rewards: [{ icon: '✨', label: '经验', value: 10 }],
    }));
    setHistory((prev) => [...entries, ...prev]);
    setPendingEvents([]);
  }, [pendingEvents]);

  const handleProcessPending = useCallback((e: PendingEvent) => {
    setPendingEvents((prev) => prev.filter((p) => p.id !== e.id));
    setCurrentEvent({
      id: `event_${e.id}`,
      title: e.title,
      icon: e.icon,
      type: e.type,
      description: e.description,
      narrative: `你遇到了新的情况：${e.description}\n\n你该如何应对？`,
      choices: [
        { id: 'dc1', text: '谨慎应对', outcome: '你小心处理，顺利度过了这次事件。', rewards: [{ icon: '✨', label: '经验', value: 20 }] },
        { id: 'dc2', text: '勇敢前进', outcome: '你大胆行动，虽然有些波折但最终收获颇丰。', rewards: [{ icon: '💰', label: '金币', value: 30 }, { icon: '✨', label: '经验', value: 15 }] },
      ],
    });
    setSelectedChoice(null);
  }, []);

  const historyGroups = history.reduce<Record<string, HistoryEntry[]>>((acc, entry) => {
    const t = entry.type;
    if (!acc[t]) acc[t] = [];
    acc[t].push(entry);
    return acc;
  }, {});

  // ============================================================
  // 当前事件视图
  // ============================================================

  const renderActiveEvent = () => {
    if (!currentEvent) {
      return (
        <View className='empty-state'>
          <Text className='empty-icon'>🗺️</Text>
          <Text className='empty-title'>暂无进行中事件</Text>
          <Text className='empty-hint'>继续旅行可能会触发新事件</Text>
        </View>
      );
    }

    return (
      <View className='active-event-section'>
        <Text className='section-label'>进行中事件</Text>
        <View className='active-event' style={{ borderColor: TYPE_CONFIG[currentEvent.type].color }}>
          {/* Banner */}
          <View className='active-event-banner'>
            <View className='active-event-icon-wrap' style={{ background: TYPE_BG[currentEvent.type] }}>
              <Text className='active-event-icon'>{currentEvent.icon}</Text>
            </View>
            <View className='active-event-info'>
              <View className='active-event-header'>
                <Text className='active-event-title'>{currentEvent.title}</Text>
                <EventTypeBadge type={currentEvent.type} />
              </View>
              <Text className='active-event-desc'>{currentEvent.description}</Text>
            </View>
          </View>

          {/* 叙事文本 */}
          <View className='event-narrative'>
            <Text className='event-narrative-text'>{currentEvent.narrative}</Text>
          </View>

          {/* 选择结果 */}
          {selectedChoice && (
            <View className='choice-outcome'>
              <Text className='outcome-text'>{selectedChoice.outcome}</Text>
              {selectedChoice.rewards && selectedChoice.rewards.length > 0 && (
                <>
                  <View className='outcome-divider' />
                  <RewardsRow rewards={selectedChoice.rewards} />
                </>
              )}
              <View className='outcome-divider' />
              <Text className='outcome-hint'>— 点击下方按钮继续旅程 —</Text>
            </View>
          )}

          {/* 选项 */}
          {!selectedChoice && (
            <View className='event-choices'>
              <Text className='choices-title'>— 选择你的行动 —</Text>
              {currentEvent.choices.map((choice) => (
                <View key={choice.id} className='choice-card' onClick={() => handleChoose(choice)}>
                  <Text className='choice-text'>{choice.text}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {selectedChoice && (
          <View className='detail-close' style={{ marginTop: 'var(--spacing-sm)' }} onClick={handleContinue}>
            <Text className='detail-close-text'>继续旅程</Text>
          </View>
        )}
      </View>
    );
  };

  // ============================================================
  // 待处理事件
  // ============================================================

  const renderPendingEvents = () => {
    if (pendingEvents.length === 0) return null;
    return (
      <View className='pending-section'>
        <View className='flex-between' style={{ marginBottom: 'var(--spacing-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text className='section-label'>待处理事件</Text>
          <View className='detail-close' style={{ margin: 0, padding: '6px 16px', width: 'auto' }} onClick={handleBatchResolve}>
            <Text className='detail-close-text'>批量完成</Text>
          </View>
        </View>
        <View className='pending-list'>
          {pendingEvents.map((pe) => (
            <View key={pe.id} className='pending-event' onClick={() => handleProcessPending(pe)}>
              <Text className='pending-event-icon'>{pe.icon}</Text>
              <View className='pending-event-info'>
                <View className='pending-event-header'>
                  <Text className='pending-event-title'>{pe.title}</Text>
                  <EventTypeBadge type={pe.type} />
                </View>
                <Text className='pending-event-desc'>{pe.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // ============================================================
  // 历史记录视图
  // ============================================================

  const renderHistory = () => {
    if (history.length === 0) {
      return (
        <View className='empty-state'>
          <Text className='empty-icon'>📜</Text>
          <Text className='empty-title'>暂无事件记录</Text>
          <Text className='empty-hint'>完成事件后将显示在这里</Text>
        </View>
      );
    }

    return (
      <View className='history-list'>
        {(Object.entries(historyGroups) as [EventType, HistoryEntry[]][]).map(([type, entries]) => (
          <View key={type} className='history-type-group'>
            <View className='history-type-header'>
              <View className='history-type-indicator' style={{ background: TYPE_CONFIG[type].color }} />
              <Text className='history-type-label'>{TYPE_CONFIG[type].label}</Text>
              <Text className='history-type-count'>{entries.length} 次</Text>
            </View>
            {entries.map((entry) => (
              <View key={entry.id} className='history-event' onClick={() => setDetailEvent(entry)}>
                <View className='history-event-main'>
                  <Text className='history-event-icon'>{entry.icon}</Text>
                  <View className='history-event-content'>
                    <View className='history-event-header'>
                      <Text className='history-event-title'>{entry.title}</Text>
                      <Text className='history-event-date'>{entry.timestamp}</Text>
                    </View>
                    <Text className='history-event-choice'>选择：{entry.choice}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  };

  // ============================================================
  // 详情浮层
  // ============================================================

  const renderDetailOverlay = () => {
    if (!detailEvent) return null;
    return (
      <View className='event-detail-overlay' onClick={() => setDetailEvent(null)}>
        <View className='event-detail-card' onClick={(e) => e.stopPropagation()}>
          <View className='detail-header'>
            <Text className='detail-icon'>{detailEvent.icon}</Text>
            <View className='detail-title-wrap'>
              <Text className='detail-title'>{detailEvent.title}</Text>
              <EventTypeBadge type={detailEvent.type} />
            </View>
          </View>
          <View className='detail-section'>
            <Text className='detail-section-title'>你的选择</Text>
            <View className='detail-choice-item'>
              <Text className='detail-choice-text'>{detailEvent.choice}</Text>
            </View>
          </View>
          <View className='detail-section'>
            <Text className='detail-section-title'>结果</Text>
            <Text className='detail-outcome'>{detailEvent.outcome}</Text>
          </View>
          {detailEvent.rewards && detailEvent.rewards.length > 0 && (
            <View className='detail-section'>
              <Text className='detail-section-title'>获得奖励</Text>
              <RewardsRow rewards={detailEvent.rewards} />
            </View>
          )}
          <View className='detail-close' onClick={() => setDetailEvent(null)}>
            <Text className='detail-close-text'>关闭</Text>
          </View>
        </View>
      </View>
    );
  };

  // ============================================================
  // 主渲染
  // ============================================================

  return (
    <View className='event-page fade-in'>
      <View className='event-header'>
        <Text className='page-title'>📜 事件</Text>
      </View>

      {/* Tabs */}
      <View className='event-tabs'>
        <View
          className={`event-tab ${activeTab === 'current' ? 'event-tab--active' : ''}`}
          onClick={() => setActiveTab('current')}
        >
          <Text className='event-tab-text'>当前</Text>
        </View>
        <View
          className={`event-tab ${activeTab === 'history' ? 'event-tab--active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <Text className='event-tab-text'>记录</Text>
        </View>
      </View>

      <ScrollView className='event-content' scrollY enhanced bounces={false}>
        {activeTab === 'current' ? (
          <>
            {renderActiveEvent()}
            {renderPendingEvents()}
          </>
        ) : (
          renderHistory()
        )}
      </ScrollView>

      {renderDetailOverlay()}
    </View>
  );
}
