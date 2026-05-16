import { Select } from 'antd'
import { SwapOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '@/stores/projectStore'
import { PROJECT_FALLBACK } from '@/constants/routes'

/** SVG 勾选图标（绿色） */
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#52c41a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

/** SVG 叉号图标（红色） */
const CrossIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff4d4f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

/** 根据项目名称推断项目作用域 */
function getScope(name: string): string | null {
  const n = name.toLowerCase()
  if (n.includes('ftg') || n.includes('food')) return 'ftg'
  if (n.includes('game1') || n.includes('game')) return 'game1'
  if (n.includes('tavern') || n.includes('ai')) return 'tavern'
  return null
}

const ProjectSwitcher = () => {
  const navigate = useNavigate()
  const currentProject = useProjectStore((s) => s.currentProject)
  const projects = useProjectStore((s) => s.projects)
  const setProject = useProjectStore((s) => s.setProject)

  const handleChange = (value: number) => {
    const selected = projects.find((p) => p.id === value)
    if (selected) {
      setProject(selected)
      // 导航到对应项目的默认页面
      const scope = getScope(selected.name)
      if (scope) {
        const fallback = PROJECT_FALLBACK[scope]
        if (fallback) navigate(fallback)
      }
    }
  }

  return (
    <Select<number>
      value={currentProject?.id ?? undefined}
      placeholder="选择项目"
      onChange={handleChange}
      style={{ width: 200 }}
      options={projects.map((p) => ({
        label: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {p.status === 'active' ? <CheckIcon /> : <CrossIcon />}
            {p.name}
          </span>
        ),
        value: p.id,
      }))}
      prefix={<SwapOutlined />}
    />
  )
}

export default ProjectSwitcher
