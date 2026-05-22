import { createServer, default as app } from './app';
import { config } from './config';
import logger from './utils/logger';

// 使用 createServer() 以启用正确的超时配置（SSE 长连接支持）
const server = createServer();

server.listen(config.port, () => {
  logger.info(`服务器运行在端口 ${config.port}`);

  // 启动时配置验证
  if (!config.dashscopeApiKey) {
    logger.warn('⚠ DASHSCOPE_API_KEY 未配置 — 通义千问（免费默认）将不可用');
  }
  if (!config.opencodeApiKey) {
    logger.warn('⚠ OPENCODE_API_KEY 未配置 — OpenCode Go（免费默认）将不可用');
  }

  // 启动时立即执行一次模型同步（确保 FREE 模型存在，无需等到零点）
  runStartupSync().then(() => {
    // 然后安排每日零点同步
    scheduleDailyModelSync();
  });
});

/** 启动时立即同步模型（FREE 模型始终可用，PAID 模型按需） */
async function runStartupSync(): Promise<void> {
  try {
    const { default: prisma } = await import('./utils/prisma')
    const existingCount = await prisma.tavernModelMeta.count({ where: { isActive: true } })
    logger.info(`[startup] 当前数据库中活跃模型: ${existingCount} 个`)

    logger.info('[startup] 执行启动模型同步...')
    const { syncAllModels } = await import('./services/model-sync.service')
    const results = await syncAllModels('admin-001')
    const failed = results.filter(r => r.error)
    logger.info(`[startup] 模型同步完成: ${results.length - failed.length} 服务商成功, ${failed.length} 失败`)
    
    const afterCount = await prisma.tavernModelMeta.count({ where: { isActive: true } })
    logger.info(`[startup] 同步后活跃模型: ${afterCount} 个 (新增 ${afterCount - existingCount} 个)`)
    
    if (failed.length > 0) {
      logger.warn(`[startup] 同步失败: ${failed.map(f => `${f.provider}(${f.error})`).join(', ')}`)
    }
    if (afterCount === 0) {
      logger.error('[startup] ⚠ 模型数据库为空！尝试直接种子...')
      await seedFallback(prisma)
    }
  } catch (err: unknown) {
    logger.error('[startup] 模型同步异常:', err instanceof Error ? err.message : String(err))
    // 即使同步异常，也尝试种子兜底
    try {
      const { default: prisma } = await import('./utils/prisma')
      await seedFallback(prisma)
    } catch (seedErr: unknown) {
      logger.error('[startup] 种子兜底也失败了:', seedErr instanceof Error ? seedErr.message : String(seedErr))
    }
  }
}

/** 直接写入 FREE 模型种子数据（完全绕过 syncAllModels，用于兜底） */
async function seedFallback(prisma: { tavernModelMeta: { upsert: Function; count: Function } }) {
  const FREE_MODELS = [
    { modelId: 'qwen-turbo',           displayName: '通义千问 Turbo',    provider: 'tongyi',   description: '快速响应，适合日常对话',     icon: '⚡', minTier: 'FREE', quotaCost: 1, sortOrder: 10 },
    { modelId: 'qwen-plus',            displayName: '通义千问 Plus',     provider: 'tongyi',   description: '更强能力，适合复杂任务',     icon: '✨', minTier: 'FREE', quotaCost: 1, sortOrder: 20 },
    { modelId: 'qwen-max',             displayName: '通义千问 Max',      provider: 'tongyi',   description: '最强模型，适合极限挑战',     icon: '🔥', minTier: 'FREE', quotaCost: 2, sortOrder: 30 },
    { modelId: 'big-pickle',           displayName: 'Big Pickle',        provider: 'opencode', description: '免费大模型 · OpenCode Go',  icon: '🥒', minTier: 'FREE', quotaCost: 1, sortOrder: 40 },
    { modelId: 'minimax-m2.5-free',    displayName: 'MiniMax M2.5 Free', provider: 'opencode', description: '免费对话 · OpenCode Go',     icon: '🆓', minTier: 'FREE', quotaCost: 1, sortOrder: 50 },
    { modelId: 'deepseek-v4-flash-free', displayName: 'DeepSeek V4 Flash', provider: 'opencode', description: '免费推理 · OpenCode Go',     icon: '⚙️', minTier: 'FREE', quotaCost: 1, sortOrder: 60 },
  ]
  
  for (const m of FREE_MODELS) {
    await prisma.tavernModelMeta.upsert({
      where: { modelId: m.modelId },
      create: {
        modelId: m.modelId, displayName: m.displayName, provider: m.provider,
        description: m.description, icon: m.icon, minTier: m.minTier as 'FREE',
        minLevel: 1, quotaCost: m.quotaCost, sortOrder: m.sortOrder, isActive: true,
      },
      update: {
        displayName: m.displayName, description: m.description, icon: m.icon, isActive: true,
      },
    })
  }
  
  const count = await prisma.tavernModelMeta.count({ where: { isActive: true } })
  logger.info(`[startup] 种子兜底完成，活跃模型: ${count} 个`)
}

// 优雅关闭
function shutdown(signal: string) {
  logger.info(`${signal} 收到，关闭服务器...`);
  server.close((err) => {
    if (err) {
      logger.error('关闭服务器时出错:', err);
      process.exit(1);
    }
    logger.info('服务器已关闭');
    process.exit(0);
  });

  // 强制关闭超时（10 秒后如果还没关完就强制退出）
  setTimeout(() => {
    logger.error('强制关闭超时，退出进程');
    process.exit(1);
  }, 10_000).unref();
}

/** 每日零点自动同步模型（从 One API 等服务商拉取最新模型列表） */
function scheduleDailyModelSync(): void {
  const runSync = async () => {
    try {
      logger.info('[cron] 开始每日模型同步...')
      const { syncAllModels } = await import('./services/model-sync.service')
      const results = await syncAllModels('admin-001')
      const failed = results.filter(r => r.error)
      logger.info(`[cron] 模型同步完成: ${results.length - failed.length}/${results.length} 成功, 新增 ${results.reduce((s, r) => s + r.added, 0)}, 更新 ${results.reduce((s, r) => s + r.updated, 0)}`)
      if (failed.length > 0) {
        logger.warn(`[cron] 同步失败的服务商: ${failed.map(f => `${f.provider}(${f.error})`).join(', ')}`)
      }
    } catch (err: unknown) {
      logger.error('[cron] 模型同步异常:', err instanceof Error ? err.message : String(err))
    }
  }

  // 计算到下一个零点的毫秒数
  const msUntilMidnight = () => {
    const now = new Date()
    const midnight = new Date(now)
    midnight.setHours(24, 0, 0, 0)
    return midnight.getTime() - now.getTime()
  }

  // 首次安排在零点
  const initialDelay = msUntilMidnight()
  logger.info(`[cron] 模型每日同步将在 ${Math.round(initialDelay / 3600_000)} 小时后首次执行`)

  setTimeout(() => {
    runSync()
    // 之后每 24 小时执行一次
    setInterval(runSync, 86400_000)
  }, initialDelay)
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// 防止未捕获的异常导致静默退出
process.on('uncaughtException', (err) => {
  logger.error('未捕获的异常:', err);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error('未处理的 Promise 拒绝:', reason);
});
