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
}): BuiltPrompt {
  const maxRounds = params.maxHistoryRounds ?? 20
  const messages: Array<{ role: string; content: string }> = []

  // System prompt
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
  messages.push({ role: 'system', content: systemParts.join('\n') })

  // Persona
  if (params.persona) {
    messages.push({
      role: 'system',
      content: `用户设定: 用户名为 ${params.persona.name}${params.persona.description ? `，${params.persona.description}` : ''}`,
    })
  }

  // History (sliding window)
  const recentHistory = params.history.slice(-maxRounds * 2)
  for (const msg of recentHistory) {
    messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content })
  }

  // Current message
  const userName = params.persona?.name ?? '用户'
  messages.push({ role: 'user', content: `${userName}: ${params.currentMessage}` })

  // Estimate tokens
  const totalText = messages.map(m => m.content).join('')
  const tokenEstimate = estimateTokens(totalText)

  return { messages, tokenEstimate }
}