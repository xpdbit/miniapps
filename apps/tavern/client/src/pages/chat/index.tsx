import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useRef } from 'react'

import ChatBubble from '@/components/ChatBubble'
import { useGameStore } from '@/stores/gameStore'
import { usePrivacyStore } from '@/stores/privacyStore'
import { Icon } from '@/components'
import type { GameGroup, GameMessage } from '@/types/game'
import { cn } from '@/utils'
import { API_BASE_URL } from '@/constants'
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

function generateId(): string {
  return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6)
}

/** Get stored access token */
function getToken(): string | null {
  try { return Taro.getStorageSync('tavern_token') || null } catch { return null }
}

interface CardData {
  name: string
  description: string
  firstMsg: string
  prompt?: string
  scenario?: string
}

/** Call the SSE chat endpoint for a character and collect the AI response */
async function callAIForCharacter(
  characterId: string,
  cardData: CardData,
  userMessage: string,
  history: Array<{ role: string; content: string }>,
  onToken: (token: string) => void,
  signal: { aborted: boolean },
  gameMode?: { saveId: string; characterIds: string[] },
): Promise<string> {
  const token = getToken()
  if (!token) throw new Error('未登录')

  return new Promise<string>((resolve, reject) => {
    const task = Taro.request({
      url: `${API_BASE_URL}/chat/send`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      data: {
        characterId,
        message: userMessage,
        model: 'deepseek-chat',
        cardData: {
          name: cardData.name,
          description: cardData.description,
          firstMsg: cardData.firstMsg || '',
          prompt: cardData.prompt,
          scenario: cardData.scenario,
        },
        ...(gameMode ? { saveId: gameMode.saveId, characterIds: gameMode.characterIds } : {}),
      },
      enableChunked: true,
      timeout: 120000,
      success: () => {},
      fail: (err) => {
        reject(new Error(err.errMsg || '网络请求失败'))
      },
    })

    // Listen for chunked data
    task.onChunkReceived?.((res) => {
      if (signal.aborted) {
        task.abort()
        reject(new Error('已取消'))
        return
      }
      try {
        const text = typeof res.data === 'string' ? res.data : new TextDecoder().decode(res.data as ArrayBuffer)
        const lines = text.split('\n').filter(Boolean)
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const json = JSON.parse(line.slice(5))
            if (json.type === 'token' && json.content) {
              onToken(json.content)
            }
            if (json.type === 'done') {
              resolve('')
            }
            if (json.type === 'error') {
              reject(new Error(json.message || 'AI 响应错误'))
            }
          }
        }
      } catch {
        // Skip parse errors in streaming chunks
      }
    })
  })
}

