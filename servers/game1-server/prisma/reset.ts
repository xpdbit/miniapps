/**
 * Game1 开发环境数据重置脚本
 *
 * 清空所有玩家相关数据（保留 Game1Config 种子配置）
 * 执行后自动重新播种配置数据
 *
 * 用法: npx tsx prisma/reset.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('⚠️  准备重置 GAME1 开发数据...');
  console.log('  将清空: 玩家、存档、PVP、成就、分享记录');
  console.log('  保留:   游戏配置 (Game1Config)\n');

  // 等待 3 秒让用户确认
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 3000);
    // 允许 Ctrl+C 取消
    process.on('SIGINT', () => {
      clearTimeout(timer);
      console.log('\n❌ 已取消');
      process.exit(0);
    });
  });

  console.log('开始清空数据...\n');

  // 按外键依赖顺序删除（虽然设置了 CASCADE，但显式删除更安全）
  const deleteOrder = [
    { name: '分享记录',      action: () => prisma.game1ShareLog.deleteMany() },
    { name: '成就记录',      action: () => prisma.game1Achievement.deleteMany() },
    { name: 'PVP 排行榜',    action: () => prisma.game1PvpRanking.deleteMany() },
    { name: 'PVP 对战记录',  action: () => prisma.game1PvpMatch.deleteMany() },
    { name: '云端存档',      action: () => prisma.game1CloudSave.deleteMany() },
    { name: '玩家账号',      action: () => prisma.game1Player.deleteMany() },
  ];

  for (const { name, action } of deleteOrder) {
    const result = await action();
    console.log(`  ✅ ${name}: 已删除 ${result.count} 条`);
  }

  console.log('\n所有数据已清空');
  console.log('提示: 如需恢复配置种子数据，请运行: npx tsx prisma/seed.ts');
}

main()
  .catch((e) => {
    console.error('\n❌ 重置失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
