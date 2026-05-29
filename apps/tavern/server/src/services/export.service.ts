import prisma from '../utils/prisma'

interface V2CharacterData {
  spec: string
  spec_version: string
  data: {
    name: string
    description: string
    personality: string
    scenario: string
    first_mes: string
    mes_example: string
    creator_notes: string
    system_prompt: string
    post_history_instructions: string
    tags: string[]
    creator: string
    character_version: string
    extensions: Record<string, any>
  }
}

function parseMesExample(dialogs: any[]): string {
  if (!Array.isArray(dialogs)) return ''
  return dialogs.map(d => `user: ${d.user || ''}\nchar: ${d.char || ''}`).join('\n')
}

function stringifyMesExample(text: string): Array<{ user: string; char: string }> {
  if (!text) return []
  const lines = text.split('\n')
  const dialogs: Array<{ user: string; char: string }> = []
  for (let i = 0; i < lines.length - 1; i += 2) {
    const userLine = lines[i]?.replace(/^user:\s*/, '')
    const charLine = lines[i + 1]?.replace(/^char:\s*/, '')
    if (userLine && charLine) dialogs.push({ user: userLine, char: charLine })
  }
  return dialogs
}

export async function exportToV2(cardId: string): Promise<V2CharacterData> {
  const card = await prisma.tavernCard.findUnique({ where: { id: cardId } })
  if (!card) throw new Error('NOT_FOUND')

  // 从合并后的 prompt 中解析 scenario 和 first_mes（按迁移时的拼接标签拆分）
  const promptText = card.prompt || ''
  let scenario = ''
  let first_mes = ''
  let personality = promptText

  const scenarioMatch = promptText.match(/^([\s\S]*?)\n\n【场景设定】([\s\S]*?)(?:\n\n【开场白】|$)/)
  if (scenarioMatch) {
    personality = scenarioMatch[1].trim()
    scenario = scenarioMatch[2].trim()
    const firstMsgMatch = promptText.match(/【开场白】([\s\S]*)$/)
    if (firstMsgMatch) first_mes = firstMsgMatch[1].trim()
  } else {
    const firstMsgMatch = promptText.match(/【开场白】([\s\S]*)$/)
    if (firstMsgMatch) {
      personality = promptText.replace(/\n\n【开场白】[\s\S]*$/, '').trim()
      first_mes = firstMsgMatch[1].trim()
    }
  }

  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: card.name,
      description: card.description,
      personality,
      scenario,
      first_mes,
      mes_example: '',
      creator_notes: '',
      system_prompt: '',
      post_history_instructions: '',
      tags: (card.tags as string[]) || [],
      creator: '',
      character_version: '1.0',
      extensions: {},
    },
  }
}

export async function importFromV2(data: V2CharacterData, userId: string) {
  const d = data.data
  const promptParts: string[] = []
  if (d.personality) promptParts.push(`【人格】${d.personality}`)
  if (d.system_prompt) promptParts.push(`【指令】${d.system_prompt}`)
  if (d.creator_notes) promptParts.push(`【备注】${d.creator_notes}`)
  if (d.mes_example) promptParts.push(`【示例对话】\n${d.mes_example}`)

  // 合并 scenario 和 first_mes 到 prompt（旧字段已删除）
  const parts = [...promptParts]
  if (d.scenario) parts.push(`【场景设定】${d.scenario}`)
  if (d.first_mes) parts.push(`【开场白】${d.first_mes}`)

  const card = await prisma.tavernCard.create({
    data: {
      name: d.name,
      description: d.description,
      prompt: parts.join('\n\n') || null,
      tags: d.tags || [],
      userUuid: userId,
      status: 'DRAFT',
    },
  })
  return card
}