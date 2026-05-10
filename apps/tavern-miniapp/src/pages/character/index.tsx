import { View, Text, ScrollView } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import Taro from '@tarojs/taro'
import CharacterCard from '@/components/CharacterCard'
import { useCharacterStore } from '@/stores/characterStore'
import './index.scss'

export default function CharacterListPage() {
  const { characters, loading, hasMore, loadCharacters } = useCharacterStore()
  const [tab, setTab] = useState<string>('all')

  useDidShow(() => {
    loadCharacters(1)
  })

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadCharacters(characters.length / 20 + 1)
    }
  }, [loading, hasMore, characters.length, loadCharacters])

  const handleTabChange = useCallback((key: string) => {
    setTab(key)
  }, [])

  const handleCardClick = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pages/character/detail/index?id=${id}` })
  }, [])

  const filtered = tab === 'all'
    ? characters
    : characters.filter(c => {
        if (tab === 'draft') return c.status === 'DRAFT'
        if (tab === 'published') return c.status === 'PUBLISHED'
        return true
      })

  return (
    <View className='page-character-list'>
      <View className='page-character-list-tabs'>
        {[
          { key: 'all', label: '全部' },
          { key: 'draft', label: '草稿' },
          { key: 'published', label: '已发布' },
        ].map(t => (
          <Text
            key={t.key}
            className={`page-character-list-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => handleTabChange(t.key)}
          >
            {t.label}
          </Text>
        ))}
      </View>

      <ScrollView
        className='page-character-list-content'
        scrollY
        onScrollToLower={handleLoadMore}
      >
        {filtered.map(card => (
          <CharacterCard
            key={card.id}
            id={card.id}
            name={card.name}
            avatar={card.avatar}
            description={card.description}
            tags={card.tags}
            status={card.status}
            chatCount={card.chats}
            likeCount={card.likes}
            onClick={handleCardClick}
          />
        ))}
        {loading && <Text className='page-character-list-loading'>加载中...</Text>}
        {!loading && filtered.length === 0 && (
          <View className='page-character-list-empty'>
            <Text>还没有角色卡</Text>
            <Text className='page-character-list-empty-hint'>前往"创建"页面开始创作</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}