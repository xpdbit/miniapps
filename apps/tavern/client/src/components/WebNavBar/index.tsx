/**
 * WebNavBar — H5 桌面端顶部导航栏
 *
 * 仅在屏幕宽度 >= 768px 时显示，提供：
 * - 应用标题 "AI 酒馆"（可点击 Home 按钮）
 * - 主题切换按钮
 *
 * Home 按钮行为：
 * - 游戏进行中 → 跳转到通信页面 (chats/index)
 * - 非游戏状态 → 跳转到酒馆页面 (market/index)
 *
 * 小程序平台不渲染。
 */
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useGameStore } from '@/stores/gameStore'
import ThemeToggle from '@/components/ThemeToggle'
import './index.scss'

const isH5 = process.env.TARO_ENV === 'h5'

export default function WebNavBar() {
  const gameMode = useGameStore(s => s.gameMode)

  if (!isH5) return null

  const handleHomeClick = () => {
    if (gameMode) {
      // 游戏进行中 → 回到通信页面
      Taro.reLaunch({ url: '/pages/chats/index' })
    } else {
      // 非游戏状态 → 回到酒馆页面
      Taro.switchTab({ url: '/pages/market/index' })
    }
  }

  return (
    <View
      className='web-navbar'
      role='banner'
      aria-label='顶部导航'
    >
      <View
        onClick={handleHomeClick}
        className='web-navbar-home-btn'
        hoverClass='web-navbar-title--hover'
        role='button'
        aria-label='回到首页'
      >
        <Text className='web-navbar-title'>AI 酒馆</Text>
      </View>
      <ThemeToggle />
    </View>
  )
}
