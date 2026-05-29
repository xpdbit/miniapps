import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'

import CharacterCard from '@/components/CharacterCard'
import { EmptyState, Icon } from '@/components'
import { useCharacterStore } from '@/stores/characterStore'
import { useAuthStore } from '@/stores/authStore'
import './index.scss'

export default function CharacterListPage() {
  const { isLoggedIn } = useAuthStore()
  const { characters, loading, error, hasMore, loadCharacters } = useCharacterStore()
  const [tab, setTab] = useState<string>('all')
  const [refreshing, setRefreshing] = useState(false)

  useDidShow(() => {
    if (isLoggedIn) loadCharacters(1)
  })

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadCharacters(1)
    setRefreshing(false)
  }, [loadCharacters])

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadCharacters(characters.length / 20 + 1)
    }
  }, [loading, hasMore, characters.length, loadCharacters])

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
        {(['all', 'draft', 'published'] as const).map((tabValue) => (
          <View
            key={tabValue}
            className={`page-character-list-tab ${tab === tabValue ? 'page-character-list-tab--active' : ''}`}
            onClick={() => setTab(tabValue)}
          >
            <Text>{tabValue === 'all' ? '全部' : tabValue === 'draft' ? '草稿' : '已发布'}</Text>
          </View>
        ))}
        <View
          className={`page-character-list-refresh ${refreshing ? 'page-character-list-refresh--spinning' : ''}`}
          onClick={handleRefresh}
        >
          <Icon name='refresh' size={36} color='var(--color-icon-muted)' />
        </View>
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
            chatCount={card.chatCount ?? 0}
            likeCount={card.likeCount ?? 0}
            onClick={handleCardClick}
          />
        ))}
        {loading && <Text className='page-character-list-loading'>加载中...</Text>}
        {!loading && filtered.length === 0 && !error && (
          <EmptyState
            icon={<Icon name='user' size={64} color='var(--color-icon-disabled)' />}
            title='还没有角色卡'
            description='前往"创建"页面开始创作'
          />
        )}
        {!loading && error && filtered.length === 0 && (
          <View className='page-character-list-error'>
            <Icon name='close' size={48} color='var(--color-warning)' />
            <Text className='page-character-list-error-msg'>{error}</Text>
            <View className='page-character-list-error-retry' onClick={handleRefresh}>
              <Text>点击重试</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
