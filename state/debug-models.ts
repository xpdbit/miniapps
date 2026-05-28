import { PrismaClient, UserTierType } from '@prisma/client'
const p = new PrismaClient()
const TIER_PRIORITY: Record<string, number> = { FREE: 1, PAID: 2, TESTER: 3 }

async function main() {
  const uuid = 'admin-001'
  
  // 1. Check tier
  let tier = await p.tavernUserTier.findUnique({ where: { userUuid: uuid } })
  console.log('1. Tier record:', tier?.tier, 'level:', tier?.level)
  
  if (!tier) {
    console.log('   No tier found!')
    return
  }

  // 2. Get all models
  const allModels = await p.tavernModelMeta.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' }
  })
  console.log('2. All active models:', allModels.length)
  
  // 3. Simulate getAvailableModels logic
  const userPriority = TIER_PRIORITY[tier.tier]
  console.log('3. User tier:', tier.tier, 'priority:', userPriority)

  const filtered = allModels.filter(m => {
    const modelPriority = TIER_PRIORITY[m.minTier]
    const passes = userPriority >= modelPriority
    // console.log(`   ${m.modelId}: minTier=${m.minTier} prio=${modelPriority}, passes=${passes}`)
    return passes
  })
  console.log('4. After filter:', filtered.length)
  
  if (filtered.length > 0) {
    filtered.forEach(m => console.log('  -', m.modelId, m.provider, m.minTier))
  }
}
main().then(() => p.$disconnect())
