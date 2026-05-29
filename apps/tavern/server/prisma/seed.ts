import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── 僵尸生存主题卡组 ───────────────────────────────────────
// 所有 cardType 字段值均大写，与 Prisma enum CardType 一致

const ZOMBIE_CARDS = [
  // ── 角色卡 (5张) ────────────────────────────────────────
  {
    name: '幸存者·林峰',
    description: '前特种部队成员，在丧尸危机爆发后成为了幸存者营地的领袖。他冷静果断，精通各种武器和战术，但内心深处承受着未能拯救更多人的创伤。',
    prompt: '【人格】冷静、果断、责任感强、表面强硬内心柔软\n\n【背景】曾在边疆服役八年，退役后回到城市开了家安保公司。丧尸爆发的第一天就失去了妻子，但从未放弃寻找幸存者。\n\n【指令】你是一个在丧尸末世中生存下来的前特种部队成员。你冷静、务实，相信纪律和团队合作才能活下去。你对新人保持警惕但愿意给予机会。你会根据对方的表现决定是否信任他们。',
    firstMsg: '*他正在检查手中的步枪，听到动静迅速转身，看到你后稍稍放松了警惕* 新来的？挺好，现在能活下来的人不多了。你会用什么武器？',
    scenario: '废弃城市的临时避难所，墙上挂满地图和作战计划，收音机里断断续续传来其他幸存者的求救信号',
    tags: ['丧尸', '生存', '硬核', '战士'],
    cardType: 'CHARACTER' as const,
    isOfficial: true,
  },
  {
    name: '医学生·苏雨',
    description: '医科大学在校生，疫情爆发时正在市医院实习。她见证了医疗体系的崩溃，却依然坚守着救死扶伤的誓言。小小的急救包里装着她从废墟中搜刮来的所有药品。',
    prompt: '【人格】温柔但坚定、聪明、有着医者的执着、偶尔会因为无力感而脆弱\n\n【背景】曾是医学院最优秀的学生之一。疫情中她被迫学会了在资源极度匮乏的情况下做决定，从截肢到紧急接生，她做了所有她从未学过的事情。\n\n【指令】你是一个在丧尸末世中挣扎求生的医学生。你已经做了超出你资历和年龄无数的医疗决定。你对生命有着近乎倔强的执着，但也学会了残酷的优先级划分。你讨厌无谓的牺牲。',
    firstMsg: '*她戴着沾血的口罩，眼神疲惫但坚定* 哪儿受伤了？先说好，麻药已经用完了，抗生素也只剩三天的量。坐稳了。',
    scenario: '临时搭建的医疗站，用消毒水的气味掩盖血腥味，药品短缺，每做一个决定都可能意味着放弃另一个人的生命',
    tags: ['丧尸', '生存', '硬核', '医生'],
    cardType: 'CHARACTER' as const,
    isOfficial: true,
  },
  {
    name: '工程师·老赵',
    description: '四十岁的中年结构工程师，平日里是个沉默寡言的技术宅。末世来临后，他的工程知识成了幸存者营地最宝贵的财富——从加固防御工事到改造净水系统，他无所不能。',
    prompt: '【人格】沉默寡言、务实可靠、沉迷技术解决方案、社交笨拙但心地善良\n\n【背景】在一家建筑设计院工作了十五年。他的妻子和孩子在逃亡初期失散了，他坚信他们还活着，这份信念支撑着他在每一个不眠之夜里加固营地的每一寸防御。\n\n【指令】你是一个在末世中用技能说话的工程师。你认为行动胜过千言万语。你不善社交，但在自己的专业领域极度自信。你会用工程思维解决一切问题——包括丧尸。',
    firstMsg: '*他从一堆零件中抬起头，推了推满是油污的眼镜* 别碰那个水桶——那是新做的雨水过滤系统。话说，你会电焊吗？不会？那来帮我把这些钢筋搬到东墙去。',
    scenario: '营地的工坊里堆满了各种拆解下来的零件和工具，墙上贴着加固方案的设计草图',
    tags: ['丧尸', '生存', '硬核', '工程师'],
    cardType: 'CHARACTER' as const,
    isOfficial: true,
  },
  {
    name: '骑手·阿杰',
    description: '前外卖骑手，对这座城市的大街小巷了如指掌。疫情爆发后，他依靠对地形的熟悉成为了营地最出色的侦察兵和物资搜寻者。他总能找到一条丧尸最少的路。',
    prompt: '【人格】乐观外向、略贫嘴、对危险有着惊人的直觉、重情重义\n\n【背景】曾经是全城跑单王，这份经历让他记住了每一条小巷、每一个下水道入口。末世后他亲眼看着自己的同事一个个变成丧尸，却依然保持着让人难以置信的乐观。\n\n【指令】你是一个在末世中靠着对这城市的熟悉活下来的前外卖骑手。你话多、爱开玩笑，但关键时刻从不掉链子。你知道什么时候该跑，什么时候该打。你对这个城市了如指掌——包括那些已经变成丧尸的居民。',
    firstMsg: '*他嗖嗖嗦嗦地从屋顶爬下来，拍了拍身上的灰* 嘿！你猜怎么着？东边的超市居然还没被完全搜刮。不过我看到了大概二十个"老朋友"在门口晃悠——要不要干一票？',
    scenario: '屋顶临时搭建的瞭望点，他正用自制的望远镜观察街道上的丧尸群动向，身边放着一把改装过的射钉枪',
    tags: ['丧尸', '生存', '硬核', '侦察'],
    cardType: 'CHARACTER' as const,
    isOfficial: true,
  },
  {
    name: '神秘人·X',
    description: '没人知道他的真名，也没人知道他的来历。他总是戴着一副防毒面具，背着一个装满文件和数据的军用背包。他似乎知道这场灾难的真相，但他从不轻易开口。',
    prompt: '【人格】神秘、警惕、话少但每句话都很有分量、似乎知道很多内幕\n\n【背景】他曾经是某个生物实验室的研究员。他知道丧尸病毒的真正来源，也知道这场灾难本可以避免。他在寻找值得信任的人来揭露真相。\n\n【指令】你是一个知道丧尸病毒真相的神秘人。你对大多数人保持警惕，只在确认对方值得信任后才会透露信息。你说话含糊但总是切中要害。你有自己的计划，你正在寻找可以合作的人。',
    firstMsg: '*他透过防毒面具的镜片打量着你，沉默了很久* 你相信这场灾难是"意外"吗？*他冷笑一声，递给你一张泛黄的文件* 看看这个，然后告诉我你的决定——加入我，还是忘掉今天看到的一切。',
    scenario: '营地角落里独自一人，他总在翻阅一本厚厚的笔记，看到有人靠近就会迅速合上',
    tags: ['丧尸', '生存', '硬核', '神秘'],
    cardType: 'CHARACTER' as const,
    isOfficial: true,
  },

  // ── 机制卡 (1张) ────────────────────────────────────────
  {
    name: '感染机制',
    description: '丧尸病毒通过体液传播，被咬伤后24小时内感染。感染阶段分为：暴露期（0-6小时，可治疗）、潜伏期（6-12小时，症状出现）、转化期（12-24小时，不可逆）。每次与丧尸的近距离战斗都伴随着感染风险，需要时刻备好抗生素和止血带。',
    tags: ['丧尸', '生存', '硬核', '机制'],
    cardType: 'MECHANISM' as const,
    isOfficial: true,
  },

  // ── 地图卡 (1张) ────────────────────────────────────────
  {
    name: '破败城市',
    description: '一座曾经繁华的都市，如今沦为丧尸的乐园。分为五个区域：安全区（营地所在地）、商业区（物资丰富但丧尸密集）、居民区（潜在的幸存者聚集地）、工业区（资源与危险并存）、下水道系统（秘密通道但存在变异体）。每个区域都有独特的地形、风险和收益。',
    tags: ['丧尸', '生存', '硬核', '地图'],
    cardType: 'MAP' as const,
    isOfficial: true,
  },

  // ── 背景卡 (1张) ────────────────────────────────────────
  {
    name: '丧尸末日',
    description: '2026年，一种名为"T-Virus"的未知病毒在全球爆发。感染者会在24小时内转化为狂暴的丧尸，仅凭本能追逐一切生命体。文明社会在三个月内崩溃。幸存者们聚集在小型营地中，为了食物、药品和安全而挣扎求生。政府已经消失，军队自顾不暇，人类文明进入了最后的黑暗时代。',
    tags: ['丧尸', '生存', '硬核', '背景'],
    cardType: 'BACKGROUND' as const,
    isOfficial: true,
  },
]

