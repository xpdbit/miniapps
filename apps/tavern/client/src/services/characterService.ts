import type { CharacterCard } from '@/types/character'
import type { ApiResponse } from '@/types/common'
import { httpClient } from './httpClient'

interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export const characterService = {
  list: (page = 1, pageSize = 20, status?: string) =>
    httpClient.get<ApiResponse<PaginatedResult<CharacterCard>>>('/characters', { page, pageSize, status }),

  detail: (id: string) =>
    httpClient.get<ApiResponse<CharacterCard>>(`/characters/${id}`),

  create: (data: Partial<CharacterCard>) =>
    httpClient.post<ApiResponse<CharacterCard>>('/characters', data),

  update: (id: string, data: Partial<CharacterCard>) =>
    httpClient.put<ApiResponse<CharacterCard>>(`/characters/${id}`, data),

  delete: (id: string) =>
    httpClient.delete<ApiResponse<null>>(`/characters/${id}`),

  publish: (id: string) =>
    httpClient.post<ApiResponse<{ status: string }>>(`/characters/${id}/publish`),
}