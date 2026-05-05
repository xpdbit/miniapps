# FTG Dashboard — Agent Debug Channel + 401 Login Fix + Deploy

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add agent-accessible debugging endpoints to the Dashboard Admin API, fix the root cause of the 401 Unauthorized login error, and deploy.

**Architecture:** Three tasks — Task 1 (new `agent-routes.ts` + wiring into `server.ts`), Task 2 (logging fixes in `admin-auth.ts`, health enhancement in `server.ts`, startup validation, deploy script fixes), Task 3 (build + deploy). Task 1 and Task 2 are independent and can run in parallel. Task 3 depends on both.

**Tech Stack:** Express 5, TypeScript, Prisma 6, mysql2, Docker Compose, Nginx

---

## Root Cause Analysis

The 401 has TWO possible causes:

### Cause A: Admin user never seeded
`deploy_commands.sh` (the script that runs on ECS) does NOT run `prisma db push` or `prisma db seed` for the Dashboard admin container. The full `deploy.sh` does, but `deploy_commands.sh` was written as a simplified version and skips migration/seeding entirely.

### Cause B: No diagnostic visibility
The login handler (`admin-auth.ts:159-208`) catches errors but:
- Returns generic 401 for ALL failure modes (no user, wrong password, disabled status)
- Never logs the specific failure reason to console
- The catch block at line 205 returns raw error to client (security leak for DB errors)
- No startup check validates JWT_SECRET or DB connectivity

**Remediation priority:** Fix both causes. Cause A prevents login; Cause B prevents debugging.

---

## File Structure Map

| File | Action | Purpose |
|------|--------|---------|
| `dashboard/server/agent-routes.ts` | CREATE | New agent debugging endpoints |
| `dashboard/server/server.ts` | MODIFY:34-46 | Wire agent routes; enhance health endpoint |
| `dashboard/server/admin-auth.ts` | MODIFY:159-208 | Add specific failure logging to login handler |
| `deploy_commands.sh` | MODIFY:28-38 | Add prisma db push + seed after compose up |
| `deploy/scripts/deploy.sh` | MODIFY:109-126 | Add agent health verification after seed |
| — | — | — |

---

### Task 1: Agent Debugging Channel

**Files:**
- Create: `dashboard/server/agent-routes.ts`
- Modify: `dashboard/server/server.ts:34-37`

**Dependencies:** None (parallel with Task 2)

#### Step 1: Create agent-routes.ts

Create `dashboard/server/agent-routes.ts`:

