import type { GameWorldState } from '@/types/ai-script'
import { getEventTypeDescriptions } from './ai-scripts/registry'

export interface CharacterData {
  name: string
  description: string
  prompt?: string | null
}

export interface PersonaData {
  name: string
  description?: string | null
}

export interface HistoryMessage {
  role: string
  content: string
}

export interface BuiltPrompt {
  messages: Array<{ role: string; content: string }>
  tokenEstimate: number
}

function estimateTokens(text: string): number {
  let tokens = 0
  for (const char of text) {
    if (/[\u4e00-\u9fff]/.test(char)) tokens += 2
    else if (/\s/.test(char)) tokens += 0.25
    else tokens += 0.3
  }
  return Math.ceil(tokens)
}

/**
 * Build game context prompt section from game state.
 * Returns empty string if no game state provided.
 */
export function buildGameContextPrompt(gameState: GameWorldState | null, currentCharId?: string): string {
  if (!gameState) return ''

  const { world, characters } = gameState
  const charList = Object.values(characters)

  // 当前角色优先展示
  const currentChar = currentCharId ? characters[currentCharId] : undefined
  const otherChars = currentChar
    ? charList.filter((c) => c.id !== currentCharId)
    : charList

  const currentCharSection = currentChar
    ? [
        `【你的状态】`,
        `位置：${currentChar.location}`,
        `心情：${currentChar.mood}/100  精力：${currentChar.energy}/100  健康：${currentChar.health}/100  饱食：${currentChar.hunger}/100`,
      ].join('\n')
    : ''

  const otherCharsSection = otherChars.length > 0
    ? [
        '',
        '【其他角色状态】',
        ...otherChars.map(
          (c) =>
            `${c.name}: ${c.location} | 心情 ${c.mood} 精力 ${c.energy} 健康 ${c.health} 饱食 ${c.hunger}`,
        ),
      ].join('\n')
    : ''

  const eventDescriptions = getEventTypeDescriptions().join('\n')

  return [
    '',
    '-- 游戏世界 --',
    '',
    '【当前世界】',
    `时间：第 ${world.time.day} 天 ${world.time.hour}:00`,
    `天气：${weatherLabel(world.weather)}`,
    currentCharSection,
    otherCharsSection,
    '',
    '【你可以触发的游戏事件】',
    '在回复时，你可以通过 events 数组触发游戏世界的变化。',
    '如果你觉得当前场景不适合触发任何事件，events 留空即可。',
    '',
    eventDescriptions,
    '',
    '【回复格式】',
    '你的回复必须严格遵循以下 JSON 格式，不要包含任何其他文字：',
    JSON.stringify({ narrative: '你扮演角色的自然语言回复', events: [] }),
  ].join('\n')
}

function weatherLabel(weather: string): string {
  const labels: Record<string, string> = {
    sunny: '晴天',
    rainy: '下雨',
    cloudy: '多云',
    stormy: '暴风雨',
    snowy: '下雪',
  }
  return labels[weather] ?? weather
}

export function buildPrompt(params: {
  character: CharacterData
  characterId?: string
  persona?: PersonaData | null
  history: HistoryMessage[]
  currentMessage: string
  gameState?: GameWorldState | null
  maxHistoryRounds?: number
  maxTokens?: number
}): BuiltPrompt {
  const maxRounds = params.maxHistoryRounds ?? 50
  const maxTokens = params.maxTokens ?? 8000

  // Build system prompt first to calculate its token usage
  const systemParts: string[] = [
    '你正在扮演以下角色。请完全按照角色设定来回应，不要跳出角色，不要提及你是 AI 或语言模型。',
    '',
    '【角色设定】',
    `姓名: ${params.character.name}`,
    `外貌与性格: ${params.character.description}`,
  ]
  if (params.character.prompt) {
    systemParts.push('', '【提示词】', params.character.prompt)
  }
  let systemContent = systemParts.join('\n')

  // Append game context if available
  if (params.gameState) {
    const gameContext = buildGameContextPrompt(params.gameState, params.characterId)
    if (gameContext) {
      systemContent += '\n' + gameContext
    }
  }

  let usedTokens = estimateTokens(systemContent)

  const messages: Array<{ role: string; content: string }> = []
  messages.push({ role: 'system', content: systemContent })

  // Persona
  if (params.persona) {
    const personaContent = `用户设定: 用户名为 ${params.persona.name}${params.persona.description ? `，${params.persona.description}` : ''}`
    usedTokens += estimateTokens(personaContent)
    messages.push({ role: 'system', content: personaContent })
  }

  // Current message
  const userName = params.persona?.name ?? '用户'
  const currentMsgContent = `${userName}: ${params.currentMessage}`
  const currentTokens = estimateTokens(currentMsgContent)

  // Remaining budget for history
  const historyBudget = maxTokens - usedTokens - currentTokens - 500 // 500 buffer for model overhead

  // History (token-based sliding window)
  const recentHistory = params.history.slice(-maxRounds * 2)
  const historyMessages: Array<{ role: string; content: string }> = []
  let historyTokens = 0

  // Add messages from most recent to oldest until token budget is exhausted
  for (let i = recentHistory.length - 1; i >= 0; i--) {
    const msg = recentHistory[i]
    if (!msg) continue
    const msgTokens = estimateTokens(msg.content)
    if (historyTokens + msgTokens > historyBudget) break
    historyTokens += msgTokens
    historyMessages.unshift({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    })
  }

  messages.push(...historyMessages)
  messages.push({ role: 'user', content: currentMsgContent })

  // Estimate total tokens
  const totalText = messages.map(m => m.content).join('')
  const tokenEstimate = estimateTokens(totalText)

  return { messages, tokenEstimate }
}