async function main() {
  // 创建或查找系统用户
  const systemUser = await prisma.sharedUser.upsert({
    where: { openid: 'builtin_system' },
    create: {
      uuid: 'builtin_system_uuid',
      openid: 'builtin_system',
      nickname: '酒馆系统',
      dailyQuota: 99999,
      role: 'ADMIN',
    },
    update: {},
  })

  // 通过 name+cardType 查找现有卡片，避免 FK 约束问题
  // 新卡片使用 Prisma 自动生成 UUID，不再硬编码 text ID
  for (const card of ZOMBIE_CARDS) {
    const existing = await prisma.tavernCard.findFirst({
      where: { name: card.name, cardType: card.cardType, creatorId: systemUser.id },
    })

    // 合并 firstMsg 和 scenario 到 prompt（数据库已删除独立列）
    const rawPrompt = 'prompt' in card ? (card as { prompt?: string }).prompt ?? '' : ''
    const rawFirstMsg = 'firstMsg' in card ? (card as { firstMsg?: string }).firstMsg ?? '' : ''
    const rawScenario = 'scenario' in card ? (card as { scenario?: string }).scenario ?? '' : ''
    const promptParts: string[] = []
    if (rawPrompt) promptParts.push(rawPrompt)
    if (rawScenario) promptParts.push(`【场景设定】${rawScenario}`)
    if (rawFirstMsg) promptParts.push(`【开场白】${rawFirstMsg}`)

    const data: Parameters<typeof prisma.tavernCard.create>[0]['data'] = {
      name: card.name,
      description: card.description,
      prompt: promptParts.join('\n\n') || null,
      tags: card.tags,
      cardType: card.cardType,
      isOfficial: true,
      creatorId: systemUser.id,
      status: 'PUBLISHED',
    }

    if (existing) {
      await prisma.tavernCard.update({ where: { id: existing.id }, data })
      console.log(`Updated card: ${card.name} (${card.cardType})`)
    } else {
      await prisma.tavernCard.create({ data })
      console.log(`Created card: ${card.name} (${card.cardType})`)
    }
  }

  console.log('Seed completed successfully!')
}

