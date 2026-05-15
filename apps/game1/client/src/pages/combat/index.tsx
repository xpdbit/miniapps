import { View, Text, ScrollView } from '@tarojs/components';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useCombatStore, useGameStore } from '../../stores';
import './index.module.scss';

/* ============================================================
   类型定义
   ============================================================ */

interface EnemyTemplate {
  name: string;
  hp: number;
  atk: number;
  def: number;
  level: number;
  rewards: { gold: number; exp: number; items: string[] };
}

interface LogEntry {
  id: number;
  text: string;
  type: 'damage' | 'crit' | 'enemy' | 'system';
}

/* ============================================================
   敌人模板数据
   ============================================================ */

const ENEMIES: EnemyTemplate[] = [
  {
    name: '哥布林',
    hp: 50,
    atk: 8,
    def: 3,
    level: 1,
    rewards: { gold: 15, exp: 10, items: [] },
  },
  {
    name: '野狼',
    hp: 70,
    atk: 12,
    def: 4,
    level: 2,
    rewards: { gold: 25, exp: 18, items: ['狼皮'] },
  },
  {
    name: '石傀儡',
    hp: 120,
    atk: 10,
    def: 10,
    level: 3,
    rewards: { gold: 40, exp: 30, items: ['石块'] },
  },
  {
    name: '暗影刺客',
    hp: 90,
    atk: 20,
    def: 3,
    level: 4,
    rewards: { gold: 55, exp: 45, items: ['暗影碎片'] },
  },
  {
    name: '火焰巨魔',
    hp: 180,
    atk: 18,
    def: 8,
    level: 5,
    rewards: { gold: 80, exp: 60, items: ['火焰核心'] },
  },
];

const INITIAL_LOG_ENTRY: LogEntry = {
  id: 0,
  text: '⚔️ 准备就绪，点击"开始战斗"进入战斗！',
  type: 'system',
};

const FOLLOWER_MAX_HP = 80;
const TICK_INTERVAL = 1500;
const PREPARE_DELAY = 1500;
const OVERLAY_DELAY = 600;

/* ============================================================
   工具函数
   ============================================================ */

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/* ============================================================
   组件
   ============================================================ */

