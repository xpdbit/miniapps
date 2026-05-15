import { View, Text } from '@tarojs/components'
import { useState, useEffect } from 'react'
import { cn, formatCount } from '@/utils'
import './index.scss'

const TAG_DISPLAY_LIMIT = 3

export interface CharacterCardProps {
  id: string
  name: string
  avatar?: string | null
  description: string
  tags?: string[]
  status?: string
  chatCount?: number
  likeCount?: number
  onClick?: (id: string) => void
  /** 高亮选中态 */
  showBorder?: boolean
  /** 紧凑模式（横向列表用） */
  compact?: boolean
  /** 副标题 */
  subtitle?: string
}

export default function CharacterCard(props: CharacterCardProps) {
  const {
    id, name, avatar, description, tags, status,
    chatCount, likeCount, onClick, showBorder, compact, subtitle,
  } = props

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const visibleTags = tags?.slice(0, TAG_DISPLAY_LIMIT) ?? []
  const overflowCount = tags ? tags.length - TAG_DISPLAY_LIMIT : 0

  return (
    <View
      className={cn(
        'character-card',
        showBorder && 'character-card--active',
        compact && 'character-card--compact',
        mounted && 'character-card--visible',
      )}
      onClick={() => onClick?.(id)}
    >
      <View className='character-card-avatar'>
        <t-avatar
          image={avatar || ''}
          size={compact ? 'small' : 'medium'}
          shape='square'
        />
      </View>
      <View className='character-card-info'>
        <View className='character-card-header'>
          <Text className='character-card-name'>{name}</Text>
          {subtitle && (
            <Text className='character-card-subtitle'>{subtitle}</Text>
          )}
          {status && status !== 'PUBLISHED' && (
            <Text className={cn('character-card-status', `character-card-status--${status?.toLowerCase()}`)}>
              {status === 'DRAFT' ? '草稿' : status === 'PENDING' ? '审核中' : status}
            </Text>
          )}
        </View>
        <Text className='character-card-desc' numberOfLines={2}>{description}</Text>
        {visibleTags.length > 0 && (
          <View className='character-card-tags'>
            {visibleTags.map((tag, i) => (
              <Text key={i} className='character-card-tag'>{tag}</Text>
            ))}
            {overflowCount > 0 && (
              <Text className='character-card-tag character-card-tag--overflow'>
                +{overflowCount}
              </Text>
            )}
          </View>
        )}
        {(chatCount !== undefined || likeCount !== undefined) && (
          <View className='character-card-stats'>
            {chatCount !== undefined && (
              <Text className='character-card-stat'>聊 {formatCount(chatCount)}</Text>
            )}
            {likeCount !== undefined && (
              <Text className='character-card-stat'>赞 {formatCount(likeCount)}</Text>
            )}
          </View>
        )}
      </View>
    </View>
  )
}