```typescript
// =============================================================================
// Agent Debugging Routes — for AI agent diagnosis of system health
// Protected by AGENT_API_KEY shared secret (not JWT, to avoid circular deps)
// =============================================================================

import { Router, type Request, type Response } from 'express'
import jwt from 'jsonwebtoken'
import mysql from 'mysql2/promise'

const router = Router()

const AGENT_API_KEY = process.env.AGENT_API_KEY || 'ftg-agent-dev-key'
const JWT_SECRET = process.env.JWT_SECRET || ''
const DATABASE_URL = process.env.DATABASE_URL || ''
const ADMIN_SEED_USERNAME = process.env.ADMIN_SEED_USERNAME || 'admin'

// ─── Auth middleware ────────────────────────────────────────────────

function agentAuth(req: Request, res: Response, next: () => void): void {
  const key = req.headers['x-agent-key'] as string | undefined
  if (!key || key !== AGENT_API_KEY) {
    res.status(401).json({ success: false, message: '无效的 Agent API Key' })
    return
  }
  next()
}

// ─── Helpers ────────────────────────────────────────────────────────

function parseDatabaseUrl(dbUrl: string) {
  try {
    const url = new URL(dbUrl)
    return {
      host: url.hostname || 'unknown',
      port: url.port || '3306',
      user: url.username || 'unknown',
      database: url.pathname.replace(/^\//, '') || 'unknown',
      hasPassword: !!url.password,
    }
  } catch {
    return null
  }
}

async function testDbConnection(dbUrl: string): Promise<{ ok: boolean; error?: string }> {
  const parsed = parseDatabaseUrl(dbUrl)
  if (!parsed) {
    return { ok: false, error: `无法解析 DATABASE_URL: ${dbUrl.substring(0, 30)}...` }
  }
  const url = new URL(dbUrl)
  const password = url.password || ''

  let conn: mysql.Connection | null = null
  try {
    conn = await mysql.createConnection({
      host: parsed.host,
      port: parseInt(parsed.port, 10),
      user: parsed.user,
      password,
      database: parsed.database,
      connectTimeout: 5000,
    })
    await conn.ping()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
}

async function queryDb(dbUrl: string, sql: string): Promise<{ rows: unknown[]; error?: string }> {
  const parsed = parseDatabaseUrl(dbUrl)
  if (!parsed) {
    return { rows: [], error: '无法解析 DATABASE_URL' }
  }
  const url = new URL(dbUrl)
  const password = url.password || ''

  let conn: mysql.Connection | null = null
  try {
    conn = await mysql.createConnection({
      host: parsed.host,
      port: parseInt(parsed.port, 10),
      user: parsed.user,
      password,
      database: parsed.database,
      connectTimeout: 5000,
    })
    const [rows] = await conn.query(sql)
    return { rows: rows as unknown[] }
  } catch (e) {
    return { rows: [], error: (e as Error).message }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
}

// ─── GET /api/admin/agent/health ────────────────────────────────────

router.get('/health', agentAuth, async (_req: Request, res: Response) => {
  const parsedDb = parseDatabaseUrl(DATABASE_URL)
  const dbConn = await testDbConnection(DATABASE_URL)
  let adminCount: number | null = null
  let adminSeedExists = false

  if (dbConn.ok) {
    const result = await queryDb(DATABASE_URL, `SELECT COUNT(*) as cnt FROM admin_users WHERE username = '${ADMIN_SEED_USERNAME}'`)
    if (!result.error && Array.isArray(result.rows) && result.rows.length > 0) {
      const row = result.rows[0] as Record<string, unknown>
      adminSeedExists = (row.cnt as number) > 0
    }
    const countResult = await queryDb(DATABASE_URL, 'SELECT COUNT(*) as cnt FROM admin_users')
    if (!countResult.error && Array.isArray(countResult.rows) && countResult.rows.length > 0) {
      const row = countResult.rows[0] as Record<string, unknown>
      adminCount = row.cnt as number
    }
  }

  res.json({
    success: true,
    data: {
      timestamp: new Date().toISOString(),
      service: 'dashboard-admin',
      uptime: Math.floor(process.uptime()),
      env: {
        NODE_ENV: process.env.NODE_ENV || 'not set',
        ADMIN_PORT: process.env.ADMIN_PORT || '3001',
        JWT_SECRET_set: !!JWT_SECRET && JWT_SECRET.length >= 16,
        JWT_SECRET_default: JWT_SECRET === 'dashboard-dev-secret',
        AGENT_API_KEY_set: !!process.env.AGENT_API_KEY,
        DATABASE_URL_format: parsedDb ? 'valid' : 'invalid',
        ADMIN_SEED_USERNAME_set: !!process.env.ADMIN_SEED_USERNAME,
        ADMIN_SEED_PASSWORD_set: !!process.env.ADMIN_SEED_PASSWORD,
      },
      database: {
        ...parsedDb,
        connected: dbConn.ok,
        error: dbConn.error || null,
      },
      admin_users: {
        total: adminCount,
        seedUserExists: adminSeedExists,
        seedUsername: ADMIN_SEED_USERNAME,
      },
    },
  })
})

// ─── GET /api/admin/agent/db-status ─────────────────────────────────

router.get('/db-status', agentAuth, async (_req: Request, res: Response) => {
  const dbConn = await testDbConnection(DATABASE_URL)

  if (!dbConn.ok) {
    res.json({
      success: false,
      data: {
        connected: false,
        error: dbConn.error,
        tables: {},
      },
    })
    return
  }

  const tables: Record<string, { exists: boolean; rowCount: number | null; error?: string }> = {}
  const tableNames = ['admin_users', 'projects', 'audit_logs']

  for (const table of tableNames) {
    const result = await queryDb(DATABASE_URL, `SELECT COUNT(*) as cnt FROM ${table}`)
    if (result.error) {
      tables[table] = { exists: false, rowCount: null, error: result.error }
    } else {
      const row = (result.rows as Record<string, unknown>[])[0]
      tables[table] = { exists: true, rowCount: (row?.cnt as number) ?? 0 }
    }
  }

  res.json({
    success: true,
    data: {
      connected: true,
      parsedConnection: parseDatabaseUrl(DATABASE_URL),
      tables,
    },
  })
})

// ─── GET /api/admin/agent/admin-users ───────────────────────────────

router.get('/admin-users', agentAuth, async (_req: Request, res: Response) => {
  const dbConn = await testDbConnection(DATABASE_URL)

  if (!dbConn.ok) {
    res.json({ success: false, message: '数据库不可达', error: dbConn.error })
    return
  }

  const result = await queryDb(
    DATABASE_URL,
    'SELECT id, username, role, status, created_at, updated_at FROM admin_users ORDER BY id',
  )

  if (result.error) {
    res.json({ success: false, message: '查询失败', error: result.error })
    return
  }

  res.json({
    success: true,
    data: {
      total: result.rows.length,
      users: result.rows,
    },
  })
})

// ─── POST /api/admin/agent/diagnose ─────────────────────────────────

router.post('/diagnose', agentAuth, async (req: Request, res: Response) => {
  const testCredentials = req.body?.testCredentials === true
  const results: Record<string, unknown> = {}
  let overallOk = true

  // 1. Environment checks
  const envChecks: Record<string, boolean | string> = {}
  envChecks.JWT_SECRET_set = !!JWT_SECRET && JWT_SECRET.length >= 16
  envChecks.JWT_SECRET_not_default = JWT_SECRET !== 'dashboard-dev-secret'
  envChecks.AGENT_API_KEY_set = !!process.env.AGENT_API_KEY
  envChecks.NODE_ENV = process.env.NODE_ENV || 'not set'
  if (!envChecks.JWT_SECRET_set) overallOk = false
  results.env = envChecks

  // 2. Database checks
  const dbConn = await testDbConnection(DATABASE_URL)
  results.database = { connected: dbConn.ok, error: dbConn.error || null }
  if (!dbConn.ok) {
    overallOk = false
    res.json({ success: true, data: { overallOk, results } })
    return
  }

  // 3. Table existence
  const tableChecks: Record<string, { exists: boolean; rowCount: number }> = {}
  const expectedTables = ['admin_users', 'projects', 'audit_logs']
  for (const table of expectedTables) {
    const r = await queryDb(DATABASE_URL, `SELECT COUNT(*) as cnt FROM ${table}`)
    if (r.error) {
      tableChecks[table] = { exists: false, rowCount: 0 }
      overallOk = false
    } else {
      const row = (r.rows as Record<string, unknown>[])[0]
      tableChecks[table] = { exists: true, rowCount: (row?.cnt as number) ?? 0 }
    }
  }
  results.tables = tableChecks

  // 4. Admin seed user check
  const seedResult = await queryDb(
    DATABASE_URL,
    `SELECT id, username, role, status, created_at FROM admin_users WHERE username = '${ADMIN_SEED_USERNAME}'`,
  )
  const seedUser = seedResult.rows[0] as Record<string, unknown> | undefined
  results.seedUser = {
    exists: !!seedUser,
    role: seedUser?.role ?? null,
    status: seedUser?.status ?? null,
    created_at: seedUser?.created_at ?? null,
  }

  // 5. Optional: test login with seed credentials
  if (testCredentials && seedUser && seedUser.status === 'active') {
    const adminPwd = process.env.ADMIN_SEED_PASSWORD || 'Admin123!'
    const bcrypt = await import('bcrypt')
    const pwdResult = await queryDb(
      DATABASE_URL,
      `SELECT password_hash FROM admin_users WHERE username = '${ADMIN_SEED_USERNAME}'`,
    )
    if (!pwdResult.error && pwdResult.rows.length > 0) {
      const row = pwdResult.rows[0] as Record<string, unknown>
      try {
        const valid = await bcrypt.default.compare(adminPwd, row.password_hash as string)
        results.passwordVerify = { ok: valid, message: valid ? '密码验证通过' : '密码不匹配' }
        if (!valid) overallOk = false
      } catch (e) {
        results.passwordVerify = { ok: false, error: (e as Error).message }
        overallOk = false
      }
    }

    // Test JWT signing
    try {
      const testToken = jwt.sign(
        { adminId: seedUser.id as number, username: seedUser.username as string, role: seedUser.role as string },
        JWT_SECRET,
        { expiresIn: '1m' },
      )
      const decoded = jwt.verify(testToken, JWT_SECRET) as Record<string, unknown>
      results.jwtTest = {
        ok: true,
        signWorks: true,
        verifyWorks: true,
        adminId: decoded.adminId,
        username: decoded.username,
      }
    } catch (e) {
      results.jwtTest = { ok: false, error: (e as Error).message }
      overallOk = false
    }
  }

  results.overallOk = overallOk
  res.json({ success: true, data: { overallOk, results } })
})

export default router
```

