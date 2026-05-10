import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Input,
  Picker,
  Button,
  ScrollView,
} from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import type { FoodRecordDoc } from '@/services/db/schema';
import { useAuthStore } from '@/stores/authStore';
import { fetchRecordsListHttp, searchRecordsHttp, serverRecordToFoodDoc } from '@/services/userService';
import type { FoodType } from '@/types/food';
import {
  FOOD_TYPE_LABELS,
  FOOD_TYPE_EMOJIS,
  FOOD_TYPE_COLORS,
} from '@/constants/foodTypes';
import './index.scss';

// ============================================================
// 常量
// ============================================================

/** 每页记录数 */
const PAGE_SIZE = 20;

/** 排序模式 */
type SortMode = 'newest' | 'oldest' | 'hottest';

const SORT_LABELS: Record<SortMode, string> = {
  newest: '最新优先',
  oldest: '最早优先',
  hottest: '最高热量',
};

const SORT_OPTIONS = ['最新优先', '最早优先', '最高热量'];
const SORT_MAP: SortMode[] = ['newest', 'oldest', 'hottest'];

/** 食物类型选择选项 */
const TYPE_FILTER_OPTIONS = ['全部类型'].concat(
  (Object.keys(FOOD_TYPE_LABELS) as FoodType[]).map(
    (t) => `${FOOD_TYPE_EMOJIS[t]} ${FOOD_TYPE_LABELS[t]}`,
  ),
);

const TYPE_FILTER_VALUES: Array<FoodType | ''> = [''];

// ============================================================
// 工具函数
// ============================================================

/** 格式化 ISO 时间为 HH:mm */
function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return '';
  }
}

