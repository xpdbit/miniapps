import { httpClient } from './httpClient'

export const marketService = {
  list: (params?: { page?: number; pageSize?: number; sort?: string; tag?: string }) =>
    httpClient.get('/market', params),
  featured: () =>
    httpClient.get('/market/featured'),
  search: (q: string, page?: number) =>
    httpClient.get('/market/search', { q, page }),
  tags: () =>
    httpClient.get('/market/tags'),
  detail: (id: string) =>
    httpClient.get(`/market/${id}`),
  like: (id: string) =>
    httpClient.post(`/market/${id}/like`),
  unlike: (id: string) =>
    httpClient.delete(`/market/${id}/like`),
  fav: (id: string) =>
    httpClient.post(`/market/${id}/fav`),
  unfav: (id: string) =>
    httpClient.delete(`/market/${id}/fav`),
}