#### Step 2: Wire agent routes into server.ts

Modify `dashboard/server/server.ts` lines 1-46:

In the import block (after line 11), add:
```typescript
import agentRoutes from './agent-routes'
```

After line 32 (achievement routes), add:
```typescript
// 挂载 Agent 调试路由（/api/admin/agent/*）
// 使用 AGENT_API_KEY 共享密钥认证，不依赖 JWT（避免认证死循环）
app.use('/api/admin/agent', agentRoutes)
```

Replace the existing `/health` endpoint (lines 34-37) with an enhanced version:
```typescript
// 健康检查端点（包含数据库连通性）
const { pool } = await import('./db')
app.get('/health', async (_req, res) => {
  let dbOk = false
  try {
    const conn = await pool.getConnection()
    await conn.ping()
    conn.release()
    dbOk = true
  } catch {
    // DB not reachable — still return 200 for Docker healthcheck (container is alive)
  }
  res.json({
    status: dbOk ? 'ok' : 'degraded',
    service: 'dashboard-admin',
    dbConnected: dbOk,
    uptime: Math.floor(process.uptime()),
  })
})
```

Wait — the top-level await won't work. Let me restructure. The `pool` import is needed but currently db.ts is only imported by dashbord routes, not server.ts. Let me handle this differently:

