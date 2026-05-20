export type ProjectStatus = 'active' | 'inactive'

export interface Project {
  id: string
  name: string
  slug?: string
  apiBaseUrl: string
  description: string | null
  status: ProjectStatus
  createdAt: string
  updatedAt: string
}
