import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始播种 GAME1 种子数据...');

  const configs = [
    {
      key: 'game_balance',
      value: {
        exp_per_mileage: 10,
        max_level: 100,
        prestige_level_requirement: 50,
        prestige_exp_bonus_percent: 10,
      },
    },
    {
      key: 'pvp_config',
      value: {
        min_level: 10,
        daily_match_limit: 20,
        season_duration_days: 30,
        elo_k_factor: 32,
      },
    },
    {
      key: 'idle_reward',
      value: {
        base_exp_per_hour: 100,
        base_mileage_per_hour: 50,
        offline_max_hours: 12,
      },
    },
    {
      key: 'achievement_definitions',
      value: {
        mileage_100:    { title: '百里挑一',   description: '累计里程达到 100',     icon: 'mileage' },
        mileage_1000:   { title: '千里之行',   description: '累计里程达到 1000',    icon: 'mileage' },
        mileage_10000:  { title: '万里长征',   description: '累计里程达到 10000',   icon: 'mileage' },
        level_10:       { title: '小试牛刀',   description: '等级达到 10',          icon: 'level' },
        level_50:       { title: '半百之巅',   description: '等级达到 50',          icon: 'level' },
        pvp_10_wins:    { title: '初露锋芒',   description: 'PVP 获得 10 场胜利',   icon: 'pvp' },
        pvp_100_wins:   { title: '百战百胜',   description: 'PVP 获得 100 场胜利',  icon: 'pvp' },
        prestige_1:     { title: '轮回初启',   description: '完成 1 次轮回',         icon: 'prestige' },
        prestige_10:    { title: '十世轮回',   description: '完成 10 次轮回',        icon: 'prestige' },
        login_7_days:   { title: '一周达人',   description: '累计登录 7 天',         icon: 'login' },
        login_30_days:  { title: '满月礼',     description: '累计登录 30 天',        icon: 'login' },
      },
    },
    {
      key: 'season_info',
      value: {
        currentSeason: 202605,
        seasonName: 'S1 启程',
        startDate: '2026-05-01',
        endDate: '2026-06-01',
      },
    },
  ];

  for (const cfg of configs) {
    await prisma.game1Config.upsert({
      where: { key: cfg.key },
      update: { value: cfg.value as Record<string, unknown>, version: { increment: 1 } },
      create: {
        key: cfg.key,
        value: cfg.value as Record<string, unknown>,
        version: 1,
        updatedBy: 'seed',
      },
    });
    console.log(`  ✅ 配置: ${cfg.key}`);
  }

  console.log('✅ 种子数据播种完成');
}

main()
  .catch((e) => {
    console.error('❌ 种子数据播种失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
