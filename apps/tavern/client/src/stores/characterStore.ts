import { create } from 'zustand'
import { characterService } from '@/services/characterService'
import type { CharacterCard } from '@/types/character'

interface CharacterState {
  characters: CharacterCard[]
  currentCharacter: CharacterCard | null
  loading: boolean
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
  page: 1,
  hasMore: true,

  loadCharacters: async (page = 1) => {
    set({ loading: true })
    try {
      const res = await characterService.list(page)
      const { items, page: currentPage, hasMore } = res.data
      set({
        characters: page === 1 ? items : [...get().characters, ...items],
        page: currentPage,
        hasMore,
        loading: false,
      })
    } catch {
      set({ loading: false })
    }
  },

  loadDetail: async (id) => {
    set({ loading: true })
    try {
      const res = await characterService.detail(id)
      set({ currentCharacter: res.data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  createCharacter: async (data) => {
    const res = await characterService.create(data)
    set({ characters: [res.data, ...get().characters] })
  },

  deleteCharacter: async (id) => {
    await characterService.delete(id)
    set({ characters: get().characters.filter(c => c.id !== id) })
  },

  publishCharacter: async (id) => {
    await characterService.publish(id)
    const chars = get().characters.map(c =>
      c.id === id ? { ...c, status: 'PENDING' as const } : c
    )
    set({ characters: chars })
  },
}))