import prisma from '../utils/prisma'
import { Prisma } from '@prisma/client'

const cardSelect = {
  id: true, name: true, avatar: true, description: true,
  tags: true, chatCount: true, likeCount: true, favCount: true,
  cardType: true, isOfficial: true,
  createdAt: true,
  creator: { select: { id: true, nickname: true } },
}

export async function listMarket(params: {
  page?: number
  pageSize?: number
  sort?: 'latest' | 'popular' | 'mostLiked' | 'mostFaved'
  tag?: string
  cardType?: string
}) {
  const page = params.page || 1
  const pageSize = params.pageSize || 20
  const skip = (page - 1) * pageSize

  const where: Prisma.TavernCardWhereInput = {
    status: 'PUBLISHED',
    isOfficial: true,
  }
  if (params.tag) {
    where.tags = { array_contains: params.tag }
  }
  if (params.cardType) {
    where.cardType = params.cardType as 'CHARACTER' | 'MECHANISM' | 'MAP' | 'BACKGROUND'
  }

  const orderBy = (() => {
    switch (params.sort) {
      case 'popular': return { chatCount: 'desc' as const }
      case 'mostLiked': return { likeCount: 'desc' as const }
      case 'mostFaved': return { favCount: 'desc' as const }
      default: return { createdAt: 'desc' as const }
    }
  })()

  const [items, total] = await Promise.all([
    prisma.tavernCard.findMany({ where, orderBy, skip, take: pageSize, select: cardSelect }),
    prisma.tavernCard.count({ where }),
  ])

  return { items, total, page, pageSize, hasMore: skip + items.length < total }
}

export async function getFeatured() {
  return prisma.tavernCard.findMany({
    where: { status: 'PUBLISHED', isOfficial: true },
    orderBy: { likeCount: 'desc' },
    take: 5,
    select: {
      id: true, name: true, avatar: true, description: true,
      tags: true, likeCount: true, cardType: true,
    },
  })
}

export async function searchMarket(q: string, page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize
  const where: Prisma.TavernCardWhereInput = {
    status: 'PUBLISHED',
    isOfficial: true,
    OR: [
      { name: { contains: q } },
      { description: { contains: q } },
    ],
  }

  const [items, total] = await Promise.all([
    prisma.tavernCard.findMany({ where, orderBy: { likeCount: 'desc' }, skip, take: pageSize, select: cardSelect }),
    prisma.tavernCard.count({ where }),
  ])

  return { items, total, page, pageSize, hasMore: skip + items.length < total }
}

export async function getTags() {
  const cards = await prisma.tavernCard.findMany({
    where: { status: 'PUBLISHED', isOfficial: true },
    select: { tags: true },
  })

  const tagCount: Record<string, number> = {}
  for (const card of cards) {
    const tags = (card.tags as string[]) || []
    for (const tag of tags) {
      tagCount[tag] = (tagCount[tag] || 0) + 1
    }
  }

  return Object.entries(tagCount)
    .map(([tag, count]) => ({ id: tag, name: tag, count }))
    .sort((a, b) => b.count - a.count)
}

export async function getMarketCard(cardId: string) {
  return prisma.tavernCard.findUnique({
    where: { id: cardId, status: 'PUBLISHED' },
    include: {
      creator: { select: { id: true, nickname: true, avatar: true } },
    },
  })
}

// ─── Official Cards Sync API ─────────────────────────────────────

export async function getAllOfficialCards() {
  const cards = await prisma.tavernCard.findMany({
    where: { isOfficial: true, status: 'PUBLISHED' },
    select: {
      id: true, name: true, avatar: true, description: true,
      prompt: true, firstMsg: true, scenario: true,
      tags: true, cardType: true, isOfficial: true,
      chatCount: true, likeCount: true, favCount: true,
      createdAt: true, updatedAt: true,
      creator: { select: { id: true, nickname: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })
  return cards
}
