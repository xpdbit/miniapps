import { View, Text, ScrollView } from '@tarojs/components';
import { useState } from 'react';
import { useGameStore } from '../../stores';
import './index.module.scss';

// ============ Types ============
interface Perk {
  id: string;
  name: string;
  description: string;
  icon: string;
  cost: number;
  maxLevel: number;
  currentLevel: number;
  effect: string;
  category: 'combat' | 'economy' | 'growth' | 'utility';
}

// ============ Constants ============
const PRESTIGE_REQUIREMENT = 100;
const PRESTIGE_POINTS_PER = 3;

const CATEGORY_CONFIG = {
  combat: { name: '战斗', icon: '⚔️' },
  economy: { name: '经济', icon: '💰' },
  growth: { name: '成长', icon: '📈' },
  utility: { name: '功能', icon: '🔧' },
} as const;

// ============ Placeholder Data ============
const PLACEHOLDER_PERKS: Perk[] = [
  {
    id: 'strength-blessing',
    name: '力量祝福',
    description: '战斗攻击力永久提升',
    icon: '💪',
    cost: 5,
    maxLevel: 10,
    currentLevel: 0,
    effect: '+5% ATK',
    category: 'combat',
  },
  {
    id: 'iron-defense',
    name: '铁壁防御',
    description: '受到伤害永久减免',
    icon: '🛡️',
    cost: 5,
    maxLevel: 10,
    currentLevel: 0,
    effect: '+3% DEF',
    category: 'combat',
  },
  {
    id: 'wealth-source',
    name: '财富之源',
    description: '金币获取量永久提升',
    icon: '🪙',
    cost: 4,
    maxLevel: 10,
    currentLevel: 0,
    effect: '+10% Gold',
    category: 'economy',
  },
  {
    id: 'gem-fortune',
    name: '宝石幸运',
    description: '宝石获取概率提升',
    icon: '💎',
    cost: 8,
    maxLevel: 5,
    currentLevel: 0,
    effect: '+5% Gem',
    category: 'economy',
  },
  {
    id: 'exp-booster',
    name: '经验加速',
    description: '经验值获取效率提升',
    icon: '📚',
    cost: 3,
    maxLevel: 10,
    currentLevel: 0,
    effect: '+8% EXP',
    category: 'growth',
  },
  {
    id: 'swift-travel',
    name: '疾行旅途',
    description: '旅行速度永久提升',
    icon: '🏃',
    cost: 4,
    maxLevel: 10,
    currentLevel: 0,
    effect: '+5% Speed',
    category: 'growth',
  },
  {
    id: 'auto-collect',
    name: '自动收集',
    description: '离线收益自动领取',
    icon: '🤖',
    cost: 10,
    maxLevel: 3,
    currentLevel: 0,
    effect: '+10% Offline',
    category: 'utility',
  },
  {
    id: 'double-reward',
    name: '双倍奖励',
    description: '完成任务获得双倍奖励',
    icon: '🎁',
    cost: 15,
    maxLevel: 3,
    currentLevel: 0,
    effect: '+15% Rewards',
    category: 'utility',
  },
];

