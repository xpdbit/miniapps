"""
Comprehensive Nutrition Database for Food Recognition Service
200+ common Chinese foods with nutritional values per 100g
"""

from food_type_mapper import map_to_food_type

# Each entry: calories_per100g (kcal), protein (g), fat (g), carbs (g), calories (per typical serving)
# Values sourced from Chinese Food Composition Table and USDA FoodData Central

NUTRITION_DB = {
    # ============================================================
    # 谷薯类 (Grains & Potatoes) - 22 items
    # ============================================================
    '米饭':     {'calories_per100g': 116, 'protein': 2.6, 'fat': 0.3, 'carbs': 25.9, 'calories': 174, 'food_type': 'grain'},
    '馒头':     {'calories_per100g': 221, 'protein': 7.0, 'fat': 1.1, 'carbs': 45.7, 'calories': 221, 'food_type': 'grain'},
    '面条':     {'calories_per100g': 110, 'protein': 3.4, 'fat': 0.5, 'carbs': 24.3, 'calories': 220, 'food_type': 'grain'},
    '面包':     {'calories_per100g': 266, 'protein': 8.5, 'fat': 3.3, 'carbs': 49.0, 'calories': 266, 'food_type': 'grain'},
    '全麦面包':  {'calories_per100g': 246, 'protein': 9.0, 'fat': 3.4, 'carbs': 46.0, 'calories': 246, 'food_type': 'grain'},
    '红薯':     {'calories_per100g': 86,  'protein': 1.6, 'fat': 0.1, 'carbs': 20.1, 'calories': 172, 'food_type': 'grain'},
    '紫薯':     {'calories_per100g': 82,  'protein': 1.8, 'fat': 0.2, 'carbs': 18.6, 'calories': 164, 'food_type': 'grain'},
    '土豆':     {'calories_per100g': 77,  'protein': 2.0, 'fat': 0.1, 'carbs': 17.5, 'calories': 154, 'food_type': 'grain'},
    '玉米':     {'calories_per100g': 96,  'protein': 3.3, 'fat': 1.2, 'carbs': 19.0, 'calories': 192, 'food_type': 'grain'},
    '糯玉米':   {'calories_per100g': 140, 'protein': 4.0, 'fat': 1.5, 'carbs': 29.0, 'calories': 210, 'food_type': 'grain'},
    '小米粥':   {'calories_per100g': 46,  'protein': 1.4, 'fat': 0.7, 'carbs': 8.4,  'calories': 115, 'food_type': 'grain'},
    '大米粥':   {'calories_per100g': 42,  'protein': 1.1, 'fat': 0.2, 'carbs': 9.0,  'calories': 105, 'food_type': 'grain'},
    '年糕':     {'calories_per100g': 220, 'protein': 3.4, 'fat': 0.3, 'carbs': 49.5, 'calories': 220, 'food_type': 'grain'},
    '饺子':     {'calories_per100g': 195, 'protein': 8.5, 'fat': 6.8, 'carbs': 25.0, 'calories': 195, 'food_type': 'grain'},
    '汤圆':     {'calories_per100g': 231, 'protein': 3.8, 'fat': 6.2, 'carbs': 40.5, 'calories': 231, 'food_type': 'grain'},
    '粽子':     {'calories_per100g': 195, 'protein': 4.5, 'fat': 3.5, 'carbs': 37.0, 'calories': 292, 'food_type': 'grain'},
    '花卷':     {'calories_per100g': 211, 'protein': 6.4, 'fat': 1.5, 'carbs': 44.1, 'calories': 211, 'food_type': 'grain'},
    '烧饼':     {'calories_per100g': 260, 'protein': 8.2, 'fat': 4.6, 'carbs': 48.0, 'calories': 260, 'food_type': 'grain'},
    '油条':     {'calories_per100g': 386, 'protein': 6.9, 'fat': 17.6, 'carbs': 51.0, 'calories': 386, 'food_type': 'grain'},
    '燕麦片':   {'calories_per100g': 377, 'protein': 13.5, 'fat': 6.5, 'carbs': 68.0, 'calories': 377, 'food_type': 'grain'},
    '薏米':     {'calories_per100g': 357, 'protein': 12.8, 'fat': 3.3, 'carbs': 71.1, 'calories': 357, 'food_type': 'grain'},
    '糙米':     {'calories_per100g': 348, 'protein': 7.5, 'fat': 2.7, 'carbs': 73.0, 'calories': 348, 'food_type': 'grain'},
    '山药':     {'calories_per100g': 57,  'protein': 1.9, 'fat': 0.2, 'carbs': 12.4, 'calories': 114, 'food_type': 'grain'},

    # ============================================================
    # 蔬菜类 (Vegetables) - 22 items
    # ============================================================
    '白菜':     {'calories_per100g': 13,  'protein': 1.5, 'fat': 0.1, 'carbs': 2.2,  'calories': 26,  'food_type': 'vegetable'},
    '菠菜':     {'calories_per100g': 23,  'protein': 2.9, 'fat': 0.4, 'carbs': 3.6,  'calories': 23,  'food_type': 'vegetable'},
    '西兰花':   {'calories_per100g': 34,  'protein': 2.8, 'fat': 0.4, 'carbs': 6.6,  'calories': 34,  'food_type': 'vegetable'},
    '番茄':     {'calories_per100g': 18,  'protein': 0.9, 'fat': 0.2, 'carbs': 3.9,  'calories': 27,  'food_type': 'vegetable'},
    '黄瓜':     {'calories_per100g': 15,  'protein': 0.7, 'fat': 0.1, 'carbs': 3.6,  'calories': 23,  'food_type': 'vegetable'},
    '胡萝卜':   {'calories_per100g': 37,  'protein': 1.0, 'fat': 0.2, 'carbs': 8.8,  'calories': 37,  'food_type': 'vegetable'},
    '青椒':     {'calories_per100g': 20,  'protein': 0.9, 'fat': 0.2, 'carbs': 4.6,  'calories': 20,  'food_type': 'vegetable'},
    '红椒':     {'calories_per100g': 31,  'protein': 1.0, 'fat': 0.3, 'carbs': 6.3,  'calories': 31,  'food_type': 'vegetable'},
    '茄子':     {'calories_per100g': 21,  'protein': 1.1, 'fat': 0.2, 'carbs': 4.3,  'calories': 32,  'food_type': 'vegetable'},
    '蘑菇':     {'calories_per100g': 22,  'protein': 3.1, 'fat': 0.3, 'carbs': 3.3,  'calories': 22,  'food_type': 'vegetable'},
    '香菇':     {'calories_per100g': 26,  'protein': 2.2, 'fat': 0.3, 'carbs': 5.2,  'calories': 26,  'food_type': 'vegetable'},
    '金针菇':   {'calories_per100g': 26,  'protein': 2.4, 'fat': 0.4, 'carbs': 3.7,  'calories': 26,  'food_type': 'vegetable'},
    '生菜':     {'calories_per100g': 13,  'protein': 1.4, 'fat': 0.2, 'carbs': 1.6,  'calories': 13,  'food_type': 'vegetable'},
    '芹菜':     {'calories_per100g': 14,  'protein': 0.7, 'fat': 0.1, 'carbs': 3.0,  'calories': 14,  'food_type': 'vegetable'},
    '油菜':     {'calories_per100g': 12,  'protein': 1.8, 'fat': 0.2, 'carbs': 1.5,  'calories': 12,  'food_type': 'vegetable'},
    '韭菜':     {'calories_per100g': 26,  'protein': 2.4, 'fat': 0.4, 'carbs': 3.2,  'calories': 26,  'food_type': 'vegetable'},
    '豆芽':     {'calories_per100g': 18,  'protein': 2.1, 'fat': 0.5, 'carbs': 1.9,  'calories': 18,  'food_type': 'vegetable'},
    '洋葱':     {'calories_per100g': 40,  'protein': 1.1, 'fat': 0.1, 'carbs': 9.3,  'calories': 40,  'food_type': 'vegetable'},
    '大蒜':     {'calories_per100g': 126, 'protein': 4.5, 'fat': 0.2, 'carbs': 27.6, 'calories': 126, 'food_type': 'vegetable'},
    '南瓜':     {'calories_per100g': 22,  'protein': 0.7, 'fat': 0.1, 'carbs': 5.3,  'calories': 33,  'food_type': 'vegetable'},
    '冬瓜':     {'calories_per100g': 11,  'protein': 0.4, 'fat': 0.1, 'carbs': 2.6,  'calories': 11,  'food_type': 'vegetable'},
    '莲藕':     {'calories_per100g': 47,  'protein': 1.2, 'fat': 0.2, 'carbs': 10.5, 'calories': 47,  'food_type': 'vegetable'},
    '竹笋':     {'calories_per100g': 20,  'protein': 2.6, 'fat': 0.2, 'carbs': 2.5,  'calories': 20,  'food_type': 'vegetable'},

    # ============================================================
    # 水果类 (Fruits) - 22 items
    # ============================================================
    '苹果':     {'calories_per100g': 52,  'protein': 0.3, 'fat': 0.2, 'carbs': 13.8, 'calories': 104, 'food_type': 'fruit'},
    '香蕉':     {'calories_per100g': 89,  'protein': 1.1, 'fat': 0.3, 'carbs': 22.8, 'calories': 133, 'food_type': 'fruit'},
    '橙子':     {'calories_per100g': 47,  'protein': 0.9, 'fat': 0.1, 'carbs': 11.8, 'calories': 71,  'food_type': 'fruit'},
    '葡萄':     {'calories_per100g': 67,  'protein': 0.7, 'fat': 0.2, 'carbs': 17.2, 'calories': 100, 'food_type': 'fruit'},
    '西瓜':     {'calories_per100g': 30,  'protein': 0.6, 'fat': 0.2, 'carbs': 7.6,  'calories': 90,  'food_type': 'fruit'},
    '草莓':     {'calories_per100g': 32,  'protein': 0.7, 'fat': 0.3, 'carbs': 7.7,  'calories': 48,  'food_type': 'fruit'},
    '猕猴桃':   {'calories_per100g': 61,  'protein': 1.1, 'fat': 0.5, 'carbs': 14.7, 'calories': 92,  'food_type': 'fruit'},
    '梨':       {'calories_per100g': 51,  'protein': 0.4, 'fat': 0.1, 'carbs': 13.1, 'calories': 77,  'food_type': 'fruit'},
    '桃子':     {'calories_per100g': 39,  'protein': 0.9, 'fat': 0.3, 'carbs': 9.5,  'calories': 59,  'food_type': 'fruit'},
    '芒果':     {'calories_per100g': 60,  'protein': 0.8, 'fat': 0.4, 'carbs': 15.0, 'calories': 90,  'food_type': 'fruit'},
    '柚子':     {'calories_per100g': 38,  'protein': 0.8, 'fat': 0.0, 'carbs': 9.6,  'calories': 57,  'food_type': 'fruit'},
    '荔枝':     {'calories_per100g': 66,  'protein': 0.8, 'fat': 0.4, 'carbs': 16.5, 'calories': 99,  'food_type': 'fruit'},
    '蓝莓':     {'calories_per100g': 57,  'protein': 0.7, 'fat': 0.3, 'carbs': 14.5, 'calories': 86,  'food_type': 'fruit'},
    '樱桃':     {'calories_per100g': 50,  'protein': 1.0, 'fat': 0.3, 'carbs': 12.2, 'calories': 75,  'food_type': 'fruit'},
    '菠萝':     {'calories_per100g': 50,  'protein': 0.5, 'fat': 0.1, 'carbs': 13.1, 'calories': 75,  'food_type': 'fruit'},
    '哈密瓜':   {'calories_per100g': 34,  'protein': 0.8, 'fat': 0.1, 'carbs': 8.2,  'calories': 68,  'food_type': 'fruit'},
    '火龙果':   {'calories_per100g': 55,  'protein': 1.1, 'fat': 0.4, 'carbs': 12.5, 'calories': 83,  'food_type': 'fruit'},
    '柠檬':     {'calories_per100g': 29,  'protein': 1.1, 'fat': 0.3, 'carbs': 9.3,  'calories': 29,  'food_type': 'fruit'},
    '葡萄柚':   {'calories_per100g': 42,  'protein': 0.8, 'fat': 0.1, 'carbs': 10.7, 'calories': 63,  'food_type': 'fruit'},
    '石榴':     {'calories_per100g': 63,  'protein': 1.7, 'fat': 0.6, 'carbs': 14.0, 'calories': 95,  'food_type': 'fruit'},
    '榴莲':     {'calories_per100g': 147, 'protein': 1.5, 'fat': 5.3, 'carbs': 27.1, 'calories': 220, 'food_type': 'fruit'},
    '木瓜':     {'calories_per100g': 39,  'protein': 0.6, 'fat': 0.1, 'carbs': 9.8,  'calories': 59,  'food_type': 'fruit'},
    '山竹':     {'calories_per100g': 72,  'protein': 0.4, 'fat': 0.6, 'carbs': 17.9, 'calories': 72,  'food_type': 'fruit'},

    # ============================================================
    # 肉蛋类 (Meat & Eggs) - 22 items
    # ============================================================
    '鸡蛋':     {'calories_per100g': 144, 'protein': 13.3, 'fat': 8.8, 'carbs': 2.8,  'calories': 72,  'food_type': 'meat'},
    '鸡胸肉':   {'calories_per100g': 133, 'protein': 31.0, 'fat': 1.2, 'carbs': 0.0,  'calories': 133, 'food_type': 'meat'},
    '鸡腿':     {'calories_per100g': 181, 'protein': 20.0, 'fat': 11.0, 'carbs': 0.0,  'calories': 181, 'food_type': 'meat'},
    '鸡翅':     {'calories_per100g': 194, 'protein': 17.5, 'fat': 13.5, 'carbs': 0.0,  'calories': 194, 'food_type': 'meat'},
    '猪肉(瘦)': {'calories_per100g': 143, 'protein': 20.3, 'fat': 6.2, 'carbs': 1.5,  'calories': 143, 'food_type': 'meat'},
    '猪肉(肥)': {'calories_per100g': 395, 'protein': 14.0, 'fat': 37.0, 'carbs': 0.0,  'calories': 395, 'food_type': 'meat'},
    '猪排':     {'calories_per100g': 264, 'protein': 18.0, 'fat': 21.0, 'carbs': 0.0,  'calories': 264, 'food_type': 'meat'},
    '牛肉(瘦)': {'calories_per100g': 106, 'protein': 20.2, 'fat': 2.3, 'carbs': 0.2,  'calories': 106, 'food_type': 'meat'},
    '牛腩':     {'calories_per100g': 215, 'protein': 17.5, 'fat': 16.0, 'carbs': 0.0,  'calories': 215, 'food_type': 'meat'},
    '羊肉':     {'calories_per100g': 203, 'protein': 19.0, 'fat': 14.1, 'carbs': 0.0,  'calories': 203, 'food_type': 'meat'},
    '鸭肉':     {'calories_per100g': 240, 'protein': 15.5, 'fat': 19.7, 'carbs': 0.1,  'calories': 240, 'food_type': 'meat'},
    '烤鸭':     {'calories_per100g': 236, 'protein': 17.8, 'fat': 18.0, 'carbs': 1.2,  'calories': 236, 'food_type': 'meat'},
    '鹅肉':     {'calories_per100g': 251, 'protein': 17.0, 'fat': 19.9, 'carbs': 0.0,  'calories': 251, 'food_type': 'meat'},
    '鸽子肉':   {'calories_per100g': 201, 'protein': 20.7, 'fat': 12.3, 'carbs': 1.5,  'calories': 201, 'food_type': 'meat'},
    '鹌鹑蛋':   {'calories_per100g': 160, 'protein': 12.8, 'fat': 11.1, 'carbs': 1.0,  'calories': 160, 'food_type': 'meat'},
    '鸭蛋':     {'calories_per100g': 180, 'protein': 12.6, 'fat': 13.0, 'carbs': 3.1,  'calories': 180, 'food_type': 'meat'},
    '猪肝':     {'calories_per100g': 129, 'protein': 19.3, 'fat': 3.5, 'carbs': 5.0,  'calories': 129, 'food_type': 'meat'},
    '猪蹄':     {'calories_per100g': 260, 'protein': 22.6, 'fat': 18.8, 'carbs': 0.0,  'calories': 260, 'food_type': 'meat'},
    '火腿':     {'calories_per100g': 330, 'protein': 16.0, 'fat': 28.0, 'carbs': 3.0,  'calories': 330, 'food_type': 'meat'},
    '培根':     {'calories_per100g': 541, 'protein': 12.0, 'fat': 49.0, 'carbs': 1.0,  'calories': 541, 'food_type': 'meat'},
    '香肠':     {'calories_per100g': 326, 'protein': 14.0, 'fat': 28.0, 'carbs': 5.0,  'calories': 326, 'food_type': 'meat'},
    '腊肉':     {'calories_per100g': 498, 'protein': 13.0, 'fat': 48.0, 'carbs': 3.0,  'calories': 498, 'food_type': 'meat'},

    # ============================================================
    # 水产类 (Seafood) - 22 items
    # ============================================================
    '三文鱼':   {'calories_per100g': 139, 'protein': 21.3, 'fat': 6.3, 'carbs': 0.0,  'calories': 208, 'food_type': 'seafood'},
    '虾':       {'calories_per100g': 84,  'protein': 18.0, 'fat': 0.8, 'carbs': 0.0,  'calories': 84,  'food_type': 'seafood'},
    '基围虾':   {'calories_per100g': 87,  'protein': 18.7, 'fat': 0.9, 'carbs': 0.0,  'calories': 87,  'food_type': 'seafood'},
    '螃蟹':     {'calories_per100g': 95,  'protein': 13.8, 'fat': 3.6, 'carbs': 2.3,  'calories': 95,  'food_type': 'seafood'},
    '鱿鱼':     {'calories_per100g': 75,  'protein': 15.6, 'fat': 0.8, 'carbs': 1.4,  'calories': 75,  'food_type': 'seafood'},
    '带鱼':     {'calories_per100g': 127, 'protein': 17.7, 'fat': 4.9, 'carbs': 3.1,  'calories': 127, 'food_type': 'seafood'},
    '生蚝':     {'calories_per100g': 61,  'protein': 7.0, 'fat': 2.0, 'carbs': 5.0,  'calories': 61,  'food_type': 'seafood'},
    '蛤蜊':     {'calories_per100g': 62,  'protein': 10.0, 'fat': 0.7, 'carbs': 2.8,  'calories': 62,  'food_type': 'seafood'},
    '扇贝':     {'calories_per100g': 77,  'protein': 14.2, 'fat': 1.4, 'carbs': 2.6,  'calories': 77,  'food_type': 'seafood'},
    '鲍鱼':     {'calories_per100g': 84,  'protein': 14.5, 'fat': 0.8, 'carbs': 6.0,  'calories': 84,  'food_type': 'seafood'},
    '海参':     {'calories_per100g': 55,  'protein': 12.6, 'fat': 0.3, 'carbs': 0.9,  'calories': 55,  'food_type': 'seafood'},
    '鲤鱼':     {'calories_per100g': 109, 'protein': 17.6, 'fat': 4.1, 'carbs': 0.5,  'calories': 109, 'food_type': 'seafood'},
    '草鱼':     {'calories_per100g': 113, 'protein': 16.6, 'fat': 5.2, 'carbs': 0.0,  'calories': 113, 'food_type': 'seafood'},
    '鲫鱼':     {'calories_per100g': 108, 'protein': 17.1, 'fat': 4.3, 'carbs': 0.0,  'calories': 108, 'food_type': 'seafood'},
    '鲈鱼':     {'calories_per100g': 105, 'protein': 18.6, 'fat': 3.4, 'carbs': 0.0,  'calories': 105, 'food_type': 'seafood'},
    '金枪鱼':   {'calories_per100g': 130, 'protein': 26.0, 'fat': 2.0, 'carbs': 0.0,  'calories': 130, 'food_type': 'seafood'},
    '鳕鱼':     {'calories_per100g': 82,  'protein': 17.8, 'fat': 0.7, 'carbs': 0.0,  'calories': 82,  'food_type': 'seafood'},
    '黄鱼':     {'calories_per100g': 97,  'protein': 17.7, 'fat': 2.5, 'carbs': 0.8,  'calories': 97,  'food_type': 'seafood'},
    '海带':     {'calories_per100g': 12,  'protein': 1.2, 'fat': 0.1, 'carbs': 2.0,  'calories': 12,  'food_type': 'seafood'},
    '紫菜':     {'calories_per100g': 35,  'protein': 5.8, 'fat': 0.3, 'carbs': 5.1,  'calories': 35,  'food_type': 'seafood'},
    '龙虾':     {'calories_per100g': 90,  'protein': 18.8, 'fat': 1.3, 'carbs': 0.6,  'calories': 90,  'food_type': 'seafood'},
    '螺蛳':     {'calories_per100g': 68,  'protein': 11.4, 'fat': 0.8, 'carbs': 3.7,  'calories': 68,  'food_type': 'seafood'},

    # ============================================================
    # 奶豆类 (Dairy & Beans) - 20 items
    # ============================================================
    '牛奶':     {'calories_per100g': 66,  'protein': 3.2, 'fat': 3.6, 'carbs': 4.8,  'calories': 132, 'food_type': 'dairy'},
    '纯牛奶':   {'calories_per100g': 66,  'protein': 3.2, 'fat': 3.6, 'carbs': 4.8,  'calories': 132, 'food_type': 'dairy'},
    '酸奶':     {'calories_per100g': 72,  'protein': 3.5, 'fat': 2.6, 'carbs': 9.7,  'calories': 144, 'food_type': 'dairy'},
    '老酸奶':   {'calories_per100g': 90,  'protein': 3.8, 'fat': 3.6, 'carbs': 11.0, 'calories': 135, 'food_type': 'dairy'},
    '奶酪':     {'calories_per100g': 328, 'protein': 25.0, 'fat': 27.0, 'carbs': 1.3,  'calories': 328, 'food_type': 'dairy'},
    '黄油':     {'calories_per100g': 717, 'protein': 0.9, 'fat': 81.1, 'carbs': 0.1,  'calories': 717, 'food_type': 'dairy'},
    '奶油':     {'calories_per100g': 340, 'protein': 2.8, 'fat': 36.0, 'carbs': 3.0,  'calories': 340, 'food_type': 'dairy'},
    '豆腐':     {'calories_per100g': 81,  'protein': 8.1, 'fat': 4.8, 'carbs': 1.9,  'calories': 81,  'food_type': 'dairy'},
    '嫩豆腐':   {'calories_per100g': 62,  'protein': 6.2, 'fat': 3.6, 'carbs': 1.5,  'calories': 62,  'food_type': 'dairy'},
    '老豆腐':   {'calories_per100g': 98,  'protein': 9.8, 'fat': 5.8, 'carbs': 2.3,  'calories': 98,  'food_type': 'dairy'},
    '豆浆':     {'calories_per100g': 33,  'protein': 2.9, 'fat': 1.4, 'carbs': 1.8,  'calories': 66,  'food_type': 'dairy'},
    '黄豆':     {'calories_per100g': 390, 'protein': 35.0, 'fat': 16.0, 'carbs': 34.0, 'calories': 390, 'food_type': 'dairy'},
    '绿豆':     {'calories_per100g': 316, 'protein': 21.6, 'fat': 0.8, 'carbs': 62.0, 'calories': 316, 'food_type': 'dairy'},
    '红豆':     {'calories_per100g': 324, 'protein': 21.6, 'fat': 0.6, 'carbs': 60.0, 'calories': 324, 'food_type': 'dairy'},
    '黑豆':     {'calories_per100g': 339, 'protein': 28.6, 'fat': 12.0, 'carbs': 42.0, 'calories': 339, 'food_type': 'dairy'},
    '豆腐皮':   {'calories_per100g': 410, 'protein': 44.6, 'fat': 17.4, 'carbs': 18.8, 'calories': 410, 'food_type': 'dairy'},
    '腐竹':     {'calories_per100g': 459, 'protein': 44.6, 'fat': 21.7, 'carbs': 22.3, 'calories': 459, 'food_type': 'dairy'},
    '毛豆':     {'calories_per100g': 131, 'protein': 11.9, 'fat': 5.1, 'carbs': 9.9,  'calories': 131, 'food_type': 'dairy'},
    '炼乳':     {'calories_per100g': 331, 'protein': 8.2, 'fat': 9.2, 'carbs': 55.6, 'calories': 331, 'food_type': 'dairy'},
    '奶粉':     {'calories_per100g': 478, 'protein': 24.0, 'fat': 26.0, 'carbs': 40.0, 'calories': 478, 'food_type': 'dairy'},

    # ============================================================
    # 坚果类 (Nuts) - 16 items
    # ============================================================
    '核桃':     {'calories_per100g': 654, 'protein': 15.2, 'fat': 65.2, 'carbs': 13.7, 'calories': 327, 'food_type': 'nut'},
    '杏仁':     {'calories_per100g': 579, 'protein': 21.2, 'fat': 49.9, 'carbs': 21.6, 'calories': 290, 'food_type': 'nut'},
    '花生':     {'calories_per100g': 563, 'protein': 25.8, 'fat': 44.3, 'carbs': 16.1, 'calories': 281, 'food_type': 'nut'},
    '腰果':     {'calories_per100g': 553, 'protein': 18.2, 'fat': 43.9, 'carbs': 30.2, 'calories': 277, 'food_type': 'nut'},
    '瓜子':     {'calories_per100g': 582, 'protein': 19.3, 'fat': 49.8, 'carbs': 14.9, 'calories': 291, 'food_type': 'nut'},
    '开心果':   {'calories_per100g': 560, 'protein': 20.2, 'fat': 45.3, 'carbs': 27.2, 'calories': 280, 'food_type': 'nut'},
    '榛子':     {'calories_per100g': 628, 'protein': 15.0, 'fat': 60.7, 'carbs': 17.0, 'calories': 314, 'food_type': 'nut'},
    '松子':     {'calories_per100g': 673, 'protein': 13.7, 'fat': 68.4, 'carbs': 13.1, 'calories': 336, 'food_type': 'nut'},
    '夏威夷果': {'calories_per100g': 718, 'protein': 7.9, 'fat': 75.8, 'carbs': 13.8, 'calories': 359, 'food_type': 'nut'},
    '碧根果':   {'calories_per100g': 691, 'protein': 9.2, 'fat': 72.0, 'carbs': 13.9, 'calories': 346, 'food_type': 'nut'},
    '板栗':     {'calories_per100g': 185, 'protein': 4.2, 'fat': 1.5, 'carbs': 40.5, 'calories': 93,  'food_type': 'nut'},
    '莲子':     {'calories_per100g': 350, 'protein': 17.0, 'fat': 2.0, 'carbs': 67.0, 'calories': 350, 'food_type': 'nut'},
    '芝麻':     {'calories_per100g': 573, 'protein': 19.0, 'fat': 48.0, 'carbs': 24.0, 'calories': 573, 'food_type': 'nut'},
    '芝麻酱':   {'calories_per100g': 586, 'protein': 19.2, 'fat': 52.7, 'carbs': 11.8, 'calories': 586, 'food_type': 'nut'},
    '花生酱':   {'calories_per100g': 588, 'protein': 25.1, 'fat': 50.0, 'carbs': 20.0, 'calories': 588, 'food_type': 'nut'},
    '枸杞':     {'calories_per100g': 349, 'protein': 14.3, 'fat': 1.5, 'carbs': 77.0, 'calories': 349, 'food_type': 'nut'},

    # ============================================================
    # 小吃零食 (Snacks) - 20 items
    # ============================================================
    '薯片':     {'calories_per100g': 536, 'protein': 7.0, 'fat': 34.0, 'carbs': 52.0, 'calories': 268, 'food_type': 'snack'},
    '饼干':     {'calories_per100g': 433, 'protein': 8.0, 'fat': 16.0, 'carbs': 68.0, 'calories': 217, 'food_type': 'snack'},
    '巧克力':   {'calories_per100g': 546, 'protein': 4.9, 'fat': 31.3, 'carbs': 59.4, 'calories': 273, 'food_type': 'snack'},
    '冰淇淋':   {'calories_per100g': 207, 'protein': 3.5, 'fat': 11.0, 'carbs': 24.0, 'calories': 207, 'food_type': 'snack'},
    '雪糕':     {'calories_per100g': 168, 'protein': 2.5, 'fat': 8.0, 'carbs': 22.0, 'calories': 168, 'food_type': 'snack'},
    '蛋糕':     {'calories_per100g': 347, 'protein': 5.3, 'fat': 14.2, 'carbs': 51.0, 'calories': 347, 'food_type': 'snack'},
    '糖果':     {'calories_per100g': 396, 'protein': 0.0, 'fat': 0.2, 'carbs': 98.0, 'calories': 198, 'food_type': 'snack'},
    '爆米花':   {'calories_per100g': 387, 'protein': 7.0, 'fat': 20.0, 'carbs': 48.0, 'calories': 194, 'food_type': 'snack'},
    '果冻':     {'calories_per100g': 68,  'protein': 0.0, 'fat': 0.0, 'carbs': 16.0, 'calories': 68,  'food_type': 'snack'},
    '牛肉干':   {'calories_per100g': 350, 'protein': 45.0, 'fat': 12.0, 'carbs': 15.0, 'calories': 350, 'food_type': 'snack'},
    '猪肉脯':   {'calories_per100g': 378, 'protein': 30.0, 'fat': 18.0, 'carbs': 25.0, 'calories': 378, 'food_type': 'snack'},
    '豆腐干':   {'calories_per100g': 140, 'protein': 15.0, 'fat': 8.0, 'carbs': 3.0,  'calories': 140, 'food_type': 'snack'},
    '辣条':     {'calories_per100g': 420, 'protein': 8.0, 'fat': 25.0, 'carbs': 42.0, 'calories': 420, 'food_type': 'snack'},
    '海苔':     {'calories_per100g': 177, 'protein': 30.0, 'fat': 4.0, 'carbs': 6.0,  'calories': 177, 'food_type': 'snack'},
    '麻花':     {'calories_per100g': 524, 'protein': 8.2, 'fat': 31.5, 'carbs': 55.0, 'calories': 524, 'food_type': 'snack'},
    '月饼':     {'calories_per100g': 421, 'protein': 6.0, 'fat': 18.0, 'carbs': 59.0, 'calories': 421, 'food_type': 'snack'},
    '锅巴':     {'calories_per100g': 470, 'protein': 7.0, 'fat': 22.0, 'carbs': 62.0, 'calories': 470, 'food_type': 'snack'},
    '绿豆糕':   {'calories_per100g': 349, 'protein': 6.0, 'fat': 10.0, 'carbs': 60.0, 'calories': 349, 'food_type': 'snack'},
    '驴打滚':   {'calories_per100g': 280, 'protein': 5.0, 'fat': 6.0, 'carbs': 52.0, 'calories': 280, 'food_type': 'snack'},
    '棉花糖':   {'calories_per100g': 321, 'protein': 0.1, 'fat': 0.0, 'carbs': 79.0, 'calories': 321, 'food_type': 'snack'},

    # ============================================================
    # 饮品 (Beverages) - 20 items
    # ============================================================
    '可乐':     {'calories_per100g': 42,  'protein': 0.0, 'fat': 0.0, 'carbs': 10.6, 'calories': 168, 'food_type': 'beverage'},
    '雪碧':     {'calories_per100g': 41,  'protein': 0.0, 'fat': 0.0, 'carbs': 10.4, 'calories': 164, 'food_type': 'beverage'},
    '芬达':     {'calories_per100g': 43,  'protein': 0.0, 'fat': 0.0, 'carbs': 10.9, 'calories': 172, 'food_type': 'beverage'},
    '橙汁':     {'calories_per100g': 45,  'protein': 0.7, 'fat': 0.2, 'carbs': 10.4, 'calories': 112, 'food_type': 'beverage'},
    '苹果汁':   {'calories_per100g': 46,  'protein': 0.1, 'fat': 0.1, 'carbs': 11.3, 'calories': 115, 'food_type': 'beverage'},
    '咖啡(黑)': {'calories_per100g': 2,   'protein': 0.1, 'fat': 0.0, 'carbs': 0.3,  'calories': 5,   'food_type': 'beverage'},
    '拿铁咖啡': {'calories_per100g': 52,  'protein': 2.8, 'fat': 2.9, 'carbs': 4.2,  'calories': 130, 'food_type': 'beverage'},
    '绿茶':     {'calories_per100g': 1,   'protein': 0.2, 'fat': 0.0, 'carbs': 0.0,  'calories': 2,   'food_type': 'beverage'},
    '红茶':     {'calories_per100g': 1,   'protein': 0.1, 'fat': 0.0, 'carbs': 0.0,  'calories': 2,   'food_type': 'beverage'},
    '奶茶':     {'calories_per100g': 65,  'protein': 1.2, 'fat': 2.5, 'carbs': 10.0, 'calories': 325, 'food_type': 'beverage'},
    '珍珠奶茶': {'calories_per100g': 75,  'protein': 1.0, 'fat': 2.8, 'carbs': 12.0, 'calories': 375, 'food_type': 'beverage'},
    '啤酒':     {'calories_per100g': 43,  'protein': 0.5, 'fat': 0.0, 'carbs': 3.6,  'calories': 150, 'food_type': 'beverage'},
    '白酒':     {'calories_per100g': 298, 'protein': 0.0, 'fat': 0.0, 'carbs': 0.0,  'calories': 298, 'food_type': 'beverage'},
    '红酒':     {'calories_per100g': 85,  'protein': 0.1, 'fat': 0.0, 'carbs': 2.6,  'calories': 127, 'food_type': 'beverage'},
    '黄酒':     {'calories_per100g': 80,  'protein': 1.2, 'fat': 0.0, 'carbs': 5.0,  'calories': 120, 'food_type': 'beverage'},
    '牛奶咖啡': {'calories_per100g': 35,  'protein': 1.8, 'fat': 1.5, 'carbs': 4.0,  'calories': 88,  'food_type': 'beverage'},
    '椰子水':   {'calories_per100g': 19,  'protein': 0.7, 'fat': 0.2, 'carbs': 3.7,  'calories': 48,  'food_type': 'beverage'},
    '运动饮料': {'calories_per100g': 26,  'protein': 0.0, 'fat': 0.0, 'carbs': 6.4,  'calories': 65,  'food_type': 'beverage'},
    '气泡水':   {'calories_per100g': 0,   'protein': 0.0, 'fat': 0.0, 'carbs': 0.0,  'calories': 0,   'food_type': 'beverage'},
    '凉茶':     {'calories_per100g': 18,  'protein': 0.0, 'fat': 0.0, 'carbs': 4.5,  'calories': 45,  'food_type': 'beverage'},

    # ============================================================
    # 调味品 (Seasonings) - 18 items
    # ============================================================
    '酱油':     {'calories_per100g': 53,  'protein': 8.0, 'fat': 0.1, 'carbs': 4.7,  'calories': 53,  'food_type': 'seasoning'},
    '老抽':     {'calories_per100g': 72,  'protein': 7.0, 'fat': 0.1, 'carbs': 10.0, 'calories': 72,  'food_type': 'seasoning'},
    '生抽':     {'calories_per100g': 48,  'protein': 8.5, 'fat': 0.1, 'carbs': 3.5,  'calories': 48,  'food_type': 'seasoning'},
    '醋':       {'calories_per100g': 30,  'protein': 0.4, 'fat': 0.0, 'carbs': 4.7,  'calories': 30,  'food_type': 'seasoning'},
    '陈醋':     {'calories_per100g': 38,  'protein': 0.6, 'fat': 0.0, 'carbs': 6.0,  'calories': 38,  'food_type': 'seasoning'},
    '盐':       {'calories_per100g': 0,   'protein': 0.0, 'fat': 0.0, 'carbs': 0.0,  'calories': 0,   'food_type': 'seasoning'},
    '白糖':     {'calories_per100g': 387, 'protein': 0.0, 'fat': 0.0, 'carbs': 100.0,'calories': 387, 'food_type': 'seasoning'},
    '冰糖':     {'calories_per100g': 387, 'protein': 0.0, 'fat': 0.0, 'carbs': 99.9, 'calories': 387, 'food_type': 'seasoning'},
    '红糖':     {'calories_per100g': 380, 'protein': 0.7, 'fat': 0.0, 'carbs': 96.0, 'calories': 380, 'food_type': 'seasoning'},
    '辣椒酱':   {'calories_per100g': 76,  'protein': 2.5, 'fat': 3.0, 'carbs': 10.5, 'calories': 76,  'food_type': 'seasoning'},
    '番茄酱':   {'calories_per100g': 83,  'protein': 1.7, 'fat': 0.2, 'carbs': 18.9, 'calories': 83,  'food_type': 'seasoning'},
    '蚝油':     {'calories_per100g': 115, 'protein': 3.5, 'fat': 0.3, 'carbs': 25.0, 'calories': 115, 'food_type': 'seasoning'},
    '料酒':     {'calories_per100g': 58,  'protein': 0.3, 'fat': 0.0, 'carbs': 2.0,  'calories': 58,  'food_type': 'seasoning'},
    '豆瓣酱':   {'calories_per100g': 143, 'protein': 8.5, 'fat': 5.0, 'carbs': 17.0, 'calories': 143, 'food_type': 'seasoning'},
    '甜面酱':   {'calories_per100g': 136, 'protein': 4.7, 'fat': 0.5, 'carbs': 28.0, 'calories': 136, 'food_type': 'seasoning'},
    '芝麻油':   {'calories_per100g': 898, 'protein': 0.0, 'fat': 99.7, 'carbs': 0.0, 'calories': 898, 'food_type': 'seasoning'},
    '橄榄油':   {'calories_per100g': 884, 'protein': 0.0, 'fat': 100.0,'carbs': 0.0,  'calories': 884, 'food_type': 'seasoning'},
    '味精':     {'calories_per100g': 268, 'protein': 68.0, 'fat': 0.0, 'carbs': 0.0,  'calories': 268, 'food_type': 'seasoning'},

    # ============================================================
    # 复合菜肴 (Composite Dishes) - 22 items
    # ============================================================
    '宫保鸡丁':     {'calories_per100g': 172, 'protein': 16.0, 'fat': 9.0, 'carbs': 8.0,  'calories': 344, 'food_type': 'dish'},
    '麻婆豆腐':     {'calories_per100g': 85,  'protein': 6.0, 'fat': 5.0, 'carbs': 4.0,  'calories': 170, 'food_type': 'dish'},
    '红烧肉':       {'calories_per100g': 290, 'protein': 12.0, 'fat': 25.0, 'carbs': 4.0,  'calories': 435, 'food_type': 'dish'},
    '糖醋里脊':     {'calories_per100g': 210, 'protein': 14.0, 'fat': 10.0, 'carbs': 18.0, 'calories': 315, 'food_type': 'dish'},
    '鱼香肉丝':     {'calories_per100g': 140, 'protein': 12.0, 'fat': 7.0, 'carbs': 8.0,  'calories': 280, 'food_type': 'dish'},
    '回锅肉':       {'calories_per100g': 260, 'protein': 14.0, 'fat': 22.0, 'carbs': 3.0,  'calories': 390, 'food_type': 'dish'},
    '水煮鱼':       {'calories_per100g': 148, 'protein': 15.0, 'fat': 9.0, 'carbs': 2.0,  'calories': 296, 'food_type': 'dish'},
    '酸菜鱼':       {'calories_per100g': 85,  'protein': 12.0, 'fat': 3.5, 'carbs': 2.0,  'calories': 213, 'food_type': 'dish'},
    '火锅':         {'calories_per100g': 120, 'protein': 10.0, 'fat': 8.0, 'carbs': 3.0,  'calories': 600, 'food_type': 'dish'},
    '麻辣烫':       {'calories_per100g': 95,  'protein': 7.0, 'fat': 5.5, 'carbs': 5.0,  'calories': 475, 'food_type': 'dish'},
    '炒饭':         {'calories_per100g': 180, 'protein': 5.0, 'fat': 7.0, 'carbs': 25.0, 'calories': 360, 'food_type': 'dish'},
    '炒面':         {'calories_per100g': 170, 'protein': 6.0, 'fat': 6.0, 'carbs': 24.0, 'calories': 340, 'food_type': 'dish'},
    '蛋炒饭':       {'calories_per100g': 186, 'protein': 5.5, 'fat': 7.5, 'carbs': 25.0, 'calories': 372, 'food_type': 'dish'},
    '西红柿炒鸡蛋':  {'calories_per100g': 65,  'protein': 4.0, 'fat': 3.5, 'carbs': 4.0,  'calories': 130, 'food_type': 'dish'},
    '青椒肉丝':     {'calories_per100g': 135, 'protein': 12.0, 'fat': 7.0, 'carbs': 5.0,  'calories': 270, 'food_type': 'dish'},
    '红烧牛肉':     {'calories_per100g': 190, 'protein': 20.0, 'fat': 10.0, 'carbs': 5.0,  'calories': 380, 'food_type': 'dish'},
    '清蒸鱼':       {'calories_per100g': 100, 'protein': 17.0, 'fat': 3.0, 'carbs': 1.0,  'calories': 200, 'food_type': 'dish'},
    '烤鱼':         {'calories_per100g': 160, 'protein': 18.0, 'fat': 9.0, 'carbs': 3.0,  'calories': 320, 'food_type': 'dish'},
    '东坡肉':       {'calories_per100g': 310, 'protein': 13.0, 'fat': 28.0, 'carbs': 4.0,  'calories': 465, 'food_type': 'dish'},
    '辣子鸡':       {'calories_per100g': 210, 'protein': 18.0, 'fat': 14.0, 'carbs': 5.0,  'calories': 420, 'food_type': 'dish'},
    '干锅菜花':     {'calories_per100g': 85,  'protein': 3.5, 'fat': 5.0, 'carbs': 6.0,  'calories': 170, 'food_type': 'dish'},
    '地三鲜':       {'calories_per100g': 90,  'protein': 2.0, 'fat': 4.5, 'carbs': 11.0, 'calories': 180, 'food_type': 'dish'},

    # ============================================================
    # 其他 (Other - Western, Japanese, etc.) - 18 items
    # ============================================================
    '披萨':         {'calories_per100g': 266, 'protein': 11.0, 'fat': 10.0, 'carbs': 33.0, 'calories': 532, 'food_type': 'other'},
    '汉堡':         {'calories_per100g': 250, 'protein': 14.0, 'fat': 11.0, 'carbs': 26.0, 'calories': 500, 'food_type': 'other'},
    '寿司':         {'calories_per100g': 145, 'protein': 5.5, 'fat': 3.0, 'carbs': 24.0, 'calories': 290, 'food_type': 'other'},
    '三明治':       {'calories_per100g': 220, 'protein': 10.0, 'fat': 9.0, 'carbs': 26.0, 'calories': 440, 'food_type': 'other'},
    '沙拉':         {'calories_per100g': 45,  'protein': 2.0, 'fat': 2.5, 'carbs': 4.0,  'calories': 90,  'food_type': 'other'},
    '凯撒沙拉':     {'calories_per100g': 120, 'protein': 6.0, 'fat': 8.0, 'carbs': 6.0,  'calories': 240, 'food_type': 'other'},
    '意面':         {'calories_per100g': 140, 'protein': 5.0, 'fat': 3.0, 'carbs': 25.0, 'calories': 350, 'food_type': 'other'},
    '通心粉':       {'calories_per100g': 130, 'protein': 4.5, 'fat': 2.0, 'carbs': 24.0, 'calories': 325, 'food_type': 'other'},
    '牛排':         {'calories_per100g': 215, 'protein': 25.0, 'fat': 12.0, 'carbs': 0.0,  'calories': 430, 'food_type': 'other'},
    '炸鸡':         {'calories_per100g': 290, 'protein': 20.0, 'fat': 18.0, 'carbs': 10.0, 'calories': 435, 'food_type': 'other'},
    '天妇罗':       {'calories_per100g': 230, 'protein': 10.0, 'fat': 14.0, 'carbs': 17.0, 'calories': 345, 'food_type': 'other'},
    '咖喱饭':       {'calories_per100g': 165, 'protein': 5.0, 'fat': 5.0, 'carbs': 26.0, 'calories': 413, 'food_type': 'other'},
    '乌冬面':       {'calories_per100g': 100, 'protein': 3.0, 'fat': 0.5, 'carbs': 21.0, 'calories': 250, 'food_type': 'other'},
    '拉面':         {'calories_per100g': 120, 'protein': 4.5, 'fat': 3.0, 'carbs': 19.0, 'calories': 480, 'food_type': 'other'},
    '热狗':         {'calories_per100g': 247, 'protein': 10.0, 'fat': 15.0, 'carbs': 20.0, 'calories': 370, 'food_type': 'other'},
    '墨西哥卷':     {'calories_per100g': 210, 'protein': 9.0, 'fat': 10.0, 'carbs': 22.0, 'calories': 420, 'food_type': 'other'},
    '饭团':         {'calories_per100g': 160, 'protein': 4.0, 'fat': 2.0, 'carbs': 32.0, 'calories': 240, 'food_type': 'other'},
    '春卷':         {'calories_per100g': 230, 'protein': 6.0, 'fat': 12.0, 'carbs': 25.0, 'calories': 230, 'food_type': 'other'},
}


def get_food_label_map():
    """Return a dict of food_name -> index for FAISS"""
    return {name: idx for idx, name in enumerate(sorted(NUTRITION_DB.keys()))}


def get_food_type(food_name: str) -> str:
    """
    Get food type category for a given food name.
    First tries direct lookup from NUTRITION_DB, then falls back to keyword mapper.
    """
    if food_name in NUTRITION_DB:
        return NUTRITION_DB[food_name].get('food_type', map_to_food_type(food_name))
    return map_to_food_type(food_name)
