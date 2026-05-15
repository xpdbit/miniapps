import prisma from '../utils/prisma'

export async function listMarket(params: {
  page?: number
  pageSize?: number
  sort?: 'latest' | 'popular' | 'mostLiked' | 'mostFaved'
  tag?: string
}) {
  const page = params.page || 1
  const pageSize = params.pageSize || 20
  const skip = (page - 1) * pageSize

  const where: { status: 'PUBLISHED'; tags?: { array_contains: string } } = { status: 'PUBLISHED' }
  if (params.tag) {
    where.tags = { array_contains: params.tag }
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
    prisma.characterCard.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      select: {
        id: true, name: true, avatar: true, description: true,
        tags: true, chatCount: true, likeCount: true, favCount: true,
        createdAt: true,
        creator: { select: { id: true, nickname: true } },
      },
    }),
    prisma.characterCard.count({ where }),
  ])

  return { items, total, page, pageSize, hasMore: skip + items.length < total }
}

export async function getFeatured() {
  return prisma.characterCard.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { likeCount: 'desc' },
    take: 5,
    select: {
      id: true, name: true, avatar: true, description: true,
      tags: true, likeCount: true,
    },
  })
}

export async function searchMarket(q: string, page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize
  const where = {
    status: 'PUBLISHED' as const,
    OR: [
      { name: { contains: q } },
      { description: { contains: q } },
    ],
  }

  const [items, total] = await Promise.all([
    prisma.characterCard.findMany({
      where,
      orderBy: { likeCount: 'desc' },
      skip,
      take: pageSize,
      select: {
        id: true, name: true, avatar: true, description: true,
        tags: true, chatCount: true, likeCount: true,
        creator: { select: { id: true, nickname: true } },
      },
    }),
    prisma.characterCard.count({ where }),
  ])

  return { items, total, page, pageSize, hasMore: skip + items.length < total }
}

export async function getTags() {
  const cards = await prisma.characterCard.findMany({
    where: { status: 'PUBLISHED' },
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
  return prisma.characterCard.findUnique({
    where: { id: cardId, status: 'PUBLISHED' },
    include: {
      creator: { select: { id: true, nickname: true, avatar: true } },
    },
  })
}