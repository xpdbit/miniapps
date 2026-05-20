import { View, Text } from '@tarojs/components'
import { useState, useEffect, useMemo } from 'react'
import { cn } from '@/utils'
import './index.scss'

export interface CharacterCardProps {
  id: string
  name: string
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
  selected?: boolean
}

export default function CharacterCard(props: CharacterCardProps) {
  const {
    id, name, description,
    subtitle, onClick, showBorder, selected,
    compact, likeCount, chatCount,
  } = props

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const displaySubtitle = useMemo(() => {
    if (subtitle) return subtitle
    if (description) {
      return description.length > 30
        ? `${description.slice(0, 30)}...`
        : description
    }
    return undefined
  }, [subtitle, description])

  const hasStats = likeCount !== undefined || chatCount !== undefined

  if (compact) {
    return (
      <View
        className={cn(
          'character-card',
          'character-card--compact',
          (showBorder || selected) && 'character-card--active',
          selected && 'character-card--selected',
          mounted && 'character-card--visible',
        )}
        onClick={() => onClick?.(id)}
      >
        <Text className='character-card-name'>{name}</Text>
      </View>
    )
  }

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
      <View className='character-card-body'>
        <Text className='character-card-name'>{name}</Text>
        {displaySubtitle && (
          <Text className='character-card-subtitle'>{displaySubtitle}</Text>
        )}
      </View>

      {hasStats && (
        <View className='character-card-stats'>
          {likeCount !== undefined && (
            <View className='character-card-stat'>
              <Text>♥ </Text>
              <Text className='character-card-stat-value'>{likeCount}</Text>
            </View>
          )}
          {likeCount !== undefined && chatCount !== undefined && (
            <View className='character-card-stat-divider' />
          )}
          {chatCount !== undefined && (
            <View className='character-card-stat'>
              <Text>✦ </Text>
              <Text className='character-card-stat-value'>{chatCount}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  )
}
