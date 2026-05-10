/**
 * ============================================================
 * 画廊页面（Tab 页）
 * 包含三个子 tab：历史照片、收藏、主题管理
 * ============================================================
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Image, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { THEME_TEMPLATES } from '@/constants/themeDefaults';
import { fetchThemes } from '@/services/themeApi';
import { fetchRecordsListHttp } from '@/services/userService';
import { fetchFavorites, removeFavorite, type FavoriteRecord } from '@/services/favoriteService';
import { useAuthStore } from '@/stores/authStore';
import type { Theme as ServerTheme } from '@/types/theme';
import type { FoodRecordDoc } from '@/services/db/schema';
import type { FoodType } from '@/types/food';
import { FOOD_TYPE_EMOJIS, FOOD_TYPE_LABELS, FOOD_TYPE_COLORS } from '@/constants/foodTypes';
import EmptyState from '@/components/EmptyState/index';
import Skeleton from '@/components/Skeleton/index';
import Icon from '@/components/Icon/Icon';
import './index.scss';

// ============================================================
// 类型定义
// ============================================================

/** 子 tab 类型 */
type SubTab = 'history' | 'favorites' | 'themes';

/** 子 tab 配置 */
const SUB_TABS: Array<{ key: SubTab; label: string; icon: string }> = [
  { key: 'history', label: '历史照片', icon: 'history' },
  { key: 'favorites', label: '收藏', icon: 'favorite' },
  { key: 'themes', label: '主题管理', icon: 'gallery' },
];

/** 画廊主题展示项 */
interface GalleryTheme {
  themeId: string;
  name: string;
  gameName: string;
  description: string;
  previewImageUrl: string;
  usageCount: number;
}

/** 排序方式 */
type SortMode = 'usage' | 'name';

// ============================================================
// 常量
// ============================================================

const STORAGE_DEFAULT_KEY = 'gallery_default_theme';
const DEFAULT_THEME_ID = 'theme_zelda';
const HISTORY_PAGE_SIZE = 6;

/** 本地回退主题描述 */
const FALLBACK_DESCRIPTIONS: Record<string, string> = {
  theme_classic: '简约经典的记录风格，突出食物本身的美味与质感',
  theme_zelda: '海拉鲁风格的料理边框，适合冒险主题的美食分享',
  theme_monster_hunter: '猎人公会风格的用餐体验，适合记录丰盛的大餐',
  theme_animal_crossing: '无人岛生活的悠闲美食时光，治愈系美食照片首选',
  theme_minecraft: '像素风格的方块厨房，趣味性十足',
  theme_pokemon: '宝可梦训练家的野餐风格，充满活力与缤纷色彩',
};

/** 默认主题描述 */
const DEFAULT_DESCRIPTION = '一款精美的食物主题边框';

// ============================================================
// 数据加载函数
// ============================================================

/** 加载主题列表（优先服务端，失败回退本地） */
async function loadThemes(): Promise<{ themes: GalleryTheme[]; fromServer: boolean }> {
  try {
    const serverThemes = await fetchThemes(true);
    if (serverThemes && serverThemes.length > 0) {
      const mapped: GalleryTheme[] = serverThemes.map((t: ServerTheme) => ({
        themeId: t.themeId,
        name: t.name,
        gameName: t.gameName,
        description: t.description ?? FALLBACK_DESCRIPTIONS[t.themeId] ?? DEFAULT_DESCRIPTION,
        previewImageUrl: t.previewImageUrl ?? `theme-previews/${t.themeId}.png`,
        usageCount: t.usageCount,
      }));
      return { themes: mapped, fromServer: true };
    }
  } catch {
    console.warn('[Gallery] 服务端不可用，使用本地回退数据');
  }

  const local: GalleryTheme[] = THEME_TEMPLATES.map((tpl) => ({
    themeId: tpl.themeId,
    name: tpl.name,
    gameName: tpl.gameName,
    description: FALLBACK_DESCRIPTIONS[tpl.themeId] ?? DEFAULT_DESCRIPTION,
    previewImageUrl: `theme-previews/${tpl.themeId}.png`,
    usageCount: 0,
  }));
  return { themes: local, fromServer: false };
}

