import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
try {
  const keys = await p.tavernApiKey.findMany({ select: { id: true, provider: true, isActive: true, createdAt: true } });
  console.log('=== API Keys ===');
  console.log(JSON.stringify(keys, null, 2));
  
  const models = await p.tavernModelMeta.findMany({ select: { modelId: true, provider: true, isActive: true } });
  console.log('=== Models ===');
  console.log(JSON.stringify(models, null, 2));
  
  await p.$disconnect();
} catch(e) {
  console.error(e);
  await p.$disconnect();
}
