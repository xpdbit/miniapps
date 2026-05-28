import { useState, useRef, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { PROVIDER_CONFIGS } from '@/services/aiClient'
import type { AiProvider } from '@/services/aiClient'
import type { ChatMessage } from '@/types/chat'

const LOCAL_CHAT_HISTORY_KEY = 'tavern_local_chat'

interface UseDirectAIOptions {
  onToken?: (token: string) => void
  onDone?: (fullContent: string, tokens?: number) => void
  onError?: (code: string, message: string) => void
}

/** 检查 provider 是否受直连模式支持 */
function isSupportedProvider(provider: string): provider is AiProvider {
  return provider in PROVIDER_CONFIGS
}

/**
 * 直连 AI API 的聊天 Hook（隐私模式专用）
 *
 * 跳过服务端中转，从小程序/H5 直接调用 AI Provider API。
 * 支持 OpenAI 兼容格式（Tongyi/DeepSeek/Zhipu/Moonshot/MiniMax/OpenAI/OpenCode）
 * 和 Anthropic Messages API 的流式响应。
 * 代价：只能使用自己的 API Key，且仅支持单人模式。
 */
export function useDirectAI(options?: UseDirectAIOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const abortRef = useRef<boolean>(false)

  const sendMessage = useCallback(
    async (params: {
      characterId: string
      personaId?: string
      message: string
      sessionId?: string
      apiKey: string
      provider: string
      baseUrl?: string
      model?: string
      temperature?: number
      cardData?: {
        name?: string
        description?: string
        firstMsg?: string
        prompt?: string
        scenario?: string
      }
      personaData?: {
        name?: string
        description?: string
      }
    }) => {
      const { apiKey } = params
      if (!apiKey) {
        options?.onError?.('KEY_MISSING', '隐私模式下需要配置 API Key')
        return
      }

      if (!isSupportedProvider(params.provider)) {
        options?.onError?.(
          'UNKNOWN_PROVIDER',
          `不支持的服务商: ${params.provider}。隐私模式仅支持: ${Object.keys(PROVIDER_CONFIGS).join(', ')}`,
        )
        return
      }

      // 添加用户消息 + 持久化
      const userMsg: ChatMessage = { role: 'user', content: params.message }
      const withUser = [...messages, userMsg]
      setMessages(withUser)
      persistMessages(params.characterId, withUser)

      // 添加 AI 占位消息
      const aiPlaceholder: ChatMessage = { role: 'character', content: '' }
      setMessages((prev) => [...prev, aiPlaceholder])
      setIsStreaming(true)
      abortRef.current = false

      // 构建系统提示词
      const systemPrompt = buildSystemPrompt(params.cardData, params.personaData)

      const chatMessages: Array<{ role: string; content: string }> = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: params.message },
      ]

      // 使用自定义 baseUrl 或 fallback 到默认配置
      const providerCfg = PROVIDER_CONFIGS[params.provider as AiProvider]
      const requestUrl = params.baseUrl || providerCfg.baseUrl
      const model = params.model || providerCfg.defaultModel

      let fullContent = ''

      try {
        if (params.provider === 'anthropic') {
          await streamAnthropic(requestUrl, apiKey, model, chatMessages, {
            onToken: (token) => {
              if (abortRef.current) return
              fullContent += token
              updateLastMessage(fullContent)
              options?.onToken?.(token)
            },
            onDone: () => finishStream(fullContent),
            onError: (err) => handleStreamError(err),
          })
        } else {
          await streamOpenAICompatible(requestUrl, apiKey, model, chatMessages, params.temperature, {
            onToken: (token) => {
              if (abortRef.current) return
              fullContent += token
              updateLastMessage(fullContent)
              options?.onToken?.(token)
            },
            onDone: () => finishStream(fullContent),
            onError: (err) => handleStreamError(err),
          })
        }
      } catch (err: unknown) {
        handleStreamError(err)
      }

      function updateLastMessage(content: string) {
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.role === 'character') {
            updated[updated.length - 1] = { ...last, content }
          }
          return updated
        })
      }

      function finishStream(content: string) {
        const sessionId =
          params.sessionId || currentSessionId || `direct_${params.characterId}_${Date.now().toString(36)}`
        setCurrentSessionId(sessionId)
        setIsStreaming(false)

        // 持久化完成的对话
        setMessages((prev) => {
          persistMessages(params.characterId, prev)
          return prev
        })

        const estimatedTokens = Math.ceil(content.length * 0.5)
        options?.onDone?.(content, estimatedTokens)
      }

      function handleStreamError(err: unknown) {
        if (abortRef.current) return
        setIsStreaming(false)
        setMessages((prev) => {
          const cleaned = prev.slice(0, -1)
          persistMessages(params.characterId, cleaned)
          return cleaned
        })
        const msg = err instanceof Error ? err.message : '网络连接失败'
        options?.onError?.('NETWORK_ERROR', `直连 AI 失败: ${msg}`)
      }
    },
    [currentSessionId, messages, options],
  )

  const addCharacterMessage = useCallback((content: string) => {
    const charMsg: ChatMessage = { role: 'character', content }
    setMessages(prev => [...prev, charMsg])
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setCurrentSessionId(null)
  }, [])

  /** 从本地存储恢复对话历史 */
  const loadHistory = useCallback((characterId: string) => {
    const saved = loadLocalMessages(characterId)
    if (saved.length > 0) {
      setMessages(saved)
      // 恢复 sessionId（从最新消息推断）
      const lastMsg = saved[saved.length - 1]
      if (lastMsg?.sessionId) {
        setCurrentSessionId(lastMsg.sessionId)
      }
    }
  }, [])

  const stopStreaming = useCallback(() => {
    abortRef.current = true
    setIsStreaming(false)
  }, [])

  /** 移除最后一条 AI 消息（用于重新生成） */
  const removeLastAiMessage = useCallback(() => {
    setMessages(prev => {
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
    loadHistory,
    stopStreaming,
    removeLastAiMessage,
    editMessage,
    deleteMessage,
  }
}

/* ================================================================
 *  OpenAI 兼容格式流式请求
 *  (Tongyi, DeepSeek, OpenAI, Zhipu, Moonshot, MiniMax, OpenCode)
 * ================================================================ */
async function streamOpenAICompatible(
  url: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number | undefined,
  handlers: { onToken: (t: string) => void; onDone: () => void; onError: (e: unknown) => void },
): Promise<void> {
  try {
    const res = await Taro.request({
      url,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      data: {
        model,
        messages,
        temperature: temperature ?? 0.8,
        max_tokens: 4096,
        stream: true,
      },
      timeout: 120000,
      responseType: 'text',
    })

    if (res.data && typeof res.data === 'string') {
      const lines = (res.data as string).split('\n').filter(Boolean)
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          const token = parsed?.choices?.[0]?.delta?.content
          if (token) handlers.onToken(token)
        } catch {
          // skip unparseable
        }
      }
    }
    handlers.onDone()
  } catch (err) {
    handlers.onError(err)
  }
}

