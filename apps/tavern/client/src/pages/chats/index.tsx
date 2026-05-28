import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useGameStore } from '@/stores/gameStore'
import { Icon, EmptyState } from '@/components'
import CustomTabBar from '@/custom-tab-bar'
import './index.scss'

function formatTime(ts: number): string {
  const date = new Date(ts)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  if (isToday) return `${h}:${m}`
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return '昨天'
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export default function ChatsPage() {
  const { activeSave, restoreSaves } = useGameStore()
  const save = activeSave()

  useDidShow(() => {
    Taro.eventCenter.trigger('tabChange', 0)
    restoreSaves()
  })

  const sortedGroups = save?.groups
    ? [...save.groups].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        if (a.pinned && b.pinned && a.pinnedAt && b.pinnedAt) return b.pinnedAt - a.pinnedAt
        return (b.updatedAt || 0) - (a.updatedAt || 0)
      })
    : []

  if (!save) {
    return (
      <View className='page-chats'>
        <View className='page-chats-header'>
          <Text className='page-chats-header-title'>通信</Text>
        </View>
        <View className='page-chats-empty'>
          <EmptyState
            icon={<Icon name='chat' size={64} color='var(--color-icon-disabled)' />}
            title='暂无游戏会话'
            description='请先在酒馆开始游戏'
          />
        </View>
        <CustomTabBar />
      </View>
    )
  }

  return (
    <View className='page-chats'>
        <View className='page-chats-header'>
          <Text className='page-chats-header-title'>通信</Text>
        </View>
        <ScrollView className='page-chats-list' scrollY>
          {sortedGroups.map(group => (
            <View
              key={group.id}
              className='page-chats-item'
              onClick={() => Taro.switchTab({ url: '/pages/chat/index' })}
            >
              <View className='page-chats-item-avatar'>
                <Text className='page-chats-item-avatar-text'>
                  {(group.name?.[0] || '?')}
                </Text>
              </View>
              <View className='page-chats-item-info'>
                <View className='page-chats-item-top'>
                  <Text className='page-chats-item-name'>{group.name}</Text>
                  {group.updatedAt && (
                    <Text className='page-chats-item-time'>{formatTime(group.updatedAt)}</Text>
                  )}
                </View>
                <Text className='page-chats-item-preview'>
                  {group.lastMessage || `${group.memberIds?.length ?? 0} 人参与`}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      <CustomTabBar />
    </View>
  )
}
