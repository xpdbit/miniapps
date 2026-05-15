import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'

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

  const handleTabChange = useCallback((event: unknown) => {
    const ev = event as { detail?: string }
    setTab(ev.detail ?? 'all')
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
      <t-tabs value={tab} onChange={handleTabChange}>
        <t-tab-panel label='全部' value='all' />
        <t-tab-panel label='草稿' value='draft' />
        <t-tab-panel label='已发布' value='published' />
      </t-tabs>

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
            <Text className='page-character-list-empty-hint'>前往&ldquo;创建&rdquo;页面开始创作</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}