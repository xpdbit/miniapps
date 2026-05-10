import { httpClient } from './httpClient'

export interface Persona {
  id: string
  userId: string
  name: string
  description: string | null
  avatar: string | null
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export const personaService = {
  list: () =>
    httpClient.get<{ code: number; data: Persona[]; message: string }>('/personas'),

  create: (data: { name: string; description?: string; avatar?: string }) =>
    httpClient.post<{ code: number; data: Persona; message: string }>('/personas', data),

  update: (id: string, data: { name?: string; description?: string; avatar?: string }) =>
    httpClient.put<{ code: number; data: Persona; message: string }>(`/personas/${id}`, data),

  delete: (id: string) =>
    httpClient.delete<{ code: number; data: null; message: string }>(`/personas/${id}`),

  setDefault: (id: string) =>
    httpClient.post<{ code: number; data: null; message: string }>(`/personas/${id}/default`),
}