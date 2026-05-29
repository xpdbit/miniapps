/**
 * NpcList — NPC 角色列表
 * 显示 expertise 图标、名称、位置，点击切换对话对象
 */
import { View, Text } from '@tarojs/components'
import './index.scss'

interface NpcInfo {
  id: string
  name: string
  location: string
  expertise?: string[]
  role?: string
}

interface Props {
  npcs: NpcInfo[]
  activeId?: string
  onSelect: (id: string) => void
}

export default function NpcList({ npcs, activeId, onSelect }: Props) {
  return (
    <View className="npc-list">
      <Text className="npc-title">📋 角色</Text>
      {npcs.map(npc => {
        const isActive = npc.id === activeId
        return (
          <View
            key={npc.id}
            className={`npc-item ${isActive ? 'active' : ''}`}
            onClick={() => onSelect(npc.id)}
          >
            <View className="npc-avatar">{npc.name.charAt(0)}</View>
            <View className="npc-info">
              <Text className="npc-name">{npc.name}</Text>
              <Text className="npc-location">📍{npc.location}</Text>
              {npc.expertise?.length ? (
                <Text className="npc-expertise">
                  {npc.expertise.map(e => {
                    const icons: Record<string, string> = {
                      military: '⚔️', people: '👥', wealth: '💰',
                      faith: '⛪', diplomacy: '🤝', stability: '🏰',
                    }
                    return icons[e] ?? e
                  }).join(' ')}
                </Text>
              ) : null}
            </View>
          </View>
        )
      })}
    </View>
  )
}
