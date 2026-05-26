/**
 * 独立模型种子脚本 — 仅插入 TavernModelMeta 数据
 * 绕过 seed.ts 中已过时的 sharedUser/userTier 引用
 *
 * 用法: npx tsx prisma/seed-models.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const models = [
  // ── FREE 模型 ────────────────────────────────────────────
  { modelId: 'qwen-turbo',           displayName: '通义千问 Turbo',    provider: 'tongyi',     description: '快速响应，适合日常对话',     icon: '⚡', minTier: 'FREE' as const, quotaCost: 1, sortOrder: 10 },
  { modelId: 'qwen-plus',            displayName: '通义千问 Plus',     provider: 'tongyi',     description: '更强能力，适合复杂任务',     icon: '✨', minTier: 'FREE' as const, quotaCost: 1, sortOrder: 20 },
  { modelId: 'qwen-max',             displayName: '通义千问 Max',      provider: 'tongyi',     description: '最强模型，适合极限挑战',     icon: '🔥', minTier: 'FREE' as const, quotaCost: 2, sortOrder: 30 },
  { modelId: 'big-pickle',           displayName: 'Big Pickle',        provider: 'opencode',   description: '免费大模型 · OpenCode Go',  icon: '🥒', minTier: 'FREE' as const, quotaCost: 1, sortOrder: 40 },
  { modelId: 'minimax-m2.5-free',    displayName: 'MiniMax M2.5 Free', provider: 'opencode',   description: '免费对话 · OpenCode Go',     icon: '🆓', minTier: 'FREE' as const, quotaCost: 1, sortOrder: 50 },
  { modelId: 'deepseek-v4-flash', displayName: 'DeepSeek V4 Flash', provider: 'opencode', description: '免费推理 · OpenCode Go',     icon: '⚡', minTier: 'FREE' as const, quotaCost: 1, sortOrder: 60 },
  { modelId: 'deepseek-v4-pro',   displayName: 'DeepSeek V4 Pro',   provider: 'opencode', description: '深度推理 · OpenCode Go',     icon: '🧠', minTier: 'FREE' as const, quotaCost: 2, sortOrder: 65 },

  // ── PAID 模型（需自配 Key）───────────────────────────────
  { modelId: 'chatglm-turbo',        displayName: 'ChatGLM Turbo',     provider: 'zhipu',      description: '轻量高效推理',               icon: '💨', minTier: 'PAID' as const, quotaCost: 2, sortOrder: 90 },
  { modelId: 'glm-4',                displayName: 'GLM-4',             provider: 'zhipu',      description: '智谱旗舰大模型',             icon: '🔮', minTier: 'PAID' as const, quotaCost: 3, sortOrder: 100 },
  { modelId: 'gpt-4o',               displayName: 'GPT-4o',            provider: 'openai',     description: '多模态旗舰模型',             icon: '🧠', minTier: 'PAID' as const, quotaCost: 3, sortOrder: 110 },
  { modelId: 'gpt-4-turbo',          displayName: 'GPT-4 Turbo',       provider: 'openai',     description: '高性能推理',                 icon: '💎', minTier: 'PAID' as const, quotaCost: 3, sortOrder: 120 },
  { modelId: 'deepseek-chat',        displayName: 'DeepSeek V3',       provider: 'deepseek',   description: '国产开源，代码能力强',       icon: '🐋', minTier: 'PAID' as const, quotaCost: 2, sortOrder: 120 },
  { modelId: 'deepseek-reasoner',    displayName: 'DeepSeek R1',       provider: 'deepseek',   description: '深度推理，复杂问题克星',     icon: '🔍', minTier: 'PAID' as const, quotaCost: 2, sortOrder: 130 },
  { modelId: 'claude-3.5-sonnet',    displayName: 'Claude 3.5 Sonnet', provider: 'anthropic',  description: '平衡性能与速度',             icon: '🎭', minTier: 'PAID' as const, quotaCost: 3, sortOrder: 140 },
  { modelId: 'claude-3-opus',        displayName: 'Claude 3 Opus',     provider: 'anthropic',  description: '最强分析推理',               icon: '🏛️', minTier: 'PAID' as const, quotaCost: 3, sortOrder: 150 },
  { modelId: 'gemini-2.5-pro',       displayName: 'Gemini 2.5 Pro',    provider: 'google',     description: 'Google 旗舰模型',            icon: '🌐', minTier: 'PAID' as const, quotaCost: 2, sortOrder: 160 },
  { modelId: 'gemini-2.5-flash',     displayName: 'Gemini 2.5 Flash',  provider: 'google',     description: '轻量快速响应',               icon: '⚡', minTier: 'PAID' as const, quotaCost: 1, sortOrder: 170 },
  { modelId: 'moonshot-v1-8k',       displayName: 'Kimi 8K',           provider: 'moonshot',   description: '长上下文理解',               icon: '🌙', minTier: 'PAID' as const, quotaCost: 2, sortOrder: 180 },
  { modelId: 'moonshot-v1-32k',      displayName: 'Kimi 32K',          provider: 'moonshot',   description: '超长上下文处理',             icon: '🌕', minTier: 'PAID' as const, quotaCost: 3, sortOrder: 190 },
  { modelId: 'abab6.5s',             displayName: 'abab6.5s',          provider: 'minimax',    description: 'MiniMax 快速模型',           icon: '🎯', minTier: 'PAID' as const, quotaCost: 2, sortOrder: 200 },
  { modelId: 'abab7',                displayName: 'abab7',             provider: 'minimax',    description: 'MiniMax 旗舰模型',           icon: '🚀', minTier: 'PAID' as const, quotaCost: 3, sortOrder: 210 },
  { modelId: 'openrouter-auto',      displayName: 'OpenRouter Auto',   provider: 'openrouter', description: '智能路由最佳模型',           icon: '🔀', minTier: 'PAID' as const, quotaCost: 2, sortOrder: 220 },

  // ── One API 说明 ─────────────────────────────────────────
  // One API 模型不在此预置，而是通过以下方式动态获取：
  //   1. 每日零点定时任务自动从 One API /v1/models 拉取
  //   2. Dashboard 手动触发 POST /v1/admin/sync-models
  //   3. 用户配置 One API Key（含自定义 baseUrl）后自动同步
  // One API 项目地址: https://github.com/songquanpeng/one-api
]

async function main() {
  console.log(`Seeding ${models.length} ModelMeta records...`)

  for (const m of models) {
    await prisma.tavernModelMeta.upsert({
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

  const count = await prisma.tavernModelMeta.count()
  console.log(`Done! ${count} models in TavernModelMeta table.`)
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