export default function ChatPage() {
  const { saves, activeSave, addMessage, updateGroupLastMessage, setActiveSave, restoreSaves } = useGameStore()
  const { privacyMode } = usePrivacyStore()
  const [view, setView] = useState<'list' | 'chat'>('list')
  const [activeGroup, setActiveGroup] = useState<GameGroup | null>(null)
  const [input, setInput] = useState('')
  const [aiTyping, setAiTyping] = useState<string | null>(null) // character name or null
  const [searchText, setSearchText] = useState('')
  const typingRef = useRef(false)

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

  /** Get character card data from the save's selected cards */
  const getCardData = useCallback((characterId: string): CardData | null => {
    if (!save) return null
    // Try to get from localCardsStore or syncedCardsStore
    try {
      const localRaw = Taro.getStorageSync('tavern_cards')
      if (localRaw) {
        const cards = JSON.parse(localRaw)
        const card = cards.find((c: { id: string }) => c.id === characterId)
        if (card) return {
          name: card.name || '未知角色',
          description: card.description || '',
          firstMsg: card.firstMsg || '',
          prompt: card.prompt || undefined,
          scenario: card.scenario || undefined,
        }
      }
    } catch { /* ignore */ }
    return {
      name: characterId.slice(0, 8),
      description: '',
      firstMsg: '你好！',
    }
  }, [save])

  /** Trigger AI responses for all group members */
  const triggerAIResponses = useCallback(async (
    group: GameGroup,
    userMessage: string,
    historyMessages: GameMessage[],
  ) => {
    if (typingRef.current) return
    typingRef.current = true

    const recentHistory = historyMessages.slice(-20).map(m => ({
      role: m.senderId === 'player' ? 'user' as const : 'assistant' as const,
      content: m.content,
    }))

    const abortSignal = { aborted: false }
    const memberIds = group.memberIds.filter(id => id !== 'player')

    for (const memberId of memberIds) {
      if (abortSignal.aborted) break

      const cardData = getCardData(memberId)
      if (!cardData) continue

      setAiTyping(cardData.name)

      let aiContent = ''
      try {
        await callAIForCharacter(
          memberId,
          cardData,
          userMessage,
          recentHistory,
          (token) => {
            aiContent += token
            // Stream tokens to UI via temporary message update
          },
          abortSignal,
          save ? { saveId: save.id, characterIds: memberIds } : undefined,
        )
      } catch (err) {
        console.warn('[AI Group] failed for', memberId, err)
        aiContent = `[${cardData.name} 暂时不在线]`
      }

      if (aiContent.trim()) {
        const msg: GameMessage = {
          id: generateId(),
          senderId: memberId,
          senderName: cardData.name,
          content: aiContent.trim(),
          createdAt: Date.now(),
        }
        addMessage(group.id, msg)
        updateGroupLastMessage(group.id, aiContent.trim())
      }

      setAiTyping(null)
    }

    typingRef.current = false
    setAiTyping(null)
  }, [addMessage, updateGroupLastMessage, getCardData])

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || !activeGroup) return
    setInput('')
    const msg: GameMessage = {
      id: generateId(),
      senderId: 'player',
      senderName: '我',
      content: text,
      createdAt: Date.now(),
    }
    addMessage(activeGroup.id, msg)
    updateGroupLastMessage(activeGroup.id, text)

    // Trigger AI responses for all group members
    const activeGroupFull = save?.groups.find(g => g.id === activeGroup.id)
    const currentMessages = activeGroupFull?._messages || []
    const updatedMessages = [...currentMessages, msg]

    triggerAIResponses(activeGroup, text, updatedMessages)
  }, [input, activeGroup, addMessage, updateGroupLastMessage, save, triggerAIResponses])

  const handleGroupClick = (group: GameGroup) => {
    setActiveGroup(group)
    setView('chat')
  }

  const handleBack = () => {
    setView('list')
    setActiveGroup(null)
    setAiTyping(null)
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
          {privacyMode ? (
            <View className='page-chat-privacy-notice'>
              <Icon name='close' size={32} color='var(--color-warning)' />
              <Text className='page-chat-privacy-notice-text'>
                隐私模式已开启，群组/多人功能暂不可用
              </Text>
            </View>
          ) : (
            <View className='page-chat-footer-btn' onClick={() => Taro.navigateTo({ url: '/pages/scenario-select/index' })}>
              <Text className='page-chat-footer-btn-icon'>+</Text>
              <Text>开始新游戏</Text>
            </View>
          )}
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

        {/* 搜索栏 */}
        <View className='page-chat-search'>
          <Input
            className='page-chat-search-input'
            placeholder='搜索群组...'
            value={searchText}
            onInput={e => setSearchText(e.detail.value)}
          />
          {searchText && (
            <View className='page-chat-search-clear' onClick={() => setSearchText('')}>
              <Icon name='close' size={28} color='var(--color-icon-muted)' />
            </View>
          )}
        </View>

        <ScrollView className='page-chat-list' scrollY>
          {sortedGroups
            .filter(g => !searchText || g.name.includes(searchText) || g.lastMessage?.includes(searchText))
            .map(group => (
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
          <Icon name='arrow-left' size={36} color='var(--color-icon-action)' />
        </View>
        <Text className='page-chat-header-title'>{activeGroup?.name || '聊天'}</Text>
        <View className='page-chat-header-spacer' />
      </View>

      <ScrollView
        className='page-chat-messages'
        scrollY
        scrollIntoView={messages.length > 0 ? `msg-${messages[messages.length - 1]?.id}` : undefined}
      >
        <View className='page-chat-messages-inner'>
          <View className='page-chat-world-banner'>
            <Text className='page-chat-world-title'>{save.worldSetting.title}</Text>
            <Text className='page-chat-world-desc'>{save.worldSetting.description}</Text>
          </View>
          {messages.length === 0 ? (
            <View className='page-chat-empty'>
              <Text className='page-chat-empty-title'>开始对话吧</Text>
              <Text className='page-chat-empty-subtitle'>发送一条消息开启 AI 酒馆之旅</Text>
            </View>
          ) : (
            <>
              {messages.map((msg, i) => (
                <ChatBubble
                  key={msg.id}
                  role={msg.senderId === 'player' ? 'user' : 'character'}
                  content={msg.content}
                  characterName={msg.senderName}
                  timestamp={msg.createdAt}
                  avatarUrl={undefined}
                  isLast={i === messages.length - 1 && !aiTyping}
                />
              ))}
              {aiTyping && (
                <View className='page-chat-typing'>
                  <ChatBubble
                    role='character'
                    content='...'
                    characterName={aiTyping}
                    timestamp={Date.now()}
                    avatarUrl={undefined}
                    isLast={true}
                  />
                </View>
              )}
            </>
          )}
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
          disabled={!!aiTyping}
        />
        <View className='page-chat-input-actions'>
          <Text>😊</Text>
          <Text
            className={cn('page-chat-input-send', aiTyping && 'page-chat-input-send--disabled')}
            onClick={aiTyping ? undefined : handleSend}
          >
            发送
          </Text>
        </View>
      </View>
    </View>
  )
}
