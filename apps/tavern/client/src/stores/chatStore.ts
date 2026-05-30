import { create } from 'zustand'
import Taro from '@tarojs/taro'
import { httpClient } from '@/services/httpClient'
import type { ChatSession, ChatMessage, ChoiceOption } from '@/types/chat'

const MODEL_STORAGE_KEY = 'tavern_selected_model'
const PROVIDER_STORAGE_KEY = 'tavern_selected_provider'

function loadSavedModel(): { model: string; provider: string } {
  try {
    const model = Taro.getStorageSync<string>(MODEL_STORAGE_KEY) || 'deepseek-chat'
    const provider = Taro.getStorageSync<string>(PROVIDER_STORAGE_KEY) || 'deepseek'
    return { model, provider }
  } catch {
    return { model: 'deepseek-chat', provider: 'deepseek' }
  }
}

interface ChatState {
  sessions: ChatSession[]
  currentSession: ChatSession | null
  messages: ChatMessage[]
  isStreaming: boolean
  selectedModel: string
  selectedProvider: string
  /** 用户从角色详情页点击"开始对话"时暂存的角色 ID */
  pendingCharacterId: string | null
  /** 游戏模式：AI 生成的待选行动选项 */
  pendingChoices: { summary: string; choices: ChoiceOption[] } | null

  loadSessions: () => Promise<void>
  selectSession: (session: ChatSession) => void
  addMessage: (msg: ChatMessage) => void
  updateLastMessage: (content: string) => void
  setStreaming: (v: boolean) => void
  clearCurrent: () => void
  setModel: (model: string, provider?: string) => void
  setPendingCharacter: (characterId: string | null) => void
  setPendingChoices: (data: { summary: string; choices: ChoiceOption[] } | null) => void
}

const saved = loadSavedModel()

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSession: null,
  messages: [],
  isStreaming: false,
  selectedModel: saved.model,
  selectedProvider: saved.provider,
  pendingCharacterId: null,
  pendingChoices: null,

  loadSessions: async () => {
    try {
      const res = await httpClient.get<{ data: { items: Array<{ id: string }> } }>('/chat/sessions')
      set({ sessions: res.data?.items || [] })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载会话失败'
      console.error('[chatStore] loadSessions failed:', msg)
    }
  },

  selectSession: (session) => {
    set({ currentSession: session })
  },

  addMessage: (msg) => {
    set({ messages: [...get().messages, msg] })
  },

  updateLastMessage: (content: string) => {
    const msgs = [...get().messages]
    if (msgs.length > 0) {
      const lastMsg = msgs[msgs.length - 1] as ChatMessage
      msgs[msgs.length - 1] = { ...lastMsg, content }
      set({ messages: msgs })
    }
  },

  setStreaming: (v) => set({ isStreaming: v }),
  clearCurrent: () => set({ messages: [], currentSession: null }),
  setModel: (model, provider) => {
    try {
      Taro.setStorageSync(MODEL_STORAGE_KEY, model)
      if (provider) {
        Taro.setStorageSync(PROVIDER_STORAGE_KEY, provider)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存模型选择失败'
      console.error('[chatStore] setModel persist failed:', msg)
    }
    set({ selectedModel: model, ...(provider ? { selectedProvider: provider } : {}) })
  },
  setPendingCharacter: (characterId) => {
    set({ pendingCharacterId: characterId })
  },
  setPendingChoices: (data) => {
    set({ pendingChoices: data })
  },
}))