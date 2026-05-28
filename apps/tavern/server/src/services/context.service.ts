import prisma from '../utils/prisma'
import { Prisma } from '@prisma/client'

interface CreateSessionParams {
  userId: string
  characterId: string
  personaId?: string
  modelKey?: string
  temperature?: number
}


type SessionWithIncludes = Prisma.TavernChatSessionGetPayload<{
  include: { character: true; messages: { orderBy: { createdAt: 'asc' }; take: number } }
}>

type SessionWithMiniIncludes = Prisma.TavernChatSessionGetPayload<{
  include: { character: { select: { name: true; avatar: true } }; messages: { orderBy: { createdAt: 'desc' }; take: 1 } }
}>

export async function createSession(params: CreateSessionParams) {
  // 查角色名称用于会话标题
  const card = await prisma.tavernCard.findUnique({
    where: { id: params.characterId },
    select: { name: true },
  })
  if (!card) throw new Error('CHARACTER_NOT_FOUND')

  // 新建会话无需 include character/messages：
  // - character: 调用方通过 cardData 或显式查询获取，不依赖 include
  // - messages:  新会话始终为空，history 由调用方直接初始化为 []
  const session = await prisma.tavernChatSession.create({
    data: {
      userUuid: params.userId,
      cardId: params.characterId,
      personaId: params.personaId,
      modelKey: params.modelKey ?? 'tongyi',
      temperature: params.temperature ?? 0.8,
      title: `与 ${card.name} 的对话`,
    },
  })

  return session
}

export async function getSession(sessionId: string, userId: string): Promise<SessionWithIncludes | null> {
  const session = await prisma.tavernChatSession.findUnique({
    where: { id: sessionId },
    include: {
      character: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 50,
      },
    },
  })
  if (!session || session.userUuid !== userId) return null
  return session
}

export async function getMySessions(userId: string, page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize
  const [items, total] = await Promise.all([
    prisma.tavernChatSession.findMany({
      where: { userUuid: userId },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        character: { select: { name: true, avatar: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    prisma.tavernChatSession.count({ where: { userUuid: userId } }),
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
  const session = await prisma.tavernChatSession.findUnique({ where: { id: sessionId } })
  if (!session || session.userUuid !== userId) throw new Error('FORBIDDEN')
  await prisma.tavernChatMessage.deleteMany({ where: { sessionId } })
  await prisma.tavernChatSession.delete({ where: { id: sessionId } })
}

/**
 * 保存消息并可选择跳过 Session 计数器更新。
 * skipSessionUpdate=true 时仅插入消息，调用方负责合并更新 Session
 * （避免两次 saveMessage 各触发一次 Session UPDATE 的冗余）。
 */
export async function saveMessage(
  sessionId: string,
  role: string,
  content: string,
  tokens?: number,
  skipSessionUpdate?: boolean,
) {
  const msg = await prisma.tavernChatMessage.create({
    data: { sessionId, role: role as 'user' | 'character' | 'system', content, tokens },
  })

  if (!skipSessionUpdate) {
    await prisma.tavernChatSession.update({
      where: { id: sessionId },
      data: {
        messageCount: { increment: 1 },
        tokenCount: { increment: tokens ?? 0 },
      },
    })
  }

  return msg
}