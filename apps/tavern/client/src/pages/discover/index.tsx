import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useGameStore } from '@/stores/gameStore'
import CustomTabBar from '@/custom-tab-bar'
import { Icon, EmptyState } from '@/components'
import './index.scss'

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return d.toLocaleDateString('zh-CN')
}

export default function DiscoverPage() {
  const { saves } = useGameStore()

  useDidShow(() => {
    Taro.eventCenter.trigger('tabChange', 2)
  })

  // 从游戏存档中提取最近活动
  const recentActivities: Array<{ type: string; text: string; time: number }> = []
  for (const save of saves) {
    if (!Array.isArray(save.groups)) continue
    for (const group of save.groups) {
      if (group.lastMessage) {
        recentActivities.push({
          type: 'chat',
          text: `[${save.name}] ${group.name}: ${group.lastMessage.slice(0, 30)}${group.lastMessage.length > 30 ? '...' : ''}`,
          time: group.updatedAt || save.updatedAt,
        })
      }
    }
  }
  recentActivities.sort((a, b) => b.time - a.time)

  return (
    <View className='page-discover'>
        <View className='page-discover-header'>
          <Text className='page-discover-header-title'>发现</Text>
        </View>

        {saves.length === 0 ? (
          <View className='page-discover-empty'>
            <EmptyState
              icon={<Icon name='star' size={64} color='var(--color-icon-disabled)' />}
              title='暂无内容'
              description='开启一段游戏冒险吧！'
            />
          </View>
        ) : (
          <>
            {/* 朋友圈 — 游戏动态 */}
            <View className='page-discover-section'>
              <View
                className='page-discover-item'
                onClick={() => {
                  if (saves.length === 0) {
                    Taro.showToast({ title: '暂无游戏存档', icon: 'none' })
                  } else {
                    Taro.switchTab({ url: '/pages/chat/index' })
                  }
                }}
              >
                <View className='page-discover-item-left'>
                  <View className='page-discover-item-icon'>
                    <Icon name='history' size={24} color='var(--color-primary)' />
                  </View>
                  <View className='page-discover-item-info'>
                    <Text className='page-discover-item-label'>朋友圈</Text>
                    <Text className='page-discover-item-desc'>
                      {recentActivities.length > 0
                        ? `${recentActivities.length} 条新动态`
                        : '查看游戏角色的动态'}
                    </Text>
                  </View>
                </View>
                <View className='page-discover-item-arrow'>
                  <Icon name='arrow-right' size={20} color='var(--color-text-tertiary)' />
                </View>
              </View>

              {/* 最近动态预览 */}
              {recentActivities.slice(0, 3).map((activity, idx) => (
                <View key={idx}>
                  <View className='page-discover-moment'>
                    <View className='page-discover-moment-icon'>
                      <Icon name='chat' size={18} color='var(--color-primary)' />
                    </View>
                    <View className='page-discover-moment-content'>
                      <Text className='page-discover-moment-text'>{activity.text}</Text>
                      <Text className='page-discover-moment-time'>{formatTime(activity.time)}</Text>
                    </View>
                  </View>
                  {idx < Math.min(recentActivities.length, 3) - 1 && <View className='page-discover-divider' />}
                </View>
              ))}
            </View>

            <View className='page-discover-divider' />

            {/* 扫一扫 */}
            <View
              className='page-discover-item'
              onClick={() => Taro.showToast({ title: '扫码功能开发中', icon: 'none' })}
            >
              <View className='page-discover-item-left'>
                <View className='page-discover-item-icon'>
                    <Icon name='search' size={24} color='var(--color-primary)' />
                  </View>
                  <View className='page-discover-item-info'>
                    <Text className='page-discover-item-label'>扫一扫</Text>
                </View>
              </View>
              <View className='page-discover-item-arrow'>
                <Icon name='arrow-right' size={20} color='var(--color-text-tertiary)' />
              </View>
            </View>

            <View className='page-discover-divider' />

            {/* 游戏事件 — 存档列表 */}
            <View
              className='page-discover-item'
              onClick={() => {
                if (saves.length === 0) {
                  Taro.showToast({ title: '暂无游戏存档', icon: 'none' })
                } else {
                  Taro.navigateTo({ url: '/pages/archive/index' })
                }
              }}
            >
              <View className='page-discover-item-left'>
                <View className='page-discover-item-icon'>
                  <Icon name='save' size={24} color='var(--color-primary)' />
                </View>
                <View className='page-discover-item-info'>
                  <Text className='page-discover-item-label'>游戏存档</Text>
                  <Text className='page-discover-item-desc'>
                    {saves.length > 0 ? `${saves.length} 个存档` : '暂无游戏存档'}
                  </Text>
                </View>
              </View>
              <Icon name='arrow-right' size={20} color='var(--color-text-tertiary)' />
            </View>
          </>
        )}
      <CustomTabBar />
    </View>
  )
}
