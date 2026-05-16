import prisma from '../utils/prisma'

export async function listPersonas(userId: string) {
  return prisma.tavernPersona.findMany({
    where: { userId },
    orderBy: { isDefault: 'desc' },
  })
}

export async function createPersona(userId: string, data: { name: string; description?: string; avatar?: string }) {
  return prisma.tavernPersona.create({ data: { ...data, userId } })
}

export async function updatePersona(id: string, userId: string, data: { name?: string; description?: string; avatar?: string }) {
  const persona = await prisma.tavernPersona.findUnique({ where: { id } })
  if (!persona || persona.userId !== userId) throw new Error('FORBIDDEN')
  return prisma.tavernPersona.update({ where: { id }, data })
}

export async function deletePersona(id: string, userId: string) {
  const persona = await prisma.tavernPersona.findUnique({ where: { id } })
  if (!persona || persona.userId !== userId) throw new Error('FORBIDDEN')
  await prisma.tavernPersona.delete({ where: { id } })
}

export async function setDefault(id: string, userId: string) {
  const persona = await prisma.tavernPersona.findUnique({ where: { id } })
  if (!persona || persona.userId !== userId) throw new Error('FORBIDDEN')
  await prisma.$transaction([
    prisma.tavernPersona.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } }),
    prisma.tavernPersona.update({ where: { id }, data: { isDefault: true } }),
  ])
}