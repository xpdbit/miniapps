import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { useSchemeStore, CardScheme, CardRef } from '@/stores/schemeStore'
import { useSyncedCardsStore } from '@/stores/syncedCardsStore'
import { useLocalCardsStore } from '@/stores/localCardsStore'
import { useGameStore } from '@/stores/gameStore'
import { useChatStore } from '@/stores/chatStore'
import { Icon } from '@/components'
import { generateWithRetry, buildCardsPromptData, WORLD_BUILDER_SYSTEM_PROMPT } from '@/utils/aiWorldBuilder'
import './index.scss'

export default function SchemeDetailPage() {
  const router = useRouter()
  const schemeId = router.params.id || ''
  const [scheme, setScheme] = useState<CardScheme | null>(null)
  const [saveName, setSaveName] = useState('')
  const [generating, setGenerating] = useState(false)

  const schemeStore = useSchemeStore()
  const syncedStore = useSyncedCardsStore()
  const localStore = useLocalCardsStore()
  const { createSave, updateSaveGroups, enableGameMode } = useGameStore()
  const { selectedModel } = useChatStore()

  // Resolve card IDs to card objects (stores first, then fall back to scheme cardDetails)
  const allCards = [...syncedStore.cards, ...localStore.cards]
  const resolveCardDetails = (ids: string[], details?: CardRef[]): CardRef[] => {
    const fromStores: CardRef[] = ids
      .map(id => allCards.find(c => c.id === id))
      .filter((c): c is NonNullable<typeof c> => c != null)
      .map(c => ({ id: c.id, name: c.name, description: c.description }))
    // All cards found in stores → use stores (has full card data including prompt)
    if (fromStores.length === ids.length && ids.length > 0) return fromStores
    // Some or all cards missing from stores → fall back to scheme's embedded cardDetails
    if (details && details.length > 0) return details
    // No cardDetails fallback available → return what stores have (partial is better than none)
    return fromStores
  }

  useEffect(() => {
    const found = schemeStore.officialSchemes.find(s => s.id === schemeId) ||
      schemeStore.userSchemes.find(s => s.id === schemeId)
    setScheme(found || null)
  }, [schemeId, schemeStore.officialSchemes, schemeStore.userSchemes])

  const handleStart = async () => {
    if (!scheme) return
    setGenerating(true)
    try {
      const selectedCards = {
        characters: resolveCardDetails(scheme.cards.characters, scheme.cardDetails?.characters),
        mechanics: resolveCardDetails(scheme.cards.mechanics, scheme.cardDetails?.mechanics),
        maps: resolveCardDetails(scheme.cards.maps, scheme.cardDetails?.maps),
        backgrounds: resolveCardDetails(scheme.cards.backgrounds, scheme.cardDetails?.backgrounds),
      }

      if (selectedCards.characters.length === 0) {
        Taro.showToast({ title: '该方案暂无可用的卡片，部分玩法受限', icon: 'none' })
      }

      const cardsData = buildCardsPromptData(selectedCards)
      const userMessage = `角色卡: ${JSON.stringify(cardsData.characters)}\n机制卡: ${JSON.stringify(cardsData.mechanics)}\n地图卡: ${JSON.stringify(cardsData.maps)}\n背景卡: ${JSON.stringify(cardsData.backgrounds)}`
      const model = selectedModel || 'deepseek-chat'
      const result = await generateWithRetry(WORLD_BUILDER_SYSTEM_PROMPT, userMessage, model)

      const groups = Array.isArray(result.groups) ? result.groups : []
      const save = createSave({
        name: saveName || result.worldSetting.title,
        playerCount: selectedCards.characters.length,
        selectedCards: {
          characters: selectedCards.characters.map(c => c.id),
          mechanics: selectedCards.mechanics.map(c => c.id),
          maps: selectedCards.maps.map(c => c.id),
          backgrounds: selectedCards.backgrounds.map(c => c.id),
        },
        worldSetting: result.worldSetting,
        groups: groups.map((g, i) => ({
          id: 'group_' + Date.now().toString(36) + '_' + i,
          name: g.name || '未命名群组',
          memberIds: Array.isArray(g.memberIds) ? g.memberIds : [],
          isGroup: true as const,
          pinned: i === 0,
          pinnedAt: i === 0 ? Date.now() : undefined,
          updatedAt: Date.now(),
        })),
      })

      updateSaveGroups(save.id, save.groups)
      schemeStore.incrementUsage(scheme.id)
      enableGameMode()
      await Taro.showToast({ title: '世界构建完成!', icon: 'success' })
      Taro.reLaunch({ url: '/pages/chats/index' })
    } catch (err) {
      console.error('[scheme-detail] generate error:', err)
      Taro.showToast({ title: '世界构建失败，请重试', icon: 'none' })
    } finally {
      setGenerating(false)
    }
  }

  if (!scheme) {
    return (
      <View className='scheme-detail'>
        <View className='scheme-detail-empty'>
          <Text>配卡方案不存在</Text>
        </View>
      </View>
    )
  }

  return (
    <View className='scheme-detail'>
      <View className='scheme-detail-header'>
        <View className='scheme-detail-back' onClick={() => Taro.navigateBack()}>
          <Icon name='arrow-left' size={36} color='var(--color-icon-action)' />
        </View>
        <Text className='scheme-detail-title'>配卡方案详情</Text>
      </View>

      <ScrollView scrollY className='scheme-detail-body'>
        <View className='scheme-detail-tags'>
          {scheme.tags.map(tag => (
            <Text key={tag} className='scheme-detail-tag'>#{tag}</Text>
          ))}
          {scheme.source === 'official' && (
            <Text className='scheme-detail-tag scheme-detail-tag--official'>官方推荐</Text>
          )}
        </View>

        <Text className='scheme-detail-name'>{scheme.name}</Text>
        <Text className='scheme-detail-desc'>{scheme.description}</Text>
        {scheme.usageCount > 0 && (
          <Text className='scheme-detail-usage'>已使用 {scheme.usageCount} 次</Text>
        )}

        <View className='scheme-detail-section'>
          <Text className='scheme-detail-section-title'>卡组构成</Text>
          {resolveCardDetails(scheme.cards.characters, scheme.cardDetails?.characters).length > 0 && (
            <View className='scheme-detail-card-type'>
              <Text className='scheme-detail-card-type-label'>角色卡</Text>
              <View className='scheme-detail-card-names'>
                {resolveCardDetails(scheme.cards.characters, scheme.cardDetails?.characters).map(c => (
                  <Text key={c.id} className='scheme-detail-card-name'>{c.name}</Text>
                ))}
              </View>
            </View>
          )}
          {resolveCardDetails(scheme.cards.mechanics, scheme.cardDetails?.mechanics).length > 0 && (
            <View className='scheme-detail-card-type'>
              <Text className='scheme-detail-card-type-label'>机制卡</Text>
              <View className='scheme-detail-card-names'>
                {resolveCardDetails(scheme.cards.mechanics, scheme.cardDetails?.mechanics).map(c => (
                  <Text key={c.id} className='scheme-detail-card-name'>{c.name}</Text>
                ))}
              </View>
            </View>
          )}
          {resolveCardDetails(scheme.cards.maps, scheme.cardDetails?.maps).length > 0 && (
            <View className='scheme-detail-card-type'>
              <Text className='scheme-detail-card-type-label'>地图卡</Text>
              <View className='scheme-detail-card-names'>
                {resolveCardDetails(scheme.cards.maps, scheme.cardDetails?.maps).map(c => (
                  <Text key={c.id} className='scheme-detail-card-name'>{c.name}</Text>
                ))}
              </View>
            </View>
          )}
          {resolveCardDetails(scheme.cards.backgrounds, scheme.cardDetails?.backgrounds).length > 0 && (
            <View className='scheme-detail-card-type'>
              <Text className='scheme-detail-card-type-label'>背景卡</Text>
              <View className='scheme-detail-card-names'>
                {resolveCardDetails(scheme.cards.backgrounds, scheme.cardDetails?.backgrounds).map(c => (
                  <Text key={c.id} className='scheme-detail-card-name'>{c.name}</Text>
                ))}
              </View>
            </View>
          )}
          {resolveCardDetails(
            Object.values(scheme.cards).flat(),
            Object.values(scheme.cardDetails || {}).flat()
          ).length === 0 && (
            <Text className='scheme-detail-card-empty'>该方案暂未配置具体卡片</Text>
          )}
        </View>

        <View className='scheme-detail-section'>
          <Text className='scheme-detail-section-title'>游戏设置</Text>
          <View className='scheme-detail-setting'>
            <Text className='scheme-detail-setting-label'>存档名称</Text>
            <Input
              className='scheme-detail-setting-input'
              value={saveName}
              onInput={e => setSaveName(e.detail.value)}
              placeholder='留空则使用AI生成的世界观标题'
            />
          </View>
          <View className='scheme-detail-setting'>
            <Text className='scheme-detail-setting-label'>AI 模型</Text>
            <Text style={{ fontSize: '24px', color: 'var(--color-text-primary)' }}>
              {useChatStore.getState().selectedModel.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View className='scheme-detail-bottom'>
        <View
          className={`scheme-detail-start-btn ${generating ? 'scheme-detail-start-btn--loading' : ''}`}
          onClick={generating ? undefined : handleStart}
        >
          <Text>{generating ? 'AI 构建世界中...' : '开始游戏'}</Text>
        </View>
      </View>
    </View>
  )
}
