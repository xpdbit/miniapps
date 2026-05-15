import prisma from '../utils/prisma'

export async function listPersonas(userId: string) {
  return prisma.persona.findMany({
    where: { userId },
    orderBy: { isDefault: 'desc' },
  })
}

export async function createPersona(userId: string, data: { name: string; description?: string; avatar?: string }) {
  return prisma.persona.create({ data: { ...data, userId } })
}

export async function updatePersona(id: string, userId: string, data: { name?: string; description?: string; avatar?: string }) {
  const persona = await prisma.persona.findUnique({ where: { id } })
  if (!persona || persona.userId !== userId) throw new Error('FORBIDDEN')
  return prisma.persona.update({ where: { id }, data })
}

export async function deletePersona(id: string, userId: string) {
  const persona = await prisma.persona.findUnique({ where: { id } })
  if (!persona || persona.userId !== userId) throw new Error('FORBIDDEN')
  await prisma.persona.delete({ where: { id } })
}

export async function setDefault(id: string, userId: string) {
  const persona = await prisma.persona.findUnique({ where: { id } })
  if (!persona || persona.userId !== userId) throw new Error('FORBIDDEN')
  await prisma.$transaction([
    prisma.persona.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } }),
    prisma.persona.update({ where: { id }, data: { isDefault: true } }),
  ])
}