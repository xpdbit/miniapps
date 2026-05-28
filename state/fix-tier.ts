import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const uuid = 'admin-001'
  let tier = await p.tavernUserTier.findUnique({ where: { userUuid: uuid } })
  if (!tier) {
    console.log('No tier found for admin-001, creating...')
    tier = await p.tavernUserTier.create({
      data: {
        userUuid: uuid,
        tier: 'TESTER',
        level: 1,
        dailyQuotaMax: 99999,
        maxSessions: 99,
        maxCharacters: 99,
        maxPersonas: 99,
        permissions: { canUseCustomKey: true, canPublishCards: true, canExport: true, modelTier: 'all' },
      }
    })
    console.log('Created TESTER tier for admin-001')
  } else {
    console.log('Existing tier:', tier.tier, 'level:', tier.level)
  }
  console.log('Done')
}
main().then(() => p.$disconnect())