export default function CombatPage() {
  const {
    status,
    setStatus,
    enemyName,
    enemyHp,
    enemyMaxHp,
    enemyAttack,
    enemyDefense,
    setEnemy,
    partyHp,
    partyMaxHp,
    partyAttack,
    partyDefense,
    setParty,
    turnNumber,
    nextTurn,
    rewards,
    setRewards,
    reset,
  } = useCombatStore();
  const { addGold, addExp } = useGameStore();

  /* ---- 本地 UI 状态 ---- */
  const [displayLog, setDisplayLog] = useState<LogEntry[]>([INITIAL_LOG_ENTRY]);
  const [scrollTarget, setScrollTarget] = useState('');
  const [showOverlay, setShowOverlay] = useState(false);
  const [flashEnemy, setFlashEnemy] = useState(false);
  const [flashParty, setFlashParty] = useState(false);

  /* ---- 引用（避免闭包过期） ---- */
  const logIdRef = useRef(1);
  const tickRef = useRef<number | null>(null);
  const enemyRef = useRef<EnemyTemplate | null>(null);
  const flashTimerRef = useRef<number | null>(null);

  /* ============================================================
     日志辅助
     ============================================================ */

  const addLog = useCallback((text: string, type: LogEntry['type']) => {
    const id = logIdRef.current++;
    setDisplayLog((prev) => [...prev, { id, text, type }]);
    setTimeout(() => setScrollTarget(`log-${id}`), 50);
  }, []);

  /* ============================================================
     伤害闪红/闪绿效果
     ============================================================ */

  const triggerFlash = useCallback((target: 'enemy' | 'party') => {
    if (target === 'enemy') {
      setFlashEnemy(true);
    } else {
      setFlashParty(true);
    }
    if (flashTimerRef.current != null) {
      clearTimeout(flashTimerRef.current);
    }
    flashTimerRef.current = window.setTimeout(() => {
      setFlashEnemy(false);
      setFlashParty(false);
    }, 400);
  }, []);

  /* ============================================================
     战斗模拟 tick
     ============================================================ */

  const runTick = useCallback(() => {
    const state = useCombatStore.getState();
    if (state.status !== 'inProgress') return;
    const enemy = enemyRef.current;
    if (!enemy) return;

    /* ---- 玩家攻击敌人 ---- */
    const baseDmg = Math.max(
      1,
      Math.round(state.partyAttack - enemy.def * 0.5 + Math.random() * 6 - 3),
    );
    const isCrit = Math.random() < 0.1;
    const dmg = isCrit ? Math.round(baseDmg * 2) : baseDmg;
    const newEnemyHp = Math.max(0, state.enemyHp - dmg);

    state.damageEnemy(dmg);
    triggerFlash('enemy');

    if (isCrit) {
      addLog(`💥 暴击！对 ${enemy.name} 造成 ${dmg} 点伤害`, 'crit');
    } else {
      addLog(`⚔️ 对 ${enemy.name} 造成 ${dmg} 点伤害`, 'damage');
    }

    /* 检查胜利 */
    if (newEnemyHp <= 0) {
      setStatus('victory');
      addLog('🏆 战斗胜利！', 'system');
      setTimeout(() => setShowOverlay(true), OVERLAY_DELAY);
      return;
    }

    /* ---- 敌人攻击玩家 ---- */
    const eDmg = Math.max(
      1,
      Math.round(enemy.atk - state.partyDefense * 0.5 + Math.random() * 4 - 2),
    );
    const newPartyHp = Math.max(0, state.partyHp - eDmg);

    state.damageParty(eDmg);
    triggerFlash('party');
    addLog(`💢 ${enemy.name} 造成 ${eDmg} 点伤害`, 'enemy');

    /* 检查战败 */
    if (newPartyHp <= 0) {
      setStatus('defeat');
      addLog('💀 被击败了...', 'system');
      setTimeout(() => setShowOverlay(true), OVERLAY_DELAY);
      return;
    }

    state.nextTurn();
  }, [addLog, triggerFlash, setStatus]);

  /* ============================================================
     auto-combat 定时器管理
     ============================================================ */

  useEffect(() => {
    if (status === 'inProgress') {
      tickRef.current = window.setInterval(runTick, TICK_INTERVAL);
    } else {
      if (tickRef.current != null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    }
    return () => {
      if (tickRef.current != null) {
        window.clearInterval(tickRef.current);
      }
    };
  }, [status, runTick]);

  /* ============================================================
     开始战斗
     ============================================================ */

  const handleStartCombat = useCallback(() => {
    const enemy = pickRandom(ENEMIES);
    enemyRef.current = enemy;

    setStatus('preparing');
    setEnemy(enemy.name, enemy.hp, enemy.hp, enemy.atk, enemy.def);
    setParty(100, 100, 15, 5);
    setRewards(enemy.rewards.gold, enemy.rewards.exp, enemy.rewards.items);
    setDisplayLog([]);
    logIdRef.current = 1;
    setShowOverlay(false);
    setFlashEnemy(false);
    setFlashParty(false);

    addLog(`⚔️ 遭遇了 ${enemy.name}！（Lv.${enemy.level}）`, 'system');

    /* 延迟后正式开战 */
    setTimeout(() => {
      const s = useCombatStore.getState();
      if (s.status === 'preparing') {
        setStatus('inProgress');
        addLog('🏃 自动战斗开始！', 'system');
      }
    }, PREPARE_DELAY);
  }, [setStatus, setEnemy, setParty, setRewards, addLog]);

  /* ============================================================
     胜利后续 / 战败重试
     ============================================================ */

  const handleContinue = useCallback(() => {
    addGold(rewards.gold);
    addExp(rewards.exp);
    reset();
    setDisplayLog([{ ...INITIAL_LOG_ENTRY, id: 0 }]);
    logIdRef.current = 1;
    setShowOverlay(false);
  }, [rewards, addGold, addExp, reset]);

  const handleRetry = useCallback(() => {
    reset();
    setShowOverlay(false);
    setFlashEnemy(false);
    setFlashParty(false);
    setTimeout(() => handleStartCombat(), 300);
  }, [reset, handleStartCombat]);

  /* ============================================================
     计算属性
     ============================================================ */

  const followerHp = Math.max(
    0,
    Math.round((partyHp / Math.max(partyMaxHp, 1)) * FOLLOWER_MAX_HP),
  );

  const statusLabel =
    status === 'none'
      ? '待命中'
      : status === 'preparing'
        ? '准备战斗'
        : status === 'inProgress'
          ? '战斗中'
          : status === 'victory'
            ? '胜利！'
            : '战败';

  const statusDotClass =
    status === 'preparing'
      ? 'status-dot--preparing'
      : status === 'inProgress'
        ? 'status-dot--fighting'
        : status === 'victory'
          ? 'status-dot--victory'
          : status === 'defeat'
            ? 'status-dot--defeat'
            : '';

  const showCombatUI =
    status === 'preparing' ||
    status === 'inProgress' ||
    status === 'victory' ||
    status === 'defeat';

  /* ============================================================
     渲染
     ============================================================ */

  return (
    <View className='combat-page'>
      {/* ===== 状态横幅 ===== */}
      <View className='status-banner'>
        <View className='status-left'>
          <View className={`status-dot ${statusDotClass}`} />
          <Text className='status-label'>{statusLabel}</Text>
          {status === 'inProgress' && (
            <Text className='turn-counter'>回合 {turnNumber}</Text>
          )}
        </View>
      </View>

      {/* ===== 战斗竞技场 ===== */}
      <View className='combat-arena'>
        {showCombatUI && (
          <>
            {/* 敌人卡片 */}
            <View
              className={`enemy-card ${flashEnemy ? 'enemy-card--hit' : ''}`}
            >
              <View className='enemy-header'>
                <Text className='enemy-name'>{enemyName}</Text>
                {enemyRef.current && (
                  <Text className='enemy-level'>
                    Lv.{enemyRef.current.level}
                  </Text>
                )}
              </View>
              <View className='hp-bar'>
                <View className='hp-track'>
                  <View
                    className='hp-fill hp-fill--enemy'
                    style={{
                      width: `${(enemyHp / Math.max(enemyMaxHp, 1)) * 100}%`,
                    }}
                  />
                </View>
                <Text className='party-member-hp'>
                  {enemyHp}/{enemyMaxHp}
                </Text>
              </View>
              <View className='enemy-stats'>
                <Text className='stat-tag stat-tag--atk'>
                  ATK {enemyAttack}
                </Text>
                <Text className='stat-tag stat-tag--def'>
                  DEF {enemyDefense}
                </Text>
              </View>
            </View>

            {/* VS 分割线 */}
            {(status === 'preparing' || status === 'inProgress') && (
              <View className='vs-divider'>
                <View className='vs-line' />
                <Text className='vs-text'>⚔</Text>
                <View className='vs-line' />
              </View>
            )}

            {/* 队伍卡片 */}
            <View
              className={`party-card ${flashParty ? 'party-card--hit' : ''}`}
            >
              <Text className='party-label'>队伍状态</Text>

              {/* 勇者 HP */}
              <View className='party-member'>
                <View className='party-member-header'>
                  <Text className='party-member-name'>✦ 勇者</Text>
                  <Text className='party-member-hp'>
                    {Math.ceil(partyHp)}/{partyMaxHp}
                  </Text>
                </View>
                <View className='hp-track'>
                  <View
                    className='hp-fill hp-fill--party'
                    style={{
                      width: `${(partyHp / Math.max(partyMaxHp, 1)) * 100}%`,
                    }}
                  />
                </View>
              </View>

              {/* 随从 HP */}
              <View className='party-member'>
                <View className='party-member-header'>
                  <Text className='party-member-name'>◇ 随从</Text>
                  <Text className='party-member-hp'>
                    {followerHp}/{FOLLOWER_MAX_HP}
                  </Text>
                </View>
                <View className='hp-track hp-track--small'>
                  <View
                    className='hp-fill hp-fill--follower'
                    style={{
                      width: `${(followerHp / FOLLOWER_MAX_HP) * 100}%`,
                    }}
                  />
                </View>
              </View>

              <View className='party-stats'>
                <Text className='stat-tag stat-tag--atk'>
                  ATK {partyAttack}
                </Text>
                <Text className='stat-tag stat-tag--def'>
                  DEF {partyDefense}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* ===== 战斗日志 ===== */}
      <View className='log-section'>
        <Text className='section-title'>战斗记录</Text>
        <ScrollView
          className='log-scroll'
          scrollY
          scrollIntoView={scrollTarget}
          scrollWithAnimation
        >
          {displayLog.map((entry) => (
            <View
              key={entry.id}
              id={`log-${entry.id}`}
              className={`log-entry log-entry--${entry.type}`}
            >
              <Text className='log-text'>{entry.text}</Text>
            </View>
          ))}
          <View className='log-anchor' id='log-anchor' />
        </ScrollView>
      </View>

      {/* ===== 操作栏 ===== */}
      <View className='action-bar'>
        {status === 'none' && (
          <View
            className='action-btn action-btn--primary'
            onClick={handleStartCombat}
          >
            <Text className='action-btn-text'>开始战斗</Text>
          </View>
        )}
        {status === 'preparing' && (
          <View className='action-btn action-btn--disabled'>
            <Text className='action-btn-text'>准备中...</Text>
          </View>
        )}
        {status === 'inProgress' && (
          <View className='action-btn action-btn--fighting'>
            <Text className='action-btn-text'>⚔️ 自动战斗中...</Text>
          </View>
        )}
      </View>

      {/* ===== 胜利/战败浮层 ===== */}
      {showOverlay && (status === 'victory' || status === 'defeat') && (
        <View className='result-overlay'>
          <View
            className={`result-card result-card--${status}`}
            onClick={(e) => e.stopPropagation()}
          >
            {status === 'victory' ? (
              <>
                <Text className='result-icon'>🏆</Text>
                <Text className='result-title'>战斗胜利</Text>

                <View className='reward-summary'>
                  <View className='reward-row'>
                    <Text className='reward-label'>✦ 金币</Text>
                    <Text className='reward-value'>+{rewards.gold}</Text>
                  </View>
                  <View className='reward-row'>
                    <Text className='reward-label'>✧ 经验</Text>
                    <Text className='reward-value'>+{rewards.exp}</Text>
                  </View>
                  {rewards.items.length > 0 && (
                    <View className='reward-row'>
                      <Text className='reward-label'>🎒 战利品</Text>
                      <Text className='reward-value'>
                        {rewards.items.join('、')}
                      </Text>
                    </View>
                  )}
                </View>

                <View className='result-btn' onClick={handleContinue}>
                  <Text className='result-btn-text'>继续冒险</Text>
                </View>
              </>
            ) : (
              <>
                <Text className='result-icon'>💀</Text>
                <Text className='result-title defeat-title'>战败</Text>
                <Text className='result-desc'>
                  队伍被 {enemyName} 击败了...
                </Text>
                <View
                  className='result-btn result-btn--retry'
                  onClick={handleRetry}
                >
                  <Text className='result-btn-text'>重新挑战</Text>
                </View>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}