// ============ Component ============
export default function PrestigePage() {
  const { level, prestigeCount } = useGameStore();
  const [showConfirm, setShowConfirm] = useState(false);
  const [perks, setPerks] = useState<Perk[]>(PLACEHOLDER_PERKS);

  const totalSpentPoints = perks.reduce(
    (sum, perk) => sum + perk.cost * perk.currentLevel,
    0
  );
  const availablePoints = prestigeCount * PRESTIGE_POINTS_PER - totalSpentPoints;
  const canPrestige = level >= PRESTIGE_REQUIREMENT;

  const handlePrestige = () => {
    if (!canPrestige) return;
    setShowConfirm(true);
  };

  const confirmPrestige = () => {
    useGameStore.getState().setLevel(1);
    useGameStore.getState().setExp(0);
    useGameStore.setState((state) => ({ prestigeCount: state.prestigeCount + 1 }));
    setShowConfirm(false);
  };

  const cancelPrestige = () => {
    setShowConfirm(false);
  };

  const handleBuyPerk = (perkId: string) => {
    const perk = perks.find((p) => p.id === perkId);
    if (!perk || perk.currentLevel >= perk.maxLevel || availablePoints < perk.cost) {
      return;
    }
    setPerks((prev) =>
      prev.map((p) =>
        p.id === perkId ? { ...p, currentLevel: p.currentLevel + 1 } : p
      )
    );
  };

  const perksByCategory = Object.entries(CATEGORY_CONFIG).map(
    ([cat, config]) => ({
      category: cat as Perk['category'],
      ...config,
      perks: perks.filter((p) => p.category === cat),
    })
  );

  return (
    <View className='prestige-page fade-in'>
      <ScrollView scrollY className='prestige-scroll'>
        <Text className='page-title'>🔄 轮回</Text>

        <View className='prestige-info'>
          <Text className='info-text text-secondary'>
            轮回后可获得轮回点数，解锁永久加成
          </Text>
        </View>

        <View className='prestige-stats'>
          <View className='stat-row'>
            <Text className='stat-label'>当前轮回</Text>
            <Text className='stat-value'>第 {prestigeCount} 次</Text>
          </View>
          <View className='stat-row'>
            <Text className='stat-label'>轮回点数</Text>
            <Text className='stat-value text-accent'>{availablePoints}</Text>
          </View>
          <View className='stat-row'>
            <Text className='stat-label'>升级所需</Text>
            <Text className='stat-value'>
              Lv.{PRESTIGE_REQUIREMENT}（当前 Lv.{level}）
            </Text>
          </View>
        </View>

        <View
          className={prestige-btn }
          onClick={handlePrestige}
        >
          <Text>{canPrestige ? '🔥 进行轮回' : 需要 Lv.}</Text>
        </View>

        <View className='perk-section'>
          <View className='perk-section-header'>
            <Text className='perk-section-title'>天赋树</Text>
          </View>

          {perksByCategory.map(({ category, name, icon, perks: categoryPerks }) => (
            <View key={category} className='perk-category'>
              <View className='perk-category-header'>
                <Text className='perk-category-icon'>{icon}</Text>
                <Text className='perk-category-name'>{name}</Text>
              </View>

              {categoryPerks.map((perk) => {
                const isMaxed = perk.currentLevel >= perk.maxLevel;
                const canAfford = availablePoints >= perk.cost;
                const canBuy = !isMaxed && canAfford;

                return (
                  <View key={perk.id} className='perk-card'>
                    <View className='perk-icon'>{perk.icon}</View>
                    <View className='perk-info'>
                      <Text className='perk-name'>{perk.name}</Text>
                      <Text className='perk-effect'>{perk.description}</Text>
                      <View className='perk-effect-bonus'>
                        <Text className='perk-effect-text'>
                          {perk.effect} / 等级
                        </Text>
                      </View>
                    </View>
                    <View className='perk-actions'>
                      <View className='perk-level-dots'>
                        {Array.from({ length: perk.maxLevel }).map((_, i) => (
                          <View
                            key={i}
                            className={perk-level-dot }
                          />
                        ))}
                      </View>
                      <View className='perk-cost-row'>
                        <Text className='perk-cost'>
                          {isMaxed ? '已满级' : ${perk.cost} 点}
                        </Text>
                        {!isMaxed && (
                          <View
                            className={perk-buy-btn }
                            onClick={() => handleBuyPerk(perk.id)}
                          >
                            <Text className='perk-buy-text'>+</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <View className='bonus-summary'>
          <Text className='bonus-summary-title'>已激活加成</Text>
          {perks
            .filter((p) => p.currentLevel > 0)
            .map((perk) => {
              const effectNum = parseInt(perk.effect.match(/\d+/)?.[0] || '0');
              return (
                <View key={perk.id} className='bonus-item'>
                  <Text className='bonus-icon'>{perk.icon}</Text>
                  <Text className='bonus-name'>{perk.name}</Text>
                  <Text className='bonus-value'>
                    {perk.effect} x{perk.currentLevel} = +{effectNum * perk.currentLevel}%
                  </Text>
                </View>
              );
            })}
          {perks.filter((p) => p.currentLevel > 0).length === 0 && (
            <Text className='bonus-empty'>尚未激活任何加成</Text>
          )}
        </View>

        <View className='page-bottom-padding' />
      </ScrollView>

      {showConfirm && (
        <View className='confirm-overlay' onClick={cancelPrestige}>
          <View className='confirm-dialog' onClick={(e) => e.stopPropagation()}>
            <Text className='confirm-title'>确认轮回？</Text>
            <Text className='confirm-desc'>
              轮回将重置你的等级和经验，但会获得 {PRESTIGE_POINTS_PER} 点轮回点数
            </Text>
            <View className='confirm-actions'>
              <View className='confirm-btn' onClick={confirmPrestige}>
                <Text>确认轮回</Text>
              </View>
              <View className='cancel-btn' onClick={cancelPrestige}>
                <Text>取消</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}