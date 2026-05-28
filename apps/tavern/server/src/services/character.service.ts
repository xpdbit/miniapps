import prisma from '../utils/prisma'
import { Prisma } from '@prisma/client'

// List characters for a user
export async function listMyCharacters(userUuid: string, page: number = 1, pageSize: number = 20) {
  const skip = (page - 1) * pageSize
  const [items, total] = await Promise.all([
    prisma.tavernCard.findMany({
      where: { userUuid },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      select: {
        id: true, name: true, avatar: true, description: true,
        tags: true, status: true, chatCount: true, likeCount: true, favCount: true,
        cardType: true, isOfficial: true,
        createdAt: true, updatedAt: true,
      },
    }),
    prisma.tavernCard.count({ where: { userUuid } }),
  ])
  return { items, total, page, pageSize, hasMore: skip + items.length < total }
}

// Get character detail
export async function getCharacterDetail(id: string) {
  const card = await prisma.tavernCard.findUnique({
    where: { id },
  })
  return card
}

// Create character
export async function createCharacter(data: {
  name: string; description: string
  avatar?: string; prompt?: string
  tags?: string[]
  cardType?: string
}, userUuid: string) {
  const card = await prisma.tavernCard.create({
    data: {
      name: data.name,
      description: data.description,
      avatar: data.avatar,
      prompt: data.prompt,
      tags: data.tags ?? [],
      cardType: (data.cardType as Prisma.EnumCardTypeFilter['equals']) || 'CHARACTER',
      userUuid,
      status: 'DRAFT',
    },
  })
  return card
}

// Update character
export async function updateCharacter(id: string, userUuid: string, data: {
  name?: string; description?: string
  avatar?: string; prompt?: string
  tags?: string[]
  cardType?: string
}) {
  const card = await prisma.tavernCard.findUnique({ where: { id } })
  if (!card) throw new Error('NOT_FOUND')
  if (card.userUuid !== userUuid) throw new Error('FORBIDDEN')

  const updateData: Prisma.TavernCardUpdateInput = {
    name: data.name, description: data.description,
    avatar: data.avatar, prompt: data.prompt, tags: data.tags,
  }
  if (data.cardType) {
    updateData.cardType = data.cardType as Prisma.EnumCardTypeFilter['equals']
  }

  const updated = await prisma.tavernCard.update({
    where: { id },
    data: updateData,
  })
  return updated
}

// Delete character
export async function deleteCharacter(id: string, userUuid: string) {
  const card = await prisma.tavernCard.findUnique({ where: { id } })
  if (!card) throw new Error('NOT_FOUND')
  if (card.userUuid !== userUuid) throw new Error('FORBIDDEN')
  await prisma.tavernCard.delete({ where: { id } })
}

// Publish character (submit for review)
export async function publishCharacter(id: string, userUuid: string) {
  const card = await prisma.tavernCard.findUnique({ where: { id } })
  if (!card) throw new Error('NOT_FOUND')
  if (card.userUuid !== userUuid) throw new Error('FORBIDDEN')
  if (card.status !== 'DRAFT') throw new Error('INVALID_STATUS')

  return prisma.tavernCard.update({
    where: { id },
    data: { status: 'PENDING' },
  })
}
