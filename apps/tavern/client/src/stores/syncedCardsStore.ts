/**
 * syncedCardsStore — 从 ECS100 同步的官方卡片缓存
 * 每次进入市场页时触发同步，500ms 防抖防刷
 */
import { create } from 'zustand'
import type { StoreApi } from 'zustand/vanilla'
import Taro from '@tarojs/taro'
import { officialService } from '@/services/officialService'
import type { CharacterCard, CardType } from '@/types/character'

const STORAGE_KEY = 'tavern_synced_cards'
const SYNC_DEBOUNCE_MS = 500

interface SyncResult {
  success: boolean
  count: number
  error?: string
}

interface SyncedCardsState {
  cards: CharacterCard[]
  lastSyncAt: number
  loading: boolean
  error: string | null
  lastSyncPromise: Promise<SyncResult> | null
  syncTimer: ReturnType<typeof setTimeout> | null

  /** 按卡片类型获取卡片 */
  getCardsByType: (cardType: CardType) => CharacterCard[]

  /** 获取单张卡片详情 */
  getCardById: (id: string) => CharacterCard | undefined

  /** 同步官方卡片（带 500ms 防抖） */
  syncCards: () => Promise<SyncResult>

  /** 强制刷新（绕过防抖和去重，立即同步） */
  forceRefresh: () => Promise<SyncResult>

  /** 从本地存储恢复 */
  restoreFromStorage: () => void
}

async function doSync(
  set: StoreApi<SyncedCardsState>['setState'],
  get: StoreApi<SyncedCardsState>['getState'],
  isForce: boolean,
): Promise<SyncResult> {
  const state = get()

  // 非强制刷新时才走防抖和去重
  if (!isForce) {
    // 必须先检查 lastSyncPromise，再清除 timer
    // 否则先 clearTimeout 会导致旧 promise 永不 resolve → 死锁
    if (state.lastSyncPromise) {
      return state.lastSyncPromise
    }

    // 500ms 防抖：如果已有定时器，先清除
    if (state.syncTimer) {
      clearTimeout(state.syncTimer)
    }
  } else {
    // 强制刷新：清除所有待处理的同步
    if (state.syncTimer) {
      clearTimeout(state.syncTimer)
    }
  }

  // 创建新的同步 Promise
  const promise = new Promise<SyncResult>((resolve) => {
    const doFetch = async () => {
      try {
        set({ loading: true })
        const res = await officialService.getAll()
        // 检查服务器业务状态码 — 非 0 视为失败，避免 500 等错误静默清空缓存
        if (res.code !== 0) {
          throw new Error(res.message || '服务器返回异常')
        }
        const cards = res.data ?? []
        set({
          cards,
          lastSyncAt: Date.now(),
          loading: false,
          error: null,
          lastSyncPromise: null,
          syncTimer: null,
        })
        // 持久化到本地存储
        try {
          Taro.setStorageSync(STORAGE_KEY, cards)
        } catch {
          // 静默处理存储失败
        }
        resolve({ success: true, count: cards.length })
      } catch (err: unknown) {
        // 同步失败不影响现有缓存
        const msg = err instanceof Error ? err.message : '同步失败，请检查网络'
        console.error('[syncedCardsStore] sync failed:', msg)
        set({ loading: false, error: msg, lastSyncPromise: null, syncTimer: null })
        resolve({ success: false, count: get().cards.length, error: msg })
      }
    }

    if (isForce) {
      // 强制刷新：立即执行
      doFetch()
    } else {
      // 正常同步：500ms 防抖
      const timer = setTimeout(doFetch, SYNC_DEBOUNCE_MS)
      set({ syncTimer: timer })
    }
  })

  set({ lastSyncPromise: promise })
  return promise
}

export const useSyncedCardsStore = create<SyncedCardsState>((set, get) => ({
  cards: [],
  lastSyncAt: 0,
  loading: false,
  error: null,
  lastSyncPromise: null,
  syncTimer: null,

  getCardsByType: (cardType: CardType) => {
    return get().cards.filter(c => c.cardType === cardType)
  },

  getCardById: (id: string) => {
    return get().cards.find(c => c.id === id)
  },

  syncCards: async () => {
    return doSync(set, get, false)
  },

  forceRefresh: async () => {
    return doSync(set, get, true)
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
