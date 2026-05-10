import { create } from 'zustand'
import { httpClient } from '@/services/httpClient'
import type { ChatSession, ChatMessage } from '@/types/chat'

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
  selectedModel: 'tongyi',

  loadSessions: async () => {
    try {
      const res: any = await httpClient.get('/chat/sessions')
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
  setModel: (model) => set({ selectedModel: model }),
}))