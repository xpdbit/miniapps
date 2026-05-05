import { Select, Tag } from 'antd'
import { SwapOutlined } from '@ant-design/icons'
import { useProjectStore } from '@/stores/projectStore'

const ProjectSwitcher = () => {
  const currentProject = useProjectStore((s) => s.currentProject)
  const projects = useProjectStore((s) => s.projects)
  const setProject = useProjectStore((s) => s.setProject)

  const handleChange = (value: number) => {
    const selected = projects.find((p) => p.id === value)
    if (selected) {
      setProject(selected)
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
            <Tag
              color={p.status === 'active' ? 'green' : 'default'}
              style={{ margin: 0, lineHeight: '16px', fontSize: 10 }}
            >
              {p.status === 'active' ? '●' : '○'}
            </Tag>
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
