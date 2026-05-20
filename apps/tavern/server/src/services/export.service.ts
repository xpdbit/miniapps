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

  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: card.name,
      description: card.description,
      personality: card.prompt || '',
      scenario: card.scenario || '',
      first_mes: card.firstMsg ?? '',
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

  const card = await prisma.tavernCard.create({
    data: {
      name: d.name,
      description: d.description,
      prompt: promptParts.join('\n\n') || null,
      scenario: d.scenario || null,
      firstMsg: d.first_mes,
      tags: d.tags || [],
      creatorId: userId,
      status: 'DRAFT',
    },
  })
  return card
}