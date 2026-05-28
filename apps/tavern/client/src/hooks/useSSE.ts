import { useState, useRef, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { API_BASE_URL } from '@/constants'
import { useAuthStore } from '@/stores/authStore'
import type { ChatMessage, SSEMessage } from '@/types/chat'
import type { ScriptEvent, GameWorldState } from '@/types/ai-script'

interface UseSSEOptions {
  onToken?: (token: string) => void
  onDone?: (sessionId: string) => void
  onError?: (code: string, message: string) => void
  /** AI Script: 收到事件列表时回调 */
  onEvents?: (events: ScriptEvent[]) => void
  /** AI Script: 收到状态快照时回调 */
  onState?: (state: GameWorldState) => void
}

export function useSSE(options?: UseSSEOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const abortRef = useRef<boolean>(false)

  const sendMessage = useCallback(async (params: {
    characterId: string
    personaId?: string
    message: string
    sessionId?: string
    model?: string
    provider?: string
    temperature?: number
    cardData?: {
      name?: string
      description?: string
      firstMsg?: string
      prompt?: string
      scenario?: string
    }
  }) => {
    const token = useAuthStore.getState().token
    if (!token) {
      options?.onError?.('NOT_LOGGED_IN', '请先登录')
      return
    }

    // Add user message to list
    const userMsg: ChatMessage = { role: 'user', content: params.message }
    setMessages(prev => [...prev, userMsg])

    // Add placeholder for AI response
    const aiPlaceholder: ChatMessage = { role: 'character', content: '' }
    setMessages(prev => [...prev, aiPlaceholder])
    setIsStreaming(true)
    abortRef.current = false

    let fullContent = ''
    let sessionId = params.sessionId || currentSessionId || ''

    try {
      const res = await Taro.request({
        url: `${API_BASE_URL}/chat/send`,
        method: 'POST',
        data: {
          sessionId: sessionId || undefined,
          characterId: params.characterId,
          personaId: params.personaId,
          message: params.message,
          model: params.model || 'qwen-turbo',
          provider: params.provider || 'tongyi',
          temperature: params.temperature ?? 0.8,
          cardData: params.cardData,
        },
        header: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        timeout: 120000,
        responseType: 'text',
      })

      if (res.data && typeof res.data === 'string') {
        const lines = (res.data as string).split('\n').filter(Boolean)
        for (const line of lines) {
          if (abortRef.current) break
          if (!line.startsWith('data: ')) continue

          try {
            const event: SSEMessage = JSON.parse(line.slice(6))

            switch (event.type) {
              case 'meta':
                sessionId = event.sessionId || sessionId
                setCurrentSessionId(sessionId)
                break
              case 'token':
                fullContent += event.content || ''
                setMessages(prev => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last && last.role === 'character') {
                    updated[updated.length - 1] = { ...last, content: fullContent }
                  }
                  return updated
                })
                options?.onToken?.(event.content || '')
                break
              case 'done':
                setMessages(prev => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last && last.role === 'character') {
                    updated[updated.length - 1] = {
                      ...last,
                      content: fullContent,
                      sessionId: event.sessionId,
                    }
                  }
                  return updated
                })
                setCurrentSessionId(event.sessionId || sessionId)
                setIsStreaming(false)
                options?.onDone?.(event.sessionId || sessionId)
                break
              case 'error':
                setIsStreaming(false)
                setMessages(prev => prev.slice(0, -1))
                options?.onError?.(event.code || 'UNKNOWN', event.message || '未知错误')
                break
              case 'events': {
                const ev = event as SSEMessage & { events?: ScriptEvent[] }
                if (ev.events) {
                  options?.onEvents?.(ev.events)
                }
                break
              }
              case 'state': {
                const sv = event as SSEMessage & { state?: GameWorldState }
                if (sv.state) {
                  options?.onState?.(sv.state)
                }
                break
              }
            }
          } catch {
            // ignore parse errors for individual lines
          }
        }
      }
    } catch {
      setIsStreaming(false)
      setMessages(prev => prev.slice(0, -1))
      options?.onError?.('NETWORK_ERROR', '网络连接失败')
    }
  }, [currentSessionId, options])

  const addCharacterMessage = useCallback((content: string) => {
    const charMsg: ChatMessage = { role: 'character', content }
    setMessages(prev => [...prev, charMsg])
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setCurrentSessionId(null)
  }, [])

  const stopStreaming = useCallback(() => {
    abortRef.current = true
    setIsStreaming(false)
  }, [])

  /** 移除最后一条 AI 消息（用于重新生成） */
  const removeLastAiMessage = useCallback(() => {
    setMessages(prev => {
      // 从末尾找最后一条 character 消息并移除
      for (let i = prev.length - 1; i >= 0; i--) {
        const msg = prev[i]
        if (msg && msg.role === 'character') {
          return [...prev.slice(0, i), ...prev.slice(i + 1)]
        }
      }
      return prev
    })
  }, [])

  /** 编辑指定位置的消息 */
  const editMessage = useCallback((index: number, content: string) => {
    setMessages(prev => {
      if (index < 0 || index >= prev.length) return prev
      const updated = [...prev]
      const msg = updated[index]
      if (msg) {
        updated[index] = { ...msg, content }
      }
      return updated
    })
  }, [])

  /** 软删除指定位置的消息 */
  const deleteMessage = useCallback((index: number) => {
    setMessages(prev => {
      if (index < 0 || index >= prev.length) return prev
      const updated = [...prev]
      const msg = updated[index]
      if (msg) {
        updated[index] = { ...msg, content: '[消息已删除]' }
      }
      return updated
    })
  }, [])

  return {
    messages,
    isStreaming,
    currentSessionId,
    sendMessage,
    addCharacterMessage,
    clearMessages,
    stopStreaming,
    removeLastAiMessage,
    editMessage,
    deleteMessage,
  }
}