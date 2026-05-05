import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Input,
  Picker,
  Button,
  Image,
  Textarea,
} from '@tarojs/components';
import Taro from '@tarojs/taro';
import { FoodType } from '@/types/food';
import type {
  CalorieInfo,
  AIFoodDescription,
} from '@/types/food';
import {
  FOOD_TYPE_LABELS,
  FOOD_TYPE_EMOJIS,
} from '@/constants/foodTypes';
import './index.scss';

/** 页面路由参数 */
interface RecordPageParams {
  /** 食物原图云文件 ID */
  imageFileID?: string;
  /** 主题合成图云文件 ID */
  themeImageFileID?: string;
  /** 食物名称（AI 识别结果） */
  foodName?: string;
  /** 食物类型 */
  foodType?: FoodType;
  /** 卡路里 - 总量 */
  calorieTotal?: string;
  /** 卡路里 - 每100g */
  caloriePer100g?: string;
  /** 卡路里 - 蛋白质 */
  calorieProtein?: string;
  /** 卡路里 - 脂肪 */
  calorieFat?: string;
  /** 卡路里 - 碳水 */
  calorieCarbs?: string;
  /** AI 简短描述 */
  aiShort?: string;
  /** AI 游戏化描述 */
  gameDescription?: string;
  /** AI 详细描述 */
  aiDetail?: string;
  /** 纬度 */
  latitude?: string;
  /** 经度 */
  longitude?: string;
  /** 位置名称 */
  locationName?: string;
  /** IP 定位结果 */
  ipLocation?: string;
  /** 主题 ID */
  themeId?: string;
}

/** 表单数据 */
interface FormData {
  foodName: string;
  foodType: FoodType;
  calorieTotal: string;
  aiGameDescription: string;
  remark: string;
}

/** 食物类型选项列表 */
const FOOD_TYPE_OPTIONS: Array<{ value: FoodType; label: string }> =
  Object.values(FoodType).map((type) => ({
    value: type,
    label: `${FOOD_TYPE_EMOJIS[type]} ${FOOD_TYPE_LABELS[type]}`,
  }));

/** 获取 Picker 选中索引对应的 FoodType */
function getFoodTypeByIndex(index: number): FoodType {
  const option = FOOD_TYPE_OPTIONS[index];
  return option?.value ?? FoodType.OTHER;
}

/** 获取 FoodType 对应的 Picker 索引 */
function getIndexByFoodType(type: FoodType): number {
  const idx = FOOD_TYPE_OPTIONS.findIndex((opt) => opt.value === type);
  return idx >= 0 ? idx : 0;
}