/** 获取默认主题 ID */
function loadDefaultThemeId(): string {
  try {
    const stored = Taro.getStorageSync(STORAGE_DEFAULT_KEY);
    if (typeof stored === 'string' && stored.length > 0) {
      return stored;
    }
  } catch {
    // ignore
  }
  return DEFAULT_THEME_ID;
}

/** 保存默认主题 ID */
function saveDefaultThemeId(themeId: string): void {
  try {
    Taro.setStorageSync(STORAGE_DEFAULT_KEY, themeId);
  } catch {
    console.error('[Gallery] 保存默认主题失败');
  }
}

/** 格式化时间 */
function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

// ============================================================
// 组件
// ============================================================

export default function GalleryPage() {
  // 页面显示时通知自定义底部栏切换选中状态
  useDidShow(() => {
    Taro.eventCenter.trigger('tabChange', 1);
  });

  // ---- 子 tab ----
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('history');

  // ============================================================
  // 历史照片 State
  // ============================================================
  const [historyLoading, setHistoryLoading] = useState<boolean>(true);
  const [historyRecords, setHistoryRecords] = useState<FoodRecordDoc[]>([]);
  const token = useAuthStore((s) => s.token);

  // ============================================================
  // 收藏 State
  // ============================================================
  const [favLoading, setFavLoading] = useState<boolean>(true);
  const [favList, setFavList] = useState<FavoriteRecord[]>([]);
  const [favTotal, setFavTotal] = useState<number>(0);

  // ============================================================
  // 主题管理 State
  // ============================================================
  const [themesLoading, setThemesLoading] = useState<boolean>(true);
  const [themes, setThemes] = useState<GalleryTheme[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('usage');
  const [defaultThemeId, setDefaultThemeId] = useState<string>(DEFAULT_THEME_ID);
  const [selectedTheme, setSelectedTheme] = useState<GalleryTheme | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [previewModalVisible, setPreviewModalVisible] = useState<boolean>(false);

  // ============================================================
  // 加载历史照片
  // ============================================================
  const loadHistory = useCallback(async () => {
    if (!token) {
      setHistoryLoading(false);
      return;
    }
    try {
      const result = await fetchRecordsListHttp(token, {
        page: 1,
        limit: HISTORY_PAGE_SIZE,
      });
      setHistoryRecords(result.list);
    } catch {
      console.warn('[Gallery] 加载历史照片失败');
    } finally {
      setHistoryLoading(false);
    }
  }, [token]);

  // ============================================================
  // 加载收藏
  // ============================================================
  const loadFavorites = useCallback(async () => {
    setFavLoading(true);
    try {
      const result = await fetchFavorites(1, 10);
      setFavList(result.list);
      setFavTotal(result.total);
    } catch {
      console.warn('[Gallery] 加载收藏失败');
    } finally {
      setFavLoading(false);
    }
  }, []);

  // ============================================================
  // 取消收藏
  // ============================================================
  const handleRemoveFavorite = useCallback(async (recordId: number) => {
    try {
      await removeFavorite(recordId);
      setFavList((prev) => prev.filter((f) => f.record.id !== recordId));
      setFavTotal((prev) => prev - 1);
      Taro.showToast({ title: '已取消收藏', icon: 'success' });
    } catch {
      Taro.showToast({ title: '操作失败', icon: 'none' });
    }
  }, []);

  // ============================================================
  // 加载主题
  // ============================================================
  useEffect(() => {
    const initThemes = async () => {
      try {
        const { themes: loadedThemes } = await loadThemes();
        const defaultId = loadDefaultThemeId();
        setThemes(loadedThemes);
        setDefaultThemeId(defaultId);
      } catch (err) {
        const message = err instanceof Error ? err.message : '加载主题数据失败';
        console.error('[Gallery] 主题初始化失败:', message);
      } finally {
        setThemesLoading(false);
      }
    };
    initThemes();
  }, []);

  // ---- 主题排序 ----
  const sortedThemes = useMemo(() => {
    const list = [...themes];
    if (sortMode === 'usage') {
      list.sort((a, b) => b.usageCount - a.usageCount);
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    }
    return list;
  }, [themes, sortMode]);

  // ---- 主题事件处理 ----
  const handleOpenDetail = useCallback((theme: GalleryTheme) => {
    setSelectedTheme(theme);
    setModalVisible(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setModalVisible(false);
    setTimeout(() => setSelectedTheme(null), 300);
  }, []);

  const handleSheetStopPropagation = useCallback(
    (e: { stopPropagation: () => void }) => e.stopPropagation(),
    [],
  );

  const handleSetDefault = useCallback(
    (themeId: string) => {
      saveDefaultThemeId(themeId);
      setDefaultThemeId(themeId);
      Taro.showToast({ title: '已设为默认主题', icon: 'success', duration: 2000 });
      handleCloseDetail();
    },
    [handleCloseDetail],
  );

  const handleImageError = useCallback(
    (themeId: string) => {
      setThemes((prev) =>
        prev.map((t) =>
          t.themeId === themeId ? { ...t, previewImageUrl: '' } : t,
        ),
      );
    },
    [],
  );

  // ============================================================
  // 子 tab 切换时加载数据
  // ============================================================
  useEffect(() => {
    if (activeSubTab === 'history') {
      loadHistory();
    } else if (activeSubTab === 'favorites') {
      loadFavorites();
    }
  }, [activeSubTab, loadHistory, loadFavorites]);

  // ============================================================
  // 导航
  // ============================================================
  const handleViewAllHistory = useCallback(() => {
    Taro.navigateTo({ url: '/pages/history/index' });
  }, []);

  const handleViewAllFavorites = useCallback(() => {
    Taro.navigateTo({ url: '/pages/favorites/index' });
  }, []);

  const handleGoDetail = useCallback((recordId: string) => {
    Taro.navigateTo({ url: `/pages/record/detail/index?recordId=${recordId}` });
  }, []);

  const handleGoDetailFav = useCallback((recordId: number) => {
    Taro.navigateTo({ url: `/pages/record/detail/index?recordId=${recordId}` });
  }, []);

  const handleTakePhoto = useCallback(() => {
    Taro.navigateTo({ url: '/pages/camera/index' });
  }, []);

  // ============================================================
  // 获取类型颜色
  // ============================================================
  const getTypeColor = useCallback((foodType: string): string => {
    return FOOD_TYPE_COLORS[foodType as FoodType] ?? '#607D8B';
  }, []);

  // ============================================================
  // 渲染子 tab 栏
  // ============================================================
  const renderSubTabs = (): React.ReactNode => (
    <View className='gallery-sub-tabs'>
      {SUB_TABS.map((tab) => (
        <View
          key={tab.key}
          className={`gallery-sub-tab ${activeSubTab === tab.key ? 'gallery-sub-tab--active' : ''}`}
          onClick={() => setActiveSubTab(tab.key)}
        >
          <Icon name={tab.icon as any} size={28} color={activeSubTab === tab.key ? '#FF6B35' : '#999999'} />
          <Text className='gallery-sub-tab-label'>{tab.label}</Text>
        </View>
      ))}
    </View>
  );

  // ============================================================
  // 渲染历史照片
  // ============================================================
  const renderHistory = (): React.ReactNode => (
    <View className='gallery-section'>
      <View className='gallery-section-header'>
        <Text className='gallery-section-title'>最近照片</Text>
        <Text className='gallery-section-link' onClick={handleViewAllHistory}>
          查看全部 ›
        </Text>
      </View>

      {historyLoading ? (
        <Skeleton type='list' count={3} />
      ) : historyRecords.length === 0 ? (
        <EmptyState
          icon={<Icon name='photo' size={64} color='#CCCCCC' />}
          title='还没有照片记录'
          description='去拍照记录你的美食吧'
          action={{ label: '去拍照', onClick: handleTakePhoto }}
        />
      ) : (
        <View className='gallery-history-grid'>
          {historyRecords.map((record) => {
            const foodType = record.foodType as FoodType;
            const typeEmoji = FOOD_TYPE_EMOJIS[foodType] ?? '🍽️';
            const typeLabel = FOOD_TYPE_LABELS[foodType] ?? '未知';
            const typeColor = getTypeColor(record.foodType);
            return (
              <View
                key={record._id}
                className='gallery-history-card'
                onClick={() => handleGoDetail(record._id)}
              >
                <View className='gallery-history-card-image-wrap'>
                  <Image
                    className='gallery-history-card-image'
                    src={record.themeImageFileID || record.imageFileID}
                    mode='aspectFill'
                    lazyLoad
                  />
                </View>
                <View className='gallery-history-card-info'>
                  <Text className='gallery-history-card-name'>{record.foodName}</Text>
                  <View className='gallery-history-card-meta'>
                    <View className='gallery-history-type-badge' style={{ backgroundColor: typeColor }}>
                      <Text>{typeEmoji}</Text>
                      <Text>{typeLabel}</Text>
                    </View>
                    <Text className='gallery-history-card-time'>
                      {formatTime(record.createdAt)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );

  // ============================================================
  // 渲染收藏
  // ============================================================
  const renderFavorites = (): React.ReactNode => (
    <View className='gallery-section'>
      <View className='gallery-section-header'>
        <Text className='gallery-section-title'>我的收藏</Text>
        {favTotal > 0 && (
          <Text className='gallery-section-link' onClick={handleViewAllFavorites}>
            查看全部 ›
          </Text>
        )}
      </View>

      {favLoading ? (
        <Skeleton type='list' count={3} />
      ) : favList.length === 0 ? (
        <EmptyState
          icon={<Icon name='star' size={64} color='#CCCCCC' />}
          title='还没有收藏'
          description='在记录详情页点击收藏按钮添加'
        />
      ) : (
        <View className='gallery-fav-list'>
          {favList.slice(0, 5).map((fav) => {
            const foodType = fav.record.foodType as FoodType;
            const emoji = FOOD_TYPE_EMOJIS[foodType] ?? '🍽️';
            const label = FOOD_TYPE_LABELS[foodType] ?? '未知';
            return (
              <View
                key={fav.favoriteId}
                className='gallery-fav-card'
                onClick={() => handleGoDetailFav(fav.record.id)}
              >
                <Image
                  className='gallery-fav-thumb'
                  src={fav.record.themeImageUrl || fav.record.imageUrl || ''}
                  mode='aspectFill'
                  lazyLoad
                />
                <View className='gallery-fav-info'>
                  <Text className='gallery-fav-name'>{fav.record.foodName ?? '未知美食'}</Text>
                  <Text className='gallery-fav-type'>{emoji} {label}</Text>
                  <Text className='gallery-fav-time'>{formatTime(fav.record.createdAt)}</Text>
                </View>
                <View
                  className='gallery-fav-unfav-btn'
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFavorite(fav.record.id);
                  }}
                  hoverClass='gallery-fav-unfav-btn--active'
                >
                  <Icon name='star' size={20} color='#FF6B35' />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );

  // ============================================================
  // 渲染主题管理
  // ============================================================
  const renderThemes = (): React.ReactNode => {
    if (themesLoading) {
      return (
        <View className='gallery-section'>
          <Skeleton type='grid' count={6} />
        </View>
      );
    }

    if (themes.length === 0) {
      return (
        <View className='gallery-section'>
          <EmptyState icon='🎨' title='暂无可用主题' description='主题数据加载失败，请稍后重试' />
        </View>
      );
    }

    return (
      <View className='gallery-section'>
        <View className='gallery-section-header'>
          <Text className='gallery-section-title'>全部主题</Text>
          <View className='gallery-sort'>
            <Text
              className={`gallery-sort-btn${sortMode === 'usage' ? ' gallery-sort-btn--active' : ''}`}
              onClick={() => setSortMode('usage')}
            >
              按使用量
            </Text>
            <Text
              className={`gallery-sort-btn${sortMode === 'name' ? ' gallery-sort-btn--active' : ''}`}
              onClick={() => setSortMode('name')}
            >
              按名称
            </Text>
          </View>
        </View>

        <View className='gallery-themes-grid'>
          {sortedThemes.map((theme) => (
            <View
              key={theme.themeId}
              className={`gallery-card${theme.themeId === defaultThemeId ? ' gallery-card--default' : ''}`}
              onClick={() => handleOpenDetail(theme)}
            >
              <View className='gallery-card-image-wrap'>
                {theme.previewImageUrl ? (
                  <Image
                    className='gallery-card-image'
                    src={theme.previewImageUrl}
                    mode='aspectFill'
                    lazyLoad
                    onError={() => handleImageError(theme.themeId)}
                  />
                ) : (
                  <View className='gallery-card-placeholder'>
                    <Text className='gallery-card-placeholder-text'>{theme.name}</Text>
                  </View>
                )}
                {theme.themeId === defaultThemeId && (
                  <View className='gallery-card-default-badge'>
                    <Text className='gallery-card-default-star'>★</Text>
                    <Text className='gallery-card-default-label'>默认</Text>
                  </View>
                )}
              </View>
              <View className='gallery-card-info'>
                <Text className='gallery-card-name'>{theme.name}</Text>
                <Text className='gallery-card-game'>{theme.gameName}</Text>
                <Text className='gallery-card-usage'>{theme.usageCount} 次使用</Text>
              </View>
            </View>
          ))}
        </View>

        {/* 主题详情弹窗 */}
        {modalVisible && selectedTheme && (
          <View className='gallery-modal-overlay' onClick={handleCloseDetail}>
            <View className='gallery-modal-sheet' onClick={handleSheetStopPropagation}>
              <View className='gallery-modal-image-wrap'>
                {selectedTheme.previewImageUrl ? (
                  <Image className='gallery-modal-image' src={selectedTheme.previewImageUrl} mode='widthFix' />
                ) : (
                  <View className='gallery-modal-placeholder'>
                    <Text className='gallery-modal-placeholder-text'>{selectedTheme.name}</Text>
                  </View>
                )}
              </View>
              <View className='gallery-modal-content'>
                <Text className='gallery-modal-name'>{selectedTheme.name}</Text>
                <Text className='gallery-modal-game'>{selectedTheme.gameName}</Text>
                <Text className='gallery-modal-desc'>{selectedTheme.description}</Text>
                <Text className='gallery-modal-usage'>已被使用 {selectedTheme.usageCount} 次</Text>
                <View className='gallery-modal-actions'>
                  <View
                    className={`gallery-modal-btn gallery-modal-btn--primary${selectedTheme.themeId === defaultThemeId ? ' gallery-modal-btn--disabled' : ''}`}
                    onClick={() => {
                      if (selectedTheme.themeId !== defaultThemeId) {
                        handleSetDefault(selectedTheme.themeId);
                      }
                    }}
                  >
                    <Text>{selectedTheme.themeId === defaultThemeId ? '当前默认主题' : '设为默认'}</Text>
                  </View>
                  <View
                    className='gallery-modal-btn gallery-modal-btn--secondary'
                    onClick={() => setPreviewModalVisible(true)}
                  >
                    <Text>预览效果</Text>
                  </View>
                </View>
              </View>
              <View className='gallery-modal-close' onClick={handleCloseDetail}>
                <Icon name='close' size={20} color='#FFFFFF' />
              </View>
            </View>
          </View>
        )}

        {/* 预览弹窗 */}
        {previewModalVisible && selectedTheme && (
          <View className='gallery-modal-overlay' onClick={() => setPreviewModalVisible(false)}>
            <View className='gallery-preview-sheet' onClick={handleSheetStopPropagation}>
              <Text className='gallery-preview-title'>{selectedTheme.name} - 预览效果</Text>
              <View className='gallery-preview-card'>
                <View
                  className='gallery-preview-card-header'
                  style={{
                    background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
                  }}
                >
                  <Icon name='food' size={80} color='rgba(255,255,255,0.5)' />
                </View>
                <View className='gallery-preview-card-info'>
                  <Text className='gallery-preview-card-title'>{selectedTheme.name}</Text>
                  <Text className='gallery-preview-card-desc'>{selectedTheme.description}</Text>
                  <Text className='gallery-preview-card-sub'>使用此主题合成效果展示</Text>
                </View>
              </View>
              <Text className='gallery-preview-hint'>此为示例预览，实际合成效果以最终图片为准</Text>
              <View
                className='gallery-modal-btn gallery-modal-btn--primary gallery-preview-confirm'
                onClick={() => setPreviewModalVisible(false)}
              >
                <Text>关闭预览</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  // ============================================================
  // 主渲染
  // ============================================================
  return (
    <View className='gallery-page'>
      {renderSubTabs()}

      <ScrollView className='gallery-content' scrollY showScrollbar={false}>
        {activeSubTab === 'history' && renderHistory()}
        {activeSubTab === 'favorites' && renderFavorites()}
        {activeSubTab === 'themes' && renderThemes()}
      </ScrollView>
    </View>
  );
}
