/* ============================================================
   自定义底部栏组件 — 替代微信原生 tabBar
   支持全局 CSS 变量主题系统，可自定义字号和样式
   ============================================================ */
import { useState, useEffect } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './index.scss';

const TAB_LIST = [
  {
    pagePath: 'pages/home/index',
    text: '首页',
    iconPath: 'assets/icons/home.png',
    selectedIconPath: 'assets/icons/home-active.png',
  },
  {
    pagePath: 'pages/settings/index',
    text: '设置',
    iconPath: 'assets/icons/settings.png',
    selectedIconPath: 'assets/icons/settings-active.png',
  },
  {
    pagePath: 'pages/profile/index',
    text: '我的',
    iconPath: 'assets/icons/profile.png',
    selectedIconPath: 'assets/icons/profile-active.png',
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
              <Image
                className='tab-icon'
                src={selected === index ? tab.selectedIconPath : tab.iconPath}
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
