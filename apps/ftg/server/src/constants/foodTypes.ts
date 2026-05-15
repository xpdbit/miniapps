/**
 * 食物类型常量定义
 */

import { FoodType } from '../types/food';

/** 食物类型中文名称映射 */
export const FOOD_TYPE_LABELS: Record<FoodType, string> = {
  [FoodType.GRAIN]: '谷薯类',
  [FoodType.VEGETABLE]: '蔬菜类',
  [FoodType.FRUIT]: '水果类',
  [FoodType.MEAT]: '肉蛋类',
  [FoodType.SEAFOOD]: '水产类',
  [FoodType.DAIRY]: '奶豆类',
  [FoodType.NUT]: '坚果类',
  [FoodType.SNACK]: '小吃零食',
  [FoodType.BEVERAGE]: '饮品',
  [FoodType.SEASONING]: '调味品',
  [FoodType.DISH]: '复合菜肴',
  [FoodType.OTHER]: '其他',
};

/** 食物类型 Emoji 映射 */
export const FOOD_TYPE_EMOJIS: Record<FoodType, string> = {
  [FoodType.GRAIN]: '🍚',
  [FoodType.VEGETABLE]: '🥬',
  [FoodType.FRUIT]: '🍎',
  [FoodType.MEAT]: '🥩',
  [FoodType.SEAFOOD]: '🦐',
  [FoodType.DAIRY]: '🥛',
  [FoodType.NUT]: '🥜',
  [FoodType.SNACK]: '🍿',
  [FoodType.BEVERAGE]: '🥤',
  [FoodType.SEASONING]: '🧂',
  [FoodType.DISH]: '🍱',
  [FoodType.OTHER]: '🍽️',
};

/** 食物类型图标颜色映射 */
export const FOOD_TYPE_COLORS: Record<FoodType, string> = {
  [FoodType.GRAIN]: '#FFB347',
  [FoodType.VEGETABLE]: '#4CAF50',
  [FoodType.FRUIT]: '#E91E63',
  [FoodType.MEAT]: '#F44336',
  [FoodType.SEAFOOD]: '#2196F3',
  [FoodType.DAIRY]: '#E0E0E0',
  [FoodType.NUT]: '#8D6E63',
  [FoodType.SNACK]: '#FF9800',
  [FoodType.BEVERAGE]: '#03A9F4',
  [FoodType.SEASONING]: '#9E9E9E',
  [FoodType.DISH]: '#9C27B0',
  [FoodType.OTHER]: '#607D8B',
};

/** 常见食物关键词匹配映射 (用于AI识别结果后分类) */
export const FOOD_KEYWORD_MAP: Record<string, FoodType> = {
  // 谷薯类
  米: FoodType.GRAIN, 面: FoodType.GRAIN, 饭: FoodType.GRAIN, 饼: FoodType.GRAIN,
  包: FoodType.GRAIN, 馒头: FoodType.GRAIN, 土豆: FoodType.GRAIN, 红薯: FoodType.GRAIN,
  面条: FoodType.GRAIN, 米粉: FoodType.GRAIN, 面包: FoodType.GRAIN, 蛋糕: FoodType.GRAIN,
  // 蔬菜类
  菜: FoodType.VEGETABLE, 瓜: FoodType.VEGETABLE, 豆: FoodType.VEGETABLE,
  茄: FoodType.VEGETABLE, 椒: FoodType.VEGETABLE, 菇: FoodType.VEGETABLE,
  西兰花: FoodType.VEGETABLE, 菠菜: FoodType.VEGETABLE, 白菜: FoodType.VEGETABLE,
  // 水果类
  果: FoodType.FRUIT, 莓: FoodType.FRUIT, 橙: FoodType.FRUIT,
  苹果: FoodType.FRUIT, 西瓜: FoodType.FRUIT, 香蕉: FoodType.FRUIT,
  葡萄: FoodType.FRUIT, 梨: FoodType.FRUIT, 桃: FoodType.FRUIT,
  // 肉蛋类
  肉: FoodType.MEAT, 鸡: FoodType.MEAT, 猪: FoodType.MEAT, 牛: FoodType.MEAT,
  羊: FoodType.MEAT, 蛋: FoodType.MEAT, 鸭: FoodType.MEAT, 鸽: FoodType.MEAT,
  // 水产类
  鱼: FoodType.SEAFOOD, 虾: FoodType.SEAFOOD, 蟹: FoodType.SEAFOOD,
  贝: FoodType.SEAFOOD, 鱿: FoodType.SEAFOOD, 螺: FoodType.SEAFOOD,
  // 奶豆类
  奶: FoodType.DAIRY, 豆浆: FoodType.DAIRY, 豆腐: FoodType.DAIRY, 酸奶: FoodType.DAIRY,
  // 饮品
  茶: FoodType.BEVERAGE, 咖啡: FoodType.BEVERAGE, 可乐: FoodType.BEVERAGE,
  汁: FoodType.BEVERAGE, 酒: FoodType.BEVERAGE, 水: FoodType.BEVERAGE,
  // 小吃
  薯片: FoodType.SNACK, 饼干: FoodType.SNACK, 糖: FoodType.SNACK,
  巧克力: FoodType.SNACK, 冰淇淋: FoodType.SNACK,
};
