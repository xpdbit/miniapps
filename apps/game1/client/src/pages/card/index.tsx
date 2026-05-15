import { View, Text, ScrollView } from '@tarojs/components';
import { useState, useCallback } from 'react';
import { useGameStore } from '../../stores/gameStore';
import './index.module.scss';

// ============================================================
// 类型定义
// ============================================================
type CardRarity = 'N' | 'R' | 'SR' | 'SSR' | 'UR' | 'GR';

interface CardStats {
  attack: number;
  defense: number;
  hp: number;
}

interface Card {
  id: string;
  name: string;
  icon: string;
  rarity: CardRarity;
  description: string;
  isOwned: boolean;
  quantity: number;
  stats: CardStats;
}

// ============================================================
// 稀有度配置
// ============================================================
interface RarityConfig {
  color: string;
  label: string;
  labelShort: string;
  pullRate: number;
  pityGuarantee: number;
}

const RARITY_CONFIG: Record<CardRarity, RarityConfig> = {
  N: { color: '#b5a898', label: '普通', labelShort: 'N', pullRate: 50, pityGuarantee: 0 },
  R: { color: '#7a9e6b', label: '稀有', labelShort: 'R', pullRate: 25, pityGuarantee: 0 },
  SR: { color: '#6b8fac', label: '精良', labelShort: 'SR', pullRate: 15, pityGuarantee: 10 },
  SSR: { color: '#a67d9e', label: '史诗', labelShort: 'SSR', pullRate: 7, pityGuarantee: 50 },
  UR: { color: '#c4923a', label: '传说', labelShort: 'UR', pullRate: 2.5, pityGuarantee: 90 },
  GR: { color: '#c4923a', label: '神话', labelShort: 'GR', pullRate: 0.5, pityGuarantee: 0 },
};

const RARITY_ORDER: CardRarity[] = ['N', 'R', 'SR', 'SSR', 'UR', 'GR'];

const PULL_COST_SINGLE = 100;
const PULL_COST_MULTI = 900;

