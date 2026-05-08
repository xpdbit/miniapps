"""
PP-ShiTuV2 食物识别服务 - Flask API
部署于 CloudBase CloudRun，提供食物图像识别接口
"""

import io
import json
import base64
import time
import logging
from typing import Optional, List

import numpy as np
from PIL import Image
from flask import Flask, request, jsonify

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# ============================================================
# 模型加载（延迟初始化，减少冷启动时间）
# ============================================================
_detector = None
_recognizer = None
_model_loaded = False


def load_models():
    """延迟加载 PP-ShiTuV2 模型"""
    global _detector, _recognizer, _model_loaded
    if _model_loaded:
        return

    logger.info("Loading PP-ShiTuV2 models...")
    try:
        # 实际部署时使用 PaddleClas 的 PPLCNet/PicoDet 模型
        # from paddleclas import PPLCNet, PicoDet
        # _detector = PicoDet(model_dir='/app/models/picodet')
        # _recognizer = PPLCNet(model_dir='/app/models/pplcnet')
        logger.info("Models loaded successfully (placeholder)")
        _model_loaded = True
    except Exception as e:
        logger.error(f"Failed to load models: {e}")
        raise


# ============================================================
# 图片预处理
# ============================================================
def preprocess_image(image_data: bytes, max_size: int = 640) -> np.ndarray:
    """
    预处理待识别图片
    - 解码 base64/原始 bytes
    - 限制最大边长为 max_size
    - 转换为 RGB 格式
    - 归一化到 [0, 1]
    """
    image = Image.open(io.BytesIO(image_data)).convert('RGB')

    # 等比缩放，限制最大边长
    w, h = image.size
    if max(w, h) > max_size:
        scale = max_size / max(w, h)
        new_w, new_h = int(w * scale), int(h * scale)
        image = image.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # 转为 numpy 数组并归一化
    img_array = np.array(image, dtype=np.float32) / 255.0
    return img_array


# ============================================================
# 食物分类映射（中文名称 → 业务分类）
# ============================================================
FOOD_CATEGORY_MAP = {
    # 谷薯类
    '米': 'grain', '饭': 'grain', '面': 'grain', '饼': 'grain',
    '包': 'grain', '馒头': 'grain', '面条': 'grain', '米粉': 'grain',
    '米饭': 'grain', '炒饭': 'grain', '土豆': 'grain', '红薯': 'grain',
    '面包': 'grain', '蛋糕': 'grain', '粽子': 'grain', '年糕': 'grain',
    '粥': 'grain', '麦': 'grain', '粮': 'grain',
    # 蔬菜类
    '菜': 'vegetable', '瓜': 'vegetable', '椒': 'vegetable',
    '菇': 'vegetable', '茄': 'vegetable', '豆': 'vegetable',
    '西兰花': 'vegetable', '菠菜': 'vegetable', '白菜': 'vegetable',
    '青菜': 'vegetable', '生菜': 'vegetable', '胡萝卜': 'vegetable',
    '番茄': 'vegetable', '黄瓜': 'vegetable', '洋葱': 'vegetable',
    # 水果类
    '果': 'fruit', '莓': 'fruit', '橙': 'fruit', '橘': 'fruit',
    '苹果': 'fruit', '西瓜': 'fruit', '香蕉': 'fruit', '葡萄': 'fruit',
    '梨': 'fruit', '桃': 'fruit', '芒果': 'fruit', '草莓': 'fruit',
    '樱桃': 'fruit', '菠萝': 'fruit', '柠檬': 'fruit', '柚子': 'fruit',
    # 肉蛋类
    '肉': 'meat', '鸡': 'meat', '猪': 'meat', '牛': 'meat',
    '羊': 'meat', '蛋': 'meat', '鸭': 'meat', '鸽': 'meat',
    '牛排': 'meat', '火腿': 'meat', '培根': 'meat', '腊肠': 'meat',
    '排骨': 'meat', '红烧肉': 'meat', '宫保鸡丁': 'meat',
    # 水产类
    '鱼': 'seafood', '虾': 'seafood', '蟹': 'seafood', '贝': 'seafood',
    '鱿': 'seafood', '螺': 'seafood', '龙虾': 'seafood', '三文鱼': 'seafood',
    '蛤': 'seafood', '蚝': 'seafood', '海': 'seafood',
    # 奶豆类
    '奶': 'dairy', '豆浆': 'dairy', '豆腐': 'dairy', '酸奶': 'dairy',
    '奶酪': 'dairy', '豆奶': 'dairy', '豆皮': 'dairy',
    # 饮品
    '茶': 'beverage', '咖啡': 'beverage', '可乐': 'beverage', '酒': 'beverage',
    '汁': 'beverage', '水': 'beverage', '奶茶': 'beverage', '汽水': 'beverage',
    '牛奶': 'beverage', '饮料': 'beverage',
    # 坚果
    '坚果': 'nut', '花生': 'nut', '核桃': 'nut', '杏仁': 'nut',
    '腰果': 'nut', '瓜子': 'nut', '芝麻': 'nut',
    # 小吃零食
    '薯片': 'snack', '饼干': 'snack', '糖': 'snack', '零食': 'snack',
    '巧克力': 'snack', '冰淇淋': 'snack', '果冻': 'snack', '爆米花': 'snack',
    # 调味品
    '酱': 'seasoning', '醋': 'seasoning', '盐': 'seasoning', '糖': 'seasoning',
    '辣椒': 'seasoning', '酱油': 'seasoning', '味精': 'seasoning',
    # 复合菜肴
    '煲': 'dish', '火锅': 'dish', '烤': 'dish', '炸': 'dish', '炖': 'dish',
    '蒸': 'dish', '炒': 'dish', '卤': 'dish', '麻辣': 'dish', '拉面': 'dish',
    '披萨': 'dish', '汉堡': 'dish', '寿司': 'dish', '沙拉': 'dish',
    '盖饭': 'dish', '盖浇': 'dish', '套餐': 'dish',
}


