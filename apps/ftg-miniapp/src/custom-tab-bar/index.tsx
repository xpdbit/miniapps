/* ============================================================
   自定义底部栏组件 — 替代微信原生 tabBar
   支持全局 CSS 变量主题系统，可自定义字号和样式
   ============================================================ */
import { useState, useEffect } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './index.scss';

/** SVG 转 data URI */
function svgToDataUri(svg: string, color: string): string {
  const colored = svg.replace(/__COLOR__/g, color);
  return `data:image/svg+xml;utf8,${encodeURIComponent(colored)}`;
}

/** 画廊图标 SVG */
const GALLERY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="__COLOR__" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`;

const TAB_LIST: Array<{
  pagePath: string;
  text: string;
  iconPath?: string;
  selectedIconPath?: string;
  svgIcon?: string;
}> = [
  {
    pagePath: 'pages/home/index',
    text: '首页',
    iconPath: '../assets/icons/home.png',
    selectedIconPath: '../assets/icons/home-active.png',
  },
  {
    pagePath: 'pages/gallery/index',
    text: '画廊',
    svgIcon: GALLERY_SVG,
  },
  {
    pagePath: 'pages/profile/index',
    text: '我的',
    iconPath: '../assets/icons/profile.png',
    selectedIconPath: '../assets/icons/profile-active.png',
  },
];

/** 通过当前页面路由判断选中哪个 tab */
function getSelectedIndex(): number {
  try {
    const pages = Taro.getCurrentPages();
    const currentPage = pages[pages.length - 1];
    if (currentPage) {
      const route = currentPage.route || '';
      const idx = TAB_LIST.findIndex((tab) => route.endsWith(tab.pagePath));
      return idx !== -1 ? idx : 0;
    }
  } catch {
    // 静默失败，返回默认值
  }
  return 0;
}

export default function CustomTabBar() {
  const [selected, setSelected] = useState(getSelectedIndex());

  useEffect(() => {
    // 监听页面切换事件（由各 tab 页面在 componentDidShow 中触发）
    const handler = (index: number) => {
      setSelected(index);
    };
    Taro.eventCenter.on('tabChange', handler);

    // 组件挂载时读取一次当前路由
    setSelected(getSelectedIndex());

    return () => {
      Taro.eventCenter.off('tabChange', handler);
    };
  }, []);

  const switchTab = (index: number) => {
    if (index === selected) return;
    const tab = TAB_LIST[index];
    if (tab) {
      Taro.switchTab({ url: `/${tab.pagePath}` });
    }
  };

  return (
    <View className='custom-tab-bar'>
      <View className='tab-bar-inner'>
        {TAB_LIST.map((tab, index) => (
          <View
            key={tab.pagePath}
            className={`tab-item ${selected === index ? 'tab-item--active' : ''}`}
            onClick={() => switchTab(index)}
          >
            <View className='tab-icon-wrap'>
              {tab.svgIcon ? (
                <Image
                  className='tab-icon'
                  src={svgToDataUri(tab.svgIcon, selected === index ? '#FF6B35' : '#999999')}
                  mode='aspectFit'
                />
              ) : (
                <Image
                  className='tab-icon'
                  src={selected === index ? (tab.selectedIconPath ?? '') : (tab.iconPath ?? '')}
                  mode='aspectFit'
                />
              )}
            </View>
            <Text className='tab-label'>{tab.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
