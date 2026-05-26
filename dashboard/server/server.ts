// 必须在所有 import 之前加载 .env，确保 process.env 在模块初始化前就绪
import 'dotenv/config'

// =============================================================================
// Dashboard Admin API Server Entry Point
// 为 Dashboard 提供独立的管理员认证 API 服务
// =============================================================================

import { execSync } from 'child_process'
import express from 'express'
import prisma from './prisma'
import authRouter from './auth-routes'
import adminAuth from './admin-auth'
import dashboardRoutes from './dashboardRoutes'
import foodRecordRoutes from './admin-food-records'
import apiKeyRoutes from './admin-api-keys'
import achievementRoutes from './admin-achievements'
import agentRoutes from './agent-routes'
import monitoringRoutes from './admin-monitoring'
import game1Routes from './routes/game1-proxy'
import tavernRoutes from './routes/tavern-proxy'

const app = express()
const PORT = parseInt(process.env.ADMIN_PORT || '3001', 10)

app.use(express.json({ limit: '10mb' }))

// 请求日志中间件 — 记录每个请求的 method/path/status，用于线上问题诊断
app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    // 仅记录 /api/admin 路径的请求，避免 SPA 静态文件噪音
    if (req.path.startsWith('/api/admin') || req.path.startsWith('/health')) {
      console.log(`[REQ] ${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`)
    }
  })
  next()
})

// 挂载统一认证路由（/api/auth/*）— 所有项目共享
app.use('/api/auth', authRouter)

// 挂载管理员认证路由
app.use('/api/admin', adminAuth)

// 挂载仪表盘统计路由（/api/admin/dashboard/*）
// 统一在 /api/admin 下，方便前端使用单一 baseURL 访问所有 Admin API
app.use('/api/admin/dashboard', dashboardRoutes)

// 挂载食物记录管理路由（/api/admin/food-records/*）
app.use('/api/admin/food-records', foodRecordRoutes)

// 挂载 API 密钥管理路由（/api/admin/api-keys/*）
app.use('/api/admin/api-keys', apiKeyRoutes)

// 挂载成就管理路由（/api/admin/achievements/*）
app.use('/api/admin/achievements', achievementRoutes)

// 挂载 AGENT 调试通道（/api/admin/agent/*）
app.use('/api/admin/agent', agentRoutes)

// 挂载监控路由（/api/admin/monitoring/*）
app.use('/api/admin/monitoring', monitoringRoutes)

// 挂载 Game1 代理路由（/api/admin/game1/* → game1-server）
// 使用独立子路径挂载点，防止 Express5 多 Router 共享 /api/admin 触发 405 机制
app.use('/api/admin/game1', game1Routes)

// 挂载 Tavern 代理路由（/api/admin/tavern/* → tavern-server）
app.use('/api/admin/tavern', tavernRoutes)

// 健康检查端点
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    const userCount = await prisma.user.count()
    res.json({ status: 'ok', service: 'dashboard-admin', db: 'connected', users: userCount })
  } catch {
    res.status(503).json({ status: 'degraded', service: 'dashboard-admin', db: 'disconnected' })
  }
})

// ─── 启动时自动同步数据库 schema ─────────────────────────────────────
// 确保 users/user_auths 等表与 Prisma Schema 一致，避免部署遗漏 prisma db push
try {
  execSync('npx prisma db push --schema=../prisma/schema-miniapps.prisma --accept-data-loss', {
    stdio: 'pipe',
    timeout: 30000,
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'production' },
  })
  console.log('[Startup] 数据库 schema 同步完成')
} catch (err) {
  const execErr = err as { stderr?: Buffer; message?: string }
  console.error('[Startup] 数据库 schema 同步失败（服务仍将继续启动）')
  // 输出完整 stderr 以便诊断（Prisma 错误信息在 stderr 中）
  if (execErr.stderr) {
    console.error('[Startup] Prisma 错误详情:\n' + execErr.stderr.toString().trim())
  } else {
    console.error('[Startup] 错误:', execErr.message ?? String(err))
  }
  console.error('[Startup] ⚠️ 手动修复: cd dashboard && npx prisma db push --schema=../prisma/schema-miniapps.prisma --force-reset')
}

// ─── 启动时自动 seed 默认项目 ────────────────────────────────────────
// 确保 dashboard_projects 表中至少有 FTG / Game1 / AI-Tavern 三个项目
// 使用 upsert 按 slug 去重，多次启动不会重复创建
const DEFAULT_PROJECTS = [
  { slug: 'ftg', name: 'FTG', apiBaseUrl: '/api/v1/ftl', description: '食物主题生成器' },
  { slug: 'game1', name: 'Game1', apiBaseUrl: '/api/v1/game1', description: '挂机放置游戏' },
  { slug: 'tavern', name: 'AI-Tavern', apiBaseUrl: '/api/v1/tavern', description: 'AI 角色聊天' },
]

async function seedDefaultProjects() {
  try {
    for (const p of DEFAULT_PROJECTS) {
      await prisma.dashboardProject.upsert({
        where: { slug: p.slug },
        update: { name: p.name, apiBaseUrl: p.apiBaseUrl, description: p.description },
        create: p,
      })
    }
    console.log('[Startup] 默认项目 seed 完成')
  } catch (err) {
    console.error('[Startup] 默认项目 seed 失败:', (err as Error).message)
  }
}

const server = app.listen(PORT, '0.0.0.0', async () => {
  // 服务启动后自动 seed 默认项目（确保下拉框有可选项目）
  await seedDefaultProjects()
  console.log(`Dashboard Admin API running on port ${PORT}`)
  const envLabel = (process.env.NODE_ENV || 'development') === 'production' ? '生产' : '开发';
  console.log(`========================================`);
  console.log(`  Dashboard Admin API`);
  console.log(`========================================`);
  console.log(`  环境:         ${envLabel} (${process.env.NODE_ENV || 'development'})`);
  console.log(`  端口:         ${PORT}`);
  console.log(`  Game1 代理:   ${process.env.GAME1_API_URL || 'http://game1-server:3004/api/v1/game1'}`);
  console.log(`  Tavern 代理:  ${process.env.TAVERN_API_URL || 'http://tavern-server:3002/api/v1'}`);
  console.log(`========================================`);
})

// 与 Nginx 保持长连接复用，防止每个请求新建 TCP 连接
server.keepAliveTimeout = 65 * 1000; // 65s，匹配 Nginx keepalive_timeout
server.headersTimeout = 70 * 1000;   // 70s，必须大于 keepAliveTimeout
server.timeout = 30 * 1000;          // 30s 请求超时，防止慢请求占用连接

// 监听 server 错误（EADDRINUSE 等），提供清晰的诊断信息
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[FATAL] 端口 ${PORT} 已被占用，无法启动服务。`)
    console.error(`[FATAL] 可能原因：上一次启动的进程未完全退出。`)
    console.error(`[FATAL] 解决方法：netstat -ano | findstr :${PORT} 查到 PID 后 taskkill /F /PID <pid>`)
    process.exit(1)
  }
  console.error(`[FATAL] 服务启动失败:`, err.message)
  process.exit(1)
})