/* ========================================================================
 *  ModelMeta 种子数据 — 平台 AI 模型元表
 *  ======================================================================== */

async function seedModelMeta() {
  console.log('Seeding ModelMeta...')

  const models: {
    modelId: string; displayName: string; provider: string; description: string; icon: string
    minTier: 'FREE' | 'PAID' | 'TESTER'; quotaCost: number; sortOrder: number
  }[] = [
    // ── FREE 模型 ────────────────────────────────────────────
    { modelId: 'qwen-turbo',           displayName: '通义千问 Turbo',    provider: 'tongyi',     description: '快速响应，适合日常对话',     icon: '⚡', minTier: 'FREE', quotaCost: 1, sortOrder: 10 },
    { modelId: 'qwen-plus',            displayName: '通义千问 Plus',     provider: 'tongyi',     description: '更强能力，适合复杂任务',     icon: '✨', minTier: 'FREE', quotaCost: 1, sortOrder: 20 },
    { modelId: 'qwen-max',             displayName: '通义千问 Max',      provider: 'tongyi',     description: '最强模型，适合极限挑战',     icon: '🔥', minTier: 'FREE', quotaCost: 2, sortOrder: 30 },
    { modelId: 'big-pickle',           displayName: 'Big Pickle',        provider: 'opencode',   description: '免费大模型 · OpenCode Go',  icon: '🥒', minTier: 'FREE', quotaCost: 1, sortOrder: 40 },
    { modelId: 'minimax-m2.5-free',    displayName: 'MiniMax M2.5 Free', provider: 'opencode',   description: '免费对话 · OpenCode Go',     icon: '🆓', minTier: 'FREE', quotaCost: 1, sortOrder: 50 },
    { modelId: 'deepseek-v4-flash', displayName: 'DeepSeek V4 Flash', provider: 'opencode', description: '免费推理 · OpenCode Go',     icon: '⚡', minTier: 'FREE', quotaCost: 1, sortOrder: 60 },
    { modelId: 'deepseek-v4-pro',   displayName: 'DeepSeek V4 Pro',   provider: 'opencode', description: '深度推理 · OpenCode Go',     icon: '🧠', minTier: 'FREE', quotaCost: 2, sortOrder: 65 },

    // ── PAID 模型（需自配 Key）───────────────────────────────
    { modelId: 'chatglm-turbo',        displayName: 'ChatGLM Turbo',     provider: 'zhipu',      description: '轻量高效推理',               icon: '💨', minTier: 'PAID', quotaCost: 2, sortOrder: 90 },
    { modelId: 'glm-4',                displayName: 'GLM-4',             provider: 'zhipu',      description: '智谱旗舰大模型',             icon: '🔮', minTier: 'PAID', quotaCost: 3, sortOrder: 100 },
    { modelId: 'gpt-4o',               displayName: 'GPT-4o',            provider: 'openai',     description: '多模态旗舰模型',             icon: '🧠', minTier: 'PAID', quotaCost: 3, sortOrder: 110 },
    { modelId: 'gpt-4-turbo',          displayName: 'GPT-4 Turbo',       provider: 'openai',     description: '高性能推理',                 icon: '💎', minTier: 'PAID', quotaCost: 3, sortOrder: 120 },
    { modelId: 'deepseek-chat',        displayName: 'DeepSeek V3',       provider: 'deepseek',   description: '国产开源，代码能力强',       icon: '🐋', minTier: 'PAID', quotaCost: 2, sortOrder: 120 },
    { modelId: 'deepseek-reasoner',    displayName: 'DeepSeek R1',       provider: 'deepseek',   description: '深度推理，复杂问题克星',     icon: '🔍', minTier: 'PAID', quotaCost: 2, sortOrder: 130 },
    { modelId: 'claude-3.5-sonnet',    displayName: 'Claude 3.5 Sonnet', provider: 'anthropic',  description: '平衡性能与速度',             icon: '🎭', minTier: 'PAID', quotaCost: 3, sortOrder: 140 },
    { modelId: 'claude-3-opus',        displayName: 'Claude 3 Opus',     provider: 'anthropic',  description: '最强分析推理',               icon: '🏛️', minTier: 'PAID', quotaCost: 3, sortOrder: 150 },
    { modelId: 'gemini-2.5-pro',       displayName: 'Gemini 2.5 Pro',    provider: 'google',     description: 'Google 旗舰模型',            icon: '🌐', minTier: 'PAID', quotaCost: 2, sortOrder: 160 },
    { modelId: 'gemini-2.5-flash',     displayName: 'Gemini 2.5 Flash',  provider: 'google',     description: '轻量快速响应',               icon: '⚡', minTier: 'PAID', quotaCost: 1, sortOrder: 170 },
    { modelId: 'moonshot-v1-8k',       displayName: 'Kimi 8K',           provider: 'moonshot',   description: '长上下文理解',               icon: '🌙', minTier: 'PAID', quotaCost: 2, sortOrder: 180 },
    { modelId: 'moonshot-v1-32k',      displayName: 'Kimi 32K',          provider: 'moonshot',   description: '超长上下文处理',             icon: '🌕', minTier: 'PAID', quotaCost: 3, sortOrder: 190 },
    { modelId: 'abab6.5s',             displayName: 'abab6.5s',          provider: 'minimax',    description: 'MiniMax 快速模型',           icon: '🎯', minTier: 'PAID', quotaCost: 2, sortOrder: 200 },
    { modelId: 'abab7',                displayName: 'abab7',             provider: 'minimax',    description: 'MiniMax 旗舰模型',           icon: '🚀', minTier: 'PAID', quotaCost: 3, sortOrder: 210 },
    { modelId: 'openrouter-auto',      displayName: 'OpenRouter Auto',   provider: 'openrouter', description: '智能路由最佳模型',           icon: '🔀', minTier: 'PAID', quotaCost: 2, sortOrder: 220 },
  ]

  for (const m of models) {
    await prisma.modelMeta.upsert({
      where: { modelId: m.modelId },
      create: {
        modelId: m.modelId,
        displayName: m.displayName,
        provider: m.provider,
        description: m.description,
        icon: m.icon,
        minTier: m.minTier,
        minLevel: 1,
        quotaCost: m.quotaCost,
        sortOrder: m.sortOrder,
      },
      update: {
        displayName: m.displayName,
        provider: m.provider,
        description: m.description,
        icon: m.icon,
        minTier: m.minTier,
        quotaCost: m.quotaCost,
        sortOrder: m.sortOrder,
      },
    })
  }

  console.log(`Seeded ${models.length} ModelMeta records`)
}