export default function RecordPage() {
  // ============================================================
  // Route params (memoized 避免每次渲染重新创建)
  // ============================================================
  const params = useMemo<RecordPageParams>(() => {
    const router = Taro.getCurrentInstance().router;
    return (router?.params ?? {}) as RecordPageParams;
  }, []);

  // ============================================================
  // State
  // ============================================================
  const [formData, setFormData] = useState<FormData>({
    foodName: params.foodName ?? '',
    foodType: params.foodType ?? FoodType.OTHER,
    calorieTotal: params.calorieTotal ?? '',
    aiGameDescription: params.gameDescription ?? '',
    remark: '',
  });

  const [foodTypePickerIndex, setFoodTypePickerIndex] = useState<number>(
    getIndexByFoodType(params.foodType ?? FoodType.OTHER),
  );

  const [saving, setSaving] = useState<boolean>(false);

  /** 从路由参数中提取的图片信息 */
  const imageFileID: string = params.imageFileID ?? '';
  const themeImageFileID: string = params.themeImageFileID ?? '';

  // ============================================================
  // 验证
  // ============================================================
  const isFormValid: boolean = formData.foodName.trim().length > 0;

  // ============================================================
  // 字段更新
  // ============================================================
  const handleFoodNameChange = useCallback(
    (e: { detail: { value: string } }) => {
      setFormData((prev) => ({ ...prev, foodName: e.detail.value }));
    },
    [],
  );

  const handleCalorieChange = useCallback(
    (e: { detail: { value: string } }) => {
      // 只允许数字输入
      const value = e.detail.value.replace(/[^0-9]/g, '');
      setFormData((prev) => ({ ...prev, calorieTotal: value }));
    },
    [],
  );

  const handleRemarkChange = useCallback(
    (e: { detail: { value: string } }) => {
      setFormData((prev) => ({ ...prev, remark: e.detail.value }));
    },
    [],
  );

  const handleFoodTypeChange = useCallback(
    (e: { detail: { value: string | number } }) => {
      const index = Number(e.detail.value);
      setFoodTypePickerIndex(index);
      setFormData((prev) => ({
        ...prev,
        foodType: getFoodTypeByIndex(index),
      }));
    },
    [],
  );

  // ============================================================
  // 保存记录
  // ============================================================
  const handleSave = useCallback(async () => {
    if (!isFormValid) {
      Taro.showToast({
        title: '请输入食物名称',
        icon: 'none',
        duration: 2000,
      });
      return;
    }

    setSaving(true);

    try {
      const calorieTotalNum = formData.calorieTotal
        ? parseInt(formData.calorieTotal, 10)
        : 0;

      const calorieInfo: CalorieInfo = {
        total: calorieTotalNum,
        per100g: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
      };

      const aiDescription: AIFoodDescription = {
        short: params.aiShort ?? '',
        gameStyle: formData.aiGameDescription,
        detail: params.aiDetail ?? '',
      };

      const result = await Taro.cloud.callFunction({
        name: 'createFoodRecord',
        data: {
          action: 'create',
          data: {
            imageFileID,
            themeImageFileID,
            foodName: formData.foodName.trim(),
            foodType: formData.foodType,
            calories: calorieInfo,
            aiDescription,
            gameDescription: formData.aiGameDescription,
            latitude: params.latitude
              ? parseFloat(params.latitude)
              : 0,
            longitude: params.longitude
              ? parseFloat(params.longitude)
              : 0,
            locationName: params.locationName ?? '',
            ipLocation: params.ipLocation ?? '',
            themeId: params.themeId ?? '',
            remark: formData.remark.trim(),
          },
        },
      });

      const response = result.result as {
        success: boolean;
        data?: { recordId: string };
        errMsg?: string;
      };

      if (!response.success) {
        throw new Error(response.errMsg ?? '保存失败');
      }

      const recordId = response.data?.recordId ?? '';

      Taro.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 2000,
      });

      // 跳转到详情页
      setTimeout(() => {
        Taro.navigateTo({
          url: `/pages/record/detail/index?recordId=${recordId}`,
        });
      }, 500);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '保存失败，请重试';
      Taro.showToast({
        title: message,
        icon: 'none',
        duration: 2000,
      });
    } finally {
      setSaving(false);
    }
  }, [
    formData,
    isFormValid,
    imageFileID,
    themeImageFileID,
    params,
  ]);

  // ============================================================
  // 重新拍照
  // ============================================================
  const handleRetakePhoto = useCallback(() => {
    Taro.navigateBack();
  }, []);

  // ============================================================
  // 构建 Picker 范围
  // ============================================================
  const pickerRange = FOOD_TYPE_OPTIONS.map((opt) => opt.label);

  // ============================================================
  // 渲染
  // ============================================================
  return (
    <View className='record-page'>
      {/* ==================== 图片区域 ==================== */}
      {(imageFileID || themeImageFileID) && (
        <View className='record-card'>
          <Text className='record-card-title'>食物图片</Text>
          <View className='record-images'>
            {imageFileID && (
              <View className='record-image-wrapper'>
                <Image
                  className='record-image'
                  src={imageFileID}
                  mode='aspectFill'
                />
              </View>
            )}
            {themeImageFileID && (
              <View className='record-image-wrapper'>
                <Image
                  className='record-image'
                  src={themeImageFileID}
                  mode='aspectFill'
                />
              </View>
            )}
          </View>
        </View>
      )}

      {/* ==================== 基本信息 ==================== */}
      <View className='record-card'>
        <Text className='record-card-title'>基本信息</Text>

        {/* 食物名称 */}
        <View className='record-form-item'>
          <Text className='record-form-label record-form-label-required'>
            食物名称
          </Text>
          <Input
            className='record-input'
            type='text'
            placeholder='请输入食物名称'
            value={formData.foodName}
            onInput={handleFoodNameChange}
          />
        </View>

        {/* 食物类型 */}
        <View className='record-form-item'>
          <Text className='record-form-label'>食物类型</Text>
          <Picker
            mode='selector'
            range={pickerRange}
            value={foodTypePickerIndex}
            onChange={handleFoodTypeChange}
          >
            <View className='record-picker'>
              <Text
                className={
                  formData.foodType
                    ? ''
                    : 'record-picker-placeholder'
                }
              >
                {pickerRange[foodTypePickerIndex] ?? '请选择食物类型'}
              </Text>
              <Text className='record-picker-arrow'>›</Text>
            </View>
          </Picker>
        </View>

        {/* 热量 */}
        <View className='record-form-item'>
          <Text className='record-form-label'>热量</Text>
          <View className='record-calorie-row'>
            <Input
              className='record-calorie-input'
              type='number'
              placeholder='0'
              value={formData.calorieTotal}
              onInput={handleCalorieChange}
            />
            <Text className='record-calorie-unit'>kcal</Text>
          </View>
        </View>
      </View>

      {/* ==================== AI 描述 ==================== */}
      {formData.aiGameDescription && (
        <View className='record-card'>
          <Text className='record-card-title'>AI 游戏描述</Text>
          <View className='record-form-item'>
            <Text className='record-readonly-text'>
              {formData.aiGameDescription}
            </Text>
          </View>
        </View>
      )}

      {/* ==================== 备注 ==================== */}
      <View className='record-card'>
        <Text className='record-card-title'>备注</Text>
        <View className='record-form-item'>
          <Textarea
            className='record-textarea'
            placeholder='添加备注（选填）'
            value={formData.remark}
            onInput={handleRemarkChange}
          />
        </View>
      </View>

      {/* ==================== 操作按钮 ==================== */}
      <View className='record-actions'>
        <Button
          className={`record-btn record-btn--primary${
            saving ? ' record-btn--loading' : ''
          }`}
          onClick={handleSave}
          loading={saving}
          disabled={saving}
        >
          {saving ? '保存中...' : '保存记录'}
        </Button>
        <Button
          className='record-btn record-btn--secondary'
          onClick={handleRetakePhoto}
          disabled={saving}
        >
          重新拍照
        </Button>
      </View>
    </View>
  );
}
