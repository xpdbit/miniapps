/**
 * syncedCardsStore — 从 ECS100 同步的官方卡片缓存
 * 每次进入市场页时触发同步，500ms 防抖防刷
 */
import { create } from 'zustand'
import Taro from '@tarojs/taro'
import { officialService } from '@/services/officialService'
import type { CharacterCard, CardType } from '@/types/character'

const STORAGE_KEY = 'tavern_synced_cards'
const SYNC_DEBOUNCE_MS = 500

interface SyncedCardsState {
  cards: CharacterCard[]
  lastSyncAt: number
  loading: boolean
  lastSyncPromise: Promise<void> | null
  syncTimer: ReturnType<typeof setTimeout> | null

  /** 按卡片类型获取卡片 */
  getCardsByType: (cardType: CardType) => CharacterCard[]

  /** 获取单张卡片详情 */
  getCardById: (id: string) => CharacterCard | undefined

  /** 同步官方卡片（带 500ms 防抖） */
  syncCards: () => Promise<void>

  /** 从本地存储恢复 */
  restoreFromStorage: () => void
}

export const useSyncedCardsStore = create<SyncedCardsState>((set, get) => ({
  cards: [],
  lastSyncAt: 0,
  loading: false,
  lastSyncPromise: null,
  syncTimer: null,

  getCardsByType: (cardType: CardType) => {
    return get().cards.filter(c => c.cardType === cardType)
  },

  getCardById: (id: string) => {
    return get().cards.find(c => c.id === id)
  },

  syncCards: async () => {
    const state = get()

    // 500ms 防抖：如果已有定时器，先清除
    if (state.syncTimer) {
      clearTimeout(state.syncTimer)
    }

    // 如果已有正在进行的同步，复用其 Promise
    if (state.lastSyncPromise) {
      return state.lastSyncPromise
    }

    // 创建新的同步 Promise
    const promise = new Promise<void>((resolve) => {
      const timer = setTimeout(async () => {
        try {
          set({ loading: true })
          const res = await officialService.getAll()
          const cards = res.data ?? []
          set({
            cards,
            lastSyncAt: Date.now(),
            loading: false,
            lastSyncPromise: null,
            syncTimer: null,
          })
          // 持久化到本地存储
          try {
            Taro.setStorageSync(STORAGE_KEY, cards)
          } catch {
            // 静默处理存储失败
          }
        } catch {
          // 同步失败不影响现有缓存
          set({ loading: false, lastSyncPromise: null, syncTimer: null })
        }
        resolve()
      }, SYNC_DEBOUNCE_MS)

      set({ syncTimer: timer })
    })

    set({ lastSyncPromise: promise })
    return promise
  },

  restoreFromStorage: () => {
    try {
      const stored = Taro.getStorageSync(STORAGE_KEY)
      if (stored && Array.isArray(stored) && stored.length > 0) {
        set({ cards: stored, lastSyncAt: Date.now() })
      }
    } catch {
      // 静默处理
    }
  },
}))
