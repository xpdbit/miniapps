"""
Maps food names and categories to the 12 FoodType enum values
"""

FOOD_TYPE_MAP = {
    'grain': ['米', '面', '饭', '饼', '包', '馒头', '土豆', '红薯', '面条', '米粉', '面包', '蛋糕', '饺子', '年糕', '粥', '玉米', '麦片'],
    'vegetable': ['菜', '瓜', '豆', '茄', '椒', '菇', '西兰花', '菠菜', '白菜', '番茄', '黄瓜', '胡萝卜', '青椒', '茄子', '蘑菇'],
    'fruit': ['果', '莓', '橙', '苹果', '西瓜', '香蕉', '葡萄', '梨', '桃', '草莓', '猕猴桃', '芒果', '柚子', '荔枝'],
    'meat': ['肉', '鸡', '猪', '牛', '羊', '蛋', '鸭', '鸽', '排', '腿'],
    'seafood': ['鱼', '虾', '蟹', '贝', '鱿', '螺', '蛤', '蚝', '带鱼', '三文鱼'],
    'dairy': ['奶', '豆浆', '豆腐', '酸奶', '奶酪', '黄豆', '豆皮'],
    'nut': ['核桃', '杏仁', '花生', '腰果', '瓜子', '开心果', '榛子', '松子'],
    'snack': ['薯片', '饼干', '糖', '巧克力', '冰淇淋', '雪糕', '爆米花', '果冻'],
    'beverage': ['茶', '咖啡', '可乐', '汁', '酒', '水', '奶茶', '雪碧', '橙汁'],
    'seasoning': ['酱', '醋', '盐', '糖', '辣椒', '番茄酱', '蚝油', '料酒'],
    'dish': ['宫保鸡丁', '麻婆豆腐', '红烧', '糖醋', '火锅', '炒', '炖', '烤', '沙拉', '披萨', '汉堡', '寿司', '三明治', '意面'],
    'other': [],
}


def map_to_food_type(food_name: str) -> str:
    """Map a food name to one of the 12 FoodType categories"""
    for food_type, keywords in FOOD_TYPE_MAP.items():
        for keyword in keywords:
            if keyword in food_name:
                return food_type
    return 'other'