def classify_food(food_name: str) -> str:
    """根据食物名称推断食物分类"""
    for keyword, category in FOOD_CATEGORY_MAP.items():
        if keyword in food_name:
            return category
    return 'other'


# ============================================================
# 营养信息（常见食物，每100g）
# ============================================================
NUTRITION_DB = {
    '米饭': {'calories_per_100g': 116, 'protein': 2.6, 'fat': 0.3, 'carbs': 25.9},
    '面条': {'calories_per_100g': 110, 'protein': 4.0, 'fat': 0.4, 'carbs': 22.0},
    '苹果': {'calories_per_100g': 52, 'protein': 0.3, 'fat': 0.2, 'carbs': 13.8},
    '鸡蛋': {'calories_per_100g': 144, 'protein': 13.3, 'fat': 8.8, 'carbs': 2.8},
    '鸡胸肉': {'calories_per_100g': 133, 'protein': 31.0, 'fat': 1.2, 'carbs': 0},
    '猪肉': {'calories_per_100g': 395, 'protein': 13.2, 'fat': 37.0, 'carbs': 2.4},
    '牛肉': {'calories_per_100g': 125, 'protein': 19.9, 'fat': 4.2, 'carbs': 2.0},
    '三文鱼': {'calories_per_100g': 208, 'protein': 20.4, 'fat': 13.4, 'carbs': 0},
    '虾': {'calories_per_100g': 99, 'protein': 20.0, 'fat': 0.7, 'carbs': 0.2},
    '豆腐': {'calories_per_100g': 76, 'protein': 8.1, 'fat': 3.7, 'carbs': 4.2},
    '牛奶': {'calories_per_100g': 66, 'protein': 3.2, 'fat': 3.5, 'carbs': 5.0},
    '西兰花': {'calories_per_100g': 34, 'protein': 2.8, 'fat': 0.4, 'carbs': 7.0},
    '土豆': {'calories_per_100g': 77, 'protein': 2.0, 'fat': 0.1, 'carbs': 17.5},
    '香蕉': {'calories_per_100g': 89, 'protein': 1.1, 'fat': 0.3, 'carbs': 22.8},
    '面包': {'calories_per_100g': 265, 'protein': 9.0, 'fat': 3.2, 'carbs': 49.0},
}


