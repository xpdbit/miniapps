import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const count = await p.tavernModelMeta.count()
  console.log('Total count:', count)
  const all = await p.tavernModelMeta.findMany({ where: { isActive: true } })
  console.log('Active count:', all.length)
  all.forEach(m => console.log(m.modelId, m.minTier, m.isActive))
}
main().then(() => p.$disconnect())