/** 格式化日期头：今天、昨天、具体日期 */
function formatDateHeader(isoString: string): string {
  try {
    const date = new Date(isoString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dStr = date.toDateString();
    const tStr = today.toDateString();
    const yStr = yesterday.toDateString();

    if (dStr === tStr) return '今天';
    if (dStr === yStr) return '昨天';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

/** 获取日期字符串（用于分组） */
function getDateKey(isoString: string): string {
  try {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

/** 按日期分组 */
function groupByDate(
  records: FoodRecordDoc[],
): Array<{ dateKey: string; dateLabel: string; items: FoodRecordDoc[] }> {
  const groups = new Map<string, FoodRecordDoc[]>();

  for (const record of records) {
    const key = getDateKey(record.createdAt);
    const existing = groups.get(key);
    if (existing !== undefined) {
      existing.push(record);
    } else {
      groups.set(key, [record]);
    }
  }

  return Array.from(groups.entries())
    .map(([dateKey, items]) => ({
      dateKey,
      dateLabel: formatDateHeader(items[0]?.createdAt ?? dateKey),
      items,
    }))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

// ============================================================
// 页面组件
// ============================================================

export default function HistoryPage() {
  // ============================================================
  // State
  // ============================================================
  const [openid, setOpenid] = useState<string>('');
  const [records, setRecords] = useState<FoodRecordDoc[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);

  // Filters
  const [searchText, setSearchText] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<FoodType | ''>('');
  const [typePickerIndex, setTypePickerIndex] = useState<number>(0);
  const [sortMode, setSortMode] = useState<SortMode>('newest');

  // Debounce ref for search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ============================================================
  // 获取 token（从 authStore，无需 CloudBase 云函数）
  // ============================================================
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (token) {
      setOpenid('auth'); // 使用 HTTP API 无需 openid，用占位符标记已就绪
    } else {
      Taro.showToast({ title: '请先登录', icon: 'none' });
    }
  }, [token]);

  // ============================================================
  // 获取数据（通过 HTTP API 替代 CloudBase）
  // ============================================================
  const fetchRecords = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!token || openid.length === 0) return;

      try {
        let docs: FoodRecordDoc[] = [];

        if (searchText.trim().length > 0) {
          // 搜索模式 → 使用 /api/v1/records/search
          docs = await searchRecordsHttp(token, searchText.trim());
          // 搜索模式不支持分页和排序，直接返回所有结果
          setRecords(docs);
          setTotal(docs.length);
          setHasMore(false);
          setPage(1);
          return;
        }

        // 普通浏览模式 → 使用 /api/v1/records
        const filterParams: { page?: number; limit?: number; foodType?: string } = {
          page: pageNum,
          limit: PAGE_SIZE,
        };
        if (typeFilter !== '') {
          filterParams.foodType = typeFilter;
        }

        const result = await fetchRecordsListHttp(token, filterParams);

        if (sortMode === 'hottest') {
          // 高温排序：按热量降序，需要从服务器获取全量数据排序（最多200条）
          const allData = await fetchRecordsListHttp(token, { page: 1, limit: 200, ...filterParams });
          const sorted = [...allData.list].sort((a, b) => b.calories.total - a.calories.total);
          const paged = sorted.slice(0, PAGE_SIZE);
          if (append) {
            setRecords((prev) => [...prev, ...paged]);
          } else {
            setRecords(paged);
          }
          setTotal(allData.total);
          setHasMore(false);
          setPage(pageNum);
        } else if (sortMode === 'oldest') {
          // 最早排序：反向遍历所有页直到取满（最多取5页）
          let allPages: FoodRecordDoc[] = [];
          let currentPage = 1;
          let hasMorePages = true;
          const MAX_PAGES = 5;
          while (hasMorePages && currentPage <= MAX_PAGES) {
            const pageData = await fetchRecordsListHttp(token, { page: currentPage, limit: PAGE_SIZE, ...filterParams });
            allPages = [...pageData.list, ...allPages];
            hasMorePages = pageData.hasMore;
            currentPage++;
          }
          allPages.reverse(); // 服务端默认倒序，反转后正序
          
          if (append) {
            setRecords((prev) => [...prev, ...allPages]);
          } else {
            setRecords(allPages);
          }
          setTotal(allPages.length);
          setHasMore(false);
          setPage(pageNum);
        } else {
          // 最新排序（默认）：服务端已按 createdAt desc 排列
          if (append) {
            setRecords((prev) => [...prev, ...result.list]);
          } else {
            setRecords(result.list);
          }
          setTotal(result.total);
          setHasMore(result.hasMore);
          setPage(pageNum);
        }
      } catch {
        Taro.showToast({
          title: '加载失败，请重试',
          icon: 'none',
          duration: 2000,
        });
      }
    },
    [token, openid, typeFilter, searchText, sortMode],
  );

  // ============================================================
  // 初次加载 & 条件变化时重新加载
  // ============================================================
  useEffect(() => {
    if (openid.length === 0) return;

    setLoading(true);
    fetchRecords(1, false).finally(() => {
      setLoading(false);
    });
  }, [openid, typeFilter, sortMode, fetchRecords]);

  // ============================================================
  // 搜索防抖
  // ============================================================
  useEffect(() => {
    if (openid.length === 0) return;

    if (searchTimerRef.current !== null) {
      clearTimeout(searchTimerRef.current);
    }

    searchTimerRef.current = setTimeout(() => {
      setLoading(true);
      fetchRecords(1, false).finally(() => {
        setLoading(false);
      });
    }, 400);

    return () => {
      if (searchTimerRef.current !== null) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchText, openid, fetchRecords]);

  // ============================================================
  // 页面显示时刷新
  // ============================================================
  useDidShow(() => {
    if (openid.length > 0) {
      fetchRecords(1, false);
    }
  });

  // ============================================================
  // 下拉刷新（ScrollView 触顶触发）
  // ============================================================
  const handleRefresh = useCallback(() => {
    fetchRecords(1, false);
  }, [fetchRecords]);

  // ============================================================
  // 加载更多
  // ============================================================
  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore || loading) return;

    setLoadingMore(true);
    fetchRecords(page + 1, true).finally(() => {
      setLoadingMore(false);
    });
  }, [loadingMore, hasMore, loading, page, fetchRecords]);

  // ============================================================
  // 触底加载
  // ============================================================
  const handleScrollToLower = useCallback(() => {
    handleLoadMore();
  }, [handleLoadMore]);

  // ============================================================
  // 搜索
  // ============================================================
  const handleSearchInput = useCallback(
    (e: { detail: { value: string } }) => {
      setSearchText(e.detail.value);
    },
    [],
  );

  const handleClearSearch = useCallback(() => {
    setSearchText('');
  }, []);

  // ============================================================
  // 类型过滤
  // ============================================================
  const handleTypeFilterChange = useCallback(
    (e: { detail: { value: string | number } }) => {
      const index = Number(e.detail.value);
      setTypePickerIndex(index);
      const val = TYPE_FILTER_VALUES[index] ?? '';
      setTypeFilter(val);
    },
    [],
  );

  // ============================================================
  // 排序切换
  // ============================================================
  const handleSortChange = useCallback(() => {
    Taro.showActionSheet({
      itemList: SORT_OPTIONS,
    }).then((res) => {
      const mode = SORT_MAP[res.tapIndex];
      if (mode !== undefined) {
        setSortMode(mode);
      }
    });
  }, []);

  // ============================================================
  // 查看记录详情
  // ============================================================
  const handleViewDetail = useCallback((recordId: string) => {
    Taro.navigateTo({
      url: `/pages/record/detail/index?recordId=${recordId}`,
    });
  }, []);

  // ============================================================
  // 去拍照
  // ============================================================
  const handleTakePhoto = useCallback(() => {
    Taro.navigateTo({ url: '/pages/camera/index' });
  }, []);

  // ============================================================
  // 获取类型颜色（带兜底）
  // ============================================================
  const getTypeColor = useCallback((foodType: string): string => {
    return FOOD_TYPE_COLORS[foodType as FoodType] ?? '#607D8B';
  }, []);

  // ============================================================
  // 渲染记录卡片
  // ============================================================
  const renderCard = useCallback(
    (record: FoodRecordDoc): React.ReactNode => {
      const foodType = record.foodType as FoodType;
      const typeEmoji = FOOD_TYPE_EMOJIS[foodType] ?? '🍽️';
      const typeLabel = FOOD_TYPE_LABELS[foodType] ?? '未知';
      const typeColor = getTypeColor(record.foodType);

      return (
        <View
          key={record._id}
          className='history-card'
          onClick={() => handleViewDetail(record._id)}
        >
          <View className='history-card-thumb'>
            <Image
              className='history-card-thumb-image'
              src={record.themeImageFileID || record.imageFileID}
              mode='aspectFill'
              lazyLoad
            />
          </View>
          <View className='history-card-body'>
            <View className='history-card-top'>
              <Text className='history-card-name'>
                {record.foodName}
              </Text>
              <Text className='history-card-calories'>
                🔥 {record.calories.total}
              </Text>
            </View>
            <View className='history-card-badge-row'>
              <View
                className='history-type-badge'
                style={{ backgroundColor: typeColor }}
              >
                <Text>{typeEmoji}</Text>
                <Text>{typeLabel}</Text>
              </View>
              {record.themeId && record.themeId.length > 0 && (
                <Text className='history-theme-tag'>
                  🎨 {record.themeId}
                </Text>
              )}
            </View>
            <View className='history-card-meta'>
              <Text className='history-card-time'>
                {formatTime(record.createdAt)}
              </Text>
              {record.locationName &&
                record.locationName.length > 0 && (
                  <Text className='history-card-location'>
                    📍 {record.locationName}
                  </Text>
                )}
            </View>
          </View>
        </View>
      );
    },
    [handleViewDetail, getTypeColor],
  );

  // ============================================================
  // 渲染日期分组
  // ============================================================
  const renderGroupedList = useCallback((): React.ReactNode => {
    if (records.length === 0) return null;

    const grouped = groupByDate(records);
    return grouped.map((group) => (
      <View key={group.dateKey} className='history-date-group'>
        <View className='history-date-header'>
          <Text className='history-date-label'>{group.dateLabel}</Text>
          <Text className='history-date-count'>
            {group.items.length} 条记录
          </Text>
        </View>
        {group.items.map((item) => renderCard(item))}
      </View>
    ));
  }, [records, renderCard]);

  // ============================================================
  // 渲染
  // ============================================================
  return (
    <ScrollView
      className='history-page'
      scrollY
      showScrollbar={false}
      onScrollToLower={handleScrollToLower}
      onScrollToUpper={handleRefresh}
      lowerThreshold={100}
      upperThreshold={50}
    >
      <View className='history-content'>
      {/* ==================== 顶部工具栏 ==================== */}
      <View className='history-toolbar'>
        <View className='history-search-row'>
          <View className='history-search-box'>
            <Text className='history-search-icon'>🔍</Text>
            <Input
              className='history-search-input'
              type='text'
              placeholder='搜索食物名称'
              value={searchText}
              onInput={handleSearchInput}
              confirmType='search'
            />
            {searchText.length > 0 && (
              <Text
                className='history-search-clear'
                onClick={handleClearSearch}
              >
                ✕
              </Text>
            )}
          </View>
        </View>

        <View className='history-filter-row'>
          <Picker
            mode='selector'
            range={TYPE_FILTER_OPTIONS}
            value={typePickerIndex}
            onChange={handleTypeFilterChange}
          >
            <View
              className={`history-filter-btn${
                typeFilter !== '' ? ' history-filter-btn--active' : ''
              }`}
            >
              <Text className='history-filter-label'>
                {TYPE_FILTER_OPTIONS[typePickerIndex] ?? '全部类型'}
              </Text>
              <Text className='history-filter-arrow'>▾</Text>
            </View>
          </Picker>

          <View
            className='history-sort-btn'
            onClick={handleSortChange}
          >
            <Text className='history-sort-icon'>⇅</Text>
            <Text>{SORT_LABELS[sortMode]}</Text>
          </View>
        </View>
      </View>

      {/* ==================== 内容区 ==================== */}
      {loading ? (
        <View className='history-loading'>
          <View className='history-loading-spinner' />
          <Text>加载中...</Text>
        </View>
      ) : records.length === 0 && searchText.length === 0 ? (
        <View className='history-empty'>
          <Text className='history-empty-icon'>📸</Text>
          <Text className='history-empty-text'>还没有食物记录</Text>
          <Text className='history-empty-sub'>
        开始记录你的第一份美食吧
          </Text>
          <Button
            className='history-empty-btn'
            onClick={handleTakePhoto}
          >
            拍照记录
          </Button>
        </View>
      ) : records.length === 0 && searchText.length > 0 ? (
        <View className='history-no-result'>
          <Text>未找到 &ldquo;{searchText}&rdquo; 相关的记录</Text>
          <Text
            className='history-filter-label'
            onClick={handleClearSearch}
          >
            清除搜索
          </Text>
        </View>
      ) : (
        <>
          {renderGroupedList()}

          {/* 底部加载更多 */}
          <View className='history-footer'>
            {loadingMore ? (
              <Text>加载更多...</Text>
            ) : hasMore ? (
              <>
                <View className='history-footer-line' />
                <Text>上拉加载更多</Text>
                <View className='history-footer-line' />
              </>
            ) : total > 0 ? (
              <Text>共 {total} 条记录</Text>
            ) : null}
          </View>
        </>
      )}
      </View>
    </ScrollView>
  );
}