```typescript
import { pool } from './db'
```

Then the health endpoint:
```typescript
app.get('/health', async (_req, res) => {
  let dbOk = false
  try {
    const conn = await pool.getConnection()
    await conn.ping()
    conn.release()
    dbOk = true
  } catch {
    // DB not reachable
  }
  res.json({
    status: dbOk ? 'ok' : 'degraded',
    service: 'dashboard-admin',
    dbConnected: dbOk,
    uptime: Math.floor(process.uptime()),
  })
})
```

But wait — `pool` from `db.ts` connects to `food_theme_generator` database, while the admin auth uses the `dashboard` database via Prisma. The health check should test BOTH. Let me keep it simple and just test the mysql2 pool, plus note that the Docker HEALTHCHECK in Dockerfile.admin already calls `/health`. Actually, for the Docker HEALTHCHECK, we want it to succeed even if DB is down (container should keep running). Let me return 200 always but include the db status in the JSON.

#### Step 3: Verify TypeScript compilation

Run: `cd Dashboard && npx tsc --noEmit`
Expected: No errors from new file.

#### Step 4: Commit Task 1

```bash
git add dashboard/server/agent-routes.ts dashboard/server/server.ts
git commit -m "feat: add agent debugging channel with health, db-status, admin-users, diagnose endpoints"
```

---

### Task 2: Fix 401 Login Error

**Files:**
- Modify: `dashboard/server/admin-auth.ts:159-208`
- Modify: `dashboard/server/server.ts:1-46` (already touched in Task 1)
- Modify: `deploy_commands.sh:28-38`
- Modify: `deploy/scripts/deploy.sh` (minor: add agent health check)

**Dependencies:** None (parallel with Task 1). If Task 1 was already completed, Task 2's server.ts changes build on top of Task 1's import/handler changes.

#### Step 1: Add diagnostic logging to login handler

Modify `dashboard/server/admin-auth.ts` lines 159-208:

Replace the login handler:

