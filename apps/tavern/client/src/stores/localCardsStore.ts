/**
 * localCardsStore — 用户本地创建的卡片（不存服务器，仅本地）
 * 使用 Taro Storage 持久化
 */
import { create } from 'zustand'
import Taro from '@tarojs/taro'
import type { LocalCard, CardType } from '@/types/character'

const STORAGE_KEY = 'tavern_local_cards'

function generateId(): string {
  return 'local_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

interface LocalCardsState {
  cards: LocalCard[]

  /** 获取所有本地卡片 */
  getAllCards: () => LocalCard[]

  /** 按类型获取卡片 */
  getCardsByType: (cardType: CardType) => LocalCard[]

  /** 获取单张卡片 */
  getCardById: (id: string) => LocalCard | undefined

  /** 创建本地卡片 */
  createCard: (data: Omit<LocalCard, 'id' | 'createdAt' | 'updatedAt'>) => LocalCard

  /** 更新本地卡片 */
  updateCard: (id: string, data: Partial<LocalCard>) => void

  /** 删除本地卡片 */
  deleteCard: (id: string) => void

  /** 从本地存储恢复 */
  restoreFromStorage: () => void
}

function persist(cards: LocalCard[]) {
  try {
    Taro.setStorageSync(STORAGE_KEY, cards)
  } catch {
    // 静默处理
  }
}

export const useLocalCardsStore = create<LocalCardsState>((set, get) => ({
  cards: [],

  getAllCards: () => get().cards,

  getCardsByType: (cardType: CardType) => {
    return get().cards.filter(c => c.cardType === cardType)
  },

  getCardById: (id: string) => {
    return get().cards.find(c => c.id === id)
  },

  createCard: (data) => {
    const now = Date.now()
    const card: LocalCard = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    }
    const newCards = [card, ...get().cards]
    set({ cards: newCards })
    persist(newCards)
    return card
  },

  updateCard: (id, data) => {
    const newCards = get().cards.map(c =>
      c.id === id ? { ...c, ...data, updatedAt: Date.now() } : c
    )
    set({ cards: newCards })
    persist(newCards)
  },

  deleteCard: (id) => {
    const newCards = get().cards.filter(c => c.id !== id)
    set({ cards: newCards })
    persist(newCards)
  },

  restoreFromStorage: () => {
    try {
      const stored = Taro.getStorageSync(STORAGE_KEY)
      if (stored && Array.isArray(stored) && stored.length > 0) {
        set({ cards: stored })
      }
    } catch {
      // 静默处理
    }
  },
}))
