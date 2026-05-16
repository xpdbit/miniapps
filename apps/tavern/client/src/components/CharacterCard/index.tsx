import { View, Text } from '@tarojs/components'
import { useState, useEffect } from 'react'
import { cn } from '@/utils'
import './index.scss'

export interface CharacterCardProps {
  id: string
  name: string
  /** 以下属性向下兼容，但新设计只显示名字 */
  avatar?: string | null
  description?: string
  tags?: string[]
  status?: string
  chatCount?: number
  likeCount?: number
  onClick?: (id: string) => void
  showBorder?: boolean
  compact?: boolean
  subtitle?: string
  /** 选中状态（选中卡片自动前置 + 显示选中边框） */
  selected?: boolean
}

export default function CharacterCard(props: CharacterCardProps) {
  const {
    id, name, onClick, showBorder, selected,
  } = props

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <View
      className={cn(
        'character-card',
        (showBorder || selected) && 'character-card--active',
        selected && 'character-card--selected',
        mounted && 'character-card--visible',
      )}
      onClick={() => onClick?.(id)}
    >
      {/* 卡面：暖白卡面，显示卡片名字 */}
      <View className='character-card-face'>
        <Text className='character-card-name'>{name}</Text>
      </View>
    </View>
  )
}