/* ================================================================
 *  Anthropic Messages API 流式请求
 *
 *  格式: event: content_block_delta
 *        data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}
 * ================================================================ */
async function streamAnthropic(
  url: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  handlers: { onToken: (t: string) => void; onDone: () => void; onError: (e: unknown) => void },
): Promise<void> {
  // Anthropic 要求 system 作为顶层字段
  const systemMsg = messages.find((m) => m.role === 'system')
  const nonSystem = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))

  try {
    const res = await Taro.request({
      url,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      data: {
        model,
        max_tokens: 4096,
        system: systemMsg?.content || undefined,
        messages: nonSystem,
        stream: true,
      },
      timeout: 120000,
      responseType: 'text',
    })

    if (res.data && typeof res.data === 'string') {
      const rawText = res.data as string
      // Anthropic SSE 以双换行分隔 event+data 对
      const blocks = rawText.split('\n\n').filter(Boolean)

      for (const block of blocks) {
        const lines = block.split('\n')
        let eventType = ''
        let eventData = ''

        for (const line of lines) {
          if (line.startsWith('event: ')) eventType = line.slice(7).trim()
          else if (line.startsWith('data: ')) eventData = line.slice(6).trim()
        }

        if (eventType === 'content_block_delta' && eventData) {
          try {
            const parsed = JSON.parse(eventData)
            const text = parsed?.delta?.text
            if (text) handlers.onToken(text)
          } catch {
            // skip
          }
        }
      }
    }
    handlers.onDone()
  } catch (err) {
    handlers.onError(err)
  }
}

/* ================================================================
 *  本地系统提示词构建
 * ================================================================ */
function buildSystemPrompt(
  cardData?: { name?: string; description?: string; firstMsg?: string; prompt?: string; scenario?: string },
  personaData?: { name?: string; description?: string },
): string {
  const parts: string[] = ['你正在扮演以下角色，请严格按照设定进行回复。']
  if (cardData?.name) parts.push(`\n【角色名称】${cardData.name}`)
  if (cardData?.description) parts.push(`【角色描述】${cardData.description}`)
  if (cardData?.prompt) parts.push(`【对话提示】${cardData.prompt}`)
  if (cardData?.scenario) parts.push(`【场景设定】${cardData.scenario}`)
  if (cardData?.firstMsg) parts.push(`【开场白示例】${cardData.firstMsg}`)
  if (personaData?.name) {
    parts.push(`\n【用户人设】${personaData.name}`)
    if (personaData?.description) parts.push(`人设描述：${personaData.description}`)
  }
  parts.push('\n请用自然、符合角色设定的语气回复。')
  parts.push('仅返回角色回复的内容，不要包含任何标记或格式。')
  return parts.join('\n')
}

/* ================================================================
 *  本地对话持久化
 * ================================================================ */
function persistMessages(characterId: string, msgs: ChatMessage[]): void {
  try {
    Taro.setStorageSync(`${LOCAL_CHAT_HISTORY_KEY}_${characterId}`, msgs)
  } catch {
    // 静默忽略
  }
}

/** 从本地存储恢复对话 */
export function loadLocalMessages(characterId: string): ChatMessage[] {
  try {
    const data = Taro.getStorageSync<ChatMessage[]>(`${LOCAL_CHAT_HISTORY_KEY}_${characterId}`)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}
