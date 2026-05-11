// =============================================================================
// Dashboard Admin API Server Entry Point
// 为 Dashboard 提供独立的管理员认证 API 服务
// =============================================================================

import express from 'express'
import prisma from './prisma'
import adminAuth from './admin-auth'
import dashboardRoutes from './dashboardRoutes'
import foodRecordRoutes from './admin-food-records'
import apiKeyRoutes from './admin-api-keys'
import achievementRoutes from './admin-achievements'
import agentRoutes from './agent-routes'
import game1Routes from './routes/game1-proxy'
import tavernRoutes from './routes/tavern-proxy'

const app = express()
const PORT = parseInt(process.env.ADMIN_PORT || '3001', 10)

app.use(express.json({ limit: '1mb' }))

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

// 挂载 Game1 代理路由（/api/admin/game1/* → game1-server）
app.use('/api/admin', game1Routes)

// 挂载 Tavern 代理路由（/api/admin/tavern/* → tavern-server）
app.use('/api/admin', tavernRoutes)

// 健康检查端点
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    const adminCount = await prisma.adminUser.count()
    res.json({ status: 'ok', service: 'dashboard-admin', db: 'connected', admins: adminCount })
  } catch {
    res.status(503).json({ status: 'degraded', service: 'dashboard-admin', db: 'disconnected' })
  }
})

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Dashboard Admin API running on port ${PORT}`)
})

// 与 Nginx 保持长连接复用，防止每个请求新建 TCP 连接
server.keepAliveTimeout = 65 * 1000; // 65s，匹配 Nginx keepalive_timeout
server.headersTimeout = 70 * 1000;   // 70s，必须大于 keepAliveTimeout
server.timeout = 30 * 1000;          // 30s 请求超时，防止慢请求占用连接
