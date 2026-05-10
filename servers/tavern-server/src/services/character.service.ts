import prisma from '@/utils/prisma'
import { Prisma } from '@prisma/client'

// List characters for a user
export async function listMyCharacters(userId: string, page: number = 1, pageSize: number = 20) {
  const skip = (page - 1) * pageSize
  const [items, total] = await Promise.all([
    prisma.characterCard.findMany({
      where: { creatorId: userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      select: {
        id: true, name: true, avatar: true, description: true,
        tags: true, status: true, chatCount: true, likeCount: true, favCount: true,
        createdAt: true, updatedAt: true,
      },
    }),
    prisma.characterCard.count({ where: { creatorId: userId } }),
  ])
  return { items, total, page, pageSize, hasMore: skip + items.length < total }
}

// Get character detail
export async function getCharacterDetail(id: string) {
  const card = await prisma.characterCard.findUnique({
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
  avatar?: string; personality?: string; scenario?: string
  lore?: string; systemPrompt?: string; tags?: string[]
  exampleDialogs?: unknown; nsfw?: boolean
}, userId: string) {
  const card = await prisma.characterCard.create({
    data: {
      name: data.name,
      description: data.description,
      firstMsg: data.firstMsg,
      avatar: data.avatar,
      personality: data.personality,
      scenario: data.scenario,
      lore: data.lore,
      systemPrompt: data.systemPrompt,
      tags: data.tags ?? [],
      exampleDialogs: data.exampleDialogs != null ? data.exampleDialogs as Prisma.InputJsonValue : undefined,
      nsfw: data.nsfw ?? false,
      creatorId: userId,
      status: 'DRAFT',
    },
  })
  return card
}

// Update character
export async function updateCharacter(id: string, userId: string, data: {
  name?: string; description?: string; firstMsg?: string
  avatar?: string; personality?: string; scenario?: string
  lore?: string; systemPrompt?: string; tags?: string[]
  exampleDialogs?: unknown; nsfw?: boolean
}) {
  const card = await prisma.characterCard.findUnique({ where: { id } })
  if (!card) throw new Error('NOT_FOUND')
  if (card.creatorId !== userId) throw new Error('FORBIDDEN')

  const updateData: Prisma.CharacterCardUpdateInput = {
    name: data.name, description: data.description, firstMsg: data.firstMsg,
    avatar: data.avatar, personality: data.personality, scenario: data.scenario,
    lore: data.lore, systemPrompt: data.systemPrompt, tags: data.tags,
    nsfw: data.nsfw,
  }
  if (data.exampleDialogs !== undefined) {
    updateData.exampleDialogs = data.exampleDialogs != null ? data.exampleDialogs as Prisma.InputJsonValue : undefined
  }

  const updated = await prisma.characterCard.update({
    where: { id },
    data: updateData,
  })
  return updated
}

// Delete character
export async function deleteCharacter(id: string, userId: string) {
  const card = await prisma.characterCard.findUnique({ where: { id } })
  if (!card) throw new Error('NOT_FOUND')
  if (card.creatorId !== userId) throw new Error('FORBIDDEN')
  await prisma.characterCard.delete({ where: { id } })
}

// Publish character (submit for review)
export async function publishCharacter(id: string, userId: string) {
  const card = await prisma.characterCard.findUnique({ where: { id } })
  if (!card) throw new Error('NOT_FOUND')
  if (card.creatorId !== userId) throw new Error('FORBIDDEN')
  if (card.status !== 'DRAFT') throw new Error('INVALID_STATUS')

  return prisma.characterCard.update({
    where: { id },
    data: { status: 'PENDING' },
  })
}