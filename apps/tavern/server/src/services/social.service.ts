import prisma from '../utils/prisma'

export async function like(userId: string, cardId: string) {
  const card = await prisma.characterCard.findUnique({
    where: { id: cardId },
    select: { status: true },
  })
  if (!card || card.status !== 'PUBLISHED') throw new Error('NOT_FOUND')

  const existing = await prisma.characterCardLike.findUnique({
    where: { cardId_userId: { cardId, userId } },
  })
  if (existing) return // Already liked

  await prisma.$transaction([
    prisma.characterCardLike.create({ data: { cardId, userId } }),
    prisma.characterCard.update({ where: { id: cardId }, data: { likeCount: { increment: 1 } } }),
  ])
}

export async function unlike(userId: string, cardId: string) {
  const existing = await prisma.characterCardLike.findUnique({
    where: { cardId_userId: { cardId, userId } },
  })
  if (!existing) return

  await prisma.$transaction([
    prisma.characterCardLike.delete({ where: { cardId_userId: { cardId, userId } } }),
    prisma.characterCard.update({ where: { id: cardId }, data: { likeCount: { decrement: 1 } } }),
  ])
}

export async function isLiked(userId: string, cardId: string): Promise<boolean> {
  const existing = await prisma.characterCardLike.findUnique({
    where: { cardId_userId: { cardId, userId } },
  })
  return !!existing
}

export async function fav(userId: string, cardId: string) {
  const card = await prisma.characterCard.findUnique({
    where: { id: cardId },
    select: { status: true },
  })
  if (!card || card.status !== 'PUBLISHED') throw new Error('NOT_FOUND')

  const existing = await prisma.characterCardFav.findUnique({
    where: { cardId_userId: { cardId, userId } },
  })
  if (existing) return

  await prisma.$transaction([
    prisma.characterCardFav.create({ data: { cardId, userId } }),
    prisma.characterCard.update({ where: { id: cardId }, data: { favCount: { increment: 1 } } }),
  ])
}

export async function unfav(userId: string, cardId: string) {
  const existing = await prisma.characterCardFav.findUnique({
    where: { cardId_userId: { cardId, userId } },
  })
  if (!existing) return

  await prisma.$transaction([
    prisma.characterCardFav.delete({ where: { cardId_userId: { cardId, userId } } }),
    prisma.characterCard.update({ where: { id: cardId }, data: { favCount: { decrement: 1 } } }),
  ])
}

export async function getMyFavs(userId: string, page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize
  const [items, total] = await Promise.all([
    prisma.characterCardFav.findMany({
      where: { userId },
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        card: {
          select: {
            id: true, name: true, avatar: true, description: true,
            tags: true, chatCount: true, likeCount: true,
          },
        },
      },
    }),
    prisma.characterCardFav.count({ where: { userId } }),
  ])

  return {
    items: items.map(f => f.card),
    total,
    page,
    pageSize,
    hasMore: skip + items.length < total,
  }
}