import { View, Text, ScrollView } from '@tarojs/components';
import { useState } from 'react';
import './index.module.scss';

// ============================================================
// 类型定义
// ============================================================

type SkillType = 'active' | 'passive';
type SkillTarget = 'self' | 'enemy' | 'ally' | 'all';
type SkillRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

interface Skill {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: SkillType;
  rarity: SkillRarity;
  level: number;
  maxLevel: number;
  cooldown: number;
  currentCooldown: number;
  target: SkillTarget;
  isKnown: boolean;
  isEquipped: boolean;
  damage?: number;
  effect?: string;
}

// ============================================================
// 常量配置
// ============================================================

const RARITY_COLORS: Record<SkillRarity, string> = {
  common: 'var(--rarity-common)',
  uncommon: 'var(--rarity-uncommon)',
  rare: 'var(--rarity-rare)',
  epic: 'var(--rarity-epic)',
  legendary: 'var(--rarity-legendary)',
};

const TYPE_CONFIG: Record<SkillType, { label: string; tagColor: string }> = {
  active: { label: '主动', tagColor: 'var(--color-error)' },
  passive: { label: '被动', tagColor: 'var(--color-info)' },
};

const TARGET_LABELS: Record<SkillTarget, string> = {
  self: '自身',
  enemy: '敌方',
  ally: '友方',
  all: '全体',
};

// ============================================================
// 占位技能数据
// ============================================================

const PLACEHOLDER_SKILLS: Skill[] = [
  {
    id: 'skill_001',
    name: '猛击',
    description: '对单个敌人造成150%攻击力的物理伤害，有30%概率附加眩晕效果，持续1回合。升级提升伤害倍率。',
    icon: '⚔️',
    type: 'active',
    rarity: 'common',
    level: 3,
    maxLevel: 5,
    cooldown: 3,
    currentCooldown: 0,
    target: 'enemy',
    isKnown: true,
    isEquipped: true,
    damage: 150,
  },
  {
    id: 'skill_002',
    name: '治愈之光',
    description: '恢复单个友方目标的生命值，恢复量为自身攻击力120%。冷却2回合。',
    icon: '✨',
    type: 'active',
    rarity: 'uncommon',
    level: 2,
    maxLevel: 5,
    cooldown: 2,
    currentCooldown: 1,
    target: 'ally',
    isKnown: true,
    isEquipped: true,
    effect: '恢复120%攻击力',
  },
  {
    id: 'skill_003',
    name: '铁壁',
    description: '被动提升自身10%防御力。不可与其他防御增益叠加。',
    icon: '🛡️',
    type: 'passive',
    rarity: 'common',
    level: 1,
    maxLevel: 3,
    cooldown: 0,
    currentCooldown: 0,
    target: 'self',
    isKnown: true,
    isEquipped: false,
    effect: '+10%防御力',
  },
  {
    id: 'skill_004',
    name: '雷霆一击',
    description: '对随机3个敌人造成80%攻击力的雷属性伤害，15%概率麻痹目标。',
    icon: '⚡',
    type: 'active',
    rarity: 'rare',
    level: 1,
    maxLevel: 5,
    cooldown: 4,
    currentCooldown: 0,
    target: 'enemy',
    isKnown: true,
    isEquipped: false,
    damage: 80,
  },
  {
    id: 'skill_005',
    name: '连击意志',
    description: '被动使自身每次攻击后提升5%暴击率，最高叠加5层，持续至战斗结束。',
    icon: '🔥',
    type: 'passive',
    rarity: 'epic',
    level: 0,
    maxLevel: 5,
    cooldown: 0,
    currentCooldown: 0,
    target: 'self',
    isKnown: false,
    isEquipped: false,
    effect: '+5%暴击率/层',
  },
  {
    id: 'skill_006',
    name: '群体治疗',
    description: '恢复所有友方目标30%最大生命值的生命值，冷却5回合。',
    icon: '💚',
    type: 'active',
    rarity: 'rare',
    level: 0,
    maxLevel: 3,
    cooldown: 5,
    currentCooldown: 0,
    target: 'all',
    isKnown: false,
    isEquipped: false,
    effect: '恢复30%HP',
  },
  {
    id: 'skill_007',
    name: '龙息',
    description: '对敌方全体造成100%攻击力的火属性伤害，20%概率附加灼烧，每回合掉血3%，持续2回合。',
    icon: '🐉',
    type: 'active',
    rarity: 'legendary',
    level: 0,
    maxLevel: 5,
    cooldown: 6,
    currentCooldown: 0,
    target: 'all',
    isKnown: false,
    isEquipped: false,
    damage: 100,
  },
  {
    id: 'skill_008',
    name: '钢铁意志',
    description: '被动免疫眩晕和冰冻状态。受到致命伤害时有20%概率保留1HP。',
    icon: '💪',
    type: 'passive',
    rarity: 'legendary',
    level: 0,
    maxLevel: 5,
    cooldown: 0,
    currentCooldown: 0,
    target: 'self',
    isKnown: false,
    isEquipped: false,
    effect: '免疫异常状态',
  },
];

