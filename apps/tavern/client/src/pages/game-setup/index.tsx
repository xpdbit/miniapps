import { View, Text, ScrollView, Image, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'

import { useSyncedCardsStore } from '@/stores/syncedCardsStore'
import { useLocalCardsStore } from '@/stores/localCardsStore'
import { useGameStore } from '@/stores/gameStore'
import { useChatStore } from '@/stores/chatStore'
import { usePrivacyStore } from '@/stores/privacyStore'
import { generateText } from '@/services/aiService'
import { Icon, ModelSelector } from '@/components'
import type { CardType, CharacterCard, LocalCard } from '@/types/character'
import './index.scss'

/**
 * 卡片网格间距 (px) — 与 app.scss 中 --spacing-sm 保持一致。
 * 若修改 app.scss 中的 --spacing-sm，此处需同步更新。
 * @see apps/tavern/client/src/app.scss:108 `--spacing-sm: 16px`
 */
const CARD_GAP_PX = 16

/* ========================================================================
 *  AI 响应 JSON 提取器 — 健壮版
 *  1. 优先尝试 markdown 代码块（```json ... ```）
 *  2. 按嵌套深度逐个匹配 {} 对并尝试 JSON.parse
 *  3. 校验是否包含 worldSetting + groups 两个必需字段
 *  ======================================================================== */
interface GenResult {
  worldSetting: { title: string; description: string; rules: string[] }
  groups: Array<{ name: string; memberIds: string[] }>
}

/** 重试用更严格提示 */
const RETRY_SYSTEM_PROMPT = '你是一个 JSON 生成器。只输出以下 JSON，不要任何其他文字、解释、代码块。\nJSON 结构：\n{\n  "worldSetting": { "title": "世界观标题", "description": "世界观描述（200字内）", "rules": ["规则1", "规则2", "规则3"] },\n  "groups": [{ "name": "群组名称", "memberIds": ["角色ID"] }]\n}'

/**
 * 调用 AI 并尝试提取 JSON，首次失败时自动重试一次。
 */
async function generateWithRetry(systemPrompt: string, userMessage: string, model: string): Promise<GenResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = attempt === 0 ? systemPrompt : RETRY_SYSTEM_PROMPT
    const resultText = await generateText({
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: userMessage },
      ],
      model,
    })
    if (!resultText || !resultText.trim()) {
      if (attempt === 0) {
        console.warn('[generate] AI 返回空响应，自动重试中...')
        continue
      }
      throw new Error('AI 返回了空响应，请重试')
    }
    try {
      return extractGenResult(resultText)
    } catch (err) {
      if (attempt === 0) {
        console.warn(
          '[generate] JSON 提取失败，自动重试中:',
          err instanceof Error ? err.message : String(err),
          '\nAI 响应片段 (前 300 字):',
          resultText.slice(0, 300),
        )
        continue
      }
      console.error('[generate] 两次尝试均失败，AI 完整响应:', resultText.slice(0, 1000))
      throw err
    }
  }
  throw new Error('AI 响应解析失败，请重试')
}

/**
 * Sanitize a JSON candidate string before parsing.
 * Fixes common AI output issues: preamble text, unescaped
 * newlines/separators, trailing commas, BOM characters.
 */
