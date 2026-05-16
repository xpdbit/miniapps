import { View, Text, Image } from '@tarojs/components'
import { cn, formatRelativeTime } from '@/utils'
import './index.scss'

interface ChatBubbleProps {
  role: 'user' | 'character'
  content: string
  isStreaming?: boolean
  isLast?: boolean
  avatarUrl?: string | null
  characterName?: string
  timestamp?: string | number
}

export default function ChatBubble({
  role,
  content,
  isStreaming = false,
  isLast = false,
  avatarUrl,
  characterName,
  timestamp,
}: ChatBubbleProps) {
  const isUser = role === 'user'

  return (
    <View className={cn('chat-bubble', `chat-bubble--${role}`, isLast && 'chat-bubble--enter')}>
      {!isUser && (
        <View className='chat-bubble-avatar'>
          {avatarUrl ? (
            <Image src={avatarUrl} mode='aspectFill' className='chat-bubble-avatar-img' />
          ) : (
            <Text className='chat-bubble-avatar-text'>{characterName?.[0] || '?'}</Text>
          )}
        </View>
      )}
      <View className='chat-bubble-body'>
        {!isUser && characterName && (
          <View className='chat-bubble-header'>
            <Text className='chat-bubble-name'>{characterName}</Text>
          </View>
        )}
        <View className={cn('chat-bubble-content', isStreaming && 'chat-bubble-content--streaming')}>
          <Text>{content}</Text>
          {isStreaming && <Text className='chat-bubble-cursor'>|</Text>}
        </View>
        {timestamp && (
          <Text className='chat-bubble-time'>{formatRelativeTime(timestamp)}</Text>
        )}
      </View>
    </View>
  )
}
