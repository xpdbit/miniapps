import { httpClient } from './httpClient'

export const marketService = {
  list: <T = unknown>(params?: { page?: number; pageSize?: number; sort?: string; tag?: string }) =>
    httpClient.get<T>('/market', params),
  featured: <T = unknown>() =>
    httpClient.get<T>('/market/featured'),
  search: <T = unknown>(q: string, page?: number) =>
    httpClient.get<T>('/market/search', { q, page }),
  tags: <T = unknown>() =>
    httpClient.get<T>('/market/tags'),
  detail: <T = unknown>(id: string) =>
    httpClient.get<T>(`/market/${id}`),
  like: <T = unknown>(id: string) =>
    httpClient.post<T>(`/market/${id}/like`),
  unlike: <T = unknown>(id: string) =>
    httpClient.delete<T>(`/market/${id}/like`),
  fav: <T = unknown>(id: string) =>
    httpClient.post<T>(`/market/${id}/fav`),
  unfav: <T = unknown>(id: string) =>
    httpClient.delete<T>(`/market/${id}/fav`),
}