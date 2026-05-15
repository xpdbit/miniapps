import { View, Text, ScrollView } from '@tarojs/components';
import { useState } from 'react';
import { useGameStore } from '../../stores';
import './index.module.scss';

/* ============================================================
   类型定义
   ============================================================ */
interface Perk {
  id: string;
  name: string;
  description: string;
  icon: string;
  effect: string;
  maxLevel: number;
  cost: number;
  category: 'offense' | 'defense' | 'utility';
}

interface OwnedPerk {
  perkId: string;
  level: number;
}

const CATEGORY_CONFIG = {
  offense: { label: '进攻', icon: '⚔️' },
  defense: { label: '防御', icon: '🛡️' },
  utility: { label: '辅助', icon: '🏠' },
} as const;

const PLACEHOLDER_PERKS: Perk[] = [
  { id: 'p1', name: '暴击强化', description: '提升暴击率与暴击伤害', icon: '⚔️', effect: '暴击率 +5% / 等级', maxLevel: 10, cost: 100, category: 'offense' },
  { id: 'p2', name: '护甲精通', description: '增加物理防御力', icon: '🛡️', effect: '防御 +3 / 等级', maxLevel: 8, cost: 80, category: 'defense' },
  { id: 'p3', name: '连击精通', description: '增加连击触发概率', icon: '🔥', effect: '连击率 +3% / 等级', maxLevel: 10, cost: 110, category: 'offense' },
  { id: 'p4', name: '铁壁', description: '减少受到的所有伤害', icon: '🏰', effect: '减伤 +1% / 等级', maxLevel: 10, cost: 120, category: 'defense' },
  { id: 'p5', name: '高效采集', description: '加快资源采集速度', icon: '⛏️', effect: '采集速度 +10% / 等级', maxLevel: 5, cost: 60, category: 'utility' },
  { id: 'p6', name: '幸运增幅', description: '提升掉落物概率', icon: '🍀', effect: '幸运值 +2 / 等级', maxLevel: 8, cost: 90, category: 'utility' },
  { id: 'p7', name: '生命吸取', description: '造成伤害时回复生命', icon: '💉', effect: '生命吸取 +2% / 等级', maxLevel: 6, cost: 150, category: 'offense' },
  { id: 'p8', name: '快速恢复', description: '加快生命值回复速度', icon: '💚', effect: '回复速度 +5% / 等级', maxLevel: 6, cost: 70, category: 'defense' },
];

const PRESTIGE_REQUIREMENT = 100;
const PRESTIGE_POINTS_PER = 3;
const LEVEL_PENALTY = 20;

