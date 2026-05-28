import { create } from 'zustand'
import type { Project } from '@/types'

const SYSTEM_PROJECT: Project = {
  id: 'system',
  name: '系统管理',
  slug: 'system',
  apiBaseUrl: '',
  description: '系统管理后台',
  status: 'active',
  createdAt: '',
  updatedAt: '',
}

const STORAGE_KEY = 'dashboard_last_project'

interface ProjectState {
  currentProject: Project | null
  projects: Project[]
  setProject: (project: Project) => void
  setProjects: (projects: Project[]) => void
  getApiBaseUrl: () => string
  isSystemMode: () => boolean
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: (() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? (JSON.parse(saved) as Project) : SYSTEM_PROJECT
    } catch {
      return SYSTEM_PROJECT
    }
  })(),
  projects: [],

  setProject: (project: Project) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
    set({ currentProject: project })
  },

  setProjects: (projects: Project[]) => set({ projects }),

  getApiBaseUrl: () => {
    const { currentProject } = get()
    return currentProject?.apiBaseUrl || import.meta.env.VITE_API_BASE_URL || ''
  },

  isSystemMode: () => {
    return get().currentProject?.id === 'system'
  },
}))
