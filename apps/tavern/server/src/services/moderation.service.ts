import prisma from '../utils/prisma'
import { SENSITIVE_WORDS } from '../config/sensitive-words'

export async function getPendingList(page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize
  const [items, total] = await Promise.all([
    prisma.tavernCard.findMany({
      where: { status: 'PENDING', deletedAt: null },
      orderBy: { updatedAt: 'asc' },
      skip,
      take: pageSize,
    }),
    prisma.tavernCard.count({ where: { status: 'PENDING' } }),
  ])
  return { items, total, page, pageSize, hasMore: skip + items.length < total }
}

export async function approve(cardId: string, userUuid: string) {
  const card = await prisma.tavernCard.findUnique({ where: { id: cardId } })
  if (!card) throw new Error('NOT_FOUND')
  if (card.status !== 'PENDING') throw new Error('INVALID_STATUS')

  await prisma.$transaction([
    prisma.tavernCard.update({ where: { id: cardId }, data: { status: 'PUBLISHED' } }),
    prisma.tavernModerationLog.create({
      data: { targetType: 'character', targetId: cardId, action: 'approve', userUuid },
    }),
  ])
}

export async function reject(cardId: string, userUuid: string, reason: string) {
  const card = await prisma.tavernCard.findUnique({ where: { id: cardId } })
  if (!card) throw new Error('NOT_FOUND')
  if (card.status !== 'PENDING') throw new Error('INVALID_STATUS')

  await prisma.$transaction([
    prisma.tavernCard.update({ where: { id: cardId }, data: { status: 'DRAFT' } }),
    prisma.tavernModerationLog.create({
      data: { targetType: 'character', targetId: cardId, action: 'reject', reason, userUuid },
    }),
  ])
}

export async function ban(cardId: string, userUuid: string, reason: string) {
  const card = await prisma.tavernCard.findUnique({ where: { id: cardId } })
  if (!card) throw new Error('NOT_FOUND')

  await prisma.$transaction([
    prisma.tavernCard.update({ where: { id: cardId }, data: { status: 'BANNED' } }),
    prisma.tavernModerationLog.create({
      data: { targetType: 'character', targetId: cardId, action: 'ban', reason, userUuid },
    }),
  ])
}

export async function getLogs(cardId: string) {
  return prisma.tavernModerationLog.findMany({
    where: { targetId: cardId },
    orderBy: { createdAt: 'desc' },
  })
}

export function checkContent(text: string): { passed: boolean; matchedWords: string[] } {
  const matched = SENSITIVE_WORDS.filter(word => text.includes(word))
  return { passed: matched.length === 0, matchedWords: matched }
}