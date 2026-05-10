import { View, Text, Input, ScrollView, Button } from '@tarojs/components'
import { useDidShow, useRouter } from '@tarojs/taro'
import { useState, useRef, useEffect, useCallback } from 'react'
import Taro from '@tarojs/taro'
import ChatBubble from '@/components/ChatBubble'
import { useSSE } from '@/hooks/useSSE'
import { useChatStore } from '@/stores/chatStore'
import { httpClient } from '@/services/httpClient'
import type { CharacterCard } from '@/types/character'
import './index.scss'

interface BuiltinCharacter {
  id: string
  name: string
  avatar: string | null
  description: string
  personality: string | null
  firstMsg: string
  scenario: string | null
  tags: string[]
  chatCount: number
  likeCount: number
}

export default function ChatPage() {
  const router = useRouter()
  const { sessions, loadSessions } = useChatStore()
  const { messages, isStreaming, sendMessage, clearMessages } = useSSE()
  const [input, setInput] = useState('')
  const [showSessions, setShowSessions] = useState(false)
  const [characters, setCharacters] = useState<BuiltinCharacter[]>([])
  const [selectedCharacter, setSelectedCharacter] = useState<BuiltinCharacter | null>(null)
  const [loadingBuiltin, setLoadingBuiltin] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const cardScrollRef = useRef<HTMLDivElement | null>(null)

  useDidShow(() => {
    loadSessions()
    loadBuiltinCharacters()
  })

  // Load built-in characters from API
  const loadBuiltinCharacters = useCallback(async () => {
    setLoadingBuiltin(true)
    try {
      const res = await httpClient.get<{ code: number; data: BuiltinCharacter[]; message: string }>('/builtin/characters')
      if (res.code === 0 && res.data) {
        setCharacters(res.data)
      }
    } catch {
      // ignore
    } finally {
      setLoadingBuiltin(false)
    }
  }, [])

  useEffect(() => {
    // Auto scroll to bottom on new messages
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: 99999 })
    }, 100)
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isStreaming || !selectedCharacter) return
    setInput('')

    await sendMessage({
      characterId: selectedCharacter.id,
      message: text,
      model: useChatStore.getState().selectedModel,
    })
  }

  const handleSelectCharacter = (char: BuiltinCharacter) => {
    setSelectedCharacter(char)
    clearMessages()
  }

  const handleCreateCharacter = () => {
    Taro.navigateTo({ url: '/pages/creator/index' })
  }

  const handleSessionClick = (session: typeof sessions[0]) => {
    // For now just close the panel
    setShowSessions(false)
  }

  return (
    <View className='page-chat'>
      {/* Header */}
      <View className='page-chat-header'>
        <Text className='page-chat-header-icon' onClick={() => setShowSessions(true)}>☰</Text>
        <Text className='page-chat-header-title'>AI 酒馆</Text>
        <Text className='page-chat-header-icon' onClick={() => Taro.navigateTo({ url: '/pages/settings/index' })}>⚙</Text>
      </View>

      {/* Character card selector */}
      <View className='page-chat-selector'>
        <ScrollView
          className='page-chat-selector-scroll'
          scrollX
          scrollWithAnimation
          ref={cardScrollRef as any}
        >
          {characters.map((char) => (
            <View
              key={char.id}
              className={`page-chat-card ${selectedCharacter?.id === char.id ? 'page-chat-card--active' : ''}`}
              onClick={() => handleSelectCharacter(char)}
            >
              <View className='page-chat-card-avatar'>
                {char.avatar ? (
                  <View className='page-chat-card-avatar-img' style={{ backgroundImage: `url(${char.avatar})` }} />
                ) : (
                  <Text className='page-chat-card-avatar-text'>{char.name.charAt(0)}</Text>
                )}
              </View>
              <Text className='page-chat-card-name'>{char.name}</Text>
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
        ref={scrollRef as any}
      >
        {!selectedCharacter && (
          <View className='page-chat-empty'>
            <Text className='page-chat-empty-title'>选择一位角色开始对话</Text>
            <Text className='page-chat-empty-desc'>向左滑动选择内置角色，或创建新角色</Text>
          </View>
        )}
        {selectedCharacter && messages.length === 0 && (
          <View className='page-chat-welcome'>
            <Text className='page-chat-welcome-name'>{selectedCharacter.name}</Text>
            <Text className='page-chat-welcome-msg'>{selectedCharacter.firstMsg}</Text>
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
      </ScrollView>

      {/* Input area */}
      <View className='page-chat-input-area'>
        <Input
          className='page-chat-input'
          value={input}
          onInput={(e) => setInput(e.detail.value)}
          placeholder={selectedCharacter ? '输入消息...' : '请先选择角色'}
          confirmType='send'
          onConfirm={handleSend}
          disabled={isStreaming || !selectedCharacter}
        />
        <Button
          className='page-chat-send-btn'
          onClick={isStreaming || !selectedCharacter ? undefined : handleSend}
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
              <View key={s.id} className='page-chat-session-item' onClick={() => handleSessionClick(s)}>
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