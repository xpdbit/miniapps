import { View, Text, ScrollView, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useRef, useEffect, useCallback } from 'react'

import ChatBubble from '@/components/ChatBubble'
import ModelSelector from '@/components/ModelSelector'
import { useSSE } from '@/hooks/useSSE'
import { useChatStore } from '@/stores/chatStore'
import { useSyncedCardsStore } from '@/stores/syncedCardsStore'
import { useLocalCardsStore } from '@/stores/localCardsStore'
import type { CharacterCard, LocalCard, CardType } from '@/types/character'
import { CARD_TYPE_LABELS } from '@/types/character'
import { Icon } from '@/components'
import './index.scss'

type CardItem = CharacterCard | LocalCard

interface SelectableCard {
  id: string
  name: string
  description: string
  avatar?: string | null
  firstMsg?: string
  personality?: string
  scenario?: string
  lore?: string
  tags?: string[]
  cardType: CardType
  isOfficial: boolean
}

export default function ChatPage() {
  const { sessions, loadSessions } = useChatStore()
  const { messages, isStreaming, sendMessage, clearMessages } = useSSE()
  const [input, setInput] = useState('')
  const [showSessions, setShowSessions] = useState(false)
  const [selectedCard, setSelectedCard] = useState<SelectableCard | null>(null)
  const [, setLoadingCards] = useState(false)
  const [scrollIntoViewId, setScrollIntoViewId] = useState('')
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const syncedStore = useSyncedCardsStore()
  const localStore = useLocalCardsStore()

  useDidShow(() => {
    loadSessions()
    Taro.eventCenter.trigger('tabChange', 1)
    Taro.eventCenter.trigger('tavernSubTab', 'main')
    // 确保卡片数据已加载
    syncedStore.restoreFromStorage()
    localStore.restoreFromStorage()
    // 触发同步
    syncedStore.syncCards()
  })

  // 合并所有可用卡片（官方 + 本地）
  const allCards: SelectableCard[] = [
    ...syncedStore.cards.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description || '',
      avatar: c.avatar,
      firstMsg: c.firstMsg,
      personality: c.personality,
      scenario: c.scenario,
      lore: c.lore,
      tags: c.tags,
      cardType: c.cardType || 'CHARACTER',
      isOfficial: true,
    })),
    ...localStore.cards.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description || '',
      avatar: c.avatar,
      firstMsg: c.firstMsg,
      personality: c.personality,
      scenario: c.scenario,
      lore: c.lore,
      tags: c.tags,
      cardType: c.cardType || 'CHARACTER',
      isOfficial: false,
    })),
  ]

  useEffect(() => {
    if (messages.length > 0) {
      clearTimeout(scrollTimerRef.current)
      setScrollIntoViewId('chat-bottom-anchor')
      scrollTimerRef.current = setTimeout(() => setScrollIntoViewId(''), 300)
    }
    return () => clearTimeout(scrollTimerRef.current)
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isStreaming || !selectedCard) return
    setInput('')

    await sendMessage({
      characterId: selectedCard.id,
      message: text,
      model: useChatStore.getState().selectedModel,
      cardData: selectedCard.isOfficial ? undefined : {
        name: selectedCard.name,
        description: selectedCard.description,
        firstMsg: selectedCard.firstMsg,
        personality: selectedCard.personality,
        scenario: selectedCard.scenario,
        lore: selectedCard.lore,
      },
    })
  }

  const handleSelectCharacter = (card: SelectableCard) => {
    setSelectedCard(card)
    clearMessages()
  }

  const handleCreateCharacter = () => {
    Taro.navigateTo({ url: '/pages/creator/index' })
  }

  const handleSessionClick = () => {
    setShowSessions(false)
  }

  return (
    <View className='page-chat'>
      {/* Header */}
      <View className='page-chat-header'>
        <View className='page-chat-header-icon' onClick={() => setShowSessions(true)}>
          <Icon name='menu' size={44} color='#666' />
        </View>
        <Text className='page-chat-header-title'>AI 酒馆</Text>
        <View className='page-chat-header-icon' onClick={() => Taro.navigateTo({ url: '/pages/settings/index' })}>
          <Icon name='settings' size={44} color='#666' />
        </View>
      </View>

      {/* 模型选择器 */}
      <ModelSelector />

      {/* Character card selector */}
      <View className='page-chat-selector'>
        <ScrollView
          className='page-chat-selector-scroll'
          scrollX
          scrollWithAnimation
          enableFlex
        >
          {allCards.map((card) => (
            <View
              key={card.id}
              className={`page-chat-card ${selectedCard?.id === card.id ? 'page-chat-card--active' : ''}`}
              onClick={() => handleSelectCharacter(card)}
            >
              <View className='page-chat-card-avatar'>
                {card.avatar ? (
                  <View className='page-chat-card-avatar-img' style={{ backgroundImage: `url(${card.avatar})` }} />
                ) : (
                  <Text className='page-chat-card-avatar-text'>{card.name.charAt(0)}</Text>
                )}
              </View>
              <Text className='page-chat-card-name'>{card.name}</Text>
              <Text className='page-chat-card-type'>{CARD_TYPE_LABELS[card.cardType] || card.cardType}</Text>
            </View>
          ))}
          {/* Create character card */}
          <View className='page-chat-card page-chat-card--create' onClick={handleCreateCharacter}>
            <View className='page-chat-card-avatar page-chat-card-avatar--plus'>
              <Text className='page-chat-card-avatar-plus'>+</Text>
            </View>
            <Text className='page-chat-card-name'>创建角色</Text>
          </View>
        </ScrollView>
      </View>

      {/* Messages */}
      <ScrollView
        className='page-chat-messages'
        scrollY
        scrollWithAnimation
        scrollIntoView={scrollIntoViewId}
      >
        <View className='page-chat-messages-inner'>
          {!selectedCard && (
            <View className='page-chat-empty'>
              <Text className='page-chat-empty-title'>选择一位角色开始对话</Text>
              <Text className='page-chat-empty-desc'>从上方选择角色，或创建新角色</Text>
            </View>
          )}
          {selectedCard && messages.length === 0 && (
            <View className='page-chat-welcome'>
              <Text className='page-chat-welcome-name'>{selectedCard.name}</Text>
              <Text className='page-chat-welcome-msg'>{selectedCard.firstMsg || '你好！让我们开始对话吧。'}</Text>
            </View>
          )}
          {messages.map((msg, i) => (
            <ChatBubble
              key={i}
              role={msg.role as 'user' | 'character'}
              content={msg.content}
              isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'character' && !msg.id}
            />
          ))}
          <View id='chat-bottom-anchor' />
        </View>
      </ScrollView>

      {/* Input area */}
      <View className='page-chat-input-area'>
        <Input
          className='page-chat-input'
          value={input}
          onInput={(e) => setInput(e.detail.value)}
          placeholder={selectedCard ? '输入消息...' : '请先选择角色'}
          disabled={isStreaming || !selectedCard}
        />
        <Button
          className='page-chat-send-btn'
          onClick={isStreaming || !selectedCard ? undefined : handleSend}
        >
          {isStreaming ? '...' : '发送'}
        </Button>
      </View>

      {/* Session list panel */}
      {showSessions && (
        <View className='page-chat-overlay' onClick={() => setShowSessions(false)}>
          <View className='page-chat-sessions' onClick={(e) => e.stopPropagation()}>
            <Text className='page-chat-sessions-title'>历史会话</Text>
            {sessions.map((s) => (
              <View key={s.id} className='page-chat-session-item' onClick={() => handleSessionClick()}>
                <Text className='page-chat-session-name'>{s.characterName || '对话'}</Text>
                <Text className='page-chat-session-preview'>{s.lastMessage || ''}</Text>
              </View>
            ))}
            {sessions.length === 0 && (
              <Text className='page-chat-sessions-empty'>暂无历史会话</Text>
            )}
          </View>
        </View>
      )}
    </View>
  )
}
