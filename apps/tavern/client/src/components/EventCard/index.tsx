/**
 * EventCard — 重大事件弹窗
 * kingdom.event 触发时展示全屏弹窗
 */
import { View, Text } from '@tarojs/components'
import './index.scss'

interface Props {
  visible: boolean
  name: string
  severity: 'minor' | 'major' | 'crisis'
  description?: string
  onClose: () => void
}

const severityConfig: Record<string, { label: string; color: string }> = {
  minor: { label: '🟡 小事', color: '#faad14' },
  major: { label: '🟠 重大', color: '#ff7a00' },
  crisis: { label: '🔴 危机', color: '#ff4d4f' },
}

export default function EventCard({ visible, name, severity, description, onClose }: Props) {
  if (!visible) return null

  const cfg = severityConfig[severity] ?? severityConfig.minor!

  return (
    <View className="event-card-overlay" onClick={onClose}>
      <View className="event-card" onClick={e => e.stopPropagation()}>
        <View className="event-badge" style={{ background: cfg.color }}>
          <Text>{cfg.label}</Text>
        </View>
        <Text className="event-name">{name}</Text>
        {description ? <Text className="event-desc">{description}</Text> : null}
        <View className="event-close" onClick={onClose}>
          <Text>知道了</Text>
        </View>
      </View>
    </View>
  )
}
