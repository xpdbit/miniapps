import { View, Text, Image } from '@tarojs/components'
import './index.scss'

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
}

export default function CharacterCard(props: CharacterCardProps) {
  const { id, name, avatar, description, tags, status, chatCount, likeCount, onClick } = props

  return (
    <View className='character-card' onClick={() => onClick?.(id)}>
      <View className='character-card-avatar'>
        {avatar ? (
          <Image src={avatar} mode='aspectFill' className='character-card-avatar-img' />
        ) : (
          <View className='character-card-avatar-placeholder'>{name[0]}</View>
        )}
      </View>
      <View className='character-card-info'>
        <View className='character-card-header'>
          <Text className='character-card-name'>{name}</Text>
          {status && status !== 'PUBLISHED' && (
            <Text className={`character-card-status character-card-status--${status?.toLowerCase()}`}>
              {status === 'DRAFT' ? '草稿' : status === 'PENDING' ? '审核中' : status}
            </Text>
          )}
        </View>
        <Text className='character-card-desc' numberOfLines={2}>{description}</Text>
        {tags && tags.length > 0 && (
          <View className='character-card-tags'>
            {tags.map((tag, i) => (
              <Text key={i} className='character-card-tag'>{tag}</Text>
            ))}
          </View>
        )}
        {(chatCount !== undefined || likeCount !== undefined) && (
          <View className='character-card-stats'>
            {chatCount !== undefined && <Text className='character-card-stat'>💬 {chatCount}</Text>}
            {likeCount !== undefined && <Text className='character-card-stat'>❤️ {likeCount}</Text>}
          </View>
        )}
      </View>
    </View>
  )
}