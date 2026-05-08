/**
 * 食物相关类型定义
 */

/** 食物类型枚举 */
export enum FoodType {
  /** 谷薯类 */
  GRAIN = 'grain',
  /** 蔬菜类 */
  VEGETABLE = 'vegetable',
  /** 水果类 */
  FRUIT = 'fruit',
  /** 肉蛋类 */
  MEAT = 'meat',
  /** 水产类 */
  SEAFOOD = 'seafood',
  /** 奶豆类 */
  DAIRY = 'dairy',
  /** 坚果类 */
  NUT = 'nut',
  /** 小吃零食 */
  SNACK = 'snack',
  /** 饮品 */
  BEVERAGE = 'beverage',
  /** 调味品 */
  SEASONING = 'seasoning',
  /** 复合菜肴 */
  DISH = 'dish',
  /** 其他 */
  OTHER = 'other',
}

/** 卡路里信息 */
export interface CalorieInfo {
  total: number;
  per100g: number;
  protein: number;
  fat: number;
  carbs: number;
}

/** AI 识别结果 */
export interface RecognitionResult {
  foodName: string;
  confidence: number;
  foodType: FoodType;
  alternatives: Array<{
    foodName: string;
    confidence: number;
  }>;
}

/** AI 生成的食物描述 */
export interface AIFoodDescription {
  short: string;
  gameStyle: string;
  detail: string;
}

/** 食物记录数据库模型 */
export interface FoodRecord {
  id: number;
  userId: number;
  imageUrl: string;
  themeImageUrl: string;
  foodName: string;
  foodType: FoodType;
  calories: CalorieInfo;
  aiDescShort: string;
  aiDescGameStyle: string;
  aiDescDetail: string;
  gameDescription: string;
  latitude: number;
  longitude: number;
  locationName: string;
  ipLocation: string;
  themeId: string;
  createdAt: Date;
}
