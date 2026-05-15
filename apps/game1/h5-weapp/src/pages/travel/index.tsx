import { View, Text, ScrollView } from '@tarojs/components';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../../stores';
import { itemRegistry, InventoryEngine } from '../../engine';
import ProgressBar from '../../components/ProgressBar';
import Dialog from '../../components/Dialog';
import './index.module.scss';

/* ============================================================
   类型定义
   ============================================================ */

interface TravelRoute {
  id: string;
  name: string;
  description: string;
  /** 路程（触发到达所需 tick 数） */
  distance: number;
  minLevel: number;
  rewards: {
    gold: number;
    exp: number;
    mileage: number;
  };
}

interface LogEntry {
  id: number;
  text: string;
  type: 'info' | 'event' | 'reward' | 'warning';
}

interface TravelEvent {
  id: string;
  title: string;
  description: string;
  choices: Array<{
    label: string;
    value: string;
    effect: {
      stamina: number;
      food: number;
      morale: number;
      gold: number;
    };
    outcomeText: string;
  }>;
}

/* ============================================================
   路线数据
   ============================================================ */

const ROUTES: TravelRoute[] = [
  {
    id: 'greenwood',
    name: '翠绿森林',
    description: '穿过宁静的翠绿森林，采集草药和木材',
    distance: 30,
    minLevel: 1,
    rewards: { gold: 50, exp: 30, mileage: 10 },
  },
  {
    id: 'stonebridge',
    name: '石桥丘陵',
    description: '跨越古老的石桥，探索起伏的丘陵地带',
    distance: 45,
    minLevel: 2,
    rewards: { gold: 80, exp: 50, mileage: 18 },
  },
  {
    id: 'mistlake',
    name: '雾隐湖',
    description: '环绕迷雾笼罩的神秘湖泊，遭遇稀有生物',
    distance: 60,
    minLevel: 3,
    rewards: { gold: 120, exp: 80, mileage: 25 },
  },
  {
    id: 'dragonpass',
    name: '龙脊山口',
    description: '穿越险峻的龙脊山脉，需要充分的准备',
    distance: 90,
    minLevel: 5,
    rewards: { gold: 200, exp: 150, mileage: 40 },
  },
];

/* ============================================================
   随机事件数据
   ============================================================ */

const TRAVEL_EVENTS: TravelEvent[] = [
  {
    id: 'find_chest',
    title: '发现宝箱！',
    description: '路边草丛中发现了一个破旧的宝箱，里面似乎有东西在发光。',
    choices: [
      {
        label: '打开宝箱',
        value: 'open',
        effect: { stamina: -5, food: 0, morale: 10, gold: 30 },
        outcomeText: '宝箱里有一些金币！士气大振。',
      },
      {
        label: '小心绕开',
        value: 'skip',
        effect: { stamina: 0, food: 0, morale: 0, gold: 0 },
        outcomeText: '你谨慎地绕开了宝箱，继续前进。',
      },
    ],
  },
  {
    id: 'rainstorm',
    title: '暴风雨',
    description: '天空突然暗了下来，狂风夹杂着暴雨席卷而来！',
    choices: [
      {
        label: '找地方避雨',
        value: 'shelter',
        effect: { stamina: 10, food: -5, morale: -5, gold: 0 },
        outcomeText: '你找到了一个山洞避雨，恢复了体力但消耗了食物。',
      },
      {
        label: '冒雨前进',
        value: 'push',
        effect: { stamina: -15, food: 0, morale: 10, gold: 0 },
        outcomeText: '你咬牙在暴雨中前进，虽然很累但意志更加坚定。',
      },
    ],
  },
  {
    id: 'wanderer',
    title: '迷路的旅人',
    description: '一位疲惫不堪的旅人向你求助，希望能得到一些食物。',
    choices: [
      {
        label: '给予食物',
        value: 'help',
        effect: { stamina: 0, food: -10, morale: 15, gold: 0 },
        outcomeText: '旅人感激不尽，你的善举让队伍士气高涨。',
      },
      {
        label: '婉拒离开',
        value: 'ignore',
        effect: { stamina: 0, food: 0, morale: -5, gold: 0 },
        outcomeText: '你拒绝了旅人的请求，继续赶路。',
      },
    ],
  },
  {
    id: 'herb_garden',
    title: '草药园',
    description: '发现了一片野生草药园，空气中弥漫着清新的药草香。',
    choices: [
      {
        label: '采集草药',
        value: 'gather',
        effect: { stamina: -10, food: 0, morale: 5, gold: 20 },
        outcomeText: '你采集了一些珍贵的草药，可以在城镇卖出好价钱。',
      },
      {
        label: '原地休息',
        value: 'rest',
        effect: { stamina: 15, food: -5, morale: 10, gold: 0 },
        outcomeText: '大家在草药园旁休息了片刻，精神焕发。',
      },
    ],
  },
  {
    id: 'bandit',
    title: '遭遇山贼！',
    description: '几个山贼挡住了去路，想要收取"过路费"。',
    choices: [
      {
        label: '战斗击退',
        value: 'fight',
        effect: { stamina: -20, food: 0, morale: 10, gold: 15 },
        outcomeText: '经过一番搏斗，你们击退了山贼，还缴获了一些战利品！',
      },
      {
        label: '缴纳过路费',
        value: 'bribe',
        effect: { stamina: 0, food: 0, morale: -10, gold: -25 },
        outcomeText: '你花钱消灾，山贼满意地让开了道路。',
      },
    ],
  },
];