// ============================================================
// 占位卡牌数据 (26 张)
// ============================================================
const PLACEHOLDER_CARDS: Card[] = [
  // N - 5张
  { id: 'n1', name: '小草妖', icon: '🌱', rarity: 'N', description: '随处可见的弱小草妖，没有任何攻击力。', isOwned: true, quantity: 3, stats: { attack: 1, defense: 2, hp: 5 } },
  { id: 'n2', name: '石像鬼', icon: '🗿', rarity: 'N', description: '古老的石雕生命，行动迟缓但很耐打。', isOwned: true, quantity: 1, stats: { attack: 2, defense: 3, hp: 8 } },
  { id: 'n3', name: '小水滴', icon: '💧', rarity: 'N', description: '最基础的水系精灵，毫无存在感。', isOwned: false, quantity: 0, stats: { attack: 1, defense: 1, hp: 4 } },
  { id: 'n4', name: '火星虫', icon: '🔥', rarity: 'N', description: '微弱的火系生物，稍微有点烫。', isOwned: true, quantity: 2, stats: { attack: 3, defense: 1, hp: 3 } },
  { id: 'n5', name: '风滚草', icon: '🌿', rarity: 'N', description: '随风飘荡的杂草，性格随和。', isOwned: false, quantity: 0, stats: { attack: 2, defense: 2, hp: 5 } },
  // R - 5张
  { id: 'r1', name: '森林狼', icon: '🐺', rarity: 'R', description: '群居的捕食者，擅长协同作战。', isOwned: true, quantity: 1, stats: { attack: 8, defense: 5, hp: 15 } },
  { id: 'r2', name: '冰晶兽', icon: '🦊', rarity: 'R', description: '寒冰属性的狡猾生物，行动敏捷。', isOwned: false, quantity: 0, stats: { attack: 7, defense: 6, hp: 14 } },
  { id: 'r3', name: '雷鹰', icon: '🦅', rarity: 'R', description: '操控雷电的猛禽，速度极快。', isOwned: true, quantity: 2, stats: { attack: 9, defense: 4, hp: 12 } },
  { id: 'r4', name: '岩甲熊', icon: '🐻', rarity: 'R', description: '披着坚硬岩石皮肤的熊类生物。', isOwned: false, quantity: 0, stats: { attack: 6, defense: 10, hp: 20 } },
  { id: 'r5', name: '毒蛙', icon: '🐸', rarity: 'R', description: '拥有绚丽花纹的有毒两栖类。', isOwned: true, quantity: 1, stats: { attack: 10, defense: 3, hp: 10 } },
  // SR - 5张
  { id: 'sr1', name: '火焰狮', icon: '🦁', rarity: 'SR', description: '操控烈焰的百兽之王，威严而强大。', isOwned: true, quantity: 1, stats: { attack: 18, defense: 10, hp: 35 } },
  { id: 'sr2', name: '寒霜龙', icon: '🐉', rarity: 'SR', description: '冰霜巨龙的后裔，能冻结一切。', isOwned: false, quantity: 0, stats: { attack: 16, defense: 14, hp: 40 } },
  { id: 'sr3', name: '暗影豹', icon: '🐆', rarity: 'SR', description: '穿梭于暗影中的致命猎手。', isOwned: true, quantity: 1, stats: { attack: 20, defense: 8, hp: 25 } },
  { id: 'sr4', name: '圣光虎', icon: '🐯', rarity: 'SR', description: '拥有神圣光芒之力的虎类。', isOwned: false, quantity: 0, stats: { attack: 15, defense: 12, hp: 38 } },
  { id: 'sr5', name: '雷鸣象', icon: '🐘', rarity: 'SR', description: '脚踏雷霆的巨型象兽，力量惊人。', isOwned: true, quantity: 1, stats: { attack: 14, defense: 18, hp: 50 } },
  // SSR - 5张
  { id: 'ssr1', name: '炽天使', icon: '👼', rarity: 'SSR', description: '圣光化身的六翼天使，光明正义。', isOwned: false, quantity: 0, stats: { attack: 30, defense: 25, hp: 80 } },
  { id: 'ssr2', name: '深渊魔', icon: '😈', rarity: 'SSR', description: '来自深渊的远古恶魔，暗黑力量。', isOwned: true, quantity: 1, stats: { attack: 35, defense: 20, hp: 70 } },
  { id: 'ssr3', name: '星穹凤', icon: '🦅', rarity: 'SSR', description: '穿越星穹的神圣凤凰，浴火重生。', isOwned: false, quantity: 0, stats: { attack: 32, defense: 22, hp: 75 } },
  { id: 'ssr4', name: '混沌兽', icon: '🦎', rarity: 'SSR', description: '混沌中诞生的异界生物，不可名状。', isOwned: true, quantity: 1, stats: { attack: 28, defense: 28, hp: 85 } },
  { id: 'ssr5', name: '时空龙', icon: '🐲', rarity: 'SSR', description: '能操纵时空的禁忌巨龙。', isOwned: false, quantity: 0, stats: { attack: 38, defense: 18, hp: 65 } },
  // UR - 4张
  { id: 'ur1', name: '创世神', icon: '🌟', rarity: 'UR', description: '开天辟地的至高神明，拥有无边法力。', isOwned: false, quantity: 0, stats: { attack: 50, defense: 50, hp: 150 } },
  { id: 'ur2', name: '灭世龙', icon: '🔴', rarity: 'UR', description: '毁灭世界的禁忌巨龙，一念之间天崩地裂。', isOwned: false, quantity: 0, stats: { attack: 60, defense: 40, hp: 130 } },
  { id: 'ur3', name: '永恒神', icon: '✨', rarity: 'UR', description: '超越时间存在的古老神明。', isOwned: false, quantity: 0, stats: { attack: 45, defense: 55, hp: 160 } },
  { id: 'ur4', name: '轮回王', icon: '♾️', rarity: 'UR', description: '掌控万物轮回的冥界之主。', isOwned: false, quantity: 0, stats: { attack: 55, defense: 45, hp: 140 } },
  // GR - 2张
  { id: 'gr1', name: '宇宙意志', icon: '🌌', rarity: 'GR', description: '超越一切宇宙的终极存在本身。', isOwned: false, quantity: 0, stats: { attack: 80, defense: 80, hp: 250 } },
  { id: 'gr2', name: '万物起源', icon: '💫', rarity: 'GR', description: '一切一切的起点，也是终点。', isOwned: false, quantity: 0, stats: { attack: 75, defense: 75, hp: 300 } },
];

const TOTAL_CARDS = PLACEHOLDER_CARDS.length;

