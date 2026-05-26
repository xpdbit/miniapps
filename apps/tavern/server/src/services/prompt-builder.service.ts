export interface CharacterData {
  name: string
  description: string
  prompt?: string | null
  scenario?: string | null
  firstMsg: string
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

export function buildPrompt(params: {
  character: CharacterData
  persona?: PersonaData | null
  history: HistoryMessage[]
  currentMessage: string
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
  if (params.character.scenario) {
    systemParts.push('', '【场景】', params.character.scenario)
  }
  const systemContent = systemParts.join('\n')
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