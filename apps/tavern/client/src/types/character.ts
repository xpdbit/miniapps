export type CardType = 'CHARACTER' | 'MECHANISM' | 'MAP' | 'BACKGROUND'

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  CHARACTER: '角色',
  MECHANISM: '机制',
  MAP: '地图',
  BACKGROUND: '背景',
}

export interface CharacterCard {
  id: string
  name: string
  avatar?: string | null
  description: string
  prompt?: string
  scenario?: string
  firstMsg?: string
  tags?: string[]
  creator?: { id: string; nickname: string } | string
  likeCount?: number
  chatCount?: number
  favCount?: number
  cardType: CardType
  isOfficial: boolean
  status?: 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'BANNED'
  createdAt: string
  updatedAt: string
}

export interface LocalCard {
  id: string
  name: string
  cardType: CardType
  description: string
  prompt?: string
  scenario?: string
  firstMsg?: string
  tags?: string[]
  avatar?: string
  createdAt: number
  updatedAt: number
}

export interface CharacterPersona {
  id: string
  name: string
  description: string
  avatar: string
}