import { httpClient } from './httpClient'
import type { CharacterCard } from '@/types/character'

interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export const characterService = {
  list: (page = 1, pageSize = 20, status?: string) =>
    httpClient.get<PaginatedResult<CharacterCard>>('/characters', { page, pageSize, status }),

  detail: (id: string) =>
    httpClient.get<{ character: CharacterCard }>(`/characters/${id}`),

  create: (data: Partial<CharacterCard>) =>
    httpClient.post<CharacterCard>('/characters', data),

  update: (id: string, data: Partial<CharacterCard>) =>
    httpClient.put<CharacterCard>(`/characters/${id}`, data),

  delete: (id: string) =>
    httpClient.delete<void>(`/characters/${id}`),

  publish: (id: string) =>
    httpClient.post<{ status: string }>(`/characters/${id}/publish`),
}