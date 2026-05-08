/**
 * 成就定义配置
 */

import { AchievementConditionType } from '../types/achievement';

/** 成就配置项 */
export interface AchievementConfigItem {
  achievementId: string;
  name: string;
  description: string;
  iconUrl: string;
  conditionType: AchievementConditionType;
  conditionValue: number;
  conditionParam?: string;
  themeId: string;
}

/** 成就列表定义 (12个成就) */
export const ACHIEVEMENTS_CONFIG: AchievementConfigItem[] = [
  {
    achievementId: 'first_record',
    name: '初次邂逅',
    description: '完成第一次食物记录',
    iconUrl: 'achievement-icons/first_record.png',
    conditionType: AchievementConditionType.TOTAL_RECORDS,
    conditionValue: 1,
    themeId: 'theme_classic',
  },
  {
    achievementId: 'ten_records',
    name: '美食探索者',
    description: '累计完成10次食物记录',
    iconUrl: 'achievement-icons/ten_records.png',
    conditionType: AchievementConditionType.TOTAL_RECORDS,
    conditionValue: 10,
    themeId: 'theme_classic',
  },
  {
    achievementId: 'fifty_records',
    name: '资深美食家',
    description: '累计完成50次食物记录',
    iconUrl: 'achievement-icons/fifty_records.png',
    conditionType: AchievementConditionType.TOTAL_RECORDS,
    conditionValue: 50,
    themeId: 'theme_classic',
  },
  {
    achievementId: 'hundred_records',
    name: '食神降临',
    description: '累计完成100次食物记录',
    iconUrl: 'achievement-icons/hundred_records.png',
    conditionType: AchievementConditionType.TOTAL_RECORDS,
    conditionValue: 100,
    themeId: 'theme_classic',
  },
  {
    achievementId: 'streak_3',
    name: '坚持三天',
    description: '连续打卡3天',
    iconUrl: 'achievement-icons/streak_3.png',
    conditionType: AchievementConditionType.STREAK_DAYS,
    conditionValue: 3,
    themeId: 'theme_zelda',
  },
  {
    achievementId: 'streak_7',
    name: '一周全勤',
    description: '连续打卡7天',
    iconUrl: 'achievement-icons/streak_7.png',
    conditionType: AchievementConditionType.STREAK_DAYS,
    conditionValue: 7,
    themeId: 'theme_zelda',
  },
  {
    achievementId: 'streak_30',
    name: '月度满贯',
    description: '连续打卡30天',
    iconUrl: 'achievement-icons/streak_30.png',
    conditionType: AchievementConditionType.STREAK_DAYS,
    conditionValue: 30,
    themeId: 'theme_monster_hunter',
  },
  {
    achievementId: 'meat_lover',
    name: '肉食爱好者',
    description: '记录10次肉类食物',
    iconUrl: 'achievement-icons/meat_lover.png',
    conditionType: AchievementConditionType.FOOD_TYPE_COUNT,
    conditionValue: 10,
    conditionParam: 'meat',
    themeId: 'theme_monster_hunter',
  },
  {
    achievementId: 'veggie_master',
    name: '蔬菜达人',
    description: '记录10次蔬菜',
    iconUrl: 'achievement-icons/veggie_master.png',
    conditionType: AchievementConditionType.FOOD_TYPE_COUNT,
    conditionValue: 10,
    conditionParam: 'vegetable',
    themeId: 'theme_animal_crossing',
  },
  {
    achievementId: 'fruit_fanatic',
    name: '水果狂人',
    description: '记录10次水果',
    iconUrl: 'achievement-icons/fruit_fanatic.png',
    conditionType: AchievementConditionType.FOOD_TYPE_COUNT,
    conditionValue: 10,
    conditionParam: 'fruit',
    themeId: 'theme_animal_crossing',
  },
  {
    achievementId: 'theme_collector',
    name: '主题收藏家',
    description: '使用过所有主题',
    iconUrl: 'achievement-icons/theme_collector.png',
    conditionType: AchievementConditionType.THEME_USAGE,
    conditionValue: 6,
    themeId: 'theme_pokemon',
  },
  {
    achievementId: 'checkin_10',
    name: '打卡达人',
    description: '在不同地点打卡10次',
    iconUrl: 'achievement-icons/checkin_10.png',
    conditionType: AchievementConditionType.CHECKIN_COUNT,
    conditionValue: 10,
    themeId: 'theme_minecraft',
  },
];