export default function PrestigePage() {
  const { level, prestigeCount, addExp, setLevel } = useGameStore();
  const [activeTab, setActiveTab] = useState<'offense' | 'defense' | 'utility'>('offense');
  const [ownedPerks, setOwnedPerks] = useState<OwnedPerk[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const canPrestige = level >= PRESTIGE_REQUIREMENT;
  const prestigePoints = prestigeCount * PRESTIGE_POINTS_PER;
  const spentPoints = ownedPerks.reduce((sum, p) => sum + p.level, 0);
  const availablePoints = prestigePoints - spentPoints;
  const filteredPerks = PLACEHOLDER_PERKS.filter((p) => p.category === activeTab);

  function getOwnedLevel(perkId: string): number {
    return ownedPerks.find((p) => p.perkId === perkId)?.level ?? 0;
  }

  function canBuyPerk(perk: Perk): boolean {
    const currentLevel = getOwnedLevel(perk.id);
    return currentLevel < perk.maxLevel && availablePoints >= perk.cost;
  }

  function handleBuyPerk(perk: Perk) {
    if (!canBuyPerk(perk)) return;
    setOwnedPerks((prev) => {
      const exists = prev.find((p) => p.perkId === perk.id);
      if (exists) {
        return prev.map((p) =>
          p.perkId === perk.id ? { ...p, level: p.level + 1 } : p
        );
      }
      return [...prev, { perkId: perk.id, level: 1 }];
    });
  }

  function handlePrestige() {
    const newLevel = Math.max(1, level - LEVEL_PENALTY);
    setLevel(newLevel);
    setShowConfirm(false);
    setShowResult(true);
    setTimeout(() => setShowResult(false), 2000);
  }

  function renderLevelDots(current: number, max: number) {
    return (
      <View className='perk-level-dots'>
        {Array.from({ length: max }).map((_, i) => (
          <View
            key={i}
            className={`perk-level-dot ${i < current ? 'perk-level-dot--filled' : 'perk-level-dot--empty'}`}
          />
        ))}
      </View>
    );
  }

  return (
    <View className='prestige-page fade-in'>
      {/* 页面标题 */}
      <View className='prestige-header'>
        <Text className='prestige-header-title'>轮回</Text>
        <Text className='prestige-header-sub'>Lv.{level}</Text>
      </View>

      {/* 状态卡片 */}
      <View className='prestige-stats-card'>
        <View className='prestige-stat-item'>
          <Text className='prestige-stat-icon'>🔄</Text>
          <Text className='prestige-stat-label'>当前轮回</Text>
          <Text className='prestige-stat-value'>{prestigeCount} 次</Text>
        </View>
        <View className='prestige-stat-divider' />
        <View className='prestige-stat-item'>
          <Text className='prestige-stat-icon'>⭐</Text>
          <Text className='prestige-stat-label'>可用点数</Text>
          <Text className='prestige-stat-value prestige-stat-value--accent'>{availablePoints}</Text>
        </View>
        <View className='prestige-stat-divider' />
        <View className='prestige-stat-item'>
          <Text className='prestige-stat-icon'>🎯</Text>
          <Text className='prestige-stat-label'>等级要求</Text>
          <Text className='prestige-stat-value'>Lv.{PRESTIGE_REQUIREMENT}</Text>
        </View>
      </View>

      {/* 轮回按钮 */}
      <View
        className={`prestige-btn ${canPrestige ? 'prestige-btn--active' : ''}`}
        onClick={() => canPrestige && setShowConfirm(true)}
      >
        <Text className='prestige-btn-text'>
          {canPrestige ? '开始轮回' : `需要 Lv.${PRESTIGE_REQUIREMENT}`}
        </Text>
        <Text className='prestige-btn-hint'>
          {canPrestige
            ? `等级下降 ${LEVEL_PENALTY} 级、获得 ${PRESTIGE_POINTS_PER} 点`
            : '轮回后可解锁天赋加成'}
        </Text>
      </View>

      {/* 天赋树标题 */}
      <View className='perk-section-title'>
        <Text className='perk-section-title-text'>天赋树</Text>
        <Text className='perk-section-title-sub'>{availablePoints} 点剩余</Text>
      </View>

      {/* 分类标签 */}
      <View className='perk-tabs'>
        {(Object.keys(CATEGORY_CONFIG) as Array<'offense' | 'defense' | 'utility'>).map((key) => (
          <View
            key={key}
            className={`perk-tab ${activeTab === key ? 'perk-tab--active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            <Text className='perk-tab-text'>{CATEGORY_CONFIG[key].icon} {CATEGORY_CONFIG[key].label}</Text>
          </View>
        ))}
      </View>

      {/* Perk 列表 */}
      <ScrollView className='perk-list' scrollY>
        {filteredPerks.map((perk) => {
          const ownedLevel = getOwnedLevel(perk.id);
          return (
            <View key={perk.id} className={`perk-card ${ownedLevel > 0 ? 'perk-card--owned' : ''}`}>
              <View className='perk-card-left'>
                <View className='perk-icon'>
                  <Text className='perk-icon-text'>{perk.icon}</Text>
                </View>
                <View className='perk-info'>
                  <Text className='perk-name'>{perk.name}</Text>
                  <Text className='perk-effect'>{perk.effect}</Text>
                  <Text className='perk-desc'>{perk.description}</Text>
                  {renderLevelDots(ownedLevel, perk.maxLevel)}
                </View>
              </View>
              <View className='perk-card-right'>
                <Text className='perk-level-text'>{ownedLevel}/{perk.maxLevel}</Text>
                <View
                  className={`perk-buy-btn ${!canBuyPerk(perk) ? 'perk-buy-btn--disabled' : ''}`}
                  onClick={() => handleBuyPerk(perk)}
                >
                  <Text className='perk-buy-btn-text'>
                    {ownedLevel >= perk.maxLevel ? 'MAX' : `+${perk.cost}`}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* 已激活加成摘要 */}
      {ownedPerks.length > 0 && (
        <View className='bonus-summary'>
          <Text className='bonus-summary-title'>已激活加成</Text>
          {ownedPerks
            .filter((op) => op.level > 0)
            .map((op) => {
              const perk = PLACEHOLDER_PERKS.find((p) => p.id === op.perkId);
              if (!perk) return null;
              return (
                <View key={op.perkId} className='bonus-item'>
                  <Text className='bonus-item-icon'>{perk.icon}</Text>
                  <Text className='bonus-item-name'>{perk.name}</Text>
                  <Text className='bonus-item-level'>Lv.{op.level}</Text>
                  <Text className='bonus-item-value'>+{perk.effect}</Text>
                </View>
              );
            })}
        </View>
      )}

      {/* 确认弹窗 */}
      {showConfirm && (
        <View className='confirm-overlay' onClick={() => setShowConfirm(false)}>
          <View className='confirm-dialog' onClick={(e) => e.stopPropagation()}>
            <Text className='confirm-title'>确认轮回？</Text>
            <Text className='confirm-desc'>
              等级将从 Lv.{level} 下降至 Lv.{Math.max(1, level - LEVEL_PENALTY)}
              {'\n'}
              获得 {PRESTIGE_POINTS_PER} 点轮回点数
            </Text>
            <View className='confirm-actions'>
              <View className='confirm-btn confirm-btn--cancel' onClick={() => setShowConfirm(false)}>
                <Text className='confirm-btn-text'>取消</Text>
              </View>
              <View className='confirm-btn confirm-btn--ok' onClick={handlePrestige}>
                <Text className='confirm-btn-text'>确认轮回</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 轮回结果弹窗 */}
      {showResult && (
        <View className='confirm-overlay'>
          <View className='confirm-dialog confirm-dialog--result'>
            <Text className='confirm-result-icon'>🔄</Text>
            <Text className='confirm-title'>轮回完成！</Text>
            <Text className='confirm-desc'>获得 {PRESTIGE_POINTS_PER} 点轮回点数</Text>
          </View>
        </View>
      )}
    </View>
  );
}