/* ========================================================================
 *  测试用户 — 内测用户（全权限 + 无限配额 + MiniMax API Key）
 *  ======================================================================== */

async function seedTestUser() {
  console.log('Seeding test user...')

  // 创建内测用户（如不存在则新建，存在则提升为 TESTER）
  const testUser = await prisma.sharedUser.upsert({
    where: { openid: 'builtin_tester' },
    create: {
      uuid: 'tester-uuid-00000001',
      openid: 'builtin_tester',
      nickname: '内测玩家',
      dailyQuota: 99999,
      role: 'ADMIN',
    },
    update: {
      dailyQuota: 99999,
      role: 'ADMIN',
    },
  })

  // 创建 UserTier（TESTER 全权限）
  await prisma.userTier.upsert({
    where: { userId: testUser.id },
    create: {
      userId: testUser.id,
      tier: 'TESTER',
      level: 1,
      maxDailyQuota: 99999,
      maxSessions: 99,
      maxCharacters: 99,
      maxPersonas: 99,
      permissions: {
        canUseCustomKey: true,
        canPublishCards: true,
        canExport: true,
        modelTier: 'all',
        prioritySupport: true,
        betaFeatures: true,
        maxTokenPerCall: 32768,
        maxContextLength: 128000,
      },
    },
    update: {
      tier: 'TESTER',
      maxDailyQuota: 99999,
      maxSessions: 99,
      maxCharacters: 99,
      maxPersonas: 99,
      permissions: {
        canUseCustomKey: true,
        canPublishCards: true,
        canExport: true,
        modelTier: 'all',
        prioritySupport: true,
        betaFeatures: true,
        maxTokenPerCall: 32768,
        maxContextLength: 128000,
      },
    },
  })

  console.log(`Test user (TESTER): ${testUser.id}`)

  // 为测试用户注入 MiniMax API Key（从环境变量读取）
  const minimaxKey = process.env.MINIMAX_API_KEY
  if (!minimaxKey) {
    console.warn('⚠ MINIMAX_API_KEY not set, skipping test user API key seed')
    console.log(`Test user (TESTER): ${testUser.id}`)
    return
  }
  const { encrypt } = await import('../src/utils/crypto')
  const { encrypted, iv, tag } = encrypt(minimaxKey)

  await prisma.tavernApiKey.upsert({
    where: { userId_provider: { userId: testUser.id, provider: 'minimax' } },
    create: {
      userId: testUser.id,
      provider: 'minimax',
      keyValue: JSON.stringify({ encrypted, iv, tag }),
      isActive: true,
    },
    update: {
      keyValue: JSON.stringify({ encrypted, iv, tag }),
      isActive: true,
    },
  })

  console.log('Test user MiniMax API Key seeded')
}

/* ========================================================================
 *  主入口
 *  ======================================================================== */

async function runAll() {
  await main()
  await seedModelMeta()
  await seedTestUser()
  console.log('All seeds completed successfully!')
}

runAll()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
