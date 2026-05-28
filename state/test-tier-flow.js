// Test getUserTier and getAvailableModels directly
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const TIER_PRIORITY = { FREE: 1, PAID: 2, TESTER: 3 };

async function getUserTier(userUuid) {
  let tier = await p.tavernUserTier.findUnique({ where: { userUuid } });
  console.log('getUserTier raw:', JSON.stringify(tier));
  if (!tier) {
    console.log('No tier found, creating default...');
    // This would be createDefaultTier
    return { tier: 'FREE', level: 1 };
  }
  const result = {
    tier: tier.tier,
    level: tier.level,
    maxDailyQuota: tier.dailyQuotaMax,
    maxSessions: tier.maxSessions,
    maxCharacters: tier.maxCharacters,
    maxPersonas: tier.maxPersonas,
  };
  console.log('getUserTier result:', JSON.stringify(result));
  return result;
}

async function getAvailableModels(userUuid) {
  const tierInfo = await getUserTier(userUuid);
  const userPriority = TIER_PRIORITY[tierInfo.tier];
  console.log('userPriority:', userPriority, 'tier:', tierInfo.tier);

  const allModels = await p.tavernModelMeta.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  console.log('allModels count:', allModels.length);

  const filtered = allModels.filter(m => {
    const modelPriority = TIER_PRIORITY[m.minTier];
    if (tierInfo.level < m.minLevel) { console.log('  REJECTED level:', m.modelId, 'minLevel:', m.minLevel); return false; }
    if (userPriority < modelPriority) { console.log('  REJECTED tier:', m.modelId, 'minTier:', m.minTier); return false; }
    return true;
  });
  console.log('filtered count:', filtered.length);
  return filtered;
}

async function main() {
  const uuid = 'admin-001';
  const models = await getAvailableModels(uuid);
  console.log('Final count:', models.length);
  if (models.length > 0) {
    models.forEach(m => console.log(' -', m.modelId));
  }
}
main().then(() => p.$disconnect());
