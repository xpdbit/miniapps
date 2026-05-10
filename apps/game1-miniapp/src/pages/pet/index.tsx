import { useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import './index.module.scss';

// Types
type PetRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

interface Pet {
  id: string;
  name: string;
  icon: string;
  rarity: PetRarity;
  level: number;
  exp: number;
  expToNext: number;
  affection: number;
  evolutionStage: number;
  maxEvolutionStage: number;
  attack: number;
  defense: number;
  hp: number;
  maxHp: number;
  isActive: boolean;
  skillName: string;
  description: string;
}

interface FoodItem {
  id: string;
  name: string;
  icon: string;
  affectionBonus: number;
}

// Rarity config
const RARITY_CONFIG: Record<PetRarity, { color: string; label: string }> = {
  common: { color: 'var(--rarity-common)', label: '普通' },
  uncommon: { color: 'var(--rarity-uncommon)', label: '优秀' },
  rare: { color: 'var(--rarity-rare)', label: '稀有' },
  epic: { color: 'var(--rarity-epic)', label: '史诗' },
  legendary: { color: 'var(--rarity-legendary)', label: '传说' },
};

// Placeholder data
const PLACEHOLDER_PETS: Pet[] = [
  {
    id: '1',
    name: '炎火狐',
    icon: '🔥',
    rarity: 'epic',
    level: 25,
    exp: 1250,
    expToNext: 2000,
    affection: 78,
    evolutionStage: 2,
    maxEvolutionStage: 3,
    attack: 458,
    defense: 312,
    hp: 2800,
    maxHp: 3200,
    isActive: true,
    skillName: '烈焰风暴',
    description: '掌控火焰的神秘灵狐',
  },
  {
    id: '2',
    name: '水晶龟',
    icon: '💎',
    rarity: 'rare',
    level: 18,
    exp: 800,
    expToNext: 1500,
    affection: 92,
    evolutionStage: 2,
    maxEvolutionStage: 3,
    attack: 220,
    defense: 580,
    hp: 4500,
    maxHp: 4500,
    isActive: false,
    skillName: '晶壁防御',
    description: '外壳坚硬如水晶',
  },
  {
    id: '3',
    name: '风灵鸟',
    icon: '🪶',
    rarity: 'uncommon',
    level: 12,
    exp: 450,
    expToNext: 800,
    affection: 65,
    evolutionStage: 1,
    maxEvolutionStage: 3,
    attack: 185,
    defense: 145,
    hp: 1800,
    maxHp: 2000,
    isActive: false,
    skillName: '风之庇护',
    description: '御风而行的灵鸟',
  },
  {
    id: '4',
    name: '岩甲龙',
    icon: '🪨',
    rarity: 'common',
    level: 8,
    exp: 200,
    expToNext: 500,
    affection: 40,
    evolutionStage: 1,
    maxEvolutionStage: 2,
    attack: 95,
    defense: 210,
    hp: 1200,
    maxHp: 1500,
    isActive: false,
    skillName: '岩崩',
    description: '披戴岩石铠甲的亚龙',
  },
];

const PLACEHOLDER_FOOD: FoodItem[] = [
  { id: 'f1', name: '能量饼干', icon: '🍪', affectionBonus: 5 },
  { id: 'f2', name: '星光果', icon: '⭐', affectionBonus: 12 },
  { id: 'f3', name: '彩虹糖', icon: '🍬', affectionBonus: 8 },
];

export default function PetPage() {
  const [pets] = useState<Pet[]>(PLACEHOLDER_PETS);
  const [foodItems] = useState<FoodItem[]>(PLACEHOLDER_FOOD);
  const [selectedPet, setSelectedPet] = useState<Pet>(PLACEHOLDER_PETS[0]!);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [showFeedOverlay, setShowFeedOverlay] = useState(false);
  const [showFeedResult, setShowFeedResult] = useState(false);
  const [feedAnimationFood, setFeedAnimationFood] = useState<FoodItem | null>(null);

  const handleSelectThumb = (pet: Pet) => {
    setSelectedPet(pet);
  };

  const handleFeed = () => {
    setShowFeedOverlay(true);
    setSelectedFood(null);
  };

  const handleSelectFood = (food: FoodItem) => {
    setSelectedFood(food);
  };

  const handleConfirmFeed = () => {
    if (!selectedFood || !selectedPet) return;

    const foodToAnimate = selectedFood;
    setFeedAnimationFood(foodToAnimate);
    setShowFeedOverlay(false);

    setTimeout(() => {
      setShowFeedResult(true);
      setFeedAnimationFood(null);

      setTimeout(() => {
        setShowFeedResult(false);
      }, 1500);
    }, 600);
  };

  const handleTrain = () => {
    const newExp = Math.min(selectedPet.exp + 150, selectedPet.expToNext);
    const newLevel = selectedPet.exp + 150 >= selectedPet.expToNext ? selectedPet.level + 1 : selectedPet.level;
    setSelectedPet({ ...selectedPet, exp: newExp, level: newLevel });
  };

  const handleEvolve = () => {
    if (selectedPet.evolutionStage < selectedPet.maxEvolutionStage) {
      setSelectedPet({
        ...selectedPet,
        evolutionStage: selectedPet.evolutionStage + 1,
        maxHp: selectedPet.maxHp + 500,
        hp: selectedPet.hp + 500,
      });
    }
  };

  const hasPets = pets.length > 0;
  const canEvolve = selectedPet.evolutionStage < selectedPet.maxEvolutionStage;

  const getRarityColor = (rarity: PetRarity) => RARITY_CONFIG[rarity].color;
  const getRarityLabel = (rarity: PetRarity) => RARITY_CONFIG[rarity].label;

  // 宠物活跃加成计算
  interface PetBonus {
    label: string;
    value: string;
    icon: string;
  }

  const computePetBonuses = (pet: Pet): PetBonus[] => {
    const bonuses: PetBonus[] = [];
    const lvRatio = pet.level / 50;
    // 等级加成
    bonuses.push({ label: '攻击加成', value: `+${Math.floor(pet.attack * lvRatio * 0.15)}`, icon: '⚔️' });
    bonuses.push({ label: '防御加成', value: `+${Math.floor(pet.defense * lvRatio * 0.12)}`, icon: '🛡️' });
    // 好感度加成
    const affBonus = Math.floor(pet.affection / 20) * 2;
    if (affBonus > 0) {
      bonuses.push({ label: '全属性%', value: `+${affBonus}%`, icon: '✨' });
    }
    // 进化加成
    if (pet.evolutionStage > 1) {
      bonuses.push({ label: '进化奖励', value: `+${pet.evolutionStage * 5}%`, icon: '⬆️' });
    }
    // 稀有度加成
    const rarityBonusMap: Record<PetRarity, string> = {
      common: '+2%', uncommon: '+5%', rare: '+8%', epic: '+12%', legendary: '+20%',
    };
    bonuses.push({ label: '稀有度奖励', value: rarityBonusMap[pet.rarity], icon: '💎' });
    return bonuses;
  };

  const activeBonuses = computePetBonuses(selectedPet);

  return (
    <View className='pet-page fade-in'>
      <Text className='page-title'>🐾 宠物</Text>

      {!hasPets ? (
        <View className='empty-state'>
          <Text className='empty-icon'>🥚</Text>
          <Text className='empty-text'>暂无宠物</Text>
          <Text className='empty-hint'>完成冒险或孵化获取宠物蛋</Text>
        </View>
      ) : (
        <>
          {/* Active Pet Display */}
          <View className='active-pet'>
            <View className='active-pet-header'>
              <View className='pet-icon-large' style={{ backgroundColor: getRarityColor(selectedPet.rarity) + '20' }}>
                <Text className='pet-icon-emoji'>{selectedPet.icon}</Text>
              </View>
              <View className='pet-info'>
                <View className='pet-name-row'>
                  <Text className='pet-name' style={{ color: getRarityColor(selectedPet.rarity) }}>
                    {selectedPet.name}
                  </Text>
                  <View className='pet-level-badge'>
                    <Text className='pet-level-text'>Lv.{selectedPet.level}</Text>
                  </View>
                </View>
                <Text className='pet-rarity-label' style={{ color: getRarityColor(selectedPet.rarity) }}>
                  {getRarityLabel(selectedPet.rarity)}
                </Text>
                <Text className='pet-description'>{selectedPet.description}</Text>
              </View>
            </View>

            {/* Evolution Stars */}
            <View className='evo-stars'>
              {Array.from({ length: selectedPet.maxEvolutionStage }).map((_, i) => (
                <View
                  key={i}
                  className={`evo-star ${i < selectedPet.evolutionStage ? 'evo-star--filled' : 'evo-star--empty'}`}
                >
                  <Text className='evo-star-icon'>★</Text>
                </View>
              ))}
              <Text className='evo-stage-text'>
                {selectedPet.evolutionStage}/{selectedPet.maxEvolutionStage}
              </Text>
            </View>

            {/* Stat Bars */}
            <View className='stat-bars'>
              <View className='pet-stat-bar'>
                <View className='stat-bar-label'>
                  <Text className='stat-icon'>❤️</Text>
                  <Text className='stat-name'>生命</Text>
                </View>
                <View className='stat-bar-track'>
                  <View
                    className='stat-bar-fill stat-bar-fill--hp'
                    style={{ width: `${(selectedPet.hp / selectedPet.maxHp) * 100}%` }}
                  />
                </View>
                <Text className='stat-value'>{selectedPet.hp}/{selectedPet.maxHp}</Text>
              </View>

              <View className='pet-stat-bar'>
                <View className='stat-bar-label'>
                  <Text className='stat-icon'>✨</Text>
                  <Text className='stat-name'>经验</Text>
                </View>
                <View className='stat-bar-track'>
                  <View
                    className='stat-bar-fill stat-bar-fill--exp'
                    style={{ width: `${(selectedPet.exp / selectedPet.expToNext) * 100}%` }}
                  />
                </View>
                <Text className='stat-value'>{selectedPet.exp}/{selectedPet.expToNext}</Text>
              </View>

              <View className='pet-stat-bar'>
                <View className='stat-bar-label'>
                  <Text className='stat-icon'>💕</Text>
                  <Text className='stat-name'>好感度</Text>
                </View>
                <View className='stat-bar-track'>
                  <View
                    className='stat-bar-fill stat-bar-fill--affection'
                    style={{ width: `${selectedPet.affection}%` }}
                  />
                </View>
                <Text className='stat-value'>{selectedPet.affection}%</Text>
              </View>
            </View>

            {/* Stats Row */}
            <View className='pet-stats'>
              <View className='pet-stat-item'>
                <Text className='pet-stat-value' style={{ color: 'var(--color-error)' }}>{selectedPet.attack}</Text>
                <Text className='pet-stat-label'>攻击</Text>
              </View>
              <View className='pet-stat-divider' />
              <View className='pet-stat-item'>
                <Text className='pet-stat-value' style={{ color: 'var(--color-info)' }}>{selectedPet.defense}</Text>
                <Text className='pet-stat-label'>防御</Text>
              </View>
              <View className='pet-stat-divider' />
              <View className='pet-stat-item'>
                <Text className='pet-stat-value' style={{ color: 'var(--color-success)' }}>{selectedPet.maxHp}</Text>
                <Text className='pet-stat-label'>生命</Text>
              </View>
            </View>

            {/* Skill Display */}
            <View className='pet-skill'>
              <Text className='skill-icon'>⚡</Text>
              <Text className='skill-name'>{selectedPet.skillName}</Text>
            </View>
          </View>

          {/* Pet Bonuses Display */}
          {activeBonuses.length > 0 && (
            <View className='pet-bonuses'>
              <Text className='section-label'>活跃加成</Text>
              <View className='pet-bonuses-list'>
                {activeBonuses.map((bonus) => (
                  <View key={bonus.label} className='pet-bonus-chip'>
                    <Text className='pet-bonus-chip-icon'>{bonus.icon}</Text>
                    <View className='pet-bonus-chip-info'>
                      <Text className='pet-bonus-chip-value'>{bonus.value}</Text>
                      <Text className='pet-bonus-chip-label'>{bonus.label}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Pet Thumbnails Horizontal Scroll */}
          <View className='pet-thumb-section'>
            <Text className='section-label'>已拥有的宠物</Text>
            <ScrollView className='pet-thumb-list' scrollX enableFlex>
              {pets.map((pet) => (
                <View
                  key={pet.id}
                  className={`pet-thumb ${pet.id === selectedPet.id ? 'pet-thumb--active' : ''}`}
                  onClick={() => handleSelectThumb(pet)}
                >
                  <Text className='pet-thumb-icon'>{pet.icon}</Text>
                  <Text className='pet-thumb-name'>{pet.name}</Text>
                  <Text className='pet-thumb-level'>Lv.{pet.level}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Action Buttons */}
          <View className='pet-actions'>
            <View className='pet-action-btn' onClick={handleFeed}>
              <Text className='action-icon'>🍖</Text>
              <Text className='action-text'>喂食</Text>
            </View>
            <View className='pet-action-btn' onClick={handleTrain}>
              <Text className='action-icon'>💪</Text>
              <Text className='action-text'>训练</Text>
            </View>
            <View
              className={`pet-action-btn ${!canEvolve ? 'pet-action-btn--disabled' : ''}`}
              onClick={canEvolve ? handleEvolve : undefined}
            >
              <Text className='action-icon'>⬆️</Text>
              <Text className='action-text'>{canEvolve ? '进化' : '已满级'}</Text>
            </View>
          </View>

          {/* Evolution Progress */}
          {canEvolve && (
            <View className='evo-section'>
              <Text className='evo-title'>进化进度</Text>
              <View className='evo-progress-bar'>
                <View
                  className='evo-progress-fill'
                  style={{ width: `${(selectedPet.evolutionStage / selectedPet.maxEvolutionStage) * 100}%` }}
                />
              </View>
              <Text className='evo-hint'>
                再获得 {selectedPet.maxEvolutionStage - selectedPet.evolutionStage} 次进化即可达到最高形态
              </Text>
            </View>
          )}
        </>
      )}

      {/* Feed Result Animation */}
      {showFeedResult && (
        <View className='feed-result'>
          <Text className='feed-result-icon'>✨</Text>
          <Text className='feed-result-text'>喂养成功！好感度+{selectedFood?.affectionBonus ?? 0}</Text>
        </View>
      )}

      {/* Food Selection Overlay */}
      {showFeedOverlay && (
        <View className='feed-overlay'>
          <View className='feed-overlay-bg' onClick={() => setShowFeedOverlay(false)} />
          <View className='feed-panel'>
            <View className='feed-panel-header'>
              <Text className='feed-panel-title'>选择食物</Text>
              <View className='feed-close-btn' onClick={() => setShowFeedOverlay(false)}>
                <Text className='feed-close-icon'>✕</Text>
              </View>
            </View>
            <ScrollView className='feed-grid' scrollY>
              {foodItems.map((food) => (
                <View
                  key={food.id}
                  className={`food-item ${selectedFood?.id === food.id ? 'food-item--selected' : ''}`}
                  onClick={() => handleSelectFood(food)}
                >
                  <Text className='food-icon'>{food.icon}</Text>
                  <Text className='food-name'>{food.name}</Text>
                  <Text className='food-bonus'>+{food.affectionBonus}好感度</Text>
                </View>
              ))}
            </ScrollView>
            <View
              className={`feed-confirm-btn ${!selectedFood ? 'feed-confirm-btn--disabled' : ''}`}
              onClick={selectedFood ? handleConfirmFeed : undefined}
            >
              <Text className='feed-confirm-text'>投喂</Text>
            </View>
          </View>
        </View>
      )}

      {/* Feed Animation */}
      {feedAnimationFood && (
        <View className='feed-animation'>
          <Text className='feed-animation-icon'>{feedAnimationFood.icon}</Text>
        </View>
      )}
    </View>
  );
}