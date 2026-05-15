/**
 * 食物分类映射
 * 根据 PP-ShiTuV2 识别的中文食物名称 → 映射到业务分类 (FoodType)
 */

/**
 * 食物分类关键词映射表
 * 优先级: 长关键词优先匹配
 */
const CATEGORY_KEYWORDS = [
  // 复合菜肴（优先匹配，避免被子词匹配到其他分类）
  { pattern: /火锅|麻辣烫|串串|冒菜|烧烤|烤肉/g, category: 'dish' },
  { pattern: /披萨|汉堡|三明治|寿司|刺身/g, category: 'dish' },
  { pattern: /宫保鸡丁|鱼香肉丝|麻婆豆腐|回锅肉/g, category: 'dish' },
  { pattern: /红烧|糖醋|清蒸|水煮|干锅|小炒|爆炒/g, category: 'dish' },
  { pattern: /炒饭|盖饭|盖浇|拌饭|焗饭|煲仔饭/g, category: 'grain' },

  // 主食
  { pattern: /饭|粥|米/g, category: 'grain' },
  { pattern: /面|粉|饼|包|馒头|花卷|饺子|馄饨|烧卖/g, category: 'grain' },
  { pattern: /面包|吐司|蛋糕|饼干|糕点|月饼/g, category: 'grain' },
  { pattern: /土豆|红薯|紫薯|芋头|山药|玉米/g, category: 'grain' },

  // 肉类
  { pattern: /牛肉|牛排|牛腩|牛柳/g, category: 'meat' },
  { pattern: /猪肉|猪排|猪蹄|猪肝|猪肚/g, category: 'meat' },
  { pattern: /鸡肉|鸡腿|鸡翅|鸡胸|鸡排|鸡块/g, category: 'meat' },
  { pattern: /羊肉|羊排|烤全羊/g, category: 'meat' },
  { pattern: /鸭肉|鸭脖|鸭翅|烤鸭|烧鹅/g, category: 'meat' },
  { pattern: /火腿|培根|腊肉|腊肠|午餐肉/g, category: 'meat' },
  { pattern: /鸡蛋|鸭蛋|鹌鹑蛋|蛋羹|蛋花/g, category: 'meat' },
  { pattern: /肉/g, category: 'meat' },

  // 水产海鲜
  { pattern: /三文鱼|金枪鱼|鳕鱼|鲈鱼|鲤鱼|草鱼|鲫鱼|带鱼/g, category: 'seafood' },
  { pattern: /龙虾|大闸蟹|螃蟹|皮皮虾|基围虾|对虾/g, category: 'seafood' },
  { pattern: /蛤蜊|生蚝|扇贝|蛏子|海螺|鲍鱼/g, category: 'seafood' },
  { pattern: /鱿鱼|章鱼|墨鱼|海参/g, category: 'seafood' },
  { pattern: /鱼|虾|蟹|贝|螺/g, category: 'seafood' },

  // 蔬菜
  { pattern: /西兰花|花菜|菜花|卷心菜|包菜/g, category: 'vegetable' },
  { pattern: /菠菜|生菜|白菜|青菜|油菜|油麦菜/g, category: 'vegetable' },
  { pattern: /番茄|西红柿|黄瓜|胡萝卜|白萝卜/g, category: 'vegetable' },
  { pattern: /洋葱|大蒜|生姜|葱|香菜|芹菜/g, category: 'vegetable' },
  { pattern: /蘑菇|香菇|金针菇|杏鲍菇|木耳/g, category: 'vegetable' },
  { pattern: /青椒|辣椒|茄子|豆芽|秋葵/g, category: 'vegetable' },
  { pattern: /菜|瓜|茄|菇/g, category: 'vegetable' },

  // 水果
  { pattern: /苹果|香蕉|橙子|橘子|柚子/g, category: 'fruit' },
  { pattern: /葡萄|草莓|蓝莓|樱桃|西瓜/g, category: 'fruit' },
  { pattern: /芒果|菠萝|猕猴桃|桃子|梨/g, category: 'fruit' },
  { pattern: /榴莲|山竹|荔枝|龙眼|火龙果/g, category: 'fruit' },
  { pattern: /柠檬|百香果|石榴|柿子|木瓜/g, category: 'fruit' },
  { pattern: /果/g, category: 'fruit' },

  // 奶制品
  { pattern: /牛奶|酸奶|奶酪|芝士|奶油|黄油/g, category: 'dairy' },
  { pattern: /豆奶|豆浆|豆皮|豆腐|豆花/g, category: 'dairy' },

  // 饮品
  { pattern: /咖啡|拿铁|摩卡|美式|卡布奇诺/g, category: 'beverage' },
  { pattern: /茶|绿茶|红茶|奶茶|果茶|柠檬茶/g, category: 'beverage' },
  { pattern: /可乐|雪碧|芬达|汽水|苏打水/g, category: 'beverage' },
  { pattern: /啤酒|红酒|白酒|鸡尾酒|清酒/g, category: 'beverage' },
  { pattern: /果汁|奶昔|冰沙|椰汁/g, category: 'beverage' },
  { pattern: /饮料|饮品/g, category: 'beverage' },

  // 坚果
  { pattern: /花生|核桃|杏仁|腰果|开心果|松子|榛子/g, category: 'nut' },
  { pattern: /瓜子|板栗|夏威夷果/g, category: 'nut' },

  // 零食小吃
  { pattern: /薯片|薯条|爆米花|虾条/g, category: 'snack' },
  { pattern: /巧克力|糖果|果冻|布丁/g, category: 'snack' },
  { pattern: /冰淇淋|雪糕|冰棍|冰棒/g, category: 'snack' },
  { pattern: /瓜子|话梅|蜜饯|果脯/g, category: 'snack' },

  // 调味料
  { pattern: /酱油|生抽|老抽|醋|料酒/g, category: 'seasoning' },
  { pattern: /辣椒酱|番茄酱|沙拉酱|蛋黄酱/g, category: 'seasoning' },
  { pattern: /香料|孜然|花椒|胡椒|咖喱/g, category: 'seasoning' },
];

/**
 * 根据食物名称进行分类映射
 * @param {string} foodName - PP-ShiTuV2 识别的食物中文名称
 * @returns {string} 业务分类 (匹配 FoodType 枚举值)
 */
function classifyFood(foodName) {
  if (!foodName || typeof foodName !== 'string') {
    return 'other';
  }

  for (const { pattern, category } of CATEGORY_KEYWORDS) {
    pattern.lastIndex = 0; // 重置正则状态
    if (pattern.test(foodName)) {
      return category;
    }
  }

  return 'other';
}

module.exports = { classifyFood, CATEGORY_KEYWORDS };
