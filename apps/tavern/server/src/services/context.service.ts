import prisma from '../utils/prisma'

interface CreateSessionParams {
  userId: string
  characterId: string
  personaId?: string
  modelKey?: string
  temperature?: number
}

interface SendMessageParams {
  sessionId: string
  userId: string
  message: string
}

export async function createSession(params: CreateSessionParams) {
  const character = await prisma.characterCard.findUnique({
    where: { id: params.characterId },
  })
  if (!character) throw new Error('CHARACTER_NOT_FOUND')

  const session = await prisma.chatSession.create({
    data: {
      userId: params.userId,
      characterId: params.characterId,
      personaId: params.personaId,
      modelKey: params.modelKey ?? 'tongyi',
      temperature: params.temperature ?? 0.8,
      title: `与 ${character.name} 的对话`,
    },
    include: {
      character: true,
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  // Save the character's firstMsg as initial AI message
  await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      role: 'character',
      content: character.firstMsg,
    },
  })

  return session
}

export async function getSession(sessionId: string, userId: string) {
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: {
      character: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 50,
      },
    },
  })
  if (!session || session.userId !== userId) return null
  return session
}

export async function getMySessions(userId: string, page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize
  const [items, total] = await Promise.all([
    prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        character: { select: { name: true, avatar: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    prisma.chatSession.count({ where: { userId } }),
  ])

  return {
    items: items.map(s => ({
      id: s.id,
      characterName: s.character.name,
      characterAvatar: s.character.avatar,
      lastMessage: s.messages[0]?.content?.slice(0, 50) ?? '',
      messageCount: s.messageCount,
      title: s.title,
      updatedAt: s.updatedAt,
    })),
    total,
    page,
    pageSize,
    hasMore: skip + items.length < total,
  }
}

export async function deleteSession(sessionId: string, userId: string) {
  const session = await prisma.chatSession.findUnique({ where: { id: sessionId } })
  if (!session || session.userId !== userId) throw new Error('FORBIDDEN')
  await prisma.chatMessage.deleteMany({ where: { sessionId } })
  await prisma.chatSession.delete({ where: { id: sessionId } })
}

export async function saveMessage(sessionId: string, role: string, content: string, tokens?: number) {
  const msg = await prisma.chatMessage.create({
    data: { sessionId, role, content, tokens },
  })
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: {
      messageCount: { increment: 1 },
      tokenCount: { increment: tokens ?? 0 },
    },
  })
  return msg
}