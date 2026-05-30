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

/** AI 生成的行动选项 */
export interface ChoiceOption {
  label: string          // "支持扎营休息"
  description: string    // "帮忙搭建营地，照顾弗罗多的伤势"
}

export interface SSEMessage {
  type: 'meta' | 'token' | 'done' | 'error' | 'events' | 'state' | 'choice'
  sessionId?: string
  characterId?: string
  content?: string
  messageId?: string
  tokens?: number
  code?: string
  message?: string
  events?: Array<{ type: string; payload: Record<string, unknown> }>
  state?: Record<string, unknown>
  /** choice 事件专用：当前局面总结 */
  summary?: string
  /** choice 事件专用：可选行动列表 */
  choices?: ChoiceOption[]
}