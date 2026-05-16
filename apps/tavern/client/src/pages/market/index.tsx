import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import CharacterCard from '@/components/CharacterCard'
import { useSyncedCardsStore } from '@/stores/syncedCardsStore'
import { useLocalCardsStore } from '@/stores/localCardsStore'
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

function showMainTabBar(show: boolean) {
  Taro.eventCenter.trigger('tavernSubTab', show ? 'main' : 'sub')
}

export default function MarketPage() {
  const [subTab, setSubTab] = useState<SubTabType>('character')
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const syncedStore = useSyncedCardsStore()
  const localStore = useLocalCardsStore()

  useDidShow(() => {
    Taro.eventCenter.trigger('tabChange', 0)
    showMainTabBar(true)
    syncedStore.syncCards()
  })

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

  const handleCardClick = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pages/character/detail/index?id=${id}` })
  }, [])

  const handleCreateCard = useCallback((cardType: CardType) => {
    Taro.navigateTo({ url: `/pages/creator/index?cardType=${cardType}` })
  }, [])

  const handleSearchInput = useCallback((e: { detail: { value: string } }) => {
    setSearchQuery(e.detail.value)
  }, [])

  const showEmpty = !loading && filteredOfficialCards.length === 0 && localCards.length === 0

  const renderCardGrid = (cards: (CharacterCardType | LocalCard)[], isOfficial: boolean) => (
    <View className='market-grid'>
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
                Taro.navigateTo({ url: `/pages/chat/index?characterId=${card.id}&local=true` })
              }
            }}
          />
          {isOfficial && (
            <View
              className='market-grid-detail-btn'
              onClick={(e) => {
                e.stopPropagation()
                handleCardClick(card.id)
              }}
            >
              <Icon name='arrow-right' size={28} color='#C49A6C' />
            </View>
          )}
        </View>
      ))}
    </View>
  )

  return (
    <View className='page-market'>
      {subTab === 'character' && (
        <View className='market-character-area'>
          <View className='market-search'>
            <View className='market-search-wrapper'>
              <Icon name='search' size={40} color='#999' />
              <Input
                className='market-search-input'
                placeholder='搜索角色...'
                value={searchQuery}
                onInput={handleSearchInput}
              />
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
            {showEmpty && (
              <EmptyState icon={<Icon name='user' size={64} color='#CCCCCC' />} title='暂无角色' description={searchQuery ? '换个关键词试试吧' : '稍后再来看看'} />
            )}
          </ScrollView>
        </View>
      )}

      {subTab === 'mechanism' && (
        <View className='market-sub-panel-content'>
          {loading && <Skeleton type='list' count={4} />}
          {!loading && filteredOfficialCards.length > 0 && renderCardGrid(filteredOfficialCards, true)}
          {localCards.length > 0 && (
            <><View className='market-section-title'><Text>我的卡片</Text></View>{renderCardGrid(localCards, false)}</>
          )}
          {showEmpty && (
            <EmptyState icon={<Icon name='settings' size={64} color='#CCCCCC' />} title='暂无机制卡' description='官方机制卡同步后将在此显示' />
          )}
          <View className='market-sub-create-bar'>
            <View className='market-create-card' onClick={() => handleCreateCard('MECHANISM')}>
              <View className='market-create-card-inner'>
                <Icon name='plus' size={40} color='#FF6B35' />
                <Text className='market-create-card-label'>创建机制卡</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {subTab === 'map' && (
        <View className='market-sub-panel-content'>
          {loading && <Skeleton type='list' count={4} />}
          {!loading && filteredOfficialCards.length > 0 && renderCardGrid(filteredOfficialCards, true)}
          {localCards.length > 0 && (
            <><View className='market-section-title'><Text>我的卡片</Text></View>{renderCardGrid(localCards, false)}</>
          )}
          {showEmpty && (
            <EmptyState icon={<Icon name='gallery' size={64} color='#CCCCCC' />} title='暂无地图卡' description='官方地图卡同步后将在此显示' />
          )}
          <View className='market-sub-create-bar'>
            <View className='market-create-card' onClick={() => handleCreateCard('MAP')}>
              <View className='market-create-card-inner'>
                <Icon name='plus' size={40} color='#FF6B35' />
                <Text className='market-create-card-label'>创建地图卡</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {subTab === 'background' && (
        <View className='market-sub-panel-content'>
          {loading && <Skeleton type='list' count={4} />}
          {!loading && filteredOfficialCards.length > 0 && renderCardGrid(filteredOfficialCards, true)}
          {localCards.length > 0 && (
            <><View className='market-section-title'><Text>我的卡片</Text></View>{renderCardGrid(localCards, false)}</>
          )}
          {showEmpty && (
            <EmptyState icon={<Icon name='photo' size={64} color='#CCCCCC' />} title='暂无背景卡' description='官方背景卡同步后将在此显示' />
          )}
          <View className='market-sub-create-bar'>
            <View className='market-create-card' onClick={() => handleCreateCard('BACKGROUND')}>
              <View className='market-create-card-inner'>
                <Icon name='plus' size={40} color='#FF6B35' />
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
                    size={48} color='#FF6B35'
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
                  }}>
                    <View className='market-local-card-info'>
                      <Text className='market-local-card-name'>{card.name}</Text>
                      <Text className='market-local-card-type'>{CARD_TYPE_LABELS[card.cardType] || card.cardType}卡</Text>
                    </View>
                    <Icon name='arrow-right' size={28} color='#999' />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      <View className='market-sub-tabs'>
        {SUB_TABS.map(tab => (
          <View
            key={tab.key}
            className={`market-sub-tab ${subTab === tab.key ? 'market-sub-tab--active' : ''}`}
            onClick={() => setSubTab(tab.key)}
          >
            <Icon name={tab.icon} size={40} color={subTab === tab.key ? '#FF6B35' : '#999'} />
            <Text className='market-sub-tab-label'>{tab.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
