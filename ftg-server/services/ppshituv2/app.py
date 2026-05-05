"""
PP-ShiTuV2 Food Recognition Microservice
Flask HTTP API for food image recognition
"""

import os
import io
import json
import base64
import logging
from PIL import Image
from flask import Flask, request, jsonify

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Global model variables (lazy loaded)
_recognition_model = None
_faiss_index = None
_label_map = {}

MODEL_DIR = os.environ.get('MODEL_DIR', './models')
CONFIDENCE_THRESHOLD = 0.3
MAX_IMAGE_SIZE = 640
JPEG_QUALITY = 90

# --- Model Loading ---

def get_model():
    """Lazy-load PP-ShiTuV2 model"""
    global _recognition_model
    if _recognition_model is None:
        try:
            from paddleclas import PaddleClas
            _recognition_model = PaddleClas(
                model_name='PPLCNetV2_base',
                use_gpu=False,
                top_k=3,
            )
            logger.info("PP-ShiTuV2 model loaded successfully")
        except ImportError:
            logger.warning(
                "PaddleClas not installed. Running in stub mode. "
                "Food will be identified from keyword database only."
            )
            _recognition_model = False
    return _recognition_model if _recognition_model is not False else None


def get_faiss_index():
    """Lazy-load FAISS index with food labels"""
    global _faiss_index, _label_map
    if _faiss_index is None:
        try:
            from nutrition_db import get_food_label_map
            _label_map = get_food_label_map()
            logger.info(f"Loaded {len(_label_map)} food labels from nutrition database")
        except Exception as e:
            logger.warning(f"Failed to load label map: {e}")
            _label_map = {}
        _faiss_index = True if _label_map else False
    return _label_map


# --- Image Preprocessing ---

def preprocess_image(image_data: bytes) -> bytes:
    """Resize and compress image to standard format"""
    try:
        img = Image.open(io.BytesIO(image_data))
        # Convert to RGB
        if img.mode != 'RGB':
            img = img.convert('RGB')
        # Resize: longest edge <= MAX_IMAGE_SIZE
        width, height = img.size
        scale = MAX_IMAGE_SIZE / max(width, height) if max(width, height) > MAX_IMAGE_SIZE else 1.0
        if scale < 1.0:
            width = int(width * scale)
            height = int(height * scale)
            img = img.resize((width, height), Image.LANCZOS)
        # Compress to JPEG
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=JPEG_QUALITY)
        return buffer.getvalue()
    except Exception as e:
        logger.error(f"Image preprocessing failed: {e}")
        return image_data  # Return original on error


# --- Nutrition Database Lookup ---

def lookup_nutrition(food_name: str):
    """Look up nutrition info for a food name"""
    try:
        from nutrition_db import NUTRITION_DB, get_food_type
        # Try exact match first
        if food_name in NUTRITION_DB:
            info = NUTRITION_DB[food_name]
            return {
                'calories_total': info.get('calories', 0),
                'calories_per100g': info.get('calories_per100g', 0),
                'protein': info.get('protein', 0),
                'fat': info.get('fat', 0),
                'carbs': info.get('carbs', 0),
                'food_type': get_food_type(food_name),
            }
        # Fuzzy match
        for name, info in NUTRITION_DB.items():
            if food_name in name or name in food_name:
                return {
                    'calories_total': info.get('calories', 0),
                    'calories_per100g': info.get('calories_per100g', 0),
                    'protein': info.get('protein', 0),
                    'fat': info.get('fat', 0),
                    'carbs': info.get('carbs', 0),
                    'food_type': get_food_type(name),
                }
        return None
    except Exception as e:
        logger.error(f"Nutrition lookup failed: {e}")
        return None


# --- API Routes ---

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    model = get_model()
    label_count = len(get_faiss_index()) if get_faiss_index() else 0
    return jsonify({
        'status': 'ok',
        'model_loaded': model is not None,
        'label_count': label_count,
        'model_dir': MODEL_DIR,
    })


@app.route('/predict', methods=['POST'])
def predict():
    """
    Food recognition endpoint
    Accepts: { "image": "<base64_encoded_image>" }
    Returns: { success, food_name, confidence, food_type, calories, alternatives }
    """
    try:
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({'success': False, 'error': 'missing_image', 'message': 'No image data provided'}), 400

        # Decode and preprocess image
        image_data = base64.b64decode(data['image'])
        preprocessed = preprocess_image(image_data)

        # Try PP-ShiTuV2 recognition
        model = get_model()
        if model:
            try:
                temp_path = '/tmp/food_temp.jpg'
                with open(temp_path, 'wb') as f:
                    f.write(preprocessed)
                result = model.predict(temp_path)
                os.remove(temp_path)
                if result and len(result) > 0:
                    top = result[0]
                    confidence = float(top.get('score', 0))
                    if confidence >= CONFIDENCE_THRESHOLD:
                        food_name = top.get('label_names', ['unknown'])[0]
                        alternatives = [
                            {'foodName': r.get('label_names', ['unknown'])[0], 'confidence': float(r.get('score', 0))}
                            for r in result[:3]
                        ]
                        nutrition = lookup_nutrition(food_name)
                        return jsonify({
                            'success': True,
                            'food_name': food_name,
                            'confidence': confidence,
                            'food_type': nutrition['food_type'] if nutrition else 'other',
                            'calories': nutrition,
                            'alternatives': alternatives,
                        })
            except Exception as e:
                logger.warning(f"PP-ShiTuV2 prediction failed, falling back to keyword: {e}")

        # Fallback: keyword-based recognition using nutrition DB labels
        food_label_map = get_faiss_index()
        if food_label_map:
            # Return a default food item when model is unavailable
            return jsonify({
                'success': True,
                'food_name': '未知食物',
                'confidence': 0.0,
                'food_type': 'other',
                'calories': None,
                'alternatives': [],
                'note': 'Model not loaded - running in keyword-only mode',
            })

        return jsonify({
            'success': False,
            'error': 'non_food',
            'message': 'No food detected in image',
        })

    except Exception as e:
        logger.error(f"Prediction error: {e}")
        return jsonify({
            'success': False,
            'error': 'prediction_error',
            'message': str(e),
        }), 500


if __name__ == '__main__':
    port = int(os.environ.get('FLASK_PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
