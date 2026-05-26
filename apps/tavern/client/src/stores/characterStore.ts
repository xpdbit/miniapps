import { create } from 'zustand'
import Taro from '@tarojs/taro'
import { characterService } from '@/services/characterService'
import type { CharacterCard } from '@/types/character'

interface CharacterState {
  characters: CharacterCard[]
  currentCharacter: CharacterCard | null
  loading: boolean
  error: string | null
  page: number
  hasMore: boolean

  loadCharacters: (page?: number) => Promise<void>
  loadDetail: (id: string) => Promise<void>
  createCharacter: (data: Partial<CharacterCard>) => Promise<void>
  deleteCharacter: (id: string) => Promise<void>
  publishCharacter: (id: string) => Promise<void>
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  characters: [],
  currentCharacter: null,
  loading: false,
  error: null,
  page: 1,
  hasMore: true,

  loadCharacters: async (page = 1) => {
    set({ loading: true, error: null })
    try {
      const res = await characterService.list(page)
      const { items, page: currentPage, hasMore } = res.data
      set({
        characters: page === 1 ? items : [...get().characters, ...items],
        page: currentPage,
        hasMore,
        loading: false,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载角色列表失败'
      console.error('[characterStore] loadCharacters failed:', msg)
      set({ loading: false, error: msg })
      Taro.showToast({ title: msg, icon: 'none', duration: 2000 })
    }
  },

  loadDetail: async (id) => {
    set({ loading: true, error: null })
    try {
      const res = await characterService.detail(id)
      set({ currentCharacter: res.data, loading: false })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载角色详情失败'
      console.error('[characterStore] loadDetail failed:', msg)
      set({ loading: false, error: msg })
      Taro.showToast({ title: msg, icon: 'none', duration: 2000 })
    }
  },

  createCharacter: async (data) => {
    try {
      const res = await characterService.create(data)
      set({ characters: [res.data, ...get().characters] })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '创建角色失败'
      console.error('[characterStore] createCharacter failed:', msg)
      Taro.showToast({ title: msg, icon: 'none', duration: 2000 })
    }
  },

  deleteCharacter: async (id) => {
    try {
      await characterService.delete(id)
      set({ characters: get().characters.filter(c => c.id !== id) })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '删除角色失败'
      console.error('[characterStore] deleteCharacter failed:', msg)
      Taro.showToast({ title: msg, icon: 'none', duration: 2000 })
    }
  },

  publishCharacter: async (id) => {
    try {
      await characterService.publish(id)
      const chars = get().characters.map(c =>
        c.id === id ? { ...c, status: 'PENDING' as const } : c
      )
      set({ characters: chars })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '发布角色失败'
      console.error('[characterStore] publishCharacter failed:', msg)
      Taro.showToast({ title: msg, icon: 'none', duration: 2000 })
    }
  },
}))