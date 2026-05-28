import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import CharacterCard from '@/components/CharacterCard'
import { useSyncedCardsStore } from '@/stores/syncedCardsStore'
import { useLocalCardsStore } from '@/stores/localCardsStore'
import { useGameStore } from '@/stores/gameStore'
import type { CharacterCard as CharacterCardType, CardType, LocalCard } from '@/types/character'
import { CARD_TYPE_LABELS } from '@/types/character'
import { EmptyState, Icon, Skeleton } from '@/components'
import type { IconName } from '@/components/Icon'
import './index.scss'

type SubTabType = 'character' | 'mechanism' | 'map' | 'background' | 'create'

const CARD_TYPE_MAP: Record<SubTabType, CardType | null> = {
  character: 'CHARACTER',
  mechanism: 'MECHANISM',
  map: 'MAP',
  background: 'BACKGROUND',
  create: null,
}

const SUB_TABS: { key: SubTabType; label: string; icon: IconName }[] = [
  { key: 'character', label: '角色', icon: 'user' },
  { key: 'mechanism', label: '机制', icon: 'settings' },
  { key: 'map', label: '地图', icon: 'gallery' },
  { key: 'background', label: '背景', icon: 'photo' },
  { key: 'create', label: '创建', icon: 'plus' },
]



export default function CardsPage() {
  const [subTab, setSubTab] = useState<SubTabType>('character')
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const syncedStore = useSyncedCardsStore()
  const localStore = useLocalCardsStore()
  const { cardsPerRow } = useGameStore()

  useDidShow(() => {
    Taro.eventCenter.trigger('tabChange', 0)
    syncedStore.syncCards()
  })

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    const result = await syncedStore.forceRefresh()
    if (!result.success) {
      Taro.showToast({ title: result.error || '刷新失败', icon: 'none' })
    }
    setRefreshing(false)
  }, [syncedStore])

  useEffect(() => {
    if (!syncedStore.loading) {
      setLoading(false)
    }
  }, [syncedStore.loading])

  useEffect(() => {
    syncedStore.restoreFromStorage()
    localStore.restoreFromStorage()
  }, [])

  const officialCards = (() => {
    const cardType = CARD_TYPE_MAP[subTab]
    if (!cardType) return []
    return syncedStore.getCardsByType(cardType)
  })()

  const localCards = (() => {
    const cardType = CARD_TYPE_MAP[subTab]
    if (!cardType) return []
    return localStore.getCardsByType(cardType)
  })()

  const filteredOfficialCards = searchQuery
    ? officialCards.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : officialCards

  const handleCreateCard = useCallback((cardType: CardType) => {
    Taro.navigateTo({ url: `/pages/creator/index?cardType=${cardType}` })
  }, [])

  const handleSearchInput = useCallback((e: { detail: { value: string } }) => {
    setSearchQuery(e.detail.value)
  }, [])

  const handleClearSearch = useCallback(() => {
    setSearchQuery('')
  }, [])

  const showError = syncedStore.error && !loading && filteredOfficialCards.length === 0
  const showEmpty = !loading && !syncedStore.error && filteredOfficialCards.length === 0 && localCards.length === 0

  const renderCardGrid = (cards: (CharacterCardType | LocalCard)[], isOfficial: boolean) => (
    <View
      className='market-grid'
      style={{ gridTemplateColumns: `repeat(${cardsPerRow}, 1fr)` }}
    >
      {cards.map(card => (
        <View key={card.id} className='market-grid-item'>
          <CharacterCard
            id={card.id}
            name={card.name}
            avatar={card.avatar}
            description={card.description}
            tags={card.tags}
            onClick={() => {
              if (isOfficial) {
                Taro.navigateTo({ url: `/pages/character/detail/index?id=${card.id}` })
              } else {
                Taro.switchTab({ url: '/pages/chat/index' })
              }
            }}
          />

        </View>
      ))}
    </View>
  )

  return (
    <View className='page-cards'>
      {subTab === 'character' && (
        <View className='market-character-area'>
          <View className='market-search'>
            <View className='market-search-wrapper'>
              <Icon name='search' size={40} color='var(--color-icon-muted)' />
              <Input
                className='market-search-input'
                placeholder='搜索卡片...'
                value={searchQuery}
                onInput={handleSearchInput}
              />
              {searchQuery.length > 0 && (
                <View className='market-search-clear' onClick={handleClearSearch}>
                  <Icon name='close' size={28} color='var(--color-icon-muted)' />
                </View>
              )}
              <View
                className={`market-search-refresh ${refreshing ? 'market-search-refresh--spinning' : ''}`}
                onClick={handleRefresh}
              >
                <Icon name='refresh' size={36} color='var(--color-icon-muted)' />
              </View>
            </View>
          </View>
          <ScrollView scrollY className='market-content' lowerThreshold={100}>
            {loading && syncedStore.cards.length === 0 && (
              <View className='market-grid'>
                <Skeleton type='list' count={6} />
              </View>
            )}
            {!loading && filteredOfficialCards.length > 0 && renderCardGrid(filteredOfficialCards, true)}
            {localCards.length > 0 && (
              <>
                <View className='market-section-title'><Text>我的卡片</Text></View>
                {renderCardGrid(localCards, false)}
              </>
            )}
            {showError && (
              <View className='market-error-state'>
                <Icon name='close' size={48} color='#FF9500' />
                <Text className='market-error-message'>{syncedStore.error}</Text>
                <View className='market-error-retry' onClick={handleRefresh}>
                  <Text>点击重试</Text>
                </View>
              </View>
            )}
            {showEmpty && (
              <EmptyState icon={<Icon name='user' size={64} color='var(--color-icon-disabled)' />} title='暂无角色' description={searchQuery ? '换个关键词试试吧' : '稍后再来看看'} />
            )}
          </ScrollView>
        </View>
      )}

      {subTab === 'mechanism' && (
        <View className='market-sub-panel-content'>
          <View
            className={`market-sub-panel-refresh ${refreshing ? 'market-sub-panel-refresh--spinning' : ''}`}
            onClick={handleRefresh}
          >
            <Icon name='refresh' size={32} color='var(--color-icon-muted)' />
          </View>
          {loading && <Skeleton type='list' count={4} />}
          {!loading && filteredOfficialCards.length > 0 && renderCardGrid(filteredOfficialCards, true)}
          {localCards.length > 0 && (
            <><View className='market-section-title'><Text>我的卡片</Text></View>{renderCardGrid(localCards, false)}</>
          )}
          {showError && (
            <View className='market-error-state'>
              <Icon name='close' size={48} color='#FF9500' />
              <Text className='market-error-message'>{syncedStore.error}</Text>
              <View className='market-error-retry' onClick={handleRefresh}>
                <Text>点击重试</Text>
              </View>
            </View>
          )}
          {showEmpty && (
            <EmptyState icon={<Icon name='settings' size={64} color='var(--color-icon-disabled)' />} title='暂无机制卡' description='官方机制卡同步后将在此显示' />
          )}
          <View className='market-sub-create-bar'>
            <View className='market-create-card' onClick={() => handleCreateCard('MECHANISM')}>
              <View className='market-create-card-inner'>
                <Icon name='plus' size={40} color='var(--color-icon-action)' />
                <Text className='market-create-card-label'>创建机制卡</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {subTab === 'map' && (
        <View className='market-sub-panel-content'>
          <View
            className={`market-sub-panel-refresh ${refreshing ? 'market-sub-panel-refresh--spinning' : ''}`}
            onClick={handleRefresh}
          >
            <Icon name='refresh' size={32} color='var(--color-icon-muted)' />
          </View>
          {loading && <Skeleton type='list' count={4} />}
          {!loading && filteredOfficialCards.length > 0 && renderCardGrid(filteredOfficialCards, true)}
          {localCards.length > 0 && (
            <><View className='market-section-title'><Text>我的卡片</Text></View>{renderCardGrid(localCards, false)}</>
          )}
          {showError && (
            <View className='market-error-state'>
              <Icon name='close' size={48} color='#FF9500' />
              <Text className='market-error-message'>{syncedStore.error}</Text>
              <View className='market-error-retry' onClick={handleRefresh}>
                <Text>点击重试</Text>
              </View>
            </View>
          )}
          {showEmpty && (
            <EmptyState icon={<Icon name='gallery' size={64} color='var(--color-icon-disabled)' />} title='暂无地图卡' description='官方地图卡同步后将在此显示' />
          )}
          <View className='market-sub-create-bar'>
            <View className='market-create-card' onClick={() => handleCreateCard('MAP')}>
              <View className='market-create-card-inner'>
                <Icon name='plus' size={40} color='var(--color-icon-action)' />
                <Text className='market-create-card-label'>创建地图卡</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {subTab === 'background' && (
        <View className='market-sub-panel-content'>
          <View
            className={`market-sub-panel-refresh ${refreshing ? 'market-sub-panel-refresh--spinning' : ''}`}
            onClick={handleRefresh}
          >
            <Icon name='refresh' size={32} color='var(--color-icon-muted)' />
          </View>
          {loading && <Skeleton type='list' count={4} />}
          {!loading && filteredOfficialCards.length > 0 && renderCardGrid(filteredOfficialCards, true)}
          {localCards.length > 0 && (
            <><View className='market-section-title'><Text>我的卡片</Text></View>{renderCardGrid(localCards, false)}</>
          )}
          {showError && (
            <View className='market-error-state'>
              <Icon name='close' size={48} color='#FF9500' />
              <Text className='market-error-message'>{syncedStore.error}</Text>
              <View className='market-error-retry' onClick={handleRefresh}>
                <Text>点击重试</Text>
              </View>
            </View>
          )}
          {showEmpty && (
            <EmptyState icon={<Icon name='photo' size={64} color='var(--color-icon-disabled)' />} title='暂无背景卡' description='官方背景卡同步后将在此显示' />
          )}
          <View className='market-sub-create-bar'>
            <View className='market-create-card' onClick={() => handleCreateCard('BACKGROUND')}>
              <View className='market-create-card-inner'>
                <Icon name='plus' size={40} color='var(--color-icon-action)' />
                <Text className='market-create-card-label'>创建背景卡</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {subTab === 'create' && (
        <View className='market-create-panel'>
          <Text className='market-create-panel-title'>创建新卡片</Text>
          <Text className='market-create-panel-hint'>选择你要创建的卡片类型（本地保存）</Text>
          <View className='market-create-options'>
            {(['CHARACTER', 'MECHANISM', 'MAP', 'BACKGROUND'] as CardType[]).map(type => (
              <View key={type} className='market-create-option' onClick={() => handleCreateCard(type)}>
                <View className='market-create-option-icon'>
                  <Icon
                    name={type === 'CHARACTER' ? 'user' : type === 'MECHANISM' ? 'settings' : type === 'MAP' ? 'gallery' : 'photo'}
                    size={48} color='var(--color-icon-action)'
                  />
                </View>
                <Text className='market-create-option-label'>{CARD_TYPE_LABELS[type]}卡</Text>
                <Text className='market-create-option-desc'>
                  {type === 'CHARACTER' ? '创建角色设定与对话' : type === 'MECHANISM' ? '定义游戏规则与交互' : type === 'MAP' ? '设计探索场景与地图' : '设定世界观与故事背景'}
                </Text>
              </View>
            ))}
          </View>
          {localStore.cards.length > 0 && (
            <View className='market-local-cards-section'>
              <View className='market-section-title'><Text>我的本地卡片 ({localStore.cards.length})</Text></View>
              <ScrollView scrollY className='market-local-cards-list'>
                {localStore.cards.map(card => (
                  <View key={card.id} className='market-local-card-item' onClick={() => {
                    Taro.navigateTo({ url: `/pages/creator/index?cardType=${card.cardType}&edit=${card.id}` })
                  }}
                  >
                    <View className='market-local-card-info'>
                      <Text className='market-local-card-name'>{card.name}</Text>
                      <Text className='market-local-card-type'>{CARD_TYPE_LABELS[card.cardType] || card.cardType}卡</Text>
                    </View>
                    <Icon name='arrow-right' size={28} color='var(--color-icon-muted)' />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      <View className='market-sub-tabs'>
        {/* 返回按钮 — 回到开始页面 */}
        <View
          className='market-sub-tab market-sub-tab--back'
          onClick={() => Taro.switchTab({ url: '/pages/chat/index' })}
        >
          <Icon name='arrow-left' size={40} color='var(--color-icon-muted)' />
          <Text className='market-sub-tab-label'>返回</Text>
        </View>
        {/* 分割线 */}
        <View className='market-sub-tabs-divider' />
        {SUB_TABS.map(tab => (
          <View
            key={tab.key}
            className={`market-sub-tab ${subTab === tab.key ? 'market-sub-tab--active' : ''}`}
            onClick={() => setSubTab(tab.key)}
          >
            <Icon name={tab.icon} size={40} color={subTab === tab.key ? '#FFFFFF' : '#999'} />
            <Text className='market-sub-tab-label'>{tab.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
