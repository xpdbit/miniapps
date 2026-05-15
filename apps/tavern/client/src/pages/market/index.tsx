import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { marketService } from '@/services/marketService'
import CharacterCard from '@/components/CharacterCard'
import type { CharacterCard as CharacterCardType } from '@/types/character'
import type { ApiResponse } from '@/types/common'
import './index.scss'

type SortType = 'latest' | 'popular' | 'mostLiked' | 'mostFaved'

interface Tag {
  id: string
  name: string
  count: number
}

interface CarouselItem {
  id: string
  name: string
  avatar?: string | null
  description: string
  likes: number
}

export default function MarketPage() {
  const [carouselItems, setCarouselItems] = useState<CarouselItem[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [sortType, setSortType] = useState<SortType>('latest')
  const [characters, setCharacters] = useState<CharacterCardType[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentCarousel, setCurrentCarousel] = useState(0)

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 获取轮播图
  const fetchCarousel = useCallback(async () => {
    try {
      const res = await marketService.featured<{ data: CarouselItem[] }>()
      setCarouselItems(res.data?.slice(0, 5) ?? [])
    } catch {
      // 静默处理
    }
  }, [])

  // 获取标签
  const fetchTags = useCallback(async () => {
    try {
      const res = await marketService.tags<{ data: Tag[] }>()
      setTags(res.data ?? [])
    } catch {
      // 静默处理
    }
  }, [])

  // 获取角色列表
  const fetchCharacters = useCallback(async (pageNum: number, isRefresh = false) => {
    try {
      const params = {
        page: pageNum,
        pageSize: 20,
        sort: sortType,
        tag: selectedTag || undefined,
      }
      const res = await marketService.list<ApiResponse<{ items: CharacterCardType[]; hasMore: boolean }>>(params)
      if (isRefresh) {
        setCharacters(res.data?.items ?? [])
      } else {
        setCharacters(prev => [...prev, ...(res.data?.items ?? [])])
      }
      setHasMore(res.data?.hasMore ?? false)
    } catch {
      // 静默处理
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [sortType, selectedTag])

  // 搜索
  const fetchSearch = useCallback(async (query: string, pageNum: number, isRefresh = false) => {
    try {
      const res = await marketService.search<ApiResponse<{ items: CharacterCardType[]; hasMore: boolean }>>(query, pageNum)
      if (isRefresh) {
        setCharacters(res.data?.items ?? [])
      } else {
        setCharacters(prev => [...prev, ...(res.data?.items ?? [])])
      }
      setHasMore(res.data?.hasMore ?? false)
    } catch {
      // 静默处理
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // 初始化
  useEffect(() => {
    setLoading(true)
    Promise.all([fetchCarousel(), fetchTags()]).finally(() => {
      setLoading(false)
    })
  }, [fetchCarousel, fetchTags])

  // 排序或标签变化时刷新
  useEffect(() => {
    setLoading(true)
    setPage(1)
    if (searchQuery) {
      fetchSearch(searchQuery, 1, true)
    } else {
      fetchCharacters(1, true)
    }
  }, [sortType, selectedTag, fetchCharacters, fetchSearch])

  // 搜索防抖
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
    }
    if (searchQuery) {
      searchTimerRef.current = setTimeout(() => {
        setLoading(true)
        setPage(1)
        fetchSearch(searchQuery, 1, true)
      }, 300)
    } else {
      setLoading(true)
      setPage(1)
      fetchCharacters(1, true)
    }
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
      }
    }
  }, [searchQuery, fetchCharacters, fetchSearch])

  // 下拉刷新
  const onRefresh = useCallback(() => {
    setRefreshing(true)
    setPage(1)
    if (searchQuery) {
      fetchSearch(searchQuery, 1, true).finally(() => setRefreshing(false))
    } else {
      Promise.all([fetchCarousel(), fetchTags()]).finally(() => {
        fetchCharacters(1, true).finally(() => setRefreshing(false))
      })
    }
  }, [searchQuery, fetchCarousel, fetchTags, fetchCharacters, fetchSearch])

  // 上拉加载更多
  const onLoadMore = useCallback(() => {
    if (loading || !hasMore) return
    const nextPage = page + 1
    setPage(nextPage)
    if (searchQuery) {
      fetchSearch(searchQuery, nextPage, false)
    } else {
      fetchCharacters(nextPage, false)
    }
  }, [loading, hasMore, page, searchQuery, fetchSearch, fetchCharacters])

  // 轮播自动播放
  useEffect(() => {
    if (carouselItems.length <= 1) return
    const timer = setInterval(() => {
      setCurrentCarousel(prev => (prev + 1) % carouselItems.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [carouselItems.length])

  // 点击角色卡片
  const handleCardClick = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pages/character/detail/index?id=${id}` })
  }, [])

  // 选择标签
  const handleTagSelect = useCallback((tag: string) => {
    setSelectedTag(tag === selectedTag ? '' : tag)
  }, [selectedTag])

  // 排序选择
  const handleSortChange = useCallback((type: SortType) => {
    setSortType(type)
  }, [])

  // 搜索输入
  const handleSearchInput = useCallback((event: unknown) => {
    const ev = event as { detail: { value: string } }
    setSearchQuery(ev.detail.value)
  }, [])

  // 空状态
  const showEmpty = !loading && characters.length === 0

  return (
    <View className='page-market'>
      {/* 搜索栏 */}
      <View className='market-search'>
        <t-input
          className='market-search-input'
          placeholder='搜索角色...'
          value={searchQuery}
          onChange={handleSearchInput}
        />
      </View>

      {/* 轮播图 */}
      {carouselItems.length > 0 && (
        <View className='market-carousel'>
          <ScrollView
            scrollX
            scrollWithAnimation
            className='market-carousel-scroll'
            scrollLeft={currentCarousel * 300}
            enableFlex
          >
            {carouselItems.map((item) => (
              <View
                key={item.id}
                className='market-carousel-item'
                onClick={() => handleCardClick(item.id)}
              >
                {item.avatar ? (
                  <Image src={item.avatar} mode='aspectFill' className='market-carousel-img' />
                ) : (
                  <View className='market-carousel-placeholder'>{item.name[0]}</View>
                )}
                <View className='market-carousel-overlay'>
                  <Text className='market-carousel-name'>{item.name}</Text>
                  <Text className='market-carousel-likes'>&#9825; {item.likes}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <View className='market-carousel-dots'>
            {carouselItems.map((_, index) => (
              <View
                key={index}
                className={`market-carousel-dot ${currentCarousel === index ? 'active' : ''}`}
              />
            ))}
          </View>
        </View>
      )}

      {/* 标签栏 */}
      {tags.length > 0 && (
        <ScrollView scrollX className='market-tags' enableFlex>
          <View className='market-tags-row'>
            <View
              className={`market-tag ${selectedTag === '' ? 'active' : ''}`}
              onClick={() => handleTagSelect('')}
            >
              <Text>全部</Text>
            </View>
            {tags.map(tag => (
              <View
                key={tag.id}
                className={`market-tag ${selectedTag === tag.name ? 'active' : ''}`}
                onClick={() => handleTagSelect(tag.name)}
              >
                <Text>{tag.name}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* 排序栏 */}
      <View className='market-sort'>
        <View
          className={`market-sort-item ${sortType === 'latest' ? 'active' : ''}`}
          onClick={() => handleSortChange('latest')}
        >
          <Text>最新</Text>
        </View>
        <View
          className={`market-sort-item ${sortType === 'popular' ? 'active' : ''}`}
          onClick={() => handleSortChange('popular')}
        >
          <Text>最热</Text>
        </View>
        <View
          className={`market-sort-item ${sortType === 'mostLiked' ? 'active' : ''}`}
          onClick={() => handleSortChange('mostLiked')}
        >
          <Text>最多点赞</Text>
        </View>
      </View>

      {/* 主内容区域 - 使用 ScrollView 实现下拉刷新和无限滚动 */}
      <ScrollView
        scrollY
        className='market-content'
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={onRefresh}
        onScrollToLower={onLoadMore}
        lowerThreshold={100}
      >
        {/* 加载骨架屏 */}
        {loading && characters.length === 0 && (
          <View className='market-grid'>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <View key={i} className='market-skeleton'>
                <View className='market-skeleton-avatar' />
                <View className='market-skeleton-info'>
                  <View className='market-skeleton-title' />
                  <View className='market-skeleton-desc' />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 角色卡片网格 */}
        {!loading && characters.length > 0 && (
          <View className='market-grid'>
            {characters.map(character => (
              <CharacterCard
                key={character.id}
                id={character.id}
                name={character.name}
                avatar={character.avatar}
                description={character.description}
                tags={character.tags}
                status={character.status}
                chatCount={character.chats}
                likeCount={character.likes}
                onClick={handleCardClick}
              />
            ))}
          </View>
        )}

        {/* 空状态 */}
        {showEmpty && (
          <View className='market-empty'>
            <Text className='market-empty-icon'>?</Text>
            <Text className='market-empty-text'>暂无角色</Text>
            <Text className='market-empty-hint'>
              {searchQuery ? '换个关键词试试吧' : '稍后再来看看'}
            </Text>
          </View>
        )}

        {/* 加载更多 */}
        {!loading && hasMore && characters.length > 0 && (
          <View className='market-load-more'>
            <Text>加载更多...</Text>
          </View>
        )}

        {/* 没有更多了 */}
        {!loading && !hasMore && characters.length > 0 && (
          <View className='market-no-more'>
            <Text>没有更多了</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}