const MAX_ACTIVE_EQUIP = 4;
const MAX_PASSIVE_EQUIP = 6;

// ============================================================
// 页面组件
// ============================================================

export default function SkillPage() {
  const [activeTab, setActiveTab] = useState<'active' | 'passive'>('active');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [showEquipConfirm, setShowEquipConfirm] = useState(false);
  const [skills, setSkills] = useState<Skill[]>(PLACEHOLDER_SKILLS);

  const getRarityColor = (rarity: SkillRarity) => RARITY_COLORS[rarity];

  const getEquippedCount = (type: SkillType) =>
    skills.filter((s) => s.type === type && s.isEquipped).length;

  const getMaxEquip = (type: SkillType) =>
    type === 'active' ? MAX_ACTIVE_EQUIP : MAX_PASSIVE_EQUIP;

  const activeSkills = skills.filter((s) => s.type === 'active');
  const passiveSkills = skills.filter((s) => s.type === 'passive');

  const currentSkills = activeTab === 'active' ? activeSkills : passiveSkills;
  const equippedSkills = currentSkills.filter((s) => s.isEquipped);
  const knownSkills = currentSkills.filter((s) => s.isKnown && !s.isEquipped);
  const lockedSkills = currentSkills.filter((s) => !s.isKnown);

  const handleEquipToggle = (skill: Skill) => {
    setSelectedSkill(skill);
    setShowEquipConfirm(true);
  };

  const confirmEquip = () => {
    if (!selectedSkill) return;

    setSkills((prev) =>
      prev.map((s) => {
        if (s.id === selectedSkill.id) {
          return { ...s, isEquipped: !s.isEquipped };
        }
        // 若装备，尝试自动卸下已满的同类装备
        if (
          selectedSkill.type === s.type &&
          selectedSkill.isEquipped === false &&
          s.isEquipped
        ) {
          const sameTypeEquipped = prev.filter(
            (p) => p.type === s.type && p.isEquipped
          );
          const maxEq = s.type === 'active' ? MAX_ACTIVE_EQUIP : MAX_PASSIVE_EQUIP;
          if (sameTypeEquipped.length >= maxEq) {
            return { ...s, isEquipped: false };
          }
        }
        return s;
      })
    );
    setShowEquipConfirm(false);
    setSelectedSkill(null);
  };

  const cancelEquip = () => {
    setShowEquipConfirm(false);
    setSelectedSkill(null);
  };

  const handleCardTap = (skill: Skill) => {
    if (!skill.isKnown) return;
    setSelectedSkill(skill);
  };

  const closeDetail = () => {
    setSelectedSkill(null);
    setShowEquipConfirm(false);
  };

  const cooldownPercent = (skill: Skill) => {
    if (skill.cooldown === 0) return 0;
    return (skill.currentCooldown / skill.cooldown) * 100;
  };

  const renderSkillCard = (skill: Skill) => {
    const rarityColor = getRarityColor(skill.rarity);
    const typeConfig = TYPE_CONFIG[skill.type];
    const isLocked = !skill.isKnown;

    return (
      <View
        key={skill.id}
        className={`skill-card ${isLocked ? 'skill-card--locked' : ''} ${skill.isEquipped ? 'skill-card--equipped' : ''}`}
        style={{ '--rarity-color': rarityColor } as Record<string, string>}
        onClick={() => handleCardTap(skill)}
      >
        {/* 锁定遮罩 */}
        {isLocked && (
          <View className='skill-locked-overlay'>
            <Text className='skill-lock-icon'>🔒</Text>
            <Text className='skill-lock-text'>未解锁</Text>
          </View>
        )}

        {/* 左侧：图标 */}
        <View className='skill-card__icon-wrap'>
          <Text className='skill-card__icon'>{skill.icon}</Text>
          {skill.isEquipped && (
            <View className='skill-badge--equipped'>已装备</View>
          )}
        </View>

        {/* 中间：信息 */}
        <View className='skill-card__info'>
          <View className='skill-card__header'>
            <Text className='skill-card__name'>{skill.name}</Text>
            <View
              className='skill-level-badge'
              style={{ '--rarity-color': rarityColor } as Record<string, string>}
            >
              {skill.level}/{skill.maxLevel}
            </View>
          </View>

          <View className='skill-card__tags'>
            <View
              className='skill-tag'
              style={{ '--tag-color': typeConfig.tagColor } as Record<string, string>}
            >
              {typeConfig.label}
            </View>
            <View
              className='skill-tag skill-tag--rarity'
              style={{ '--tag-color': rarityColor } as Record<string, string>}
            >
              {skill.rarity === 'common' && '普通'}
              {skill.rarity === 'uncommon' && '优秀'}
              {skill.rarity === 'rare' && '稀有'}
              {skill.rarity === 'epic' && '史诗'}
              {skill.rarity === 'legendary' && '传说'}
            </View>
          </View>

          {/* 主动技能冷却条 */}
          {skill.type === 'active' && skill.cooldown > 0 && (
            <View className='skill-cooldown'>
              <View
                className='skill-cooldown__bar'
                style={{
                  width: `${100 - cooldownPercent(skill)}%`,
                }}
              />
              <Text className='skill-cooldown__text'>
                {skill.currentCooldown > 0
                  ? `冷却中 ${skill.currentCooldown}/${skill.cooldown}`
                  : '可用'}
              </Text>
            </View>
          )}

          <Text className='skill-card__desc' numberOfLines={1}>
            {skill.description}
          </Text>
        </View>

        {/* 右侧：操作 */}
        {!isLocked && !skill.isEquipped && (
          <View className='skill-card__action' onClick={() => handleEquipToggle(skill)}>
            <Text className='skill-action-btn'>装备</Text>
          </View>
        )}
        {!isLocked && skill.isEquipped && (
          <View
            className='skill-card__action skill-card__action--equipped'
            onClick={() => handleEquipToggle(skill)}
          >
            <Text className='skill-action-btn'>卸下</Text>
          </View>
        )}
      </View>
    );
  };

  const renderSection = (
    title: string,
    skillList: Skill[],
    startIndex: number
  ) => {
    if (skillList.length === 0) return null;
    return (
      <View className='skill-section'>
        <Text className='skill-section__title'>{title}</Text>
        <View className='skill-section__list'>
          {skillList.map((skill, i) => renderSkillCard(skill))}
        </View>
      </View>
    );
  };

  return (
    <View className='skill-page fade-in'>
      {/* 页面标题 */}
      <Text className='page-title'>⚡ 技能</Text>

      {/* Tab 切换 */}
      <View className='skill-tabs'>
        <View
          className={`skill-tab ${activeTab === 'active' ? 'skill-tab--active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          <Text className='skill-tab__text'>主动技能</Text>
        </View>
        <View
          className={`skill-tab ${activeTab === 'passive' ? 'skill-tab--active' : ''}`}
          onClick={() => setActiveTab('passive')}
        >
          <Text className='skill-tab__text'>被动技能</Text>
        </View>
      </View>

      {/* 装备计数 */}
      <View className='equip-count'>
        <Text className='equip-count__text'>
          已装备 {getEquippedCount(activeTab)}/{getMaxEquip(activeTab)}{' '}
          {activeTab === 'active' ? '主动' : '被动'}
        </Text>
      </View>

      {/* 技能列表 */}
      <ScrollView
        className='skill-list'
        scrollY
        enhanced
        bounces={false}
      >
        {renderSection('已装备', equippedSkills, 0)}
        {renderSection('已习得', knownSkills, equippedSkills.length)}
        {renderSection('未解锁', lockedSkills, equippedSkills.length + knownSkills.length)}
      </ScrollView>

      {/* 技能详情浮层 */}
      {selectedSkill && (
        <View className='skill-detail-overlay' onClick={closeDetail}>
          <View
            className='skill-detail-card'
            style={{
              '--rarity-color': getRarityColor(selectedSkill.rarity),
            } as Record<string, string>}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 关闭按钮 */}
            <View className='skill-detail__close' onClick={closeDetail}>
              <Text className='skill-detail__close-text'>✕</Text>
            </View>

            {/* 头部：图标 + 名称 */}
            <View className='skill-detail__header'>
              <Text className='skill-detail__icon'>{selectedSkill.icon}</Text>
              <View className='skill-detail__title-wrap'>
                <Text className='skill-detail__name'>{selectedSkill.name}</Text>
                <View className='skill-detail__tags'>
                  <View
                    className='skill-tag'
                    style={
                      {
                        '--tag-color': TYPE_CONFIG[selectedSkill.type].tagColor,
                      } as Record<string, string>
                    }
                  >
                    {TYPE_CONFIG[selectedSkill.type].label}
                  </View>
                  <View
                    className='skill-tag skill-tag--rarity'
                    style={
                      {
                        '--tag-color': getRarityColor(selectedSkill.rarity),
                      } as Record<string, string>
                    }
                  >
                    {selectedSkill.rarity === 'common' && '普通'}
                    {selectedSkill.rarity === 'uncommon' && '优秀'}
                    {selectedSkill.rarity === 'rare' && '稀有'}
                    {selectedSkill.rarity === 'epic' && '史诗'}
                    {selectedSkill.rarity === 'legendary' && '传说'}
                  </View>
                </View>
              </View>
            </View>

            {/* 等级 */}
            <View className='skill-detail__level'>
              <Text className='skill-detail__level-text'>
                等级 {selectedSkill.level} / {selectedSkill.maxLevel}
              </Text>
            </View>

            {/* 属性信息 */}
            <View className='skill-detail__attrs'>
              <View className='skill-detail__attr'>
                <Text className='skill-detail__attr-label'>目标</Text>
                <Text className='skill-detail__attr-value'>
                  {TARGET_LABELS[selectedSkill.target]}
                </Text>
              </View>
              {selectedSkill.type === 'active' && (
                <View className='skill-detail__attr'>
                  <Text className='skill-detail__attr-label'>冷却</Text>
                  <Text className='skill-detail__attr-value'>
                    {selectedSkill.cooldown} 回合
                  </Text>
                </View>
              )}
              {selectedSkill.damage && (
                <View className='skill-detail__attr'>
                  <Text className='skill-detail__attr-label'>伤害</Text>
                  <Text className='skill-detail__attr-value'>
                    {selectedSkill.damage}%
                  </Text>
                </View>
              )}
              {selectedSkill.effect && (
                <View className='skill-detail__attr'>
                  <Text className='skill-detail__attr-label'>效果</Text>
                  <Text className='skill-detail__attr-value'>
                    {selectedSkill.effect}
                  </Text>
                </View>
              )}
            </View>

            {/* 分割线 */}
            <View className='skill-detail__divider' />

            {/* 描述 */}
            <View className='skill-detail__desc-wrap'>
              <Text className='skill-detail__desc-label'>技能描述</Text>
              <Text className='skill-detail__desc'>{selectedSkill.description}</Text>
            </View>

            {/* 操作按钮 */}
            <View className='skill-detail__actions'>
              <View
                className={`skill-detail__btn ${selectedSkill.isEquipped ? 'skill-detail__btn--unequip' : 'skill-detail__btn--equip'}`}
                onClick={() => handleEquipToggle(selectedSkill)}
              >
                <Text className='skill-detail__btn-text'>
                  {selectedSkill.isEquipped ? '卸下' : '装备'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 装备确认弹窗 */}
      {showEquipConfirm && selectedSkill && (
        <View className='skill-confirm-overlay' onClick={cancelEquip}>
          <View
            className='skill-confirm-card'
            onClick={(e) => e.stopPropagation()}
          >
            <Text className='skill-confirm__title'>
              {selectedSkill.isEquipped ? '确认卸下' : '确认装备'}
            </Text>
            <Text className='skill-confirm__msg'>
              {selectedSkill.isEquipped
                ? `确定要卸下「${selectedSkill.name}」吗？`
                : `确定要装备「${selectedSkill.name}」吗？`}
            </Text>
            <View className='skill-confirm__btns'>
              <View className='skill-confirm__btn skill-confirm__btn--cancel' onClick={cancelEquip}>
                <Text className='skill-confirm__btn-text'>取消</Text>
              </View>
              <View className='skill-confirm__btn skill-confirm__btn--ok' onClick={confirmEquip}>
                <Text className='skill-confirm__btn-text'>确定</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