```typescript
// POST /api/admin/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      res.status(400).json({ success: false, message: '用户名和密码不能为空' })
      return
    }

    const admin = await prisma.adminUser.findUnique({ where: { username } })

    if (!admin) {
      console.error(`[Login] 用户不存在: username="${username}", ip=${getClientIp(req)}`)
      res.status(401).json({ success: false, message: '用户名或密码错误' })
      return
    }

    if (admin.status === 'disabled') {
      console.error(`[Login] 账号已禁用: username="${username}", id=${admin.id}, ip=${getClientIp(req)}`)
      res.status(401).json({ success: false, message: '用户名或密码错误' })
      return
    }

    const valid = await bcrypt.compare(password, admin.passwordHash)
    if (!valid) {
      console.error(`[Login] 密码错误: username="${username}", id=${admin.id}, ip=${getClientIp(req)}`)
      res.status(401).json({ success: false, message: '用户名或密码错误' })
      return
    }

    const token = jwt.sign(
      { adminId: admin.id, username: admin.username, role: admin.role },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY },
    )

    console.log(`[Login] 登录成功: username="${username}", id=${admin.id}, role=${admin.role}, ip=${getClientIp(req)}`)
    await auditLog({
      req,
      adminId: admin.id,
      action: 'LOGIN',
      details: { username: admin.username },
    })

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: admin.id,
          username: admin.username,
          role: admin.role,
        },
      },
    })
  } catch (error) {
    const err = error as Error
    console.error(`[Login] 服务器错误: message="${err.message}", stack="${err.stack}", body="${JSON.stringify(req.body)}"`)
    // Don't leak internal error details to client
    res.status(500).json({ success: false, message: '登录服务暂时不可用，请稍后重试' })
  }
})
```

#### Step 2: Add startup validation in server.ts

Modify `dashboard/server/server.ts` — add after the imports (before `const app = express()`):

```typescript
// ─── Startup validation ────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET || JWT_SECRET === 'dashboard-dev-secret') {
  console.error('[STARTUP] ⚠️  JWT_SECRET 未设置或使用默认值！请设置环境变量 JWT_SECRET')
}
if (JWT_SECRET && JWT_SECRET.length < 16) {
  console.error('[STARTUP] ⚠️  JWT_SECRET 长度不足 16 字符，安全性较低')
}
console.log(`[STARTUP] Dashboard Admin API starting on port ${PORT}`)
console.log(`[STARTUP] JWT_SECRET: ${JWT_SECRET ? 'SET (len=' + JWT_SECRET.length + ')' : 'NOT SET'}`)
console.log(`[STARTUP] NODE_ENV: ${process.env.NODE_ENV || 'not set'}`)
```

#### Step 3: Fix deploy_commands.sh — add prisma migration + seed

Modify `deploy_commands.sh` lines 28-38 (after docker compose up, before verification):

Replace:
```bash
# 3. 重建 Docker 容器
echo ""
echo "[3/4] 重建 Docker 容器..."
cd /opt/ftg/deploy
docker compose down 2>&1 | tail -3
docker compose up -d --build 2>&1 | tail -10

# 4. 验证
echo ""
echo "[4/4] 等待服务启动..."
sleep 15
```

With:
```bash
# 3. 重建 Docker 容器
echo ""
echo "[3/5] 重建 Docker 容器..."
cd /opt/ftg/deploy
docker compose down 2>&1 | tail -3
docker compose up -d --build 2>&1 | tail -10

# 4. 数据库迁移 + 种子
echo ""
echo "[4/5] 等待 MySQL 就绪 + 数据库迁移..."
for i in $(seq 1 30); do
    if docker inspect --format='{{.State.Health.Status}}' ftg-mysql 2>/dev/null | grep -q healthy; then
        break
    fi
    sleep 2
done

echo "Admin 数据库迁移 (prisma db push)..."
docker compose exec -T admin npx prisma db push --accept-data-loss 2>&1 || echo "[WARN] prisma db push 可能失败（若表已存在为正常情况）"

echo "Admin 数据库种子 (prisma db seed)..."
docker compose exec -T admin npx prisma db seed 2>&1 || echo "[WARN] 种子可能已执行过"

# 5. 验证
echo ""
echo "[5/5] 等待服务启动并验证..."
sleep 10
```

#### Step 4: Add agent health check to deploy.sh

Modify `deploy/scripts/deploy.sh` — after the seed step (line 126) and before Step 4 (line 128), add:

```bash
# ── Agent health diagnostics ──────────────────────────────────────
log_info "Agent 健康诊断..."
if [ -n "${AGENT_API_KEY:-}" ]; then
    docker compose --env-file .env exec -T admin \
        curl -s http://localhost:3001/api/admin/agent/health \
        -H "x-agent-key: ${AGENT_API_KEY}" | python3 -m json.tool 2>/dev/null | head -20 || log_warn "Agent health check 失败"
else
    log_warn "AGENT_API_KEY 未设置，跳过 agent 健康诊断（在 deploy/.env 中添加 AGENT_API_KEY=your-secret）"
fi
```

#### Step 5: Verify TypeScript compilation

```bash
cd Dashboard && npx tsc --noEmit
```

