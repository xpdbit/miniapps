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
  /** 总热量 (kcal) */
  total: number;
  /** 每100g热量 */
  per100g: number;
  /** 蛋白质 (g) */
  protein: number;
  /** 脂肪 (g) */
  fat: number;
  /** 碳水化合物 (g) */
  carbs: number;
}

/** AI 识别结果 */
export interface RecognitionResult {
  /** 识别到的食物名称 */
  foodName: string;
  /** 置信度 0-1 */
  confidence: number;
  /** 食物类型 */
  foodType: FoodType;
  /** 备选识别结果 */
  alternatives: Array<{
    foodName: string;
    confidence: number;
  }>;
}

/** AI 生成的食物描述 */
export interface AIFoodDescription {
  /** 简短食物描述 (如 "刚出炉的热气腾腾的面包") */
  short: string;
  /** 游戏化风格描述 (如 "获得道具：🍞 烈火烘焙坊の元气面包！") */
  gameStyle: string;
  /** 详细描述 */
  detail: string;
}

/** 食物记录核心模型 */
export interface FoodRecord {
  /** 记录ID */
  _id: string;
  /** 用户 openid */
  openid: string;
  /** 原图云文件ID */
  imageFileID: string;
  /** 主题合成图云文件ID */
  themeImageFileID: string;
  /** 食物名称 */
  foodName: string;
  /** 食物类型 */
  foodType: FoodType;
  /** 卡路里信息 */
  calories: CalorieInfo;
  /** AI 食物描述 */
  aiDescription: AIFoodDescription;
  /** 游戏化描述 */
  gameDescription: string;
  /** 纬度 */
  latitude: number;
  /** 经度 */
  longitude: number;
  /** 位置名称 */
  locationName: string;
  /** IP 定位结果 */
  ipLocation: string;
  /** 使用的主题ID */
  themeId: string;
  /** 创建时间 (ISO格式) */
  createdAt: string;
}