// ============================================================
// 工具函数
// ============================================================
function getRandomRarity(weighted = true): CardRarity {
  if (!weighted) {
    const rarities: CardRarity[] = ['N', 'R', 'SR', 'SSR', 'UR', 'GR'];
    return rarities[Math.floor(Math.random() * rarities.length)]!;
  }
  const rand = Math.random() * 100;
  let cumulative = 0;
  const rarities: CardRarity[] = ['GR', 'UR', 'SSR', 'SR', 'R', 'N'];
  for (const rarity of rarities) {
    cumulative += RARITY_CONFIG[rarity].pullRate;
    if (rand <= cumulative) return rarity;
  }
  return 'N';
}

function findCardByRarity(cards: Card[], rarity: CardRarity): Card | undefined {
  return cards.find((c) => c.rarity === rarity);
}

function getOwnedCount(cards: Card[]): number {
  return cards.filter((c) => c.isOwned).length;
}

function getRarityBreakdown(cards: Card[]): Record<CardRarity, { owned: number; total: number }> {
  const breakdown: Record<string, { owned: number; total: number }> = {};
  for (const rarity of RARITY_ORDER) {
    const group = cards.filter((c) => c.rarity === rarity);
    breakdown[rarity] = {
      owned: group.filter((c) => c.isOwned).length,
      total: group.length,
    };
  }
  return breakdown as Record<CardRarity, { owned: number; total: number }>;
}

