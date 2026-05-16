// =============================================================================
// Agent Debug Routes — 为 AI Agent 提供诊断系统状态的调试通道
// 通过 x-agent-key 头认证（非 JWT，避免认证系统故障时无法诊断）
// =============================================================================

import { Router, type Request, type Response, type NextFunction } from 'express'
import prisma from './prisma'

const router = Router()

// ─── Agent Auth Middleware ──────────────────────────────────────────
// 使用独立的 x-agent-key 头进行认证，不依赖 JWT，
// 以便在认证系统出现故障时仍能进行诊断

function agentAuth(req: Request, res: Response, next: NextFunction): void {
  const agentKey = req.headers['x-agent-key']
  const validKey = process.env.AGENT_API_KEY || process.env.JWT_SECRET || 'agent-dev-key'

  if (typeof agentKey !== 'string' || agentKey !== validKey) {
    res.status(401).json({ success: false, message: 'Unauthorized' })
    return
  }
  next()
}

// ─── Helper: Test Database Connectivity ────────────────────────────

async function checkDbConnection(): Promise<boolean> {
  try {
    await (prisma.$queryRawUnsafe('SELECT 1') as Promise<unknown>)
    return true
  } catch {
    return false
  }
}

// ─── GET /health — 基础健康检查 ──────────────────────────────────

router.get('/health', agentAuth, async (_req: Request, res: Response) => {
  try {
    const dbConnected = await checkDbConnection()

    let adminUsersCount = 0
    if (dbConnected) {
      try {
        adminUsersCount = await prisma.dashboardAdminUser.count()
      } catch {
        adminUsersCount = -1
      }
    }

    res.json({
      timestamp: new Date().toISOString(),
      service: 'dashboard-admin-agent',
      jwt_secret_configured: !!process.env.JWT_SECRET,
      agent_api_key_configured: !!process.env.AGENT_API_KEY,
      node_env: process.env.NODE_ENV || 'development',
      admin_port: parseInt(process.env.ADMIN_PORT || '3001', 10),
      db_connected: dbConnected,
      admin_users_count: adminUsersCount,
    })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── GET /db-status — 数据库表状态诊断 ─────────────────────────

router.get('/db-status', agentAuth, async (_req: Request, res: Response) => {
  try {
    const connected = await checkDbConnection()

    const tableNames = ['dashboard_admin_users', 'dashboard_projects', 'dashboard_audit_logs', '_prisma_migrations'] as const
    const tables: Record<string, { exists: boolean; row_count: number }> = {}

    for (const name of tableNames) {
      tables[name] = { exists: false, row_count: 0 }
    }

    if (connected) {
      for (const name of tableNames) {
        try {
          const result = await (prisma.$queryRawUnsafe(
            `SELECT COUNT(*) as cnt FROM \`${name}\``,
          ) as Promise<Array<{ cnt: bigint }>>)

          const row = result[0]
          if (row) {
            tables[name] = { exists: true, row_count: Number(row.cnt) }
          } else {
            tables[name] = { exists: false, row_count: 0 }
          }
        } catch {
          // Table does not exist — keep defaults
        }
      }
    }

    res.json({ connected, tables })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── GET /admin-users — 查看管理员用户列表 ─────────────────────

router.get('/admin-users', agentAuth, async (_req: Request, res: Response) => {
  try {
    const users = await prisma.dashboardAdminUser.findMany({
      select: { id: true, username: true, role: true, status: true, created_at: true },
      orderBy: { created_at: 'desc' },
    })

    res.json({ users, count: users.length })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── POST /seed-admin — 初始化超级管理员 ─────────────────────────
// 幂等操作：若 ADMIN_SEED_USERNAME 指定的用户已存在则直接返回成功

router.post('/seed-admin', agentAuth, async (_req: Request, res: Response) => {
  try {
    const seedUsername = process.env.ADMIN_SEED_USERNAME || 'admin'
    const seedPassword = process.env.ADMIN_SEED_PASSWORD || 'Admin123!'

    const existing = await prisma.dashboardAdminUser.findUnique({ where: { username: seedUsername } })
    if (existing) {
      res.json({
        success: true,
        message: `Admin user '${seedUsername}' already exists`,
        alreadyExisted: true,
      })
      return
    }

    const bcrypt = await import('bcrypt')
    const passwordHash = await bcrypt.hash(seedPassword, 12)

    const admin = await prisma.dashboardAdminUser.create({
      data: { username: seedUsername, password_hash: passwordHash, role: 'super_admin' },
      select: { id: true, username: true, role: true, status: true, created_at: true },
    })

    res.status(201).json({
      success: true,
      message: `Admin user '${seedUsername}' created`,
      data: admin,
    })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

console.log('[Agent] Agent debug routes registered')

export default router