/* ============================================================
   常量
   ============================================================ */

const MAX_STAMINA = 100;
const MAX_FOOD = 100;
const MAX_MORALE = 100;
const EVENT_CHANCE = 0.07; // 每次 tick 触发事件的概率
const MIN_TICKS_BETWEEN_EVENTS = 10;
const SCROLL_ANCHOR_ID = 'log-anchor';

/* ============================================================
   工具函数
   ============================================================ */

function pickRandomEvent(): TravelEvent {
  return TRAVEL_EVENTS[Math.floor(Math.random() * TRAVEL_EVENTS.length)]!;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/* ============================================================
   组件
   ============================================================ */

export default function TravelPage() {
  const { level, totalMileage, addGold, addExp, addMileage } =
    useGameStore();

  /* ---- 旅行状态 ---- */
  const [travelStatus, setTravelStatus] = useState<
    'idle' | 'traveling' | 'arrived'
  >('idle');
  const [currentRoute, setCurrentRoute] = useState<TravelRoute | null>(null);
  const [journeyProgress, setJourneyProgress] = useState(0);
  const [stamina, setStamina] = useState(MAX_STAMINA);
  const [food, setFood] = useState(MAX_FOOD);
  const [morale, setMorale] = useState(MAX_MORALE);
  const [isPaused, setIsPaused] = useState(false);

  /* ---- 日志 ---- */
  const [travelLog, setTravelLog] = useState<LogEntry[]>([
    { id: 0, text: '准备就绪，选择路线开始旅行吧！', type: 'info' },
  ]);
  const logIdRef = useRef(1);
  const [scrollTarget, setScrollTarget] = useState('');

  /* ---- 弹窗 ---- */
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<TravelEvent | null>(null);
  const [showArrivalModal, setShowArrivalModal] = useState(false);

  /* ---- 内部追踪（避免闭包过期） ---- */
  const progressRef = useRef(0);
  const staminaRef = useRef(MAX_STAMINA);
  const foodRef = useRef(MAX_FOOD);
  const moraleRef = useRef(MAX_MORALE);
  const isPausedRef = useRef(false);
  const ticksSinceLastEventRef = useRef(99);
  const currentRouteRef = useRef<TravelRoute | null>(null);
  const dropTimerRef = useRef(0);

  /* ============================================================
     日志辅助
     ============================================================ */

  const addLog = useCallback((text: string, type: LogEntry['type']) => {
    const id = logIdRef.current++;
    setTravelLog((prev) => [...prev, { id, text, type }]);
    // 触发 ScrollView 自动滚动到最新消息
    setTimeout(() => setScrollTarget(`log-${id}`), 50);
  }, []);

  /* ============================================================
     旅行模拟
     ============================================================ */

  useEffect(() => {
    if (travelStatus !== 'traveling') return;

    const intervalId = window.setInterval(() => {
      if (isPausedRef.current) return;

      // 更新 progress
      const newProgress = progressRef.current + 1;
      progressRef.current = newProgress;
      setJourneyProgress(newProgress);

      // 消耗资源
      let staminaCost = 1;
      if (foodRef.current < 30) staminaCost += 1; // 食物不足加倍消耗体力
      if (moraleRef.current < 20) staminaCost += 0.5; // 士气低落增加消耗

      const newStamina = clamp(staminaRef.current - staminaCost, 0, MAX_STAMINA);
      const newFood = clamp(foodRef.current - 0.5, 0, MAX_FOOD);
      const newMorale = clamp(moraleRef.current - 0.2, 0, MAX_MORALE);

      staminaRef.current = newStamina;
      foodRef.current = newFood;
      moraleRef.current = newMorale;
      setStamina(newStamina);
      setFood(newFood);
      setMorale(newMorale);

      // 旅途物品掉落检查（每 30 秒）
      // 必须在到达/资源检查之前执行，确保短路线（如翠绿森林 d=30）也能获得掉落
      dropTimerRef.current += 1;
      if (dropTimerRef.current >= 30) {
        dropTimerRef.current = 0;

        const route = currentRouteRef.current;
        if (route && newStamina > 0 && newMorale > 0) {
          // 基础 30% 概率，随进度提升至最高 60%
          const progressRatio = newProgress / route.distance;
          const dropChance = Math.min(0.3 + progressRatio * 0.3, 0.6);

          if (Math.random() < dropChance) {
            // 路线难度（1~5），难度越高越容易出高稀有度物品
            const difficulty = Math.min(Math.ceil(route.minLevel / 2), 5);
            const difficultyBonus = (difficulty - 1) * 0.05;
            const rarityRoll = Math.random();
            let targetRarity: string;
            if (rarityRoll < 0.5 - difficultyBonus) {
              targetRarity = 'common';
            } else if (rarityRoll < 0.8 - difficultyBonus) {
              targetRarity = 'uncommon';
            } else if (rarityRoll < 0.95 - difficultyBonus) {
              targetRarity = 'rare';
            } else {
              targetRarity = 'epic';
            }

            // 加权随机选择该稀有度下的物品
            const candidates = itemRegistry.getDroppableByRarity([targetRarity as any]);
            if (candidates.length > 0) {
              const totalWeight = candidates.reduce((sum, item) => sum + item.dropWeight, 0);
              let roll = Math.random() * totalWeight;
              let selectedItem = candidates[candidates.length - 1];
              if (selectedItem) {
                for (const item of candidates) {
                  roll -= item.dropWeight;
                  if (roll <= 0) {
                    selectedItem = item;
                    break;
                  }
                }

                // 消耗品/食物/材料掉落 1~3 个，装备掉落 1 个
                const quantity =
                  selectedItem.type === 'consumable' ||
                  selectedItem.type === 'food' ||
                  selectedItem.type === 'material'
                    ? Math.floor(Math.random() * 3) + 1
                    : 1;

                const added = InventoryEngine.instance.addItem(
                  selectedItem.id,
                  quantity,
                  selectedItem.name,
                  selectedItem.type,
                  selectedItem.rarity,
                  selectedItem.weight,
                );

                if (added) {
                  const logText =
                    quantity > 1
                      ? `🎒 获得 ${selectedItem.name} x${quantity}`
                      : `🎒 获得 ${selectedItem.name}`;
                  addLog(logText, 'reward');
                }
              }
            }
          }
        }
      }

      // 检查是否到达
      const route = currentRouteRef.current;
      if (route && newProgress >= route.distance) {
        // 到达目的地
        setTravelStatus('arrived');
        setShowArrivalModal(true);
        addLog(`🎉 抵达了${route.name}！旅途结束。`, 'reward');
        return;
      }

      // 检查资源耗尽
      if (newStamina <= 0) {
        setTravelStatus('arrived');
        addLog('⚠️ 体力耗尽，无法继续前进...', 'warning');
        setShowArrivalModal(true);
        return;
      }
      if (newMorale <= 0) {
        setTravelStatus('arrived');
        addLog('💔 士气低落到了极点，队伍决定返回。', 'warning');
        setShowArrivalModal(true);
        return;
      }

      // 随机事件
      ticksSinceLastEventRef.current += 1;
      if (
        ticksSinceLastEventRef.current > MIN_TICKS_BETWEEN_EVENTS &&
        Math.random() < EVENT_CHANCE
      ) {
        ticksSinceLastEventRef.current = 0;
        isPausedRef.current = true;
        setIsPaused(true);

        const evt = pickRandomEvent();
        setCurrentEvent(evt);
        setShowEventModal(true);
        addLog(`❓ ${evt.title}`, 'event');
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [travelStatus, addLog]);

  /* ============================================================
     同步 ref（副作用 vs interval 闭包）
     ============================================================ */

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    currentRouteRef.current = currentRoute;
  }, [currentRoute]);

  /* ============================================================
     事件选择处理
     ============================================================ */

  const handleEventChoice = useCallback(
    (value: string) => {
      if (!currentEvent) return;

      const choice = currentEvent.choices.find((c) => c.value === value);
      if (!choice) return;

      const { stamina: s, food: f, morale: m, gold: g } = choice.effect;

      setStamina((prev) => clamp(prev + s, 0, MAX_STAMINA));
      setFood((prev) => clamp(prev + f, 0, MAX_FOOD));
      setMorale((prev) => clamp(prev + m, 0, MAX_MORALE));
      staminaRef.current = clamp(staminaRef.current + s, 0, MAX_STAMINA);
      foodRef.current = clamp(foodRef.current + f, 0, MAX_FOOD);
      moraleRef.current = clamp(moraleRef.current + m, 0, MAX_MORALE);

      if (g > 0) {
        addGold(g);
      } else if (g < 0) {
        // 花钱的事件
        useGameStore.getState().spendGold(Math.abs(g));
      }

      addLog(`→ ${choice.outcomeText}`, 'event');
      setShowEventModal(false);
      setCurrentEvent(null);

      // 继续旅行
      isPausedRef.current = false;
      setIsPaused(false);
    },
    [currentEvent, addLog, addGold],
  );

  /* ============================================================
     开始/结束旅行
     ============================================================ */

  const handleStartRoute = useCallback(
    (route: TravelRoute) => {
      if (level < route.minLevel) {
        addLog(`❌ 等级不足（需要 Lv.${route.minLevel}）`, 'warning');
        return;
      }

      setCurrentRoute(route);
      setJourneyProgress(0);
      progressRef.current = 0;
      setStamina(MAX_STAMINA);
      setFood(MAX_FOOD);
      setMorale(MAX_MORALE);
      staminaRef.current = MAX_STAMINA;
      foodRef.current = MAX_FOOD;
      moraleRef.current = MAX_MORALE;
      ticksSinceLastEventRef.current = 99;
      dropTimerRef.current = 0;
      setTravelLog([
        { id: logIdRef.current++, text: `🛤️ 出发前往${route.name}...`, type: 'info' },
      ]);
      setIsPaused(false);
      isPausedRef.current = false;
      setTravelStatus('traveling');
      setShowRouteModal(false);
    },
    [level, addLog],
  );

  const handlePauseResume = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev;
      isPausedRef.current = next;
      addLog(next ? '⏸️ 旅行已暂停' : '▶️ 旅行继续', 'info');
      return next;
    });
  }, [addLog]);

  const handleAbort = useCallback(() => {
    window.clearInterval(0); // 实际由 effect cleanup 处理
    setTravelStatus('idle');
    setCurrentRoute(null);
    setJourneyProgress(0);
    addLog('🚫 旅行已终止', 'warning');
  }, [addLog]);

  /* ============================================================
     到达确认
     ============================================================ */

  const handleClaimRewards = useCallback(() => {
    if (!currentRoute) return;

    const { rewards } = currentRoute;
    addGold(rewards.gold);
    addExp(rewards.exp);
    addMileage(rewards.mileage);
    addLog(
      `🏆 获得 ${rewards.gold} 金币, ${rewards.exp} 经验, ${rewards.mileage} 里程`,
      'reward',
    );

    setShowArrivalModal(false);
    setTravelStatus('idle');
    setCurrentRoute(null);
    setJourneyProgress(0);
  }, [currentRoute, addGold, addExp, addMileage, addLog]);

  /* ============================================================
     计算属性
     ============================================================ */

  const routeDistance = currentRoute?.distance ?? 1;
  const progressPercent = Math.min(
    (journeyProgress / routeDistance) * 100,
    100,
  );

  const displayMileage = currentRoute
    ? Math.floor((journeyProgress / routeDistance) * (currentRoute.rewards.mileage || 1))
    : 0;

  /* ============================================================
     渲染
     ============================================================ */

  return (
    <View className='travel-page fade-in'>
      {/* ===== 顶部状态栏 ===== */}
      <View className='status-banner'>
        <View className='status-indicator'>
          <View
            className={`status-dot ${
              travelStatus === 'traveling'
                ? 'status-dot--active'
                : travelStatus === 'arrived'
                  ? 'status-dot--done'
                  : ''
            }`}
          />
          <Text className='status-label'>
            {travelStatus === 'idle' && '待命中'}
            {travelStatus === 'traveling' && (isPaused ? '已暂停' : '旅途中')}
            {travelStatus === 'arrived' && '已到达'}
          </Text>
        </View>

        {currentRoute && (
          <Text className='route-name'>{currentRoute.name}</Text>
        )}
      </View>

      {/* ===== 资源栏 ===== */}
      <View className='resource-bar'>
        <View className='resource-item'>
          <Text className='resource-icon'>⚡</Text>
          <View className='resource-info'>
            <View className='resource-track'>
              <View
                className='resource-fill resource-fill--stamina'
                style={{
                  width: `${(stamina / MAX_STAMINA) * 100}%`,
                }}
              />
            </View>
            <Text className='resource-value'>
              {Math.floor(stamina)}/{MAX_STAMINA}
            </Text>
          </View>
        </View>
        <View className='resource-item'>
          <Text className='resource-icon'>🍞</Text>
          <View className='resource-info'>
            <View className='resource-track'>
              <View
                className='resource-fill resource-fill--food'
                style={{
                  width: `${(food / MAX_FOOD) * 100}%`,
                }}
              />
            </View>
            <Text className='resource-value'>
              {Math.floor(food)}/{MAX_FOOD}
            </Text>
          </View>
        </View>
        <View className='resource-item'>
          <Text className='resource-icon'>💪</Text>
          <View className='resource-info'>
            <View className='resource-track'>
              <View
                className='resource-fill resource-fill--morale'
                style={{
                  width: `${(morale / MAX_MORALE) * 100}%`,
                }}
              />
            </View>
            <Text className='resource-value'>
              {Math.floor(morale)}/{MAX_MORALE}
            </Text>
          </View>
        </View>
      </View>

      {/* ===== 里程信息 ===== */}
      <View className='mileage-row'>
        <Text className='mileage-label'>当前旅程</Text>
        <Text className='mileage-value'>
          {displayMileage} / {currentRoute?.rewards.mileage ?? 0} 里程
        </Text>
        <View className='mileage-divider' />
        <Text className='mileage-label'>总里程</Text>
        <Text className='mileage-value'>{totalMileage}</Text>
      </View>

      {/* ===== 进度条（旅行中） ===== */}
      {travelStatus === 'traveling' && (
        <View className='progress-section'>
          <ProgressBar
            value={journeyProgress}
            max={routeDistance}
            height={18}
            color='var(--color-primary)'
            label='旅程进度'
            showPercent
            striped={!isPaused}
          />
          {isPaused && <Text className='pause-hint'>点击"继续"按钮恢复旅行</Text>}
        </View>
      )}

      {/* ===== 旅行日志 ===== */}
      <View className='log-section'>
        <Text className='section-title'>旅行日志</Text>
        <ScrollView
          className='log-scroll'
          scrollY
          scrollIntoView={scrollTarget}
          scrollWithAnimation
        >
          {travelLog.map((entry) => (
            <View
              key={entry.id}
              id={`log-${entry.id}`}
              className={`log-entry log-entry--${entry.type}`}
            >
              <Text className='log-text'>{entry.text}</Text>
            </View>
          ))}
          <View id={SCROLL_ANCHOR_ID} className='log-anchor' />
        </ScrollView>
      </View>

      {/* ===== 操作按钮 ===== */}
      <View className='action-bar'>
        {travelStatus === 'idle' && (
          <View
            className='action-btn action-btn--primary'
            onClick={() => setShowRouteModal(true)}
          >
            <Text className='action-btn-text'>开始旅行</Text>
          </View>
        )}

        {travelStatus === 'traveling' && (
          <>
            <View className='action-btn' onClick={handlePauseResume}>
              <Text className='action-btn-text'>
                {isPaused ? '▶ 继续' : '⏸ 暂停'}
              </Text>
            </View>
            <View
              className='action-btn action-btn--danger'
              onClick={handleAbort}
            >
              <Text className='action-btn-text'>✕ 终止</Text>
            </View>
          </>
        )}

        {travelStatus === 'arrived' && (
          <View
            className='action-btn action-btn--primary'
            onClick={handleClaimRewards}
          >
            <Text className='action-btn-text'>领取奖励</Text>
          </View>
        )}
      </View>

      {/* ===== 路线选择弹窗 ===== */}
      <Dialog
        visible={showRouteModal}
        title='选择路线'
        description='选择你想要探索的路线'
        type='info'
        onClose={() => setShowRouteModal(false)}
      >
        <View className='route-list'>
          {ROUTES.map((route) => {
            const locked = level < route.minLevel;
            return (
              <View
                key={route.id}
                className={`route-card ${locked ? 'route-card--locked' : ''}`}
                onClick={() => !locked && handleStartRoute(route)}
              >
                <View className='route-card-top'>
                  <Text className='route-card-name'>{route.name}</Text>
                  {locked && (
                    <Text className='route-card-lock'>Lv.{route.minLevel}</Text>
                  )}
                </View>
                <Text className='route-card-desc'>{route.description}</Text>
                <View className='route-card-rewards'>
                  <Text className='route-card-reward'>
                    ✦+{route.rewards.gold}
                  </Text>
                  <Text className='route-card-reward'>
                    ✧+{route.rewards.exp}
                  </Text>
                  <Text className='route-card-reward'>
                    📍+{route.rewards.mileage}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </Dialog>

      {/* ===== 事件弹窗 ===== */}
      {currentEvent && (
        <Dialog
          visible={showEventModal}
          title={currentEvent.title}
          description={currentEvent.description}
          type='event'
          choices={currentEvent.choices.map((c) => ({
            label: c.label,
            value: c.value,
            hint: formatEffectHint(c.effect),
          }))}
          onChoice={handleEventChoice}
          onClose={() => {
            // 不能关闭，必须选择
          }}
        />
      )}

      {/* ===== 到达奖励弹窗 ===== */}
      {currentRoute && (
        <Dialog
          visible={showArrivalModal}
          title={
            stamina <= 0
              ? '体力耗尽'
              : morale <= 0
                ? '士气崩溃'
                : '抵达目的地！'
          }
          description={
            stamina <= 0 || morale <= 0
              ? '虽然没能完全探索路线，但仍然有一些收获。'
              : `你成功抵达了${currentRoute.name}！`
          }
          type='reward'
          onChoice={handleClaimRewards}
          choices={[{ label: '领取奖励', value: 'claim' }]}
        >
          <View className='rewards-summary'>
            <Text className='rewards-title'>旅途收获</Text>
            <View className='rewards-row'>
              <Text className='rewards-label'>✦ 金币</Text>
              <Text className='rewards-value'>+{currentRoute.rewards.gold}</Text>
            </View>
            <View className='rewards-row'>
              <Text className='rewards-label'>✧ 经验</Text>
              <Text className='rewards-value'>+{currentRoute.rewards.exp}</Text>
            </View>
            <View className='rewards-row'>
              <Text className='rewards-label'>📍 里程</Text>
              <Text className='rewards-value'>
                +{currentRoute.rewards.mileage}
              </Text>
            </View>
          </View>
        </Dialog>
      )}
    </View>
  );
}

/* ============================================================
   工具：格式化事件效果提示
   ============================================================ */

function formatEffectHint(effect: {
  stamina: number;
  food: number;
  morale: number;
  gold: number;
}): string {
  const parts: string[] = [];
  if (effect.stamina > 0) parts.push(`⚡+${effect.stamina}`);
  if (effect.stamina < 0) parts.push(`⚡${effect.stamina}`);
  if (effect.food > 0) parts.push(`🍞+${effect.food}`);
  if (effect.food < 0) parts.push(`🍞${effect.food}`);
  if (effect.morale > 0) parts.push(`💪+${effect.morale}`);
  if (effect.morale < 0) parts.push(`💪${effect.morale}`);
  if (effect.gold > 0) parts.push(`✦+${effect.gold}`);
  if (effect.gold < 0) parts.push(`✦${effect.gold}`);
  return parts.length > 0 ? parts.join(' ') : '无影响';
}
