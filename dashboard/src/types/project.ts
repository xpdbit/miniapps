export type ProjectStatus = 'active' | 'inactive'

export interface Project {
  id: number
  name: string
  apiBaseUrl: string
  description: string | null
  status: ProjectStatus
  createdAt: string
  updatedAt: string
}
