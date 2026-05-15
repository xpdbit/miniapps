import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'

import { marketService } from '@/services/marketService'
import { formatCount } from '@/utils'
import type { CharacterCard } from '@/types/character'
import './index.scss'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  PENDING: '审核中',
  PUBLISHED: '已发布',
  BANNED: '已封禁',
}

export default function CharacterDetailPage() {
  const router = useRouter()
  const { id } = router.params as { id?: string }

  const [character, setCharacter] = useState<CharacterCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadCharacter = useCallback(async () => {
    if (!id) {
      setError(true)
      setLoading(false)
      return
    }
    try {
      const res = await marketService.detail(id) as { data: CharacterCard }
      if (res.data) {
        setCharacter(res.data)
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadCharacter()
  }, [loadCharacter])

  const handleStartChat = () => {
    if (!character) return
    Taro.switchTab({ url: '/pages/chat/index' })
  }

  const handleEdit = () => {
    if (!character) return
    Taro.navigateTo({ url: `/pages/creator/index?id=${character.id}` })
  }

  // 加载中
  if (loading) {
    return (
      <View className='page-character-detail'>
        <View className='page-character-detail-loading'>
          <Text>加载中...</Text>
        </View>
      </View>
    )
  }

  // 错误或未找到
  if (error || !character) {
    return (
      <View className='page-character-detail'>
        <View className='page-character-detail-loading'>
          <Text>角色不存在或加载失败</Text>
        </View>
      </View>
    )
  }

  const {
    name,
    avatar,
    description,
    personality,
    scenario,
    firstMsg,
    lore,
    tags,
    status,
    chats,
    likes,
  } = character

  return (
    <ScrollView scrollY className='page-character-detail'>
      {/* 头部：头像 + 名字 + 标签 */}
      <View className='page-character-detail-header'>
        <View className='page-character-detail-avatar'>
          <t-avatar image={avatar || ''} size='extralarge' shape='circle' />
        </View>

        <Text className='page-character-detail-name'>{name}</Text>

        {status && status !== 'PUBLISHED' && (
          <t-badge
            content={STATUS_LABELS[status] || status}
            shape='round'
            size='medium'
          />
        )}

        {tags && tags.length > 0 && (
          <View className='page-character-detail-tags'>
            {tags.map((tag, i) => (
              <t-tag key={i} theme='primary' variant='light' size='small'>
                {tag}
              </t-tag>
            ))}
          </View>
        )}

        {/* 统计 */}
        <View className='page-character-detail-stats'>
          <Text className='page-character-detail-stat'>
            聊 {formatCount(chats)}
          </Text>
          <Text className='page-character-detail-stat'>
            &#9825; {formatCount(likes)}
          </Text>
        </View>
      </View>

      {/* 信息区块 */}
      <View className='page-character-detail-body'>
        {/* 角色描述 */}
        <View className='page-character-detail-section'>
          <Text className='page-character-detail-section-title'>角色描述</Text>
          <Text className='page-character-detail-section-content'>
            {description}
          </Text>
        </View>

        {/* 性格特征 */}
        {personality && (
          <View className='page-character-detail-section'>
            <Text className='page-character-detail-section-title'>性格特征</Text>
            <Text className='page-character-detail-section-content'>
              {personality}
            </Text>
          </View>
        )}

        {/* 场景设定 */}
        {scenario && (
          <View className='page-character-detail-section'>
            <Text className='page-character-detail-section-title'>场景设定</Text>
            <Text className='page-character-detail-section-content'>
              {scenario}
            </Text>
          </View>
        )}

        {/* 开场白 */}
        {firstMsg && (
          <View className='page-character-detail-section'>
            <Text className='page-character-detail-section-title'>开场白</Text>
            <View className='page-character-detail-first-msg'>
              <Text>{firstMsg}</Text>
            </View>
          </View>
        )}

        {/* 背景故事 */}
        {lore && (
          <View className='page-character-detail-section'>
            <Text className='page-character-detail-section-title'>背景故事</Text>
            <Text className='page-character-detail-section-content'>{lore}</Text>
          </View>
        )}
      </View>

      {/* 操作按钮 */}
      <View className='page-character-detail-actions'>
        <t-button className='page-character-detail-chat-btn' onClick={handleStartChat}>
          开始对话
        </t-button>
        <t-button
          className='page-character-detail-publish-btn'
          onClick={handleEdit}
        >
          编辑角色
        </t-button>
      </View>
    </ScrollView>
  )
}
