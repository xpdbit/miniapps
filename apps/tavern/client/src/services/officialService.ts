/**
 * 官方卡片同步服务
 * 通过 API_BASE_URL + /official 端点获取 dashboard 创建的官方卡片
 */
import type { CharacterCard } from '@/types/character'
import type { ApiResponse } from '@/types/common'
import { httpClient } from './httpClient'

export const officialService = {
  /** 获取所有已发布的官方卡片（用于客户端同步） */
  getAll: () =>
    httpClient.get<ApiResponse<CharacterCard[]>>('/official/all'),
}