#### Step 6: Commit Task 2

```bash
git add dashboard/server/admin-auth.ts dashboard/server/server.ts deploy_commands.sh deploy/scripts/deploy.sh
git commit -m "fix: add diagnostic logging to login, startup validation, prisma seed in deploy_commands.sh"
```

---

### Task 3: Deploy

**Dependencies:** Task 1 and Task 2 must be completed.

**Files:**
- Build output: `deploy/nginx/html/*` (built from `dashboard/dist/`)

#### Step 1: Build Dashboard frontend

```bash
cd Dashboard
npm ci
npm run build
```

Expected: `dist/` directory created with `index.html` and `assets/` files.

Verify:
```bash
ls -la dist/index.html dist/assets/
```

#### Step 2: Copy build to deploy directory

```bash
rm -rf deploy/nginx/html/*
cp -r dashboard/dist/* deploy/nginx/html/
```

Verify:
```bash
ls deploy/nginx/html/
```

Expected: `index.html` present.

#### Step 3: Rebuild and restart Docker containers

```bash
cd deploy
docker compose --env-file .env down
docker compose --env-file .env up -d --build
```

#### Step 4: Wait for services healthy

```bash
# Wait for MySQL healthy
for i in $(seq 1 30); do
    docker inspect --format='{{.State.Health.Status}}' ftg-mysql 2>/dev/null | grep -q healthy && break
    sleep 2
done

# Run admin DB migration
docker compose --env-file .env exec -T admin npx prisma db push --accept-data-loss

# Seed admin user
docker compose --env-file .env exec -T admin npx prisma db seed
```

#### Step 5: Verify deployment

**5a — Docker health check:**
```bash
docker compose --env-file .env ps
```

Expected: All services show "healthy" in STATUS column.

**5b — Admin API health:**
```bash
curl -k https://localhost/api/admin/health
```

Expected: `{"status":"ok","service":"dashboard-admin","dbConnected":true,...}`

**5c — Agent health:**
```bash
curl -k https://localhost/api/admin/agent/health -H "x-agent-key: <AGENT_API_KEY from .env>"
```

**5d — Login test:**
```bash
curl -k https://localhost/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin123!"}'
```

Expected: `{"success":true,"data":{"token":"...","user":{...}}}`

**5e — Admin users list:**
```bash
curl -k https://localhost/api/admin/agent/admin-users -H "x-agent-key: <AGENT_API_KEY>"
```

Expected: At least 1 admin user with username "admin", role "super_admin".

#### Step 6: Commit Task 3 (deploy artifacts, if any changed)

If `deploy_commands.sh` or `deploy.sh` were modified in Task 3 (not already committed in Task 2):

```bash
git add deploy_commands.sh deploy/scripts/deploy.sh
git commit -m "deploy: rebuild with agent debugging and login fix"
```

---

## Commit Strategy Summary

| Order | Commit | Contents |
|-------|--------|----------|
| 1 | `feat: add agent debugging channel` | `agent-routes.ts` + `server.ts` import/wiring |
| 2 | `fix: add diagnostic logging and seed fix` | `admin-auth.ts` logging + `server.ts` startup check + `deploy_commands.sh` seed |
| 3 | `deploy: rebuild and verify` | Any remaining deploy script changes |

Tasks 1 and 2 can be worked on in parallel (no shared state). Task 3 requires both to be done.

---

## Verification Checklist (Post-Deploy)

- [ ] `curl -k https://47.94.108.150/api/admin/health` returns 200 with `dbConnected: true`
- [ ] `curl -k https://47.94.108.150/api/admin/login -d '{"username":"admin","password":"Admin123!"}'` returns token
- [ ] Agent `/api/admin/agent/health` shows `seedUserExists: true`
- [ ] `docker logs ftg-admin` shows `[Login] 登录成功` for the test login
- [ ] Dashboard SPA loads at `https://47.94.108.150/` without errors
- [ ] Nginx returns valid SSL certificate (self-signed OK)
- [ ] Agent `/api/admin/agent/diagnose` returns `overallOk: true`

## Environment Variables Required in deploy/.env

```bash
# Required for agent channel — add if not present:
AGENT_API_KEY=ftg-agent-prod-<random-16-chars>

# Required for seed credentials (ensure these exist):
ADMIN_SEED_USERNAME=admin
ADMIN_SEED_PASSWORD=Admin123!
```
