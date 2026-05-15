/**
 * FTG_Server 数据库种子数据
 *
 * 执行方式: npx tsx prisma/seed.ts
 * 使用 Prisma upsert 保证幂等性（重复执行不产生重复数据）
 */

import { PrismaClient } from '@prisma/client';
import { ACHIEVEMENTS_CONFIG } from '../src/constants/achievements';
import { THEME_TEMPLATES, DEFAULT_THEME_CONFIG } from '../src/constants/themeDefaults';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始种子数据填充...\n');

  // ============================================================
  // 1. 成就数据（12条）
  // ============================================================
  console.log('📋 填充成就数据...');
  for (const achievement of ACHIEVEMENTS_CONFIG) {
    await prisma.achievement.upsert({
      where: { achievementId: achievement.achievementId },
      update: {},
      create: {
        achievementId: achievement.achievementId,
        name: achievement.name,
        description: achievement.description,
        iconUrl: achievement.iconUrl,
        conditionType: achievement.conditionType,
        conditionValue: achievement.conditionValue,
        conditionParam: achievement.conditionParam ?? null,
        themeId: achievement.themeId,
      },
    });
    console.log(`  ✅ 成就: ${achievement.name} (${achievement.achievementId})`);
  }
  console.log(`  📊 共 ${ACHIEVEMENTS_CONFIG.length} 条成就\n`);

  // ============================================================
  // 2. 主题数据（6条，携带默认 config_json）
  // ============================================================
  console.log('🎨 填充主题数据...');
  for (const [index, template] of THEME_TEMPLATES.entries()) {
    await prisma.theme.upsert({
      where: { themeId: template.themeId },
      update: {},
      create: {
        themeId: template.themeId,
        name: template.name,
        gameName: template.gameName,
        configJson: DEFAULT_THEME_CONFIG as Record<string, unknown>,
        sortOrder: index,
      },
    });
    console.log(`  ✅ 主题: ${template.name} (${template.themeId})`);
  }
  console.log(`  📊 共 ${THEME_TEMPLATES.length} 条主题\n`);

  console.log('🎉 种子数据填充完成!');
}

main()
  .catch((e) => {
    console.error('❌ 种子数据填充失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
