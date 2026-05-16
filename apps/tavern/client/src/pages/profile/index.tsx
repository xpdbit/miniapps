import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useAuthStore } from '@/stores/authStore'
import { Icon } from '@/components'
import { cn, formatUuid } from '@/utils'
import './index.scss'

interface MenuItem {
  icon: string
  label: string
  url: string
  switchTab?: boolean
}

const MENU_ITEMS: MenuItem[] = [
  { icon: 'user', label: '我的角色', url: '/pages/character/index' },
  { icon: 'plus', label: '创建角色', url: '/pages/creator/index' },
  { icon: 'persona', label: '人设管理', url: '/pages/persona/index' },
]

export default function ProfilePage() {
  useDidShow(() => {
    Taro.eventCenter.trigger('tabChange', 2)
  })

  const { user } = useAuthStore()
  const nickname = user?.nickname || '酒馆旅人'
  const userUuid = user?.uuid || ''
  const dailyQuota = user?.dailyQuota ?? 20
  const usedQuota = user?.usedQuota ?? 0
  const remaining = Math.max(0, dailyQuota - usedQuota)

  const handleNavigate = (item: MenuItem) => {
    if (item.switchTab) {
      Taro.switchTab({ url: item.url })
    } else {
      Taro.navigateTo({ url: item.url })
    }
  }

  return (
    <View className='page-profile'>
      {/* 用户信息卡片 */}
      <View className='page-profile-header'>
        <View className='page-profile-avatar'>
          {user?.avatar ? (
            <Image src={user.avatar} mode='aspectFill' className='page-profile-avatar-img' />
          ) : (
            <Text className='page-profile-avatar-text'>{nickname?.[0] || '?'}</Text>
          )}
        </View>
        <Text className='page-profile-name'>{nickname}</Text>

        {/* UUID 身份标识 */}
        {userUuid && (
          <Text className='page-profile-uuid'>{formatUuid(userUuid)}</Text>
        )}

        {/* 配额信息 */}
        <View className='page-profile-quota'>
          <View className='page-profile-quota-item'>
            <Text className='page-profile-quota-value page-profile-quota-value--highlight'>
              {remaining}
            </Text>
            <Text className='page-profile-quota-label'>今日剩余</Text>
          </View>
          <View className='page-profile-quota-divider' />
          <View className='page-profile-quota-item'>
            <Text className='page-profile-quota-value'>{dailyQuota}</Text>
            <Text className='page-profile-quota-label'>总次数</Text>
          </View>
        </View>

        {/* 配额进度条 */}
        <View className='page-profile-quota-bar'>
          <View
            className='page-profile-quota-bar-fill'
            style={{
              width: `${dailyQuota > 0 ? (usedQuota / dailyQuota) * 100 : 0}%`,
            }}
          />
        </View>
      </View>

      {/* 菜单列表 */}
      <View className='page-profile-menu'>
        {MENU_ITEMS.map((item, index) => (
          <View
            key={index}
            className={cn(
              'page-profile-menu-item',
              index === MENU_ITEMS.length - 1 && 'page-profile-menu-item--last',
            )}
            onClick={() => handleNavigate(item)}
          >
            <View className='page-profile-menu-item-left'>
              <Icon name={item.icon as 'user' | 'plus' | 'persona' | 'settings'} size={36} color='#C49A6C' />
              <Text className='page-profile-menu-item-label'>{item.label}</Text>
            </View>
            <Text className='page-profile-menu-item-arrow'>›</Text>
          </View>
        ))}
      </View>

      {/* 版本信息 */}
      <View className='page-profile-footer'>
        <Text className='page-profile-footer-text'>AI 酒馆 v1.0.0</Text>
      </View>
    </View>
  )
}
