import { View, Text, ScrollView, Image, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'

import { useSyncedCardsStore } from '@/stores/syncedCardsStore'
import { useLocalCardsStore } from '@/stores/localCardsStore'
import { useGameStore } from '@/stores/gameStore'
import { generateText } from '@/services/aiService'
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
  const [saveName, setSaveName] = useState('')
  const [generating, setGenerating] = useState(false)

  const syncedStore = useSyncedCardsStore()
  const localStore = useLocalCardsStore()
  const { createSave, updateSaveGroups } = useGameStore()

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
      const cardsData = {
        characters: selectedCards.characters.map(c => ({ id: c.id, name: c.name, description: c.description, prompt: c.prompt })),
        mechanics: selectedCards.mechanics.map(c => ({ id: c.id, name: c.name, description: c.description })),
        maps: selectedCards.maps.map(c => ({ id: c.id, name: c.name, description: c.description })),
        backgrounds: selectedCards.backgrounds.map(c => ({ id: c.id, name: c.name, description: c.description })),
      }

      const systemPrompt = '你是一个游戏世界构建师。基于卡牌组合构建世界观，并将角色分配到群组中。\n以 JSON 格式返回（不要 markdown 包裹）：\n{\n  "worldSetting": { "title": "世界观标题", "description": "世界观描述（200字内）", "rules": ["规则1", "规则2", "规则3"] },\n  "groups": [{ "name": "群组名称", "memberIds": ["角色ID"] }]\n}\n要求：群组 2-4 个，每个角色至少属于一个群组，第一个群组为"世界公告群"包含所有角色。'

      const userMessage = `角色卡: ${JSON.stringify(cardsData.characters)}\n机制卡: ${JSON.stringify(cardsData.mechanics)}\n地图卡: ${JSON.stringify(cardsData.maps)}\n背景卡: ${JSON.stringify(cardsData.backgrounds)}`

      interface GenResult {
        worldSetting: { title: string; description: string; rules: string[] }
        groups: Array<{ name: string; memberIds: string[] }>
      }

      const resultText = await generateText({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        model: 'big-pickle',
      })
      // Extract JSON from response (may have markdown wrapping)
      const jsonMatch = resultText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
        || resultText.match(/{[\s\S]*}/)
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : resultText
      const result: GenResult = JSON.parse(jsonStr)

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
        groups: result.groups.map((g, i) => ({
          id: 'group_' + Date.now().toString(36) + '_' + i,
          name: g.name,
          memberIds: g.memberIds,
          isGroup: true as const,
          pinned: i === 0,
          pinnedAt: i === 0 ? Date.now() : undefined,
          updatedAt: Date.now(),
        })),
      })

      updateSaveGroups(save.id, save.groups)
      await Taro.showToast({ title: '世界构建完成!', icon: 'success' })
      Taro.switchTab({ url: '/pages/chat/index' })
    } catch (err) {
      console.error('[generate] error:', err)
      Taro.showToast({ title: '世界构建失败，请重试', icon: 'none' })
    } finally {
      setGenerating(false)
    }
  }

  const confirmCanGenerate = selectedCards.characters.length >= 1 &&
    selectedCards.mechanics.length >= 1 &&
    selectedCards.maps.length >= 1 &&
    selectedCards.backgrounds.length >= 1

  const renderCardGrid = () => (
    <ScrollView className='game-setup-grid' scrollY>
      <View className='game-setup-grid-inner'>
        {allCards.map(card => {
          const isSelected = selected.find(c => c.id === card.id)
          return (
            <View
              key={card.id}
              className={`game-setup-card ${isSelected ? 'game-setup-card--selected' : ''}`}
              onClick={() => toggleCard(card)}
            >
              <View className='game-setup-card-avatar'>
                {card.avatar ? (
                  <Image src={card.avatar} mode='aspectFill' className='game-setup-card-avatar-img' />
                ) : (
                  <Text className='game-setup-card-avatar-text'>{(card.name || '?')[0]}</Text>
                )}
              </View>
              <Text className='game-setup-card-name'>{card.name}</Text>
              <Text className='game-setup-card-desc'>{card.description?.slice(0, 30) || ''}</Text>
              {isSelected && <View className='game-setup-card-check'>✓</View>}
            </View>
          )
        })}
      </View>
    </ScrollView>
  )

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
        <Text className='game-setup-confirm-section-title'>存档名称（可选）</Text>
        <Input
          className='game-setup-confirm-input'
          value={saveName}
          onInput={e => setSaveName(e.detail.value)}
          placeholder='留空则使用AI生成的世界观标题'
        />
      </View>
      <View
        className={`game-setup-confirm-btn ${generating ? 'game-setup-confirm-btn--loading' : ''}`}
        onClick={generating ? undefined : handleGenerate}
      >
        <Text>{generating ? 'AI 构建世界中...' : '开始游戏'}</Text>
      </View>
    </View>
  )

  return (
    <View className='game-setup'>
      <View className='game-setup-header'>
        {step !== 'confirm' && currentIdx > 0 && (
          <View className='game-setup-header-back' onClick={handlePrev}>
            <Icon name='arrow-left' size={36} color='#007AFF' />
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
