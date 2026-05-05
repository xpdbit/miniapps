import { Button, Tooltip } from 'antd'
import { SunOutlined, MoonOutlined } from '@ant-design/icons'

interface ThemeToggleProps {
  isDark: boolean
  onToggle: () => void
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ isDark, onToggle }) => (
  <Tooltip title={isDark ? '切换亮色模式' : '切换暗色模式'}>
    <Button
      type="text"
      icon={isDark ? <SunOutlined /> : <MoonOutlined />}
      onClick={onToggle}
    />
  </Tooltip>
)

export default ThemeToggle
