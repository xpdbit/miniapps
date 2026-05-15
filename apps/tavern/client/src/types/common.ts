export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface PaginationParams {
  page?: number
  pageSize?: number
}
