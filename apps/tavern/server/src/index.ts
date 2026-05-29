import { createServer, default as app } from './app';
import { config } from './config';
import logger from './utils/logger';
import { execSync } from 'child_process';
import { getProviderApiKey } from './services/admin-config.service';
import { scenarioLoader } from './services/ai-scripts/scenario-loader';

// 使用 createServer() 以启用正确的超时配置（SSE 长连接支持）
const server = createServer();

/** server 是否已成功启动（用于 shutdown 容错） */
let serverListening = false;
/** 是否已尝试自动清理端口占用（避免无限重试） */
let portCleanupAttempted = false;

/**
 * 尝试自动释放被同服务（node 进程）占用的端口
 * @returns 是否成功清理了占用端口的 node 进程
 */
function tryReleaseNodePort(port: number): boolean {
  try {
    // 查找占用指定端口的 PID
    const netstatOut = execSync(`netstat -ano | findstr :${port}`, {
      encoding: 'utf-8',
      timeout: 5000,
    });

    // netstat 输出: "  TCP    0.0.0.0:3002   0.0.0.0:0   LISTENING    12345"
    const lines = netstatOut.trim().split('\n').filter(l => l.includes('LISTENING'));
    if (lines.length === 0) return false;

    const pids = new Set<number>();
    for (const line of lines) {
      const match = line.trim().match(/(\d+)$/);
      if (match) pids.add(parseInt(match[1]!, 10));
    }

    if (pids.size === 0) return false;

    let cleaned = false;
    for (const pid of pids) {
      if (pid === 0 || pid === process.pid) continue;

      // 检查是否为 node 进程
      try {
        const taskOut = execSync(`tasklist /FI "PID eq ${pid}" /NH`, {
          encoding: 'utf-8',
          timeout: 3000,
        });

        if (taskOut.toLowerCase().includes('node.exe')) {
          logger.info(`检测到 node 进程 (PID: ${pid}) 占用端口 ${port}，正在清理...`);
          execSync(`taskkill /PID ${pid} /F`, { timeout: 3000 });
          logger.info(`已终止进程 PID: ${pid}`);
          cleaned = true;
        } else {
          logger.warn(`端口 ${port} 被非 node 进程 (PID: ${pid}) 占用，无法自动清理`);
          return false;
        }
      } catch {
        // tasklist 查询失败，不处理
        return false;
      }
    }

    return cleaned;
  } catch {
    // netstat 执行失败或超时
    return false;
  }
}

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    if (!portCleanupAttempted) {
      portCleanupAttempted = true;
      logger.warn(`端口 ${config.port} 被占用，尝试自动清理同服务进程...`);

      if (tryReleaseNodePort(config.port)) {
        // 等待端口释放后重试 listen
        setTimeout(() => {
          server.listen(config.port);
        }, 500);
        return;
      }
    }

    logger.error(`端口 ${config.port} 已被占用，无法启动服务器。`);
    logger.error(`手动清理: 在管理员终端执行以下命令:`);
    logger.error(`  for /f "tokens=5" %a in ('netstat -ano ^| findstr :${config.port}') do taskkill /PID %a /F`);
    process.exit(1);
  } else {
    logger.error('服务器启动错误:', err);
    process.exit(1);
  }
});

server.listen(config.port, async () => {
  serverListening = true;
  logger.info(`服务器运行在端口 ${config.port}`);

  // 加载所有 Scenario 剧本
  scenarioLoader.loadAll();

  // 从 Dashboard Admin API 获取 AI Provider 配置（环境变量作为降级）
  const [dashscopeKey, opencodeKey] = await Promise.all([
    getProviderApiKey('tongyi').catch(() => null),
    getProviderApiKey('opencode').catch(() => null),
  ])
  const effectiveDashscopeKey = dashscopeKey || config.dashscopeApiKey
  const effectiveOpencodeKey = opencodeKey || config.opencodeApiKey

  const envLabel = process.env.NODE_ENV === 'production' ? '生产' : '开发';
  logger.info(`========================================`);
  logger.info(`  AI-Tavern Server`);
  logger.info(`========================================`);
  logger.info(`  环境:         ${envLabel} (${process.env.NODE_ENV || 'development'})`);
  logger.info(`  端口:         ${config.port}`);
  logger.info(`  公开地址:     ${config.publicUrl}`);
  logger.info(`  CORS:         ${Array.isArray(config.corsOrigin) ? config.corsOrigin.join(', ') : config.corsOrigin}`);
  logger.info(`  数据库:       MySQL (ai_tavern)`);
  logger.info(`  Redis:        ${config.redisUrl || '未配置'}`);
  logger.info(`  通义千问:     ${effectiveDashscopeKey ? '已配置' : '未配置'}`);
  logger.info(`  OpenCode:     ${effectiveOpencodeKey ? '已配置' : '未配置'}`);
  logger.info(`========================================`);

  // 启动时配置验证
  if (!effectiveDashscopeKey) {
    logger.warn('⚠ DASHSCOPE_API_KEY 未配置 — 通义千问（免费默认）将不可用');
  }
  if (!effectiveOpencodeKey) {
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
    const synced = results.filter(r => !r.error)
    const totalAdded = results.reduce((s, r) => s + r.added, 0)
    logger.info(`[startup] 模型同步完成: ${synced.length} 服务商同步, ${failed.length} 个有错误, 新增 ${totalAdded} 个模型`)
    
    if (failed.length > 0) {
      logger.warn(`[startup] 同步错误: ${failed.map(f => `${f.provider}(${f.error})`).join(', ')}`)
    }
    // 仅当同步前为 0 且无新增时才种子兜底（避免重复 COUNT 查询）
    if (existingCount === 0 && totalAdded === 0) {
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
// dynamic import fallback — PrismaClient type is not available in this scope
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function seedFallback(prisma: any) {
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

  if (!serverListening) {
    // server 尚未成功启动（如 EADDRINUSE 后直接退出），无需 close
    logger.info('服务器尚未启动完成，直接退出');
    process.exit(1);
    return;
  }

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
        logger.warn(`[cron] 同步错误的服务商: ${failed.map(f => `${f.provider}(${f.error})`).join(', ')}`)
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
