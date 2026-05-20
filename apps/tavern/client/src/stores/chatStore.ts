import { create } from 'zustand'
import Taro from '@tarojs/taro'
import { httpClient } from '@/services/httpClient'
import type { ChatSession, ChatMessage } from '@/types/chat'

const MODEL_STORAGE_KEY = 'tavern_selected_model'

function loadSavedModel(): string {
  try {
    return Taro.getStorageSync<string>(MODEL_STORAGE_KEY) || 'qwen-turbo'
  } catch {
    return 'qwen-turbo'
  }
}

interface ChatState {
  sessions: ChatSession[]
  currentSession: ChatSession | null
  messages: ChatMessage[]
  isStreaming: boolean
  selectedModel: string

  loadSessions: () => Promise<void>
  selectSession: (session: ChatSession) => void
  addMessage: (msg: ChatMessage) => void
  updateLastMessage: (content: string) => void
  setStreaming: (v: boolean) => void
  clearCurrent: () => void
  setModel: (model: string) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSession: null,
  messages: [],
  isStreaming: false,
  selectedModel: loadSavedModel(),

  loadSessions: async () => {
    try {
      const res = await httpClient.get<{ data: { items: Array<{ id: string }> } }>('/chat/sessions')
      set({ sessions: res.data?.items || [] })
    } catch {
      // ignore
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
  setModel: (model) => {
    try {
      Taro.setStorageSync(MODEL_STORAGE_KEY, model)
    } catch {
      // ignore
    }
    set({ selectedModel: model })
  },
}))