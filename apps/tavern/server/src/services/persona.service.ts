import prisma from '../utils/prisma'

export async function listPersonas(userUuid: string) {
  return prisma.tavernPersona.findMany({
    where: { userUuid },
    orderBy: { isDefault: 'desc' },
  })
}

export async function createPersona(userUuid: string, data: { name: string; description?: string; avatar?: string }) {
  return prisma.tavernPersona.create({ data: { ...data, userUuid } })
}

export async function updatePersona(id: string, userUuid: string, data: { name?: string; description?: string; avatar?: string }) {
  const persona = await prisma.tavernPersona.findUnique({ where: { id } })
  if (!persona || persona.userUuid !== userUuid) throw new Error('FORBIDDEN')
  return prisma.tavernPersona.update({ where: { id }, data })
}

export async function deletePersona(id: string, userUuid: string) {
  const persona = await prisma.tavernPersona.findUnique({ where: { id } })
  if (!persona || persona.userUuid !== userUuid) throw new Error('FORBIDDEN')
  await prisma.tavernPersona.delete({ where: { id } })
}

export async function setDefault(id: string, userUuid: string) {
  const persona = await prisma.tavernPersona.findUnique({ where: { id } })
  if (!persona || persona.userUuid !== userUuid) throw new Error('FORBIDDEN')
  await prisma.$transaction([
    prisma.tavernPersona.updateMany({ where: { userUuid, isDefault: true }, data: { isDefault: false } }),
    prisma.tavernPersona.update({ where: { id }, data: { isDefault: true } }),
  ])
}