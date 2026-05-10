import prisma from '@/utils/prisma'

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
  const card = await prisma.characterCard.findUnique({ where: { id: cardId } })
  if (!card) throw new Error('NOT_FOUND')

  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: card.name,
      description: card.description,
      personality: card.personality || '',
      scenario: card.scenario || '',
      first_mes: card.firstMsg,
      mes_example: parseMesExample(card.exampleDialogs as any[]),
      creator_notes: '',
      system_prompt: card.systemPrompt || '',
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
  const card = await prisma.characterCard.create({
    data: {
      name: d.name,
      description: d.description,
      personality: d.personality || null,
      scenario: d.scenario || null,
      firstMsg: d.first_mes,
      systemPrompt: d.system_prompt || null,
      lore: d.creator_notes || null,
      exampleDialogs: stringifyMesExample(d.mes_example),
      tags: d.tags || [],
      creatorId: userId,
      status: 'DRAFT',
    },
  })
  return card
}