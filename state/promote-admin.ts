import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const uuid = 'admin-001'
  await p.tavernUserTier.upsert({
    where: { userUuid: uuid },
    create: {
      userUuid: uuid, tier: 'TESTER', level: 1,
      dailyQuotaMax: 99999, maxSessions: 99, maxCharacters: 99, maxPersonas: 99,
      permissions: { canUseCustomKey: true, canPublishCards: true, canExport: true, modelTier: 'all' },
    },
    update: {
      tier: 'TESTER',
      permissions: { canUseCustomKey: true, canPublishCards: true, canExport: true, modelTier: 'all' },
    },
  })
  console.log('Admin upgraded to TESTER')
}
main().then(() => p.$disconnect())
