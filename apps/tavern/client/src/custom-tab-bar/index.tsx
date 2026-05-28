/* ============================================================
   自定义底部栏组件 — 支持双模式切换
   Tavern Mode:  酒馆 | 开始 | 我的
   Game Mode:    通信 | 通讯录 | 发现 | 我的
   
   注意：游戏模式的 chats/contacts/discover 不在 app.config.ts
   tabBar.list 中，因此不能使用 Taro.switchTab，改用 Taro.reLaunch。
   ============================================================ */
import { useState, useEffect } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useGameStore } from '@/stores/gameStore';
import './index.scss';

/** 原生 tabBar 页面（在 app.config.ts 中声明），可用 Taro.switchTab */
const NATIVE_TAB_PAGES = new Set([
  'pages/cards/index',
  'pages/chat/index',
  'pages/profile/index',
]);

/** 根据页面是否在原生 tabBar 中选择导航方式 */
function navigateTab(url: string) {
  if (NATIVE_TAB_PAGES.has(url)) {
    Taro.switchTab({ url: `/${url}` });
  } else {
    Taro.reLaunch({ url: `/${url}` });
  }
}

/** SVG 转 data URI */
function svgToDataUri(svg: string, color: string): string {
  const colored = svg.replace(/__COLOR__/g, color);
  return `data:image/svg+xml,${encodeURIComponent(colored)}`;
}

/* ---- Tavern Mode SVGs ---- */
const GALLERY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="__COLOR__" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`;
const CHAT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="__COLOR__" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
const USER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="__COLOR__" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

/* ---- Game Mode SVGs ---- */
const CHATS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="__COLOR__" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
const CONTACTS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="__COLOR__" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
const DISCOVER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="__COLOR__" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="none"/></svg>`;

/* ---- Mode Tab Lists ---- */
const TAVERN_TAB_LIST = [
  { pagePath: 'pages/cards/index', text: '酒馆', svgIcon: GALLERY_SVG },
  { pagePath: 'pages/chat/index', text: '开始', svgIcon: CHAT_SVG },
  { pagePath: 'pages/profile/index', text: '我的', svgIcon: USER_SVG },
];

const GAME_TAB_LIST = [
  { pagePath: 'pages/chats/index', text: '通信', svgIcon: CHATS_SVG },
  { pagePath: 'pages/contacts/index', text: '通讯录', svgIcon: CONTACTS_SVG },
  { pagePath: 'pages/discover/index', text: '发现', svgIcon: DISCOVER_SVG },
  { pagePath: 'pages/profile/index', text: '我的', svgIcon: USER_SVG },
];

/** 酒馆模式专属页面（始终显示酒馆 tab，不随 gameMode 切换） */
const TAVERN_ONLY_PAGES = new Set([
  'pages/cards/index',
  'pages/chat/index',
]);

/** 游戏模式专属页面（不在酒馆模式 tabBar 中） */
const GAME_ONLY_PAGES = new Set([
  'pages/chats/index',
  'pages/contacts/index',
  'pages/discover/index',
]);

/** 获取当前页面路由 */
function getCurrentRoute(): string {
  try {
    const pages = Taro.getCurrentPages();
    const currentPage = pages[pages.length - 1];
    return currentPage?.route ?? '';
  } catch {
    return '';
  }
}

/** 通过当前页面路由检测是否处于游戏模式（仅兜底，优先以 store 为准） */
function detectGameMode(): boolean {
  try {
    const route = getCurrentRoute();
    for (const p of GAME_ONLY_PAGES) {
      if (route.endsWith(p)) return true;
    }
    // Profile 同时存在于 tabBar.list（酒馆模式）和 GAME_TAB_LIST（游戏模式"我的"）
    if (route.endsWith('pages/profile/index') && useGameStore.getState().gameMode) {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/** 通过当前页面路由判断选中哪个 tab */
function getSelectedIndex(tabList: typeof TAVERN_TAB_LIST): number {
  try {
    const route = getCurrentRoute();
    if (route) {
      const idx = tabList.findIndex((tab) => route.endsWith(tab.pagePath));
      return idx !== -1 ? idx : 0;
    }
  } catch {
    // ignore
  }
  return 0;
}

export default function CustomTabBar() {
  const storeGameMode = useGameStore(s => s.gameMode);
  // home/开始 页面始终显示酒馆模式，不受游戏状态影响
  // 其余页面：store 为主，路由检测为兜底
  const [gameMode, setGameMode] = useState(() => {
    const route = getCurrentRoute();
    for (const p of TAVERN_ONLY_PAGES) {
      if (route.endsWith(p)) return false;
    }
    return storeGameMode || detectGameMode();
  });
  const [hidden, setHidden] = useState(false);

  const tabList = gameMode ? GAME_TAB_LIST : TAVERN_TAB_LIST;
  const [selected, setSelected] = useState(getSelectedIndex(tabList));

  useEffect(() => {
    // 监听模式切换事件（由 enableGameMode / disableGameMode 触发）
    const modeHandler = (isGameMode: boolean) => {
      setGameMode(isGameMode);
      const newList = isGameMode ? GAME_TAB_LIST : TAVERN_TAB_LIST;
      setSelected(0);
      if (newList[0]) {
        navigateTab(newList[0].pagePath);
      }
    };
    Taro.eventCenter.on('gameModeChange', modeHandler);

    // 监听 tab 切换事件
    const tabHandler = (index: number) => {
      setSelected(index);
    };
    Taro.eventCenter.on('tabChange', tabHandler);

    // 监听 modal 覆盖
    const modalHandler = (visible: boolean) => {
      setHidden(visible);
    };
    Taro.eventCenter.on('modalOverlayChange', modalHandler);

    return () => {
      Taro.eventCenter.off('gameModeChange', modeHandler);
      Taro.eventCenter.off('tabChange', tabHandler);
      Taro.eventCenter.off('modalOverlayChange', modalHandler);
    };
  }, []);

  const switchTab = (index: number) => {
    if (index === selected) return;
    const tab = tabList[index];
    if (tab) {
      navigateTab(tab.pagePath);
    }
  };

  return (
    <View className={`custom-tab-bar ${hidden ? 'custom-tab-bar--hidden' : ''} ${tabList.length > 3 ? 'custom-tab-bar--four' : ''}`}>
      <View className='tab-bar-inner'>
        {tabList.map((tab, index) => (
          <View
            key={tab.pagePath}
            className={`tab-item ${selected === index ? 'tab-item--active' : ''}`}
            onClick={() => switchTab(index)}
          >
            <View className='tab-icon-wrap'>
              <Image
                className='tab-icon'
                src={svgToDataUri(tab.svgIcon, selected === index ? '#C49A6C' : '#A8A39E')}
                mode='aspectFit'
              />
            </View>
            <Text className='tab-label'>{tab.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
