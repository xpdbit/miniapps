export interface ChatMessage {
  id?: string
  sessionId?: string
  role: 'user' | 'character' | 'system'
  content: string
  tokens?: number
  createdAt?: string
}

export interface ChatSession {
  id: string
  characterName?: string
  characterAvatar?: string
  lastMessage?: string
  messageCount?: number
  title?: string
  updatedAt?: string
  pinned?: boolean
  pinnedAt?: number
  isGroup?: boolean
  memberIds?: string[]
}

export interface SSEMessage {
  type: 'meta' | 'token' | 'done' | 'error'
  sessionId?: string
  characterId?: string
  content?: string
  messageId?: string
  tokens?: number
  code?: string
  message?: string
}