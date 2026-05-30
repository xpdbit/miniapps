import { View, Text, ScrollView, Image, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'

import { useSyncedCardsStore } from '@/stores/syncedCardsStore'
import { useLocalCardsStore } from '@/stores/localCardsStore'
import { useGameStore } from '@/stores/gameStore'
import { useChatStore } from '@/stores/chatStore'
import { usePrivacyStore } from '@/stores/privacyStore'
import { useSchemeStore } from '@/stores/schemeStore'
import { generateWithRetry, buildCardsPromptData, WORLD_BUILDER_SYSTEM_PROMPT } from '@/utils/aiWorldBuilder'
import { Icon } from '@/components'
import type { CardType, CharacterCard, LocalCard } from '@/types/character'
import './index.scss'

type Step = 'characters' | 'mechanics' | 'maps' | 'backgrounds' | 'confirm'

interface SelectedCards {
  characters: (CharacterCard | LocalCard)[]
  mechanics: (CharacterCard | LocalCard)[]
  maps: (CharacterCard | LocalCard)[]
  backgrounds: (CharacterCard | LocalCard)[]
}

const STEP_LABELS: Record<Step, string> = {
  characters: '选择角色卡',
  mechanics: '选择机制卡',
  maps: '选择地图卡',
  backgrounds: '选择背景卡',
  confirm: '确认',
}

const STEP_ORDER: { step: Step; cardType: CardType; min: number; max: number }[] = [
  { step: 'characters', cardType: 'CHARACTER' as CardType, min: 1, max: 5 },
  { step: 'mechanics', cardType: 'MECHANISM' as CardType, min: 1, max: 2 },
  { step: 'maps', cardType: 'MAP' as CardType, min: 1, max: 1 },
  { step: 'backgrounds', cardType: 'BACKGROUND' as CardType, min: 1, max: 1 },
]

export default function GameSetupPage() {
  const [step, setStep] = useState<Step>('characters')
  const [selectedCards, setSelectedCards] = useState<SelectedCards>({
    characters: [],
    mechanics: [],
    maps: [],
    backgrounds: [],
  })
  const [mounted, setMounted] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const syncedStore = useSyncedCardsStore()
  const localStore = useLocalCardsStore()
  const { createSave, updateSaveGroups, enableGameMode } = useGameStore()
  const { selectedModel } = useChatStore()
  const { privacyMode } = usePrivacyStore()
  const schemeStore = useSchemeStore()

  // 隐私模式下禁止使用群组/多人游戏功能
  useEffect(() => {
    if (privacyMode) {
      Taro.showModal({
        title: '隐私模式已开启',
        content: '群组/多人模式在隐私模式下暂不可用。\n\n请先在"我的"页面关闭隐私模式。',
        showCancel: false,
        confirmText: '我知道了',
        success: () => {
          Taro.switchTab({ url: '/pages/chat/index' })
        },
      })
    }
  }, [privacyMode])

  // 隐私模式下不渲染页面内容
  if (privacyMode) {
    return (
      <View className='game-setup'>
        <View className='game-setup-header'>
          <Text className='game-setup-header-title'>群组模式</Text>
        </View>
        <View className='game-setup-body'>
          <View className='game-setup-empty'>
            <Icon name='close' size={48} color='var(--color-warning)' />
            <Text className='game-setup-empty-title'>隐私模式已开启</Text>
            <Text className='game-setup-empty-desc'>
              群组/多人模式在隐私模式下暂不可用。{'\n'}
              请先在 &quot;我的&quot; 页面关闭隐私模式后再试。
            </Text>
          </View>
        </View>
      </View>
    )
  }

  const currentStepDef = STEP_ORDER.find(s => s.step === step)
  const syncedCards = currentStepDef ? syncedStore.getCardsByType(currentStepDef.cardType) : []
  const localCards = currentStepDef ? localStore.getCardsByType(currentStepDef.cardType) : []
  const allCards = [...syncedCards, ...localCards]
  const selected = currentStepDef ? selectedCards[step as keyof SelectedCards] : []
  const canNext = currentStepDef ? selected.length >= currentStepDef.min : false
  const isLastStep = step === 'backgrounds'
  const currentIdx = STEP_ORDER.findIndex(s => s.step === step)

  const toggleCard = (card: CharacterCard | LocalCard) => {
    const key = step as keyof SelectedCards
    const current = selectedCards[key]
    const exists = current.find(c => c.id === card.id)
    if (exists) {
      setSelectedCards({ ...selectedCards, [key]: current.filter(c => c.id !== card.id) })
    } else if (current.length < (currentStepDef?.max ?? 0)) {
      setSelectedCards({ ...selectedCards, [key]: [...current, card] })
    }
  }

  const handleNext = () => {
    if (!canNext) return
    if (isLastStep) {
      setStep('confirm')
    } else {
      const next = STEP_ORDER[currentIdx + 1]
      if (next) setStep(next.step)
    }
  }

  const handlePrev = () => {
    if (currentIdx > 0) {
      const prev = STEP_ORDER[currentIdx - 1]
      if (prev) setStep(prev.step)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const cardsData = buildCardsPromptData(selectedCards)

      const systemPrompt = WORLD_BUILDER_SYSTEM_PROMPT

      const userMessage = `角色卡: ${JSON.stringify(cardsData.characters)}\n机制卡: ${JSON.stringify(cardsData.mechanics)}\n地图卡: ${JSON.stringify(cardsData.maps)}\n背景卡: ${JSON.stringify(cardsData.backgrounds)}`

      const model = selectedModel || 'deepseek-chat'

      const result = await generateWithRetry(systemPrompt, userMessage, model)

      // 防御性校验：确保 groups 存在且为数组（extractGenResult 已验证，此处二次兜底）
      const groups = Array.isArray(result.groups) ? result.groups : []
      if (groups.length === 0) {
        throw new Error('AI 未返回有效的群组数据，请重试')
      }

      const save = createSave({
        name: saveName || result.worldSetting.title,
        playerCount: selectedCards.characters.length,
        userPersonaId: undefined, // TODO: 集成 Persona 选择步骤后替换
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
      enableGameMode()
      await Taro.showToast({ title: '世界构建完成!', icon: 'success' })
      // 显式导航：custom-tab-bar 在 game-setup（非 tabBar 页面）上未挂载，
      // gameModeChange 事件在此处无监听者，故必须由本页面主动导航。
      // 使用 reLaunch 而非 switchTab，因 /pages/chats/index 不在原生 tabBar 中。
      Taro.reLaunch({ url: '/pages/chats/index' })
    } catch (err) {
      console.error('[generate] error:', err)
      Taro.showToast({ title: '世界构建失败，请重试', icon: 'none' })
    } finally {
      setGenerating(false)
    }
  }

  const canGenerate = selectedCards.characters.length >= 1 &&
    selectedCards.mechanics.length >= 1 &&
    selectedCards.maps.length >= 1 &&
    selectedCards.backgrounds.length >= 1

  const handleSaveAsScheme = () => {
    const schemeId = 'user_scheme_' + Date.now().toString(36)
    const scheme = {
      id: schemeId,
      name: saveName || ('方案 ' + new Date().toLocaleDateString('zh-CN')),
      description: '包含 ' + selectedCards.characters.length + ' 张角色卡、' + selectedCards.mechanics.length + ' 张机制卡、' + selectedCards.maps.length + ' 张地图卡、' + selectedCards.backgrounds.length + ' 张背景卡',
      tags: [] as string[],
      cards: {
        characters: selectedCards.characters.map(c => c.id),
        mechanics: selectedCards.mechanics.map(c => c.id),
        maps: selectedCards.maps.map(c => c.id),
        backgrounds: selectedCards.backgrounds.map(c => c.id),
      },
      usageCount: 0,
    }
    schemeStore.addUserScheme(scheme)
    Taro.showToast({ title: '已保存为配卡方案', icon: 'success' })
  }

  const renderCardGrid = () => {
    return (
      <ScrollView className='game-setup-grid' scrollY>
        <View className='game-setup-grid-inner'>
          {allCards.map(card => {
            const isSelected = selected.find(c => c.id === card.id)
            return (
              <View
                key={card.id}
                className={`game-setup-card ${mounted ? 'game-setup-card--visible' : ''} ${isSelected ? 'game-setup-card--selected' : ''}`}
                onClick={() => toggleCard(card)}
              >
              <View className='game-setup-card-body'>
                <Text className='game-setup-card-name'>{card.name}</Text>
                <Text className='game-setup-card-desc'>{card.description || ''}</Text>
              </View>
              {isSelected && <View className='game-setup-card-check'>✓</View>}
            </View>
          )
        })}
      </View>
    </ScrollView>
    )
  }

  const renderConfirm = () => (
    <View className='game-setup-confirm'>
      <View className='game-setup-confirm-section'>
        <Text className='game-setup-confirm-section-title'>已选角色 ({selectedCards.characters.length})</Text>
        <View className='game-setup-confirm-tags'>
          {selectedCards.characters.map(c => (
            <Text key={c.id} className='game-setup-confirm-tag'>{c.name}</Text>
          ))}
        </View>
      </View>
      <View className='game-setup-confirm-section'>
        <Text className='game-setup-confirm-section-title'>已选机制 ({selectedCards.mechanics.length})</Text>
        <View className='game-setup-confirm-tags'>
          {selectedCards.mechanics.map(c => (
            <Text key={c.id} className='game-setup-confirm-tag game-setup-confirm-tag--secondary'>{c.name}</Text>
          ))}
        </View>
      </View>
      <View className='game-setup-confirm-section'>
        <Text className='game-setup-confirm-section-title'>地图卡</Text>
        <Text className='game-setup-confirm-map-name'>{selectedCards.maps[0]?.name || '未选择'}</Text>
      </View>
      <View className='game-setup-confirm-section'>
        <Text className='game-setup-confirm-section-title'>背景卡</Text>
        <Text className='game-setup-confirm-map-name'>{selectedCards.backgrounds[0]?.name || '未选择'}</Text>
      </View>
      <View className='game-setup-confirm-input-section'>
        <Text className='game-setup-confirm-section-title'>AI 模型</Text>
        <Text style={{ fontSize: '24px', color: 'var(--color-text-primary)' }}>
          {useChatStore.getState().selectedModel.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
        </Text>
        <Text style={{ fontSize: '20px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
          前往「我的」更换
        </Text>
      </View>
      <View className='game-setup-confirm-input-section'>
        <Text className='game-setup-confirm-section-title'>存档名称（可选）</Text>
        <Input
          className='game-setup-confirm-input'
          value={saveName}
          onInput={e => setSaveName(e.detail.value)}
          placeholder='留空则使用AI生成的世界观标题'
        />
      </View>
      <View
        className={`game-setup-confirm-btn ${generating ? 'game-setup-confirm-btn--loading' : ''} ${!canGenerate ? 'game-setup-confirm-btn--disabled' : ''}`}
        onClick={generating || !canGenerate ? undefined : handleGenerate}
      >
        <Text>{generating ? 'AI 构建世界中...' : !canGenerate ? '请至少为每个分类选择一张卡片' : '开始游戏'}</Text>
      </View>
      <View
        className='game-setup-confirm-btn game-setup-confirm-btn--secondary'
        onClick={handleSaveAsScheme}
      >
        <Text>保存为配卡方案</Text>
      </View>
    </View>
  )

  return (
    <View className='game-setup'>
      <View className='game-setup-header'>
        {step !== 'confirm' && currentIdx > 0 && (
          <View className='game-setup-header-back' onClick={handlePrev}>
            <Icon name='arrow-left' size={36} color='var(--color-icon-action)' />
          </View>
        )}
        <Text className='game-setup-header-title'>{STEP_LABELS[step]}</Text>
      </View>

      {step !== 'confirm' && (
        <View className='game-setup-progress'>
          {STEP_ORDER.map((s, i) => (
            <View
              key={s.step}
              className={`game-setup-progress-dot ${i <= currentIdx ? 'game-setup-progress-dot--active' : ''}`}
            >
              {i < currentIdx ? '✓' : i + 1}
            </View>
          ))}
        </View>
      )}

      <View className='game-setup-body'>
        {step !== 'confirm' ? (
          <>
            <Text className='game-setup-hint'>
              已选 {selected.length}/{currentStepDef?.max ?? 0} （最少 {currentStepDef?.min ?? 0} 个）
            </Text>
            {renderCardGrid()}
          </>
        ) : (
          renderConfirm()
        )}
      </View>

      {step !== 'confirm' && (
        <View className='game-setup-bottom'>
          <Text className='game-setup-bottom-count'>
            已选 {selected.length}/{currentStepDef?.max ?? 0}
          </Text>
          <View
            className={`game-setup-bottom-btn ${canNext ? '' : 'game-setup-bottom-btn--disabled'}`}
            onClick={canNext ? handleNext : undefined}
          >
            <Text>{isLastStep ? '确认选择' : '下一步'}</Text>
          </View>
        </View>
      )}
    </View>
  )
}
