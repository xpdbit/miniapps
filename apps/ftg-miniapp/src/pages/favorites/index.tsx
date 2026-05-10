import { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { fetchFavorites, removeFavorite, type FavoriteRecord } from '@/services/favoriteService';
import EmptyState from '@/components/EmptyState/index';
import Skeleton from '@/components/Skeleton/index';
import Icon from '@/components/Icon/Icon';
import { FOOD_TYPE_EMOJIS, FOOD_TYPE_LABELS } from '@/constants/foodTypes';
import type { FoodType } from '@/types/food';
import './index.scss';

export default function FavoritesPage() {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<FavoriteRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const loadData = useCallback(async (pageNum: number = 1) => {
    setLoading(true);
    try {
      const result = await fetchFavorites(pageNum, pageSize);
      if (pageNum === 1) {
        setList(result.list);
      } else {
        setList((prev) => [...prev, ...result.list]);
      }
      setTotal(result.total);
      setPage(pageNum);
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(1);
  }, [loadData]);

  const handleRemoveFavorite = useCallback(
    async (recordId: number) => {
      try {
        await removeFavorite(recordId);
        setList((prev) => prev.filter((f) => f.record.id !== recordId));
        setTotal((prev) => prev - 1);
        Taro.showToast({ title: '已取消收藏', icon: 'success' });
      } catch {
        Taro.showToast({ title: '操作失败', icon: 'none' });
      }
    },
    [],
  );

  const handleGoDetail = useCallback((recordId: number) => {
    Taro.navigateTo({ url: `/pages/record/detail/index?recordId=${recordId}` });
  }, []);

  const formatTime = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    } catch {
      return '';
    }
  };

  const handleLoadMore = useCallback(() => {
    if (list.length < total && !loading) {
      loadData(page + 1);
    }
  }, [list.length, total, loading, page, loadData]);

  if (loading && list.length === 0) {
    return (
      <View className='favorites-page'>
        <Skeleton type='list' count={5} />
      </View>
    );
  }

  return (
    <ScrollView
      className='favorites-page'
      scrollY
      showScrollbar={false}
      onScrollToLower={handleLoadMore}
    >
      {list.length === 0 ? (
        <EmptyState
          icon={<Icon name='star' size={64} color='#CCCCCC' />}
          title='还没有收藏'
          description='在记录详情页点击收藏按钮添加'
        />
      ) : (
        <View className='favorites-list'>
          {list.map((fav) => {
            const foodType = fav.record.foodType as FoodType;
            const emoji = FOOD_TYPE_EMOJIS[foodType] ?? '🍽️';
            const label = FOOD_TYPE_LABELS[foodType] ?? '未知';
            return (
              <View
                key={fav.favoriteId}
                className='favorites-card'
                onClick={() => handleGoDetail(fav.record.id)}
              >
                <Image
                  className='favorites-thumb'
                  src={fav.record.themeImageUrl || fav.record.imageUrl || ''}
                  mode='aspectFill'
                  lazyLoad
                />
                <View className='favorites-info'>
                  <Text className='favorites-name'>{fav.record.foodName ?? '未知美食'}</Text>
                  <Text className='favorites-type'>
                    {emoji} {label}
                  </Text>
                  <Text className='favorites-time'>
                    {formatTime(fav.record.createdAt)}
                  </Text>
                </View>
                <View
                  className='favorites-unfav-btn'
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFavorite(fav.record.id);
                  }}
                  hoverClass='favorites-unfav-btn--active'
                >
                  <Icon name='star' size={20} color='#FF6B35' />
                </View>
              </View>
            );
          })}
          {list.length < total && (
            <View className='favorites-loading-more'>
              <Text>加载更多...</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}
