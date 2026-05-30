import type { GameWorldState } from '@/types/ai-script'
import type { Scenario } from '@/types/scenario'
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

/**
 * Build scenario-driven game context prompt.
 * Uses Scenario's dimensions, events, and promptTemplate to generate
 * the full game context section appended to the system prompt.
 */
export function buildScenarioPrompt(
  scenario: Scenario,
  gameState: GameWorldState,
  characterId: string,
): string {
  const char = gameState.characters[characterId]
  if (!char) return ''

  const dimPanel = scenario.world.dimensions
    .map(d => {
      const val = gameState.dimensions[d.key] ?? 0
      const pct = Math.round(((val - d.range[0]) / (d.range[1] - d.range[0])) * 100)
      const bar = pct > 80 ? '🟢' : pct > 40 ? '🟡' : pct > 20 ? '🟠' : '🔴'
      return `${d.icon ?? ''} ${d.label}: ${bar} ${val}/${d.range[1]}`
    })
    .join('\n')

  const eventsList = [...scenario.events, ...scenario.customEvents]
    .map(e => {
      const params = Object.entries(e.parameters)
        .map(([k, v]) => `${k}: ${v.type}${v.enum ? ` (${v.enum.join('|')})` : ''}`)
        .join(', ')
      return `- ${e.type} { ${params} }\n  ${e.description}`
    })
    .join('\n\n')

  const rulesSummary = [
    `失败条件：${scenario.rules.loseCondition}`,
    `胜利条件：${scenario.rules.winCondition}`,
    scenario.rules.npcBehavior ? `NPC行为：${scenario.rules.npcBehavior}` : '',
  ].filter(Boolean).join('\n')

  return scenario.promptTemplate.system
    .replace(/\{character\.name\}/g, char.name)
    .replace(/\{character\.personality\}/g, (char.flags?.personality as string) ?? '')
    .replace(/\{character\.location\}/g, char.location)
    .replace(/\{dimensions_panel\}/g, dimPanel)
    .replace(/\{day\}/g, String(gameState.world.time.day))
    .replace(/\{hour\}/g, String(gameState.world.time.hour))
    .replace(/\{weather\}/g, gameState.world.weather)
    .replace(/\{rules_summary\}/g, rulesSummary)
    .replace(/\{events_list\}/g, eventsList)
}

export function buildPrompt(params: {
  character: CharacterData
  characterId?: string
  persona?: PersonaData | null
  history: HistoryMessage[]
  currentMessage: string
  gameState?: GameWorldState | null
  scenario?: Scenario | null
  scenarioCharacterId?: string
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
  if (params.scenario && params.gameState && params.scenarioCharacterId) {
    const scenarioContext = buildScenarioPrompt(params.scenario, params.gameState, params.scenarioCharacterId)
    if (scenarioContext) {
      systemContent += '\n' + scenarioContext
    }
  } else if (params.gameState) {
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

// ============================================================
//  Choice-generation prompt builder
// ============================================================

export interface ChoicePromptParams {
  personaName: string
  personaDescription?: string | null
  lastNarrative: string
  /** 当前世界状态摘要 */
  worldContext?: string
}

/**
 * Build a prompt that instructs the AI to pause the narrative and
 * generate 2-3 action choices for the player character.
 */
export function buildChoicePrompt(params: ChoicePromptParams): string {
  const personaDesc = params.personaDescription
    ? `角色设定："${params.personaDescription}"`
    : ''

  return [
    '你现在需要暂停叙事，将镜头转向玩家的角色。',
    '',
    `玩家角色名称："${params.personaName}"`,
    personaDesc,
    '',
    `最近发生的剧情：${params.lastNarrative.slice(-500)}`,
    '',
    params.worldContext ? `当前世界状态：${params.worldContext}` : '',
    '',
    '请生成 3 个玩家可以选择的行动方向：',
    '1. 每个选项包含 label（5-10字简短标题）和 description（15-30字具体描述）',
    '2. 选项必须代表明显不同的方向（战斗/探索/社交/撤退等），不要都是同一方向的变体',
    `3. 选项应考虑"${params.personaName}"的角色特点和能力`,
    '4. 第三个选项偶尔可以是高风险或意外方向',
    '5. 每个选项都应有有意义的叙事后果',
    '',
    '仅返回 JSON 格式（不要 markdown 代码块包裹）：',
    '{"summary":"当前局面的一句话总结","choices":[{"label":"选项标题","description":"选项描述"},...]}',
  ].filter(Boolean).join('\n')
}