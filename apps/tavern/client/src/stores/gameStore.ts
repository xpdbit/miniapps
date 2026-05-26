import { create } from 'zustand'
import Taro from '@tarojs/taro'
import type { GameSave, GameGroup, GameMessage } from '@/types/game'

const SAVES_KEY = 'tavern_saves'
const ACTIVE_KEY = 'tavern_active_save_id'
const GAME_MODE_KEY = 'tavern_game_mode'
const CARDS_PER_ROW_KEY = 'tavern_cards_per_row'

function loadCardsPerRow(): number {
  try {
    const v = storageGet(CARDS_PER_ROW_KEY)
    const n = Number(v)
    return n >= 1 && n <= 4 ? n : 2
  } catch { return 2 }
}

function generateId(): string {
  return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

/**
 * 在 H5 环境下 Taro.getStorageSync 可能返回空字符串而非 localStorage 中的实际值。
 * 此处统一使用原生 localStorage 作为存储后端以确保持久化可靠性。
 */
function storageGet(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key)
    }
  } catch { /* ignore */ }
  // 降级到 Taro API（小程序环境）
  try {
    const v = Taro.getStorageSync(key)
    return typeof v === 'string' ? v : v ? JSON.stringify(v) : null
  } catch { return null }
}

function storageSet(key: string, value: unknown): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value))
      return
    }
  } catch { /* ignore */ }
  // 降级到 Taro API
  try { Taro.setStorageSync(key, value) } catch { /* ignore */ }
}

function storageRemove(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key)
      return
    }
  } catch { /* ignore */ }
  try { Taro.removeStorageSync(key) } catch { /* ignore */ }
}

function loadSaves(): GameSave[] {
  try {
    const data = storageGet(SAVES_KEY)
    if (!data) return []
    if (typeof data === 'string') {
      try { const parsed = JSON.parse(data); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
    }
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function persistSaves(saves: GameSave[]) {
  try { storageSet(SAVES_KEY, saves) } catch { /* ignore */ }
}

interface GameState {
  saves: GameSave[]
  activeSaveId: string | null
  gameMode: boolean
  cardsPerRow: number

  activeSave: () => GameSave | null
  restoreSaves: () => void
  createSave: (data: Omit<GameSave, 'id' | 'createdAt' | 'updatedAt'>) => GameSave
  deleteSave: (id: string) => void
  renameSave: (id: string, name: string) => void
  setActiveSave: (id: string | null) => void
  updateSaveGroups: (saveId: string, groups: GameGroup[]) => void
  addMessage: (groupId: string, msg: GameMessage) => void
  updateGroupLastMessage: (groupId: string, msg: string) => void
  togglePinned: (groupId: string) => void
  enableGameMode: () => void
  disableGameMode: () => void
  leaveGame: () => void
  setCardsPerRow: (n: number) => void
}

export const useGameStore = create<GameState>((set, get) => ({
  saves: [],
  activeSaveId: null,
  gameMode: false,
  cardsPerRow: loadCardsPerRow(),

  activeSave: () => {
    const { saves, activeSaveId } = get()
    if (!activeSaveId) return null
    return saves.find(s => s.id === activeSaveId) || null
  },

  restoreSaves: () => {
    const saves = loadSaves()
    set({ saves })
    try {
      let id = storageGet(ACTIVE_KEY)
      // 兼容 Taro H5 可能返回字符串而非已解析值
      if (id && typeof id === 'string' && id.startsWith('"') && id.endsWith('"')) {
        id = JSON.parse(id)
      }
      if (id && typeof id === 'string') {
        const hasActiveSave = saves.some(s => s.id === id)
        // 优先以持久化的 gameMode 为准，无记录时根据 activeSaveId 推断
        let persistedGM: unknown
        try { persistedGM = storageGet(GAME_MODE_KEY) } catch { persistedGM = '' }
        const gameMode = persistedGM !== '' && persistedGM !== undefined && persistedGM !== null
          ? (persistedGM === true || persistedGM === 'true')
          : hasActiveSave
        const prevGameMode = get().gameMode
        set({ activeSaveId: id, gameMode })
        // 仅在 gameMode 实际变化时同步 CustomTabBar（避免页面级 useDidShow 调用造成导航循环）
        if (gameMode !== prevGameMode) {
          Taro.eventCenter.trigger('gameModeChange', gameMode)
        }
      }
    } catch {
      // 静默失败，存档列表仍可用
      console.warn('[gameStore] restoreSaves 恢复活跃存档失败')
    }
  },

  createSave: (data) => {
    const now = Date.now()
    const save: GameSave = { ...data, id: generateId(), createdAt: now, updatedAt: now }
    const newSaves = [save, ...get().saves]
    set({ saves: newSaves, activeSaveId: save.id })
    persistSaves(newSaves)
    storageSet(ACTIVE_KEY, save.id)
    return save
  },

  deleteSave: (id) => {
    const newSaves = get().saves.filter(s => s.id !== id)
    set({ saves: newSaves, activeSaveId: get().activeSaveId === id ? null : get().activeSaveId })
    persistSaves(newSaves)
  },

  renameSave: (id, name) => {
    const newSaves = get().saves.map(s => s.id === id ? { ...s, name, updatedAt: Date.now() } : s)
    set({ saves: newSaves })
    persistSaves(newSaves)
  },

  setActiveSave: (id) => {
    set({ activeSaveId: id })
    storageSet(ACTIVE_KEY, id || '')
  },

  updateSaveGroups: (saveId, groups) => {
    const newSaves = get().saves.map(s =>
      s.id === saveId ? { ...s, groups, updatedAt: Date.now() } : s
    )
    set({ saves: newSaves })
    persistSaves(newSaves)
  },

  addMessage: (groupId, msg) => {
    const save = get().activeSave()
    if (!save) return
    const newGroups = save.groups.map(g => {
      if (g.id !== groupId) return g
      const groupMsgs = g._messages || []
      return {
        ...g,
        _messages: [...groupMsgs, msg],
        lastMessage: msg.content,
        updatedAt: Date.now(),
      } as GameGroup
    })
    get().updateSaveGroups(save.id, newGroups)
  },

  updateGroupLastMessage: (groupId, msg) => {
    const save = get().activeSave()
    if (!save) return
    const newGroups = save.groups.map(g =>
      g.id === groupId ? { ...g, lastMessage: msg, updatedAt: Date.now() } : g
    )
    get().updateSaveGroups(save.id, newGroups)
  },

  togglePinned: (groupId) => {
    const save = get().activeSave()
    if (!save) return
    const newGroups = save.groups.map(g =>
      g.id === groupId
        ? { ...g, pinned: !g.pinned, pinnedAt: g.pinned ? undefined : Date.now() }
        : g
    )
    get().updateSaveGroups(save.id, newGroups)
  },

  enableGameMode: () => {
    set({ gameMode: true })
    storageSet(GAME_MODE_KEY, true)
    Taro.eventCenter.trigger('gameModeChange', true)
  },

  disableGameMode: () => {
    set({ gameMode: false })
    storageSet(GAME_MODE_KEY, false)
    Taro.eventCenter.trigger('gameModeChange', false)
  },

  leaveGame: () => {
    set({ activeSaveId: null, gameMode: false })
    storageSet(ACTIVE_KEY, '')
    storageSet(GAME_MODE_KEY, false)
    Taro.eventCenter.trigger('gameModeChange', false)
  },

  setCardsPerRow: (n: number) => {
    const v = Math.max(1, Math.min(4, Math.round(n)))
    set({ cardsPerRow: v })
    storageSet(CARDS_PER_ROW_KEY, v)
  },
}))