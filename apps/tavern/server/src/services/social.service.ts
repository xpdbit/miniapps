import prisma from '../utils/prisma'

export async function like(userUuid: string, cardId: string) {
  const card = await prisma.tavernCard.findUnique({
    where: { id: cardId },
    select: { status: true },
  })
  if (!card || card.status !== 'PUBLISHED') throw new Error('NOT_FOUND')

  const existing = await prisma.tavernCardLike.findUnique({
    where: { cardId_userUuid: { cardId, userUuid } },
  })
  if (existing) return // Already liked

  await prisma.$transaction([
    prisma.tavernCardLike.create({ data: { cardId, userUuid } }),
    prisma.tavernCard.update({ where: { id: cardId }, data: { likeCount: { increment: 1 } } }),
  ])
}

export async function unlike(userUuid: string, cardId: string) {
  const existing = await prisma.tavernCardLike.findUnique({
    where: { cardId_userUuid: { cardId, userUuid } },
  })
  if (!existing) return

  await prisma.$transaction([
    prisma.tavernCardLike.delete({ where: { cardId_userUuid: { cardId, userUuid } } }),
    prisma.tavernCard.update({ where: { id: cardId }, data: { likeCount: { decrement: 1 } } }),
  ])
}

export async function isLiked(userUuid: string, cardId: string): Promise<boolean> {
  const existing = await prisma.tavernCardLike.findUnique({
    where: { cardId_userUuid: { cardId, userUuid } },
  })
  return !!existing
}

export async function fav(userUuid: string, cardId: string) {
  const card = await prisma.tavernCard.findUnique({
    where: { id: cardId },
    select: { status: true },
  })
  if (!card || card.status !== 'PUBLISHED') throw new Error('NOT_FOUND')

  const existing = await prisma.tavernCardFav.findUnique({
    where: { cardId_userUuid: { cardId, userUuid } },
  })
  if (existing) return

  await prisma.$transaction([
    prisma.tavernCardFav.create({ data: { cardId, userUuid } }),
    prisma.tavernCard.update({ where: { id: cardId }, data: { favCount: { increment: 1 } } }),
  ])
}

export async function unfav(userUuid: string, cardId: string) {
  const existing = await prisma.tavernCardFav.findUnique({
    where: { cardId_userUuid: { cardId, userUuid } },
  })
  if (!existing) return

  await prisma.$transaction([
    prisma.tavernCardFav.delete({ where: { cardId_userUuid: { cardId, userUuid } } }),
    prisma.tavernCard.update({ where: { id: cardId }, data: { favCount: { decrement: 1 } } }),
  ])
}

export async function getMyFavs(userUuid: string, page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize
  const [items, total] = await Promise.all([
    prisma.tavernCardFav.findMany({
      where: { userUuid },
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
    prisma.tavernCardFav.count({ where: { userUuid } }),
  ])

  return {
    items: items.map(f => f.card),
    total,
    page,
    pageSize,
    hasMore: skip + items.length < total,
  }
}