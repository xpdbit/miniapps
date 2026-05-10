import { View, Text } from '@tarojs/components'
import './index.scss'

interface ChatBubbleProps {
  role: 'user' | 'character'
  content: string
  isStreaming?: boolean
}

export default function ChatBubble({ role, content, isStreaming }: ChatBubbleProps) {
  const isUser = role === 'user'

  return (
    <View className={`chat-bubble chat-bubble--${role}`}>
      {!isUser && (
        <View className='chat-bubble-avatar'>AI</View>
      )}
      <View className={`chat-bubble-content ${isStreaming ? 'chat-bubble-content--streaming' : ''}`}>
        <Text>{content}</Text>
        {isStreaming && <Text className='chat-bubble-cursor'>|</Text>}
      </View>
    </View>
  )
}