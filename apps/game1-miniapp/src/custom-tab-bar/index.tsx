import { useState, useEffect, useRef } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './index.scss';

function svgToDataUri(svg: string, color: string): string {
  const colored = svg.replace(/__COLOR__/g, color);
  return `data:image/svg+xml;utf8,${encodeURIComponent(colored)}`;
}

const HOME_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="__COLOR__" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
const INFO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="__COLOR__" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
const TEAM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="__COLOR__" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
const INVENTORY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="__COLOR__" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;

const TAB_LIST: Array<{
  pagePath: string;
  text: string;
  svgIcon: string;
}> = [
  { pagePath: 'pages/home/index', text: '旅途', svgIcon: HOME_SVG },
  { pagePath: 'pages/dashboard/index', text: '信息', svgIcon: INFO_SVG },
  { pagePath: 'pages/team/index', text: '队伍', svgIcon: TEAM_SVG },
  { pagePath: 'pages/inventory/index', text: '库存', svgIcon: INVENTORY_SVG },
];

/** 路由切换防抖间隔 (ms) */
const SWITCH_TAB_DEBOUNCE_MS = 300;

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
    // 静默失败
  }
  return 0;
}

export default function CustomTabBar() {
  const [selected, setSelected] = useState(getSelectedIndex());
  const switchingRef = useRef(false);

  useEffect(() => {
    const handler = (index: number) => {
      setSelected(index);
    };
    Taro.eventCenter.on('tabChange', handler);
    setSelected(getSelectedIndex());
    return () => {
      Taro.eventCenter.off('tabChange', handler);
    };
  }, []);

  const switchTab = (index: number) => {
    if (index === selected) return;
    // 防抖：防止快速切换导致 WeChat SDK 路由冲突
    if (switchingRef.current) return;
    switchingRef.current = true;

    const tab = TAB_LIST[index];
    if (tab) {
      Taro.switchTab({
        url: `/${tab.pagePath}`,
        complete: () => {
          // 路由完成后释放锁
          setTimeout(() => {
            switchingRef.current = false;
          }, SWITCH_TAB_DEBOUNCE_MS);
        },
        fail: () => {
          // 失败也要释放锁
          switchingRef.current = false;
        },
      });
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
              <Image
                className='tab-icon'
                src={svgToDataUri(tab.svgIcon, selected === index ? '#c4923a' : '#b5a898')}
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
