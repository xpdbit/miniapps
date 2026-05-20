import { View, Text, ScrollView, Input, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'

import ChatBubble from '@/components/ChatBubble'
import { useGameStore } from '@/stores/gameStore'
import { Icon } from '@/components'
import type { GameGroup, GameMessage } from '@/types/game'
import { cn } from '@/utils'
import './index.scss'

function formatGroupTime(ts: number): string {
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

export default function ChatPage() {
  const { saves, activeSave, addMessage, updateGroupLastMessage, setActiveSave, restoreSaves } = useGameStore()
  const [view, setView] = useState<'list' | 'chat'>('list')
  const [activeGroup, setActiveGroup] = useState<GameGroup | null>(null)
  const [input, setInput] = useState('')

  const save = activeSave()

  useDidShow(() => {
    Taro.eventCenter.trigger('tabChange', 1)
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

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || !activeGroup) return
    setInput('')
    const msg: GameMessage = {
      id: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      senderId: 'player',
      senderName: '我',
      content: text,
      createdAt: Date.now(),
    }
    addMessage(activeGroup.id, msg)
    updateGroupLastMessage(activeGroup.id, text)
  }, [input, activeGroup, addMessage, updateGroupLastMessage])

  const handleGroupClick = (group: GameGroup) => {
    setActiveGroup(group)
    setView('chat')
  }

  const handleBack = () => {
    setView('list')
    setActiveGroup(null)
  }

  if (!save) {
    return (
      <View className='page-chat'>
        <View className='page-chat-list-header'>
          <Text className='page-chat-list-header-title'>AI 酒馆</Text>
        </View>

        {saves.length > 0 ? (
          <ScrollView className='page-chat-saves-list' scrollY>
            {saves.map(saveItem => (
              <View
                key={saveItem.id}
                className='page-chat-saves-item'
                onClick={() => setActiveSave(saveItem.id)}
              >
                <View className='page-chat-saves-item-icon'>
                  <Text className='page-chat-saves-item-icon-text'>🎮</Text>
                </View>
                <View className='page-chat-saves-item-info'>
                  <Text className='page-chat-saves-item-name'>{saveItem.name}</Text>
                  <Text className='page-chat-saves-item-meta'>
                    {saveItem.playerCount} 人 · {new Date(saveItem.updatedAt).toLocaleDateString('zh-CN')}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View className='page-chat-empty-saves'>
            <Text className='page-chat-empty-title'>暂无游戏会话</Text>
            <Text className='page-chat-empty-subtitle'>点击下方按钮开始新游戏</Text>
          </View>
        )}

        <View className='page-chat-footer'>
          <View className='page-chat-footer-btn' onClick={() => Taro.navigateTo({ url: '/pages/game-setup/index' })}>
            <Text className='page-chat-footer-btn-icon'>+</Text>
            <Text>开始新游戏</Text>
          </View>
        </View>
      </View>
    )
  }

  // State A: Conversation List
  if (view === 'list') {
    return (
      <View className='page-chat'>
        <View className='page-chat-list-header'>
          <Text className='page-chat-list-header-title'>AI 酒馆</Text>
          <View className='page-chat-list-header-actions'>
            <Text className='page-chat-list-header-btn' onClick={() => Taro.navigateTo({ url: '/pages/archive/index' })}>
              存档
            </Text>
          </View>
        </View>

        <ScrollView className='page-chat-list' scrollY>
          {sortedGroups.map(group => (
            <View
              key={group.id}
              className={cn('page-chat-list-item', group.pinned && 'page-chat-list-item--pinned')}
              onClick={() => handleGroupClick(group)}
            >
              <View className='page-chat-list-item-avatar'>
                <Text className='page-chat-list-item-avatar-text'>{(group.name?.[0] || '?')}</Text>
              </View>
              <View className='page-chat-list-item-info'>
                <View className='page-chat-list-item-top'>
                  <Text className='page-chat-list-item-name'>{group.name}</Text>
                  {group.updatedAt && (
                    <Text className='page-chat-list-item-time'>
                      {formatGroupTime(group.updatedAt)}
                    </Text>
                  )}
                </View>
                <Text className='page-chat-list-item-preview'>
                  {group.memberIds.length > 1 ? `${group.memberIds.length} 人参与` : group.lastMessage || ''}
                </Text>
              </View>
              {group.pinned && <Text className='page-chat-list-item-pin'>📌</Text>}
            </View>
          ))}
        </ScrollView>
      </View>
    )
  }

  // State B: Chat View
  const activeGroupFull = save.groups.find(g => g.id === activeGroup?.id) || activeGroup
  const messages: GameMessage[] = activeGroupFull?._messages || []

  return (
    <View className='page-chat'>
      <View className='page-chat-header'>
        <View className='page-chat-header-back' onClick={handleBack}>
          <Icon name='arrow-left' size={36} color='#007AFF' />
        </View>
        <Text className='page-chat-header-title'>{activeGroup?.name || '聊天'}</Text>
        <View className='page-chat-header-spacer' />
      </View>

      <ScrollView className='page-chat-messages' scrollY>
        <View className='page-chat-messages-inner'>
          <View className='page-chat-world-banner'>
            <Text className='page-chat-world-title'>{save.worldSetting.title}</Text>
            <Text className='page-chat-world-desc'>{save.worldSetting.description}</Text>
          </View>
          {messages.map((msg, i) => (
            <ChatBubble
              key={msg.id}
              role={msg.senderId === 'player' ? 'user' : 'character'}
              content={msg.content}
              characterName={msg.senderName}
              timestamp={msg.createdAt}
              avatarUrl={undefined}
              isLast={i === messages.length - 1}
            />
          ))}
        </View>
      </ScrollView>

      <View className='page-chat-input'>
        <View className='page-chat-input-voice'>
          <Text>🎤</Text>
        </View>
        <Input
          className='page-chat-input-field'
          value={input}
          onInput={e => setInput(e.detail.value)}
          placeholder='输入消息...'
          onConfirm={handleSend}
        />
        <View className='page-chat-input-actions'>
          <Text>😊</Text>
          <Text className='page-chat-input-send' onClick={handleSend}>发送</Text>
        </View>
      </View>
    </View>
  )
}
