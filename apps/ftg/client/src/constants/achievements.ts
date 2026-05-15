/**
 * 成就定义配置
 */

import { AchievementConditionType, type Achievement } from '@/types/achievement';

/** 成就列表定义 */
export const ACHIEVEMENTS_CONFIG: Achievement[] = [
  {
    achievementId: 'first_record',
    name: '初次邂逅',
    description: '完成第一次食物记录',
    iconUrl: 'achievement-icons/first_record.png',
    unlockCondition: {
      type: AchievementConditionType.TOTAL_RECORDS,
      value: 1,
    },
    themeId: 'theme_classic',
  },
  {
    achievementId: 'ten_records',
    name: '美食探索者',
    description: '累计完成10次食物记录',
    iconUrl: 'achievement-icons/ten_records.png',
    unlockCondition: {
      type: AchievementConditionType.TOTAL_RECORDS,
      value: 10,
    },
    themeId: 'theme_classic',
  },
  {
    achievementId: 'fifty_records',
    name: '资深美食家',
    description: '累计完成50次食物记录',
    iconUrl: 'achievement-icons/fifty_records.png',
    unlockCondition: {
      type: AchievementConditionType.TOTAL_RECORDS,
      value: 50,
    },
    themeId: 'theme_classic',
  },
  {
    achievementId: 'hundred_records',
    name: '食神降临',
    description: '累计完成100次食物记录',
    iconUrl: 'achievement-icons/hundred_records.png',
    unlockCondition: {
      type: AchievementConditionType.TOTAL_RECORDS,
      value: 100,
    },
    themeId: 'theme_classic',
  },
  {
    achievementId: 'streak_3',
    name: '坚持三天',
    description: '连续打卡3天',
    iconUrl: 'achievement-icons/streak_3.png',
    unlockCondition: {
      type: AchievementConditionType.STREAK_DAYS,
      value: 3,
    },
    themeId: 'theme_zelda',
  },
  {
    achievementId: 'streak_7',
    name: '一周全勤',
    description: '连续打卡7天',
    iconUrl: 'achievement-icons/streak_7.png',
    unlockCondition: {
      type: AchievementConditionType.STREAK_DAYS,
      value: 7,
    },
    themeId: 'theme_zelda',
  },
  {
    achievementId: 'streak_30',
    name: '月度满贯',
    description: '连续打卡30天',
    iconUrl: 'achievement-icons/streak_30.png',
    unlockCondition: {
      type: AchievementConditionType.STREAK_DAYS,
      value: 30,
    },
    themeId: 'theme_monster_hunter',
  },
  {
    achievementId: 'meat_lover',
    name: '肉食爱好者',
    description: '记录10次肉类食物',
    iconUrl: 'achievement-icons/meat_lover.png',
    unlockCondition: {
      type: AchievementConditionType.FOOD_TYPE_COUNT,
      value: 10,
      param: 'meat',
    },
    themeId: 'theme_monster_hunter',
  },
  {
    achievementId: 'veggie_master',
    name: '蔬菜达人',
    description: '记录10次蔬菜',
    iconUrl: 'achievement-icons/veggie_master.png',
    unlockCondition: {
      type: AchievementConditionType.FOOD_TYPE_COUNT,
      value: 10,
      param: 'vegetable',
    },
    themeId: 'theme_animal_crossing',
  },
  {
    achievementId: 'fruit_fanatic',
    name: '水果狂人',
    description: '记录10次水果',
    iconUrl: 'achievement-icons/fruit_fanatic.png',
    unlockCondition: {
      type: AchievementConditionType.FOOD_TYPE_COUNT,
      value: 10,
      param: 'fruit',
    },
    themeId: 'theme_animal_crossing',
  },
  {
    achievementId: 'theme_collector',
    name: '主题收藏家',
    description: '使用过所有主题',
    iconUrl: 'achievement-icons/theme_collector.png',
    unlockCondition: {
      type: AchievementConditionType.THEME_USAGE,
      value: 6,
    },
    themeId: 'theme_pokemon',
  },
  {
    achievementId: 'checkin_10',
    name: '打卡达人',
    description: '在不同地点打卡10次',
    iconUrl: 'achievement-icons/checkin_10.png',
    unlockCondition: {
      type: AchievementConditionType.CHECKIN_COUNT,
      value: 10,
    },
    themeId: 'theme_minecraft',
  },
];
