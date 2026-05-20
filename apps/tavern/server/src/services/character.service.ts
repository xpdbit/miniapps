import prisma from '../utils/prisma'
import { Prisma } from '@prisma/client'

// List characters for a user
export async function listMyCharacters(userId: string, page: number = 1, pageSize: number = 20) {
  const skip = (page - 1) * pageSize
  const [items, total] = await Promise.all([
    prisma.tavernCard.findMany({
      where: { creatorId: userId },
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
    prisma.tavernCard.count({ where: { creatorId: userId } }),
  ])
  return { items, total, page, pageSize, hasMore: skip + items.length < total }
}

// Get character detail
export async function getCharacterDetail(id: string) {
  const card = await prisma.tavernCard.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, nickname: true, avatar: true } },
    },
  })
  return card
}

// Create character
export async function createCharacter(data: {
  name: string; description: string; firstMsg: string
  avatar?: string; prompt?: string; scenario?: string
  tags?: string[]
  cardType?: string
}, userId: string) {
  const card = await prisma.tavernCard.create({
    data: {
      name: data.name,
      description: data.description,
      firstMsg: data.firstMsg,
      avatar: data.avatar,
      prompt: data.prompt,
      scenario: data.scenario,
      tags: data.tags ?? [],
      cardType: (data.cardType as Prisma.EnumCardTypeFilter['equals']) || 'CHARACTER',
      creatorId: userId,
      status: 'DRAFT',
    },
  })
  return card
}

// Update character
export async function updateCharacter(id: string, userId: string, data: {
  name?: string; description?: string; firstMsg?: string
  avatar?: string; prompt?: string; scenario?: string
  tags?: string[]
  cardType?: string
}) {
  const card = await prisma.tavernCard.findUnique({ where: { id } })
  if (!card) throw new Error('NOT_FOUND')
  if (card.creatorId !== userId) throw new Error('FORBIDDEN')

  const updateData: Prisma.TavernCardUpdateInput = {
    name: data.name, description: data.description, firstMsg: data.firstMsg,
    avatar: data.avatar, prompt: data.prompt, scenario: data.scenario, tags: data.tags,
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
export async function deleteCharacter(id: string, userId: string) {
  const card = await prisma.tavernCard.findUnique({ where: { id } })
  if (!card) throw new Error('NOT_FOUND')
  if (card.creatorId !== userId) throw new Error('FORBIDDEN')
  await prisma.tavernCard.delete({ where: { id } })
}

// Publish character (submit for review)
export async function publishCharacter(id: string, userId: string) {
  const card = await prisma.tavernCard.findUnique({ where: { id } })
  if (!card) throw new Error('NOT_FOUND')
  if (card.creatorId !== userId) throw new Error('FORBIDDEN')
  if (card.status !== 'DRAFT') throw new Error('INVALID_STATUS')

  return prisma.tavernCard.update({
    where: { id },
    data: { status: 'PENDING' },
  })
}
