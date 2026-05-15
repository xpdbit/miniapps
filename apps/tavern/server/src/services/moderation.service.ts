import prisma from '../utils/prisma'
import { SENSITIVE_WORDS } from '../config/sensitive-words'

export async function getPendingList(page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize
  const [items, total] = await Promise.all([
    prisma.characterCard.findMany({
      where: { status: 'PENDING' },
      orderBy: { updatedAt: 'asc' },
      skip,
      take: pageSize,
      include: {
        creator: { select: { id: true, nickname: true } },
      },
    }),
    prisma.characterCard.count({ where: { status: 'PENDING' } }),
  ])
  return { items, total, page, pageSize, hasMore: skip + items.length < total }
}

export async function approve(cardId: string, operatorId: string) {
  const card = await prisma.characterCard.findUnique({ where: { id: cardId } })
  if (!card) throw new Error('NOT_FOUND')
  if (card.status !== 'PENDING') throw new Error('INVALID_STATUS')

  await prisma.$transaction([
    prisma.characterCard.update({ where: { id: cardId }, data: { status: 'PUBLISHED' } }),
    prisma.moderationLog.create({
      data: { targetType: 'character', targetId: cardId, action: 'approve', operatorId },
    }),
  ])
}

export async function reject(cardId: string, operatorId: string, reason: string) {
  const card = await prisma.characterCard.findUnique({ where: { id: cardId } })
  if (!card) throw new Error('NOT_FOUND')
  if (card.status !== 'PENDING') throw new Error('INVALID_STATUS')

  await prisma.$transaction([
    prisma.characterCard.update({ where: { id: cardId }, data: { status: 'DRAFT' } }),
    prisma.moderationLog.create({
      data: { targetType: 'character', targetId: cardId, action: 'reject', reason, operatorId },
    }),
  ])
}

export async function ban(cardId: string, operatorId: string, reason: string) {
  const card = await prisma.characterCard.findUnique({ where: { id: cardId } })
  if (!card) throw new Error('NOT_FOUND')

  await prisma.$transaction([
    prisma.characterCard.update({ where: { id: cardId }, data: { status: 'BANNED' } }),
    prisma.moderationLog.create({
      data: { targetType: 'character', targetId: cardId, action: 'ban', reason, operatorId },
    }),
  ])
}

export async function getLogs(cardId: string) {
  return prisma.moderationLog.findMany({
    where: { targetId: cardId },
    orderBy: { createdAt: 'desc' },
  })
}

export function checkContent(text: string): { passed: boolean; matchedWords: string[] } {
  const matched = SENSITIVE_WORDS.filter(word => text.includes(word))
  return { passed: matched.length === 0, matchedWords: matched }
}