/**
 * 默认主题配置
 * 后续任务会扩展为完整的主题列表
 */

import type { ThemeConfig } from '@/types/theme';

/** 默认主题合成配置 */
export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  frame: {
    frameImageId: '',
    borderWidth: 20,
    borderRadius: 16,
    overlayColor: 'rgba(0, 0, 0, 0.3)',
    overlayOpacity: 0.3,
  },
  compose: {
    imageScale: 0.8,
    offsetX: 0,
    offsetY: 0,
    textTemplate: '获得道具：{name}',
    textColor: '#FFFFFF',
    fontSize: 28,
    textX: 0,
    textY: -40,
  },
};

/** 默认主题列表模板 */
export const THEME_TEMPLATES = [
  {
    themeId: 'theme_classic',
    name: '经典食记',
    gameName: '经典食记',
  },
  {
    themeId: 'theme_zelda',
    name: '海拉鲁料理',
    gameName: '塞尔达传说',
  },
  {
    themeId: 'theme_monster_hunter',
    name: '猎人食堂',
    gameName: '怪物猎人',
  },
  {
    themeId: 'theme_animal_crossing',
    name: '无人岛美食',
    gameName: '动物森友会',
  },
  {
    themeId: 'theme_minecraft',
    name: '方块厨房',
    gameName: '我的世界',
  },
  {
    themeId: 'theme_pokemon',
    name: '宝可梦野餐',
    gameName: '宝可梦',
  },
];

/** Canvas 画布尺寸 */
export const CANVAS_SIZE = {
  width: 750,
  height: 1334,
};

/** 图片尺寸限制 */
export const IMAGE_LIMITS = {
  /** 最大上传图片尺寸 (bytes) */
  maxFileSize: 10 * 1024 * 1024,
  /** 最大宽度 */
  maxWidth: 2048,
  /** 最大高度 */
  maxHeight: 2048,
};
