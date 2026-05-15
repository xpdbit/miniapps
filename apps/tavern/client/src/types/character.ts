export interface CharacterCard {
  id: string
  name: string
  avatar?: string | null
  description: string
  personality?: string
  scenario?: string
  firstMsg?: string
  lore?: string
  tags?: string[]
  creator?: string
  likes: number
  chats: number
  rating: number
  status?: 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'BANNED'
  createdAt: number
  updatedAt: number
}

export interface CharacterPersona {
  id: string
  name: string
  description: string
  avatar: string
}