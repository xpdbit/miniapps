import { create } from 'zustand'
import type { Project } from '@/types'

interface ProjectState {
  currentProject: Project | null
  projects: Project[]
  setProject: (project: Project) => void
  setProjects: (projects: Project[]) => void
  getApiBaseUrl: () => string
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: (() => {
    try {
      const saved = sessionStorage.getItem('currentProject')
      return saved ? (JSON.parse(saved) as Project) : null
    } catch {
      return null
    }
  })(),
  projects: [],

  setProject: (project: Project) => {
    sessionStorage.setItem('currentProject', JSON.stringify(project))
    set({ currentProject: project })
  },

  setProjects: (projects: Project[]) => set({ projects }),

  getApiBaseUrl: () => {
    const { currentProject } = get()
    return currentProject?.apiBaseUrl || import.meta.env.VITE_API_BASE_URL || ''
  },
}))