function sanitizeJsonCandidate(raw: string): string {
  let result = raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '') // control chars (keep \t \n \r)
    .replace(/\u2028/g, '\\u2028')  // LINE SEPARATOR → \u2028 escape
    .replace(/\u2029/g, '\\u2029')  // PARAGRAPH SEPARATOR → \u2029 escape
    .replace(/[\uFEFF\uFFFE]/g, '')  // BOM (U+FEFF) & reversed BOM (U+FFFE)
    .replace(/\uFFFF/g, '')          // noncharacter
    // NOTE: Do NOT globally escape \n / \r → \\n / \\r.
    // JSON.parse treats \n and \r as whitespace between tokens,
    // so structural newlines are safe. Escaping them globally
    // would break valid JSON: {\n  "k":"v"\n} → {\n  "k":"v"\n} (invalid).
    // If string values contain literal unescaped newlines, the AI
    // prompt is designed to prevent that.
    .replace(/,(\s*[}\]])/g, '$1')  // remove trailing commas
    // Fix malformed keys missing colon: "key [" / "key {" → "key": [ / "key": {
    // Common AI output error when the model drops the closing quote + colon
    .replace(/([{,]\s*)"(\w+)\s+([\[\{])/g, '$1"$2": $3')

  // Strip everything before the first { or [ (AI preamble like "Here:" or "好的：")
  const braceIdx = result.search(/[\{\[]/)
  if (braceIdx > 0) {
    result = result.slice(braceIdx)
  }

  return result
}

function extractGenResult(text: string): GenResult {
  /** 校验 groups 结构：必须是数组且每个 group 的 memberIds 也是数组 */
  function isValidGenResult(parsed: unknown): parsed is GenResult {
    if (!parsed || typeof parsed !== 'object') return false
    const p = parsed as Record<string, unknown>
    if (!('worldSetting' in p) || !('groups' in p)) return false
    if (!Array.isArray(p.groups)) return false
    // 验证 worldSetting 基本结构
    const ws = p.worldSetting as Record<string, unknown> | null | undefined
    if (!ws || typeof ws.title !== 'string' || typeof ws.description !== 'string') return false
    // 验证每个 group 的 memberIds 是数组
    const groups = p.groups as unknown[]
    for (const g of groups) {
      const group = g as Record<string, unknown> | null | undefined
      if (!group || typeof group.name !== 'string' || !Array.isArray(group.memberIds)) return false
    }
    return true
  }

  // Step 1: Try markdown code block (with or without json tag)
  const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (mdMatch) {
    const candidate = (mdMatch[1] || '').trim()
    try {
      const parsed = JSON.parse(sanitizeJsonCandidate(candidate))
      if (isValidGenResult(parsed)) return parsed
    } catch { /* fall through */ }
  }

  // Step 2: Find each { ... } pair by tracking nesting depth, validate structure
  let searchStart = 0
  while (searchStart < text.length) {
    const braceOpen = text.indexOf('{', searchStart)
    if (braceOpen === -1) break

    let depth = 0
    let braceClose = -1
    // Skip braces inside JSON strings by tracking quote state
    let inString = false
    let escapeNext = false
    for (let i = braceOpen; i < text.length; i++) {
      const ch = text[i] as string
      if (escapeNext) {
        escapeNext = false
        continue
      }
      if (ch === '\\') {
        escapeNext = true
        continue
      }
      if (ch === '"' && !inString) {
        inString = true
        continue
      }
      if (ch === '"' && inString) {
        inString = false
        continue
      }
      if (inString) continue
      if (ch === '{') depth++
      else if (ch === '}') depth--
      if (depth === 0) { braceClose = i; break }
    }
    if (braceClose === -1) break // unclosed brace, give up

    const candidate = text.slice(braceOpen, braceClose + 1)
    try {
      const parsed = JSON.parse(sanitizeJsonCandidate(candidate))
      if (isValidGenResult(parsed)) return parsed
    } catch { /* try next brace pair */ }

    searchStart = braceOpen + 1
  }

  // Debug: log raw text for diagnostics
  console.warn('[extractGenResult] 原始 AI 响应 (前 500 字):', text.slice(0, 500))
  throw new Error('AI 响应中未找到有效的 JSON 结构，请重试')
}

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
  const { createSave, updateSaveGroups, enableGameMode, cardsPerRow } = useGameStore()
  const { selectedModel } = useChatStore()
  const { privacyMode } = usePrivacyStore()

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
            <Icon name='close' size={48} color='#FF9500' />
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
      const cardsData = {
        characters: selectedCards.characters.map(c => ({ id: c.id, name: c.name, description: c.description, prompt: c.prompt })),
        mechanics: selectedCards.mechanics.map(c => ({ id: c.id, name: c.name, description: c.description })),
        maps: selectedCards.maps.map(c => ({ id: c.id, name: c.name, description: c.description })),
        backgrounds: selectedCards.backgrounds.map(c => ({ id: c.id, name: c.name, description: c.description })),
      }

      const systemPrompt = '你是一个游戏世界构建师。基于卡牌组合构建世界观，并将角色分配到群组中。\n\n【重要】只输出纯 JSON，不要任何额外文字、解释、问候语、或 markdown 代码块。\n\nJSON 结构必须严格遵守（不要修改字段名）：\n{\n  "worldSetting": { "title": "世界观标题", "description": "世界观描述（200字内）", "rules": ["规则1", "规则2", "规则3"] },\n  "groups": [{ "name": "群组名称", "memberIds": ["角色ID"] }]\n}\n\n要求：群组 2-4 个，每个角色至少属于一个群组，第一个群组为"世界公告群"包含所有角色。memberIds 必须使用传入的角色 ID 字符串，不要捏造或修改 ID。'

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

  const renderCardGrid = () => {
    // 动态计算每张卡宽度：(100% / N) - gap * (N-1) / N
    const cardWidth = `calc(${100 / cardsPerRow}% - ${(CARD_GAP_PX * (cardsPerRow - 1)) / cardsPerRow}px)`

    return (
      <ScrollView className='game-setup-grid' scrollY>
        <View className='game-setup-grid-inner'>
          {allCards.map(card => {
            const isSelected = selected.find(c => c.id === card.id)
            return (
              <View
                key={card.id}
                className={`game-setup-card ${isSelected ? 'game-setup-card--selected' : ''}`}
                style={{ width: cardWidth }}
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
        <ModelSelector
          compact
          onModelChange={(_modelId) => {
            Taro.showToast({ title: `已切换模型`, icon: 'none', duration: 1000 })
          }}
        />
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
