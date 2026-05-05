/**
 * ============================================================
 * 主题画廊页面
 * 网格展示所有可用主题，支持排序、预览、设为默认
 * ============================================================
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Image, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { THEME_TEMPLATES } from '@/constants/themeDefaults';
import { fetchThemes } from '@/services/themeApi';
import type { Theme as ServerTheme } from '@/types/theme';
import EmptyState from '@/components/EmptyState/index';
import Skeleton from '@/components/Skeleton/index';
import Icon from '@/components/Icon/Icon';
import './index.scss';

// ============================================================
// 类型定义
// ============================================================

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
// 数据加载
// ============================================================

/**
 * 优先从服务端获取主题列表，失败时使用本地回退
 */
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

  // 回退到本地硬编码数据
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

/**
 * 获取默认主题 ID（本地存储）
 */
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

/**
 * 保存默认主题 ID
 */
function saveDefaultThemeId(themeId: string): void {
  try {
    Taro.setStorageSync(STORAGE_DEFAULT_KEY, themeId);
  } catch {
    console.error('[Gallery] 保存默认主题失败');
  }
}

// ============================================================
// 组件
// ============================================================

export default function GalleryPage() {
  // ---- State ----
  const [loading, setLoading] = useState<boolean>(true);
  const [themes, setThemes] = useState<GalleryTheme[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('usage');
  const [defaultThemeId, setDefaultThemeId] = useState<string>(DEFAULT_THEME_ID);
  const [selectedTheme, setSelectedTheme] = useState<GalleryTheme | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [previewModalVisible, setPreviewModalVisible] = useState<boolean>(false);

  // ---- 数据初始化 ----
  useEffect(() => {
    const init = async () => {
      try {
        const { themes: loadedThemes } = await loadThemes();
        const defaultId = loadDefaultThemeId();
        setThemes(loadedThemes);
        setDefaultThemeId(defaultId);
      } catch (err) {
        const message = err instanceof Error ? err.message : '加载主题数据失败';
        console.error('[Gallery] 初始化失败:', message);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // ---- 排序逻辑 ----
  const sortedThemes = useMemo(() => {
    const list = [...themes];
    if (sortMode === 'usage') {
      list.sort((a, b) => b.usageCount - a.usageCount);
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    }
    return list;
  }, [themes, sortMode]);

  // ---- 事件处理 ----

  /** 打开主题详情弹窗 */
  const handleOpenDetail = useCallback((theme: GalleryTheme) => {
    setSelectedTheme(theme);
    setModalVisible(true);
  }, []);

  /** 关闭详情弹窗 */
  const handleCloseDetail = useCallback(() => {
    setModalVisible(false);
    // 延迟清除选中项以让关闭动画完成
    setTimeout(() => {
      setSelectedTheme(null);
    }, 300);
  }, []);

  /** 阻止事件冒泡（弹窗内容区域） */
  const handleSheetStopPropagation = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
    },
    [],
  );

  /** 设为默认主题 */
  const handleSetDefault = useCallback(
    (themeId: string) => {
      saveDefaultThemeId(themeId);
      setDefaultThemeId(themeId);
      Taro.showToast({
        title: '已设为默认主题',
        icon: 'success',
        duration: 2000,
      });
      handleCloseDetail();
    },
    [handleCloseDetail],
  );

  /** 预览效果 */
  const handlePreviewEffect = useCallback(() => {
    setPreviewModalVisible(true);
  }, []);

  /** 关闭预览 */
  const handleClosePreview = useCallback(() => {
    setPreviewModalVisible(false);
  }, []);

  /** 切换排序方式 */
  const handleToggleSort = useCallback(
    (mode: SortMode) => {
      if (mode !== sortMode) {
        setSortMode(mode);
      }
    },
    [sortMode],
  );

  /** 图片加载失败时回退为占位符 */
  const handleImageError = useCallback(
    (themeId: string) => {
      setThemes((prev) =>
        prev.map((t) => {
          if (t.themeId === themeId) {
            // 将 previewImageUrl 置空以显示占位符
            return { ...t, previewImageUrl: '' };
          }
          return t;
        }),
      );
    },
    [],
  );

  // ---- 渲染：加载状态 ----
  if (loading) {
    return (
      <View className='gallery-page'>
        <Skeleton type='grid' count={6} />
      </View>
    );
  }

  // ---- 渲染：空状态 ----
  if (themes.length === 0) {
    return (
      <View className='gallery-page'>
        <EmptyState
          icon='🎨'
          title='暂无可用主题'
          description='主题数据加载失败，请稍后重试'
        />
      </View>
    );
  }

  // ---- 渲染：主内容 ----
  return (
    <View className='gallery-page'>
      {/* ==================== 顶部：标题 + 排序 ==================== */}
      <View className='gallery-header'>
        <Text className='gallery-header-title'>全部主题</Text>
        <View className='gallery-sort'>
          <Text
            className={`gallery-sort-btn${sortMode === 'usage' ? ' gallery-sort-btn--active' : ''}`}
            onClick={() => handleToggleSort('usage')}
          >
            按使用量
          </Text>
          <Text
            className={`gallery-sort-btn${sortMode === 'name' ? ' gallery-sort-btn--active' : ''}`}
            onClick={() => handleToggleSort('name')}
          >
            按名称
          </Text>
        </View>
      </View>

      {/* ==================== 主题网格 ==================== */}
      <ScrollView
        className='gallery-grid'
        scrollY
        enhanced
        showScrollbar={false}
      >
        <View className='gallery-grid-inner'>
          {sortedThemes.map((theme) => (
            <View
              key={theme.themeId}
              className={`gallery-card${theme.themeId === defaultThemeId ? ' gallery-card--default' : ''}`}
              onClick={() => handleOpenDetail(theme)}
            >
              {/* 卡片图片 */}
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
                    <Text className='gallery-card-placeholder-text'>
                      {theme.name}
                    </Text>
                  </View>
                )}

                {/* 默认标记 */}
                {theme.themeId === defaultThemeId && (
                  <View className='gallery-card-default-badge'>
                    <Text className='gallery-card-default-star'>★</Text>
                    <Text className='gallery-card-default-label'>默认</Text>
                  </View>
                )}
              </View>

              {/* 卡片信息 */}
              <View className='gallery-card-info'>
                <Text className='gallery-card-name'>{theme.name}</Text>
                <Text className='gallery-card-game'>{theme.gameName}</Text>
                <Text className='gallery-card-usage'>
                  {theme.usageCount} 次使用
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ==================== 主题详情弹窗 ==================== */}
      {modalVisible && selectedTheme && (
        <View className='gallery-modal-overlay' onClick={handleCloseDetail}>
          <View
            className='gallery-modal-sheet'
            onClick={handleSheetStopPropagation}
          >
            {/* 弹窗大图 */}
            <View className='gallery-modal-image-wrap'>
              {selectedTheme.previewImageUrl ? (
                <Image
                  className='gallery-modal-image'
                  src={selectedTheme.previewImageUrl}
                  mode='widthFix'
                />
              ) : (
                <View className='gallery-modal-placeholder'>
                  <Text className='gallery-modal-placeholder-text'>
                    {selectedTheme.name}
                  </Text>
                </View>
              )}
            </View>

            {/* 弹窗内容 */}
            <View className='gallery-modal-content'>
              <Text className='gallery-modal-name'>
                {selectedTheme.name}
              </Text>
              <Text className='gallery-modal-game'>
                {selectedTheme.gameName}
              </Text>
              <Text className='gallery-modal-desc'>
                {selectedTheme.description}
              </Text>
              <Text className='gallery-modal-usage'>
                已被使用 {selectedTheme.usageCount} 次
              </Text>

              {/* 操作按钮区 */}
              <View className='gallery-modal-actions'>
                <View
                  className={`gallery-modal-btn gallery-modal-btn--primary${
                    selectedTheme.themeId === defaultThemeId
                      ? ' gallery-modal-btn--disabled'
                      : ''
                  }`}
                  onClick={() => {
                    if (selectedTheme.themeId !== defaultThemeId) {
                      handleSetDefault(selectedTheme.themeId);
                    }
                  }}
                >
                  <Text>
                    {selectedTheme.themeId === defaultThemeId
                      ? '当前默认主题'
                      : '设为默认'}
                  </Text>
                </View>
                <View
                  className='gallery-modal-btn gallery-modal-btn--secondary'
                  onClick={handlePreviewEffect}
                >
                  <Text>预览效果</Text>
                </View>
              </View>
            </View>

            {/* 关闭按钮 */}
            <View
              className='gallery-modal-close'
              onClick={handleCloseDetail}
            >
              <Icon name='close' size={20} color='#FFFFFF' />
            </View>
          </View>
        </View>
      )}

      {/* ==================== 预览效果弹窗 ==================== */}
      {previewModalVisible && selectedTheme && (
        <View className='gallery-modal-overlay' onClick={handleClosePreview}>
          <View
            className='gallery-preview-sheet'
            onClick={handleSheetStopPropagation}
          >
            <Text className='gallery-preview-title'>
              {selectedTheme.name} - 预览效果
            </Text>
            <View className='gallery-preview-card'>
              <View
                className='gallery-preview-card-header'
                style={{
                  background:
                    'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
                }}
              >
                <Icon name='food' size={80} color='rgba(255,255,255,0.5)' />
              </View>
              <View className='gallery-preview-card-info'>
                <Text className='gallery-preview-card-title'>
                  {selectedTheme.name}
                </Text>
                <Text className='gallery-preview-card-desc'>
                  {selectedTheme.description}
                </Text>
                <Text className='gallery-preview-card-sub'>
                  使用此主题合成效果展示
                </Text>
              </View>
            </View>
            <Text className='gallery-preview-hint'>
              此为示例预览，实际合成效果以最终图片为准
            </Text>
            <View
              className='gallery-modal-btn gallery-modal-btn--primary gallery-preview-confirm'
              onClick={handleClosePreview}
            >
              <Text>关闭预览</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
