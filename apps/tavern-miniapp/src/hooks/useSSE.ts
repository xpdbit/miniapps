import { useState, useRef, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { API_BASE_URL } from '@/constants'
import { useAuthStore } from '@/stores/authStore'
import type { ChatMessage, SSEMessage } from '@/types/chat'

interface UseSSEOptions {
  onToken?: (token: string) => void
  onDone?: (sessionId: string) => void
  onError?: (code: string, message: string) => void
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
    temperature?: number
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
          model: params.model || 'tongyi',
          temperature: params.temperature ?? 0.8,
        },
        header: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        timeout: 120000,
        enableChunked: true,
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
                // Remove the placeholder AI message on error
                setMessages(prev => prev.slice(0, -1))
                options?.onError?.(event.code || 'UNKNOWN', event.message || '未知错误')
                break
            }
          } catch {
            // ignore parse errors for individual lines
          }
        }
      }
    } catch (err: any) {
      setIsStreaming(false)
      setMessages(prev => prev.slice(0, -1))
      options?.onError?.('NETWORK_ERROR', '网络连接失败')
    }
  }, [currentSessionId, options])

  const clearMessages = useCallback(() => {
    setMessages([])
    setCurrentSessionId(null)
  }, [])

  const stopStreaming = useCallback(() => {
    abortRef.current = true
    setIsStreaming(false)
  }, [])

  return {
    messages,
    isStreaming,
    currentSessionId,
    sendMessage,
    clearMessages,
    stopStreaming,
  }
}