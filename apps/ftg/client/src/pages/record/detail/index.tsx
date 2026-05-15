import { useState, useEffect, useCallback } from 'react';
import { View, Text, Button, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { FoodRecordDoc } from '@/services/db/schema';
import { FOOD_TYPE_LABELS, FOOD_TYPE_EMOJIS } from '@/constants/foodTypes';
import type { FoodType } from '@/types/food';
import './index.scss';

/** 删除操作状态 */
type DeleteState = 'idle' | 'confirming' | 'deleting';

/** 格式化 ISO 时间为可读字符串 */
function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch {
    return isoString;
  }
}

export default function RecordDetailPage() {
  // ============================================================
  // Route params
  // ============================================================
  const router = Taro.getCurrentInstance().router;
  const recordId: string = router?.params?.recordId ?? '';

  // ============================================================
  // State
  // ============================================================
  const [record, setRecord] = useState<FoodRecordDoc | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [deleteState, setDeleteState] = useState<DeleteState>('idle');

  // ============================================================
  // 获取记录
  // ============================================================
  const fetchRecord = useCallback(async () => {
    if (!recordId) {
      setError('缺少记录 ID');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await Taro.cloud.callFunction({
        name: 'createFoodRecord',
        data: {
          action: 'getRecord',
          recordId,
        },
      });

      const response = result.result as {
        success: boolean;
        data?: FoodRecordDoc;
        errMsg?: string;
      };

      if (!response.success) {
        throw new Error(response.errMsg ?? '获取记录失败');
      }

      const recordData = response.data;

      if (recordData === undefined || recordData === null) {
        throw new Error('记录不存在');
      }

      // 已软删除的记录不可查看
      if (recordData.isDeleted) {
        throw new Error('该记录已被删除');
      }

      setRecord(recordData);
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    fetchRecord();
  }, [fetchRecord]);

  // ============================================================
  // 删除记录
  // ============================================================
  const handleDelete = useCallback(async () => {
    if (deleteState === 'deleting') {
      return;
    }

    setDeleteState('confirming');

    try {
      const modalResult = await Taro.showModal({
        title: '确认删除',
        content: '删除后无法恢复，确定要删除这条食物记录吗？',
        cancelText: '取消',
        confirmText: '删除',
        confirmColor: '#E63946',
      });

      if (!modalResult.confirm) {
        setDeleteState('idle');
        return;
      }

      setDeleteState('deleting');

      const result = await Taro.cloud.callFunction({
        name: 'createFoodRecord',
        data: {
          action: 'softDelete',
          recordId,
        },
      });

      const response = result.result as {
        success: boolean;
        errMsg?: string;
      };

      if (!response.success) {
        throw new Error(response.errMsg ?? '删除失败');
      }

      Taro.showToast({
        title: '删除成功',
        icon: 'success',
        duration: 2000,
      });

      // 返回上一页
      setTimeout(() => {
        Taro.navigateBack();
      }, 500);
    } catch (err) {
      const message = err instanceof Error ? err.message : '删除失败';
      Taro.showToast({
        title: message,
        icon: 'none',
        duration: 2000,
      });
      setDeleteState('idle');
    }
  }, [recordId, deleteState]);

  // ============================================================
  // 分享
  // ============================================================
  const handleShare = useCallback(() => {
    Taro.showToast({
      title: '分享功能开发中',
      icon: 'none',
      duration: 2000,
    });
  }, []);

  // ============================================================
  // 返回
  // ============================================================
  const handleGoBack = useCallback(() => {
    Taro.navigateBack();
  }, []);

  // ============================================================
  // 重试加载
  // ============================================================
  const handleRetry = useCallback(() => {
    fetchRecord();
  }, [fetchRecord]);

  // ============================================================
  // 渲染: 加载中
  // ============================================================
  if (loading) {
    return (
      <View className='detail-page'>
        <View className='detail-loading'>
          <Text>加载中...</Text>
        </View>
      </View>
    );
  }

  // ============================================================
  // 渲染: 错误
  // ============================================================
  if (error || record === null) {
    return (
      <View className='detail-page'>
        <View className='detail-error'>
          <Text className='detail-error-text'>{error || '记录不存在'}</Text>
          <Button
            className='detail-btn detail-btn--primary'
            onClick={handleRetry}
          >
            重试
          </Button>
        </View>
      </View>
    );
  }

  // ============================================================
  // 渲染: 正常
  // ============================================================
  const foodType = record.foodType as FoodType;
  const typeLabel = FOOD_TYPE_LABELS[foodType] ?? '未知';
  const typeEmoji = FOOD_TYPE_EMOJIS[foodType] ?? '🍽️';
  const hasLocation =
    record.locationName !== '' ||
    record.latitude !== 0 ||
    record.longitude !== 0;

  return (
    <View className='detail-page'>
      {/* ==================== 主题图 ==================== */}
      <View className='detail-hero'>
        <Image
          className='detail-hero-image'
          src={record.themeImageFileID}
          mode='aspectFill'
        />
      </View>

      {/* ==================== 信息卡片 ==================== */}
      <View className='detail-info'>
        {/* 头部: 名称 + 类型标签 */}
        <View className='detail-header'>
          <Text className='detail-food-name'>{record.foodName}</Text>
          <View className='detail-type-badge'>
            <Text>
              {typeEmoji} {typeLabel}
            </Text>
          </View>
        </View>

        {/* 热量 */}
        <View className='detail-row'>
          <Text className='detail-row-label'>热量</Text>
          <View className='detail-row-value'>
            <Text className='detail-calorie-value'>
              {record.calories.total}
            </Text>
            <Text className='detail-calorie-unit'>kcal</Text>
          </View>
        </View>

        {/* AI 描述 */}
        {record.gameDescription && (
          <View className='detail-row'>
            <Text className='detail-row-label'>AI 描述</Text>
            <View className='detail-row-value'>
              <Text className='detail-description-quote'>
                {record.gameDescription}
              </Text>
            </View>
          </View>
        )}

        {/* 位置 */}
        {hasLocation && (
          <View className='detail-row'>
            <Text className='detail-row-label'>位置</Text>
            <View className='detail-row-value'>
              <Text>
                {record.locationName ||
                  `${record.latitude}, ${record.longitude}`}
              </Text>
              {record.ipLocation && (
                <Text className='detail-timestamp'>
                  {' '}
                  (IP: {record.ipLocation})
                </Text>
              )}
            </View>
          </View>
        )}

        {/* 备注 */}
        {record.remark && (
          <View className='detail-row'>
            <Text className='detail-row-label'>备注</Text>
            <View className='detail-row-value'>
              <Text>{record.remark}</Text>
            </View>
          </View>
        )}

        {/* 时间戳 */}
        <View className='detail-timestamp'>
          <Text>记录时间: {formatDateTime(record.createdAt)}</Text>
        </View>
      </View>

      {/* ==================== 操作按钮 ==================== */}
      <View className='detail-actions'>
        <Button
          className='detail-btn detail-btn--primary'
          onClick={handleShare}
        >
          分享
        </Button>
        <Button
          className={`detail-btn detail-btn--danger${
            deleteState === 'deleting' ? ' detail-btn--loading' : ''
          }`}
          onClick={handleDelete}
          loading={deleteState === 'deleting'}
          disabled={deleteState === 'deleting'}
        >
          {deleteState === 'deleting' ? '删除中...' : '删除'}
        </Button>
        <Button
          className='detail-btn detail-btn--secondary'
          onClick={handleGoBack}
        >
          返回
        </Button>
      </View>
    </View>
  );
}
