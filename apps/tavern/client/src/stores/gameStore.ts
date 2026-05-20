import { create } from 'zustand'
import Taro from '@tarojs/taro'
import type { GameSave, GameGroup, GameMessage } from '@/types/game'

const SAVES_KEY = 'tavern_saves'
const ACTIVE_KEY = 'tavern_active_save_id'

function generateId(): string {
  return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

function persistSaves(saves: GameSave[]) {
  try { Taro.setStorageSync(SAVES_KEY, saves) } catch { /* ignore */ }
}

function loadSaves(): GameSave[] {
  try {
    const data = Taro.getStorageSync(SAVES_KEY)
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

interface GameState {
  saves: GameSave[]
  activeSaveId: string | null

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
}

export const useGameStore = create<GameState>((set, get) => ({
  saves: [],
  activeSaveId: null,

  activeSave: () => {
    const { saves, activeSaveId } = get()
    if (!activeSaveId) return null
    return saves.find(s => s.id === activeSaveId) || null
  },

  restoreSaves: () => {
    set({ saves: loadSaves() })
    try {
      const id = Taro.getStorageSync(ACTIVE_KEY)
      if (id) set({ activeSaveId: id })
    } catch { /* ignore */ }
  },

  createSave: (data) => {
    const now = Date.now()
    const save: GameSave = { ...data, id: generateId(), createdAt: now, updatedAt: now }
    const newSaves = [save, ...get().saves]
    set({ saves: newSaves, activeSaveId: save.id })
    persistSaves(newSaves)
    try { Taro.setStorageSync(ACTIVE_KEY, save.id) } catch { /* ignore */ }
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
    try { Taro.setStorageSync(ACTIVE_KEY, id || '') } catch { /* ignore */ }
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
}))