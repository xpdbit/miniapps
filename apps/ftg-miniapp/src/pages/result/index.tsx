import { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, Button, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { FoodType, CalorieInfo } from '@/types';
import { FOOD_TYPE_LABELS, FOOD_TYPE_EMOJIS } from '@/constants';
import Loading from '@/components/Loading';
import EmptyState from '@/components/EmptyState/index';
import Skeleton from '@/components/Skeleton/index';
import Icon from '@/components/Icon/Icon';
import './index.scss';

/**
 * 路由参数类型
 * 从 camera 页面传递过来的识别结果
 */
interface ResultRouteParams {
  /** 主题合成图片云文件 ID */
  themeImageUrl?: string;
  /** 食物原图云文件 ID */
  originImageUrl?: string;
  /** 食物名称 */
  foodName?: string;
  /** 食物类型枚举值 */
  foodType?: string;
  /** 卡路里信息 JSON 字符串 */
  calories?: string;
  /** AI 游戏化描述 */
  gameDescription?: string;
  /** 简短描述 */
  shortDescription?: string;
  /** 记录 ID（已保存到云时） */
  recordId?: string;
}

/**
 * 识别结果页面
 *
 * 展示 AI 识别结果与主题合成图，提供保存/重拍/分享/切换主题等操作。
 * 接收 camera 页面传递的路由参数。
 */
export default function ResultPage() {
  // ============================================================
  // State
  // ============================================================
  const [loading, setLoading] = useState<boolean>(true);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // 页面数据
  const [themeImageUrl, setThemeImageUrl] = useState<string>('');
  const [foodName, setFoodName] = useState<string>('');
  const [foodType, setFoodType] = useState<FoodType | null>(null);
  const [calories, setCalories] = useState<CalorieInfo | null>(null);
  const [gameDescription, setGameDescription] = useState<string>('');

  // ============================================================
  // 初始化：解析路由参数
  // ============================================================
  useEffect(() => {
    const instance = Taro.getCurrentInstance();
    const params = (instance.router?.params ?? {}) as ResultRouteParams;

    setThemeImageUrl(params.themeImageUrl ?? '');
    // originImageUrl 暂时保留在路由参数中，后续可用于图片预览
    setFoodName(params.foodName ?? '未知食物');
    setGameDescription(
      params.gameDescription ?? '获得了一份美味的食物！',
    );

    if (params.foodType !== undefined && params.foodType.length > 0) {
      setFoodType(params.foodType as FoodType);
    }

    if (params.calories !== undefined && params.calories.length > 0) {
      try {
        const parsed = JSON.parse(params.calories) as CalorieInfo;
        setCalories(parsed);
      } catch {
        setCalories(null);
      }
    }

    setLoading(false);
  }, []);

  // ============================================================
  // 图片加载完成
  // ============================================================
  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  // ============================================================
  // 保存记录
  // ============================================================
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // TODO: 调用云函数保存食物记录
      // await Taro.cloud.callFunction({ name: 'createFoodRecord', data: { ... } });
      await Taro.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 2000,
      });
    } catch {
      Taro.showToast({
        title: '保存失败，请重试',
        icon: 'none',
        duration: 2000,
      });
    } finally {
      setSaving(false);
    }
  }, []);

  // ============================================================
  // 重新拍摄
  // ============================================================
  const handleRetake = useCallback(() => {
    Taro.redirectTo({ url: '/pages/camera/index' }).catch(() => {
      Taro.navigateBack().catch(() => {
        // fallback: 静默失败
      });
    });
  }, []);

  // ============================================================
  // 分享
  // ============================================================
  const handleShare = useCallback(() => {
    Taro.showShareMenu({
      withShareTicket: true,
    });
  }, []);

  // ============================================================
  // 查看历史
  // ============================================================
  const handleViewHistory = useCallback(() => {
    Taro.navigateTo({ url: '/pages/history/index' }).catch(() => {
      Taro.showToast({
        title: '历史记录页面开发中',
        icon: 'none',
        duration: 2000,
      });
    });
  }, []);

  // ============================================================
  // 切换主题
  // ============================================================
  const handleSwitchTheme = useCallback(() => {
    Taro.showActionSheet({
      itemList: ['经典食记', '海拉鲁料理', '猎人食堂', '无人岛美食', '方块厨房', '宝可梦野餐'],
    }).catch(() => {
      // 取消选择，不做处理
    });
  }, []);

  // ============================================================
  // 渲染 AI 描述
  // ============================================================
  const renderDescription = (): React.ReactNode => {
    if (gameDescription.length === 0) {
      return null;
    }

    return (
      <View className='result-description-card'>
        <View className='desc-quote-mark'>{'\u201C'}</View>
        <Text className='desc-text'>{gameDescription}</Text>
        <View className='desc-quote-mark desc-quote-mark--end'>{'\u201D'}</View>
      </View>
    );
  };

  // ============================================================
  // 渲染营养信息
  // ============================================================
  const renderNutrition = (): React.ReactNode => {
    if (calories === null) {
      return null;
    }

    return (
      <View className='result-nutrition'>
        <View className='nutrition-item'>
          <Text className='nutrition-value'>{calories.total}</Text>
          <Text className='nutrition-label'>总热量 (kcal)</Text>
        </View>
        <View className='nutrition-divider' />
        <View className='nutrition-item'>
          <Text className='nutrition-value'>{calories.protein}g</Text>
          <Text className='nutrition-label'>蛋白质</Text>
        </View>
        <View className='nutrition-divider' />
        <View className='nutrition-item'>
          <Text className='nutrition-value'>{calories.fat}g</Text>
          <Text className='nutrition-label'>脂肪</Text>
        </View>
        <View className='nutrition-divider' />
        <View className='nutrition-item'>
          <Text className='nutrition-value'>{calories.carbs}g</Text>
          <Text className='nutrition-label'>碳水</Text>
        </View>
      </View>
    );
  };

  // ============================================================
  // 渲染食物类型标签
  // ============================================================
  const renderFoodTypeBadge = (): React.ReactNode => {
    if (foodType === null) {
      return null;
    }

    const emoji = FOOD_TYPE_EMOJIS[foodType] ?? '🍽️';
    const label = FOOD_TYPE_LABELS[foodType] ?? '未知';

    return (
      <View className='result-type-badge'>
        <Text className='type-badge-text'>
          {emoji} {label}
        </Text>
      </View>
    );
  };

  // ============================================================
  // 渲染
  // ============================================================
  if (loading) {
    return <Loading visible text='正在加载结果...' />;
  }

  return (
    <ScrollView className='result-page' scrollY enhanced showScrollbar={false}>
      <View className='result-content'>
        {/* ==================== 顶部标题 ==================== */}
      <View className='result-header'>
        <Icon name='sparkle' size={40} color='#FFB703' />
        <Text className='result-header-title'>主题生成完成</Text>
      </View>

      {/* ==================== 主题合成图 ==================== */}
      <View className='result-image-section'>
        {!imageLoaded && themeImageUrl.length > 0 && (
          <Skeleton type='image' />
        )}
        {themeImageUrl.length > 0 && (
          <Image
            className={`result-theme-image ${imageLoaded ? 'image-loaded' : ''}`}
            src={themeImageUrl}
            mode='widthFix'
            lazyLoad
            onLoad={handleImageLoad}
          />
        )}
        {!themeImageUrl.length && (
          <EmptyState
            icon='🖼️'
            title='暂无合成图片'
            description='拍照识别食物后，这里将展示 AI 生成的专属主题图片'
          />
        )}
      </View>

      {/* ==================== 食物信息卡片 ==================== */}
      <View className='result-info-card'>
        {/* 食物名称 + 类型 */}
        <View className='result-food-header'>
          <Text className='result-food-name'>{foodName}</Text>
          {renderFoodTypeBadge()}
        </View>

        {/* 热量概览 */}
        <View className='result-calorie-row'>
          {calories !== null ? (
            <View className='result-calorie-text'>
              <Icon name='flame' size={28} color='#E63946' />
              <Text> 约 {calories.total} 千卡</Text>
            </View>
          ) : (
            <View className='result-calorie-text result-calorie-text--unknown'>
              <Icon name='flame' size={28} color='#999999' />
              <Text> 热量信息暂未获取</Text>
            </View>
          )}
        </View>

        {/* 营养信息 */}
        {renderNutrition()}
      </View>

      {/* ==================== AI 描述 ==================== */}
      {renderDescription()}

      {/* ==================== 主题切换 ==================== */}
      <View className='result-theme-switch'>
        <Button className='theme-switch-btn' onClick={handleSwitchTheme}>
          <Text className='theme-switch-icon'>🎨</Text>
          <Text className='theme-switch-text'>切换主题</Text>
          <Text className='theme-switch-arrow'>›</Text>
        </Button>
      </View>

      {/* ==================== 操作按钮 ==================== */}
      <View className='result-actions'>
        <Button
          className='result-btn result-btn--primary'
          onClick={handleSave}
          loading={saving}
          disabled={saving}
        >
          {saving ? '保存中...' : (
            <View style={{ display: 'flex', alignItems: 'center', gap: '8rpx' }}>
              <Icon name='save' size={28} color='#FFFFFF' />
              <Text>保存记录</Text>
            </View>
          )}
        </Button>

        <Button
          className='result-btn result-btn--secondary'
          onClick={handleRetake}
        >
          <View style={{ display: 'flex', alignItems: 'center', gap: '8rpx' }}>
            <Icon name='camera' size={28} color='#666666' />
            <Text>重新拍摄</Text>
          </View>
        </Button>

        <Button
          className='result-btn result-btn--secondary'
          onClick={handleShare}
        >
          <View style={{ display: 'flex', alignItems: 'center', gap: '8rpx' }}>
            <Icon name='share' size={28} color='#666666' />
            <Text>分享</Text>
          </View>
        </Button>

        <Button
          className='result-btn result-btn--ghost'
          onClick={handleViewHistory}
        >
          <View style={{ display: 'flex', alignItems: 'center', gap: '8rpx' }}>
            <Icon name='chart' size={28} color='#999999' />
            <Text>查看历史</Text>
          </View>
        </Button>
        </View>
      </View>
    </ScrollView>
  );
}