def get_nutrition(food_name: str) -> dict:
    """获取食物营养信息，未找到则返回默认值"""
    for key, info in NUTRITION_DB.items():
        if key in food_name:
            return info
    return {'calories_per_100g': 150, 'protein': 5.0, 'fat': 5.0, 'carbs': 20.0}


# ============================================================
# 识别接口（Placeholder — 实际部署时替换为 PP-ShiTuV2 推理）
# ============================================================
def recognize_food(image_data: bytes) -> dict:
    """
    调用 PP-ShiTuV2 模型进行食物识别
    返回识别的食物名称、置信度等
    """
    load_models()

    # 预处理图片
    _ = preprocess_image(image_data)

    # ========================================
    # TODO: 替换为实际的 PP-ShiTuV2 推理代码
    # 1. 主体检测（PicoDet）
    #    boxes = _detector.predict(img_array)
    # 2. 特征提取（PPLCNet）
    #    features = _recognizer.extract(crops)
    # 3. FAISS 向量检索
    #    distances, indices = faiss_index.search(features, k=5)
    # 4. 返回最佳匹配
    #    return results[indices[0][0]]
    # ========================================

    # Placeholder 结果
    return {
        'foodName': '未知食物',
        'confidence': 0.85,
        'category': 'other',
        'alternatives': [
            {'foodName': '米饭', 'confidence': 0.65},
            {'foodName': '面条', 'confidence': 0.45},
        ],
    }


# ============================================================
# API 接口
# ============================================================
@app.route('/health', methods=['GET'])
def health_check():
    """健康检查端点"""
    return jsonify({
        'status': 'ok',
        'version': '2.0.0',
        'timestamp': time.time(),
        'models_loaded': _model_loaded,
    })


@app.route('/predict', methods=['POST'])
def predict():
    """
    食物识别接口
    接收: { "image_base64": "base64编码的图片" }
    返回: { "foodName": "...", "confidence": 0.95, "category": "...", ... }
    """
    start_time = time.time()

    try:
        data = request.get_json(force=True)
        if not data or 'image_base64' not in data:
            return jsonify({
                'error': True,
                'message': '缺少 image_base64 参数',
            }), 400

        # 解码图片
        try:
            image_data = base64.b64decode(data['image_base64'])
        except Exception:
            return jsonify({
                'error': True,
                'message': '图片 base64 解码失败',
            }), 400

        # 限制图片大小（最大 10MB）
        if len(image_data) > 10 * 1024 * 1024:
            return jsonify({
                'error': True,
                'message': '图片大小超过 10MB 限制',
            }), 400

        # 执行识别
        result = recognize_food(image_data)

        # 补充分类和营养信息
        result['category'] = classify_food(result['foodName'])
        result['nutrition'] = get_nutrition(result['foodName'])
        result['processing_time_ms'] = int((time.time() - start_time) * 1000)

        logger.info(f"识别完成: {result['foodName']} (置信度: {result['confidence']})")
        return jsonify(result)

    except Exception as e:
        logger.error(f"识别失败: {e}")
        return jsonify({
            'error': True,
            'message': f'识别服务内部错误: {str(e)}',
        }), 500


@app.route('/predict/batch', methods=['POST'])
def predict_batch():
    """批量食物识别接口"""
    try:
        data = request.get_json(force=True)
        images = data.get('images', []) if data else []

        if not isinstance(images, list) or len(images) == 0:
            return jsonify({'error': True, 'message': '缺少 images 参数'}), 400

        results = []
        for img_b64 in images:
            try:
                image_data = base64.b64decode(img_b64)
                result = recognize_food(image_data)
                result['category'] = classify_food(result['foodName'])
                results.append(result)
            except Exception as e:
                results.append({'error': True, 'message': str(e)})

        return jsonify({'results': results, 'count': len(results)})

    except Exception as e:
        logger.error(f"批量识别失败: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500


# ============================================================
# 启动服务
# ============================================================
if __name__ == '__main__':
    port = int(__import__('os').environ.get('PORT', 8080))
    logger.info(f"Starting PP-ShiTuV2 food recognition server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
