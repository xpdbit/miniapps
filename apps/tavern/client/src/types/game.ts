export interface GameSave {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  playerCount: number
  schemaVersion?: number           // 数据结构版本号，用于兼容迁移
  userPersonaId?: string           // 用户在游戏中的角色化身 ID
  selectedCards: {
    characters: string[]
    mechanics: string[]
    maps: string[]
    backgrounds: string[]
  }
  worldSetting: {
    title: string
    description: string
    rules: string[]
  }
  groups: GameGroup[]
}

export interface GameGroup {
  id: string
  name: string
  memberIds: string[]
  isGroup: true
  lastMessage?: string
  updatedAt?: number
  pinned: boolean
  pinnedAt?: number
  _messages?: GameMessage[]
}

export interface GameMessage {
  id: string
  senderId: string
  senderName: string
  content: string
  createdAt: number
}