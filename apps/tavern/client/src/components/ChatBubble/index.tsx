import { View, Text, Image } from '@tarojs/components'
import { cn } from '@/utils'
import ChatMarkdown from '@/components/ChatMarkdown'
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
      <View className={cn('chat-bubble-body', isUser && 'chat-bubble-body--user')}>
        {!isUser && characterName && (
          <Text className='chat-bubble-name'>{characterName}</Text>
        )}
        <View className={cn('chat-bubble-content', isStreaming && 'chat-bubble-content--streaming')}>
          <ChatMarkdown content={content} />
          {isStreaming && (
            <View className='chat-bubble-dots'>
              <View className='chat-bubble-dot' />
              <View className='chat-bubble-dot' />
              <View className='chat-bubble-dot' />
            </View>
          )}
        </View>
        {timestamp && (
          <Text className='chat-bubble-time'>
            {typeof timestamp === 'string' ? timestamp : formatTime(timestamp)}
          </Text>
        )}
      </View>
    </View>
  )
}

function formatTime(ts: number): string {
  const date = new Date(ts)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  if (isToday) return `${h}:${m}`
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${month}-${day} ${h}:${m}`
}