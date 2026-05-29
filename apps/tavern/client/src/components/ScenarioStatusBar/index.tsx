/**
 * ScenarioStatusBar — 动态维度状态条
 * 从 Scenario 的 world.dimensions 动态渲染，不硬编码维度名
 */
import { View, Text } from '@tarojs/components'
import './index.scss'

interface DimensionDef {
  key: string
  label: string
  icon?: string
  range: [number, number]
}

interface Props {
  dimensions: DimensionDef[]
  values: Record<string, number>
}

export default function ScenarioStatusBar({ dimensions, values }: Props) {
  return (
    <View className="scenario-status-bar">
      {dimensions.map(dim => {
        const value = values[dim.key] ?? 0
        const [min, max] = dim.range
        const pct = Math.round(((value - min) / (max - min)) * 100)
        const barWidth = Math.max(0, Math.min(100, pct))
        const danger = pct < 20
        const warning = pct >= 20 && pct < 40

        return (
          <View key={dim.key} className={`status-item ${danger ? 'danger' : warning ? 'warning' : ''}`}>
            <Text className="icon">{dim.icon ?? '📊'}</Text>
            <View className="progress-wrap">
              <View className="progress-bar" style={{ width: `${barWidth}%` }} />
            </View>
            <Text className="value">{value}</Text>
            <Text className="label">{dim.label}</Text>
          </View>
        )
      })}
    </View>
  )
}