// ============================================================
// 页面组件
// ============================================================
export default function CardPage() {
  const gems = useGameStore((state) => state.gems);
  const spendGems = useGameStore((state) => state.spendGems);

  // 卡牌状态
  const [cards, setCards] = useState<Card[]>(PLACEHOLDER_CARDS);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [isPulling, setIsPulling] = useState(false);
  const [pullResults, setPullResults] = useState<Card[]>([]);
  const [showPullResult, setShowPullResult] = useState(false);
  const [showPullAnimation, setShowPullAnimation] = useState(false);
  const [pullCount, setPullCount] = useState(0);

  // 保底计数器
  const [pityCounterSR, setPityCounterSR] = useState(10);
  const [pityCounterSSR, setPityCounterSSR] = useState(30);
  const [pityCounterUR, setPityCounterUR] = useState(90);

  // 统计
  const ownedCount = getOwnedCount(cards);
  const progressPercent = (ownedCount / TOTAL_CARDS) * 100;
  const breakdown = getRarityBreakdown(cards);

  const canPullSingle = gems >= PULL_COST_SINGLE && !isPulling;
  const canPullMulti = gems >= PULL_COST_MULTI && !isPulling;

  // 抽奖逻辑
  const doPull = useCallback(
    (count: number): Card[] => {
      const results: Card[] = [];
      let curPitySR = pityCounterSR;
      let curPitySSR = pityCounterSSR;
      let curPityUR = pityCounterUR;

      for (let i = 0; i < count; i++) {
        let rarity: CardRarity;

        // 保底检查
        if (curPityUR >= 90) {
          rarity = 'UR';
        } else if (curPitySSR >= 50) {
          rarity = 'SSR';
        } else if (curPitySR >= 10) {
          rarity = 'SR';
        } else if (count === 10 && i === count - 1) {
          // 10连最后一抽保底 SR+
          rarity = getRandomRarity(false);
          if (rarity === 'N') rarity = 'SR';
        } else {
          rarity = getRandomRarity();
        }

        // 更新保底计数器
        curPitySR += 1;
        curPitySSR += 1;
        curPityUR += 1;
        if (rarity === 'SR' || rarity === 'SSR' || rarity === 'UR' || rarity === 'GR') {
          curPitySR = 0;
        }
        if (rarity === 'SSR' || rarity === 'UR' || rarity === 'GR') {
          curPitySSR = 0;
        }
        if (rarity === 'UR' || rarity === 'GR') {
          curPityUR = 0;
        }

        // 查找或创建该稀有度的卡
        const rarityCards = cards.filter((c) => c.rarity === rarity);
        const picked = rarityCards.length > 0
          ? rarityCards[Math.floor(Math.random() * rarityCards.length)]
          : cards[Math.floor(Math.random() * cards.length)];
        if (picked) results.push({ ...picked });
      }

      // 更新保底状态
      setPityCounterSR(curPitySR);
      setPityCounterSSR(curPitySSR);
      setPityCounterUR(curPityUR);

      return results;
    },
    [cards, pityCounterSR, pityCounterSSR, pityCounterUR],
  );

  const handlePull = useCallback(
    (count: number) => {
      const cost = count === 1 ? PULL_COST_SINGLE : PULL_COST_MULTI;
      if (gems < cost) return;
      if (!spendGems(cost)) return;

      setIsPulling(true);
      setPullCount(count);
      setShowPullAnimation(true);

      // 模拟抽卡动画延迟
      setTimeout(() => {
        const results = doPull(count);

        // 更新卡牌状态
        setCards((prev) => {
          const updated = [...prev];
          results.forEach((pulled) => {
            const existing = updated.find((c) => c.id === pulled.id);
            if (existing) {
              existing.isOwned = true;
              existing.quantity += 1;
            }
          });
          return updated;
        });

        setShowPullAnimation(false);
        setPullResults(results);
        setShowPullResult(true);
        setIsPulling(false);
      }, 1500);
    },
    [gems, spendGems, doPull],
  );

  const handleCardClick = useCallback((card: Card) => {
    if (card.isOwned) {
      setSelectedCard(card);
    }
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedCard(null);
  }, []);

  const closePullResult = useCallback(() => {
    setShowPullResult(false);
    setPullResults([]);
  }, []);

  const getBtnClass = (count: number, canAfford: boolean) => {
    if (isPulling) return 'pull-btn pull-btn--pulling';
    if (!canAfford) return 'pull-btn pull-btn--disabled';
    return count === 10 ? 'pull-btn pull-btn--10' : 'pull-btn';
  };

  return (
    <View className='card-page fade-in'>
      {/* 页面头部 */}
      <View className='page-header'>
        <Text className='page-title'>🃏 卡牌</Text>
        <View className='gems-display'>
          <Text className='gems-icon'>💎</Text>
          <Text className='gems-count'>{gems.toLocaleString()}</Text>
        </View>
      </View>

      {/* 收集进度 */}
      <View className='collection-section'>
        <View className='collection-info'>
          <Text className='collection-label'>已收集</Text>
          <Text className='collection-count'>
            {ownedCount} / {TOTAL_CARDS}
          </Text>
        </View>
        <View className='progress-bar'>
          <View className='progress-fill' style={{ width: `${progressPercent}%` }} />
        </View>
      </View>

      {/* 稀有度统计 */}
      <View className='rarity-breakdown'>
        {(RARITY_ORDER as CardRarity[]).map((rarity) => {
          const stat = breakdown[rarity];
          return (
            <View key={rarity} className='rarity-stat'>
              <View
                className='rarity-stat-dot'
                style={{ background: RARITY_CONFIG[rarity].color }}
              />
              <Text className='rarity-stat-label'>{RARITY_CONFIG[rarity].labelShort}</Text>
              <Text className='rarity-stat-count'>
                {stat.owned}/{stat.total}
              </Text>
            </View>
          );
        })}
      </View>

      {/* 抽奖按钮 */}
      <View className='pull-buttons'>
        <View
          className={getBtnClass(1, canPullSingle)}
          onClick={() => handlePull(1)}
        >
          <Text className='pull-btn-text'>抽 1 次</Text>
          <Text className='pull-btn-cost'>{PULL_COST_SINGLE} 💎</Text>
        </View>
        <View
          className={getBtnClass(10, canPullMulti)}
          onClick={() => handlePull(10)}
        >
          <Text className='pull-btn-text'>抽 10 次</Text>
          <Text className='pull-btn-cost'>{PULL_COST_MULTI} 💎</Text>
        </View>
      </View>

      {/* 保底计数器 */}
      <View className='pity-counters'>
        <View className='pity-item'>
          <View className='pity-dot pity-dot--sr' />
          <Text className='pity-label'>SR+</Text>
          <Text className='pity-value'>{pityCounterSR}/10</Text>
        </View>
        <View className='pity-item'>
          <View className='pity-dot pity-dot--ssr' />
          <Text className='pity-label'>SSR+</Text>
          <Text className='pity-value'>{pityCounterSSR}/50</Text>
        </View>
        <View className='pity-item'>
          <View className='pity-dot pity-dot--ur' />
          <Text className='pity-label'>UR</Text>
          <Text className='pity-value'>{pityCounterUR}/90</Text>
        </View>
      </View>

      {/* 卡牌网格 */}
      <ScrollView className='card-grid' scrollY enhanced bounces={false}>
        <View className='card-grid-inner'>
          {cards.map((card) => (
            <View
              key={card.id}
              className={`card-item ${card.isOwned ? 'card-item--owned' : 'card-item--locked'} rarity-border--${card.rarity.toLowerCase()}`}
              onClick={() => handleCardClick(card)}
            >
              {card.isOwned ? (
                <>
                  <View
                    className='card-rarity-badge'
                    style={{ background: RARITY_CONFIG[card.rarity].color }}
                  >
                    <Text>{RARITY_CONFIG[card.rarity].labelShort}</Text>
                  </View>
                  <Text className='card-icon'>{card.icon}</Text>
                  <Text className='card-name'>{card.name}</Text>
                  <View className='card-stats'>
                    <Text className='card-stat card-stat--atk'>+{card.stats.attack}</Text>
                    <Text className='card-stat card-stat--def'>+{card.stats.defense}</Text>
                    <Text className='card-stat card-stat--hp'>+{card.stats.hp}</Text>
                  </View>
                  {card.quantity > 1 && (
                    <Text className='card-quantity'>x{card.quantity}</Text>
                  )}
                </>
              ) : (
                <>
                  <View className='card-back'>
                    <Text className='card-back-icon'>?</Text>
                  </View>
                  <Text className='card-name card-name--locked'>未拥有</Text>
                </>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* 卡牌详情弹窗 */}
      {selectedCard && (
        <View className='card-detail-overlay' onClick={closeDetail}>
          <View className='card-detail-card' onClick={(e) => e.stopPropagation()}>
            <View className='detail-header'>
              <View
                className='rarity-badge'
                style={{ background: RARITY_CONFIG[selectedCard.rarity].color }}
              >
                <Text className='rarity-badge-text'>
                  {RARITY_CONFIG[selectedCard.rarity].label}
                </Text>
              </View>
              <View className='detail-close' onClick={closeDetail}>
                <Text className='detail-close-text'>✕</Text>
              </View>
            </View>

            <View className='detail-art'>
              <Text className='detail-art-emoji'>{selectedCard.icon}</Text>
            </View>

            <Text className='detail-name'>{selectedCard.name}</Text>
            <Text className='detail-description'>{selectedCard.description}</Text>

            <View className='detail-stats'>
              <View className='stat-item'>
                <Text className='stat-label'>攻击</Text>
                <Text className='stat-value stat-value--atk'>+{selectedCard.stats.attack}</Text>
              </View>
              <View className='stat-item'>
                <Text className='stat-label'>防御</Text>
                <Text className='stat-value stat-value--def'>+{selectedCard.stats.defense}</Text>
              </View>
              <View className='stat-item'>
                <Text className='stat-label'>生命</Text>
                <Text className='stat-value stat-value--hp'>+{selectedCard.stats.hp}</Text>
              </View>
            </View>

            <View className='detail-quantity'>
              <Text className='detail-quantity-label'>持有数量:</Text>
              <Text className='detail-quantity-value'>x{selectedCard.quantity}</Text>
            </View>
          </View>
        </View>
      )}

      {/* 抽卡动画占位 */}
      {showPullAnimation && (
        <View className='pull-animation-overlay'>
          <Text className='pull-animation-spinner'>✨</Text>
          <Text className='pull-animation-text'>
            {pullCount === 1 ? '抽取卡牌中...' : '抽取卡牌中...'}
          </Text>
        </View>
      )}

      {/* 抽奖结果弹窗 */}
      {showPullResult && (
        <View className='pull-result-overlay'>
          <View className='pull-result-header'>
            <Text className='pull-result-title'>抽出 {pullResults.length} 张卡牌</Text>
            <View className='pull-result-close' onClick={closePullResult}>
              <Text className='pull-result-close-text'>✕</Text>
            </View>
          </View>
          <ScrollView className='pull-result-grid' scrollY enhanced bounces={false}>
            <View className='pull-result-grid-inner'>
              {pullResults.map((card, index) => (
                <View
                  key={`${card.id}-${index}`}
                  className={`pull-result-card rarity-border--${card.rarity.toLowerCase()}`}
                  style={{ animationDelay: `${index * 0.08}s` }}
                >
                  <Text className='pull-result-icon'>{card.icon}</Text>
                  <Text className='pull-result-name'>{card.name}</Text>
                  <View
                    className='pull-result-rarity'
                    style={{ background: RARITY_CONFIG[card.rarity].color }}
                  >
                    <Text className='pull-result-rarity-text'>
                      {RARITY_CONFIG[card.rarity].label}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
          <View className='pull-result-footer'>
            <View className='pull-result-btn' onClick={closePullResult}>
              <Text className='pull-result-btn-text'>确定</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
