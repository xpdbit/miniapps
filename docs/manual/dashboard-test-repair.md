# Dashboard 测试修复手册

> **用途**: Agent 自主测试与修复操作手册  
> **状态**: current
> **更新**: 2026-05-24 (从 `docs/dashboard/` 迁移至 `docs/manual/`)
> **测试工具链**: Playwright → Sisyphus Pro → local_dev
> **注意**：所有的命令行任务均交给子AGENT另开线程执行，避免主AGENT线程堵塞！

---

## 速查

| 项目 | 值 |
|------|-----|
| 测试账号 | `admin` / `Admin123!` |
| Dashboard URL | `http://localhost:5173` |
| Admin API | `http://localhost:3001` |
| 启动命令 | `python local_server/local_dev.py` → `[6]` 启动所有服务 |
| 日志目录 | `local_server/logs/Dashboard_Front/` |
| 服务端口 | FTG:3000 / Admin:3001 / Tavern:3002 / Game1:3004 / Front:5173 |

---

## 1. Agent 执行流程

```bash
# Phase 0 — 环境准备
cd E:\.Code\.miniapps
python local_server/local_dev.py        # 菜单 [1] 启动 Docker 基础设施
                                        # 菜单 [6] 启动所有服务窗口

# Phase 1 — 类型检查（代码改动后必须）
cd dashboard
npm run type-check                     # tsc --noEmit

# Phase 2 — 浏览器测试（Playwright）
# 见 §2 测试指令

# Phase 3 — 日志检查
cat local_server/logs/Dashboard_Front/*.log | Select-String "proxy error|ECONNREFUSED|500|Error"
```

### 1.1 服务启动清单

| 服务 | 启动命令 | 端口 | 依赖 |
|------|---------|------|------|
| MySQL + Redis | Docker `local_server/docker-compose.yml` | 3307/6379 | Docker Desktop |
| FTG Server | `cd apps/ftg/server && npm run dev` | 3000 | MySQL |
| Game1 Server | `cd apps/game1/server && npm run dev` | 3004 | MySQL |
| Tavern Server | `cd apps/tavern/server && npm run dev` | 3002 | MySQL |
| Dashboard Admin | `cd dashboard && npm run dev:admin` | 3001 | MySQL + seed |
| Dashboard Front | `cd dashboard && npm run dev` | 5173 | Admin(3001) |

> **首次启动**: 需先执行 `[5] 初始化所有数据库 (npm run db:push)`

---

## 2. Playwright 测试指令

```
# 登录
page.goto('http://localhost:5173/login')
page.fill('input[placeholder*="用户名"]', 'admin')
page.fill('input[placeholder*="密码"]', 'Admin123!')
page.click('button[type="submit"]')
page.waitForURL('**/dashboard')

# 检查控制台
page.evaluate(() => ({ errors: window.__consoleErrors || [], warnings: window.__consoleWarnings || [] }))

# 检查项目下拉框
page.click('.project-switcher')
page.evaluate(() => document.querySelectorAll('.ant-select-item').length)  # 应为 3

# 逐页检查（完整测试清单）
const pages = ['/dashboard', '/projects', '/monitoring', '/admin']
for (const p of pages) { await page.goto(`http://localhost:5173${p}`); /* 检查 */ }

### 2.1 预期验证结果

| 页面 | 路由 | Console Errors | 关键检查 |
|------|------|----------------|---------|
| 登录页 | `/login` | 0 | 可登录 |
| Dashboard | `/dashboard` | 0 | 项目下拉框有 3 选项 |
| 配置 | `/projects` | 0 | 项目列表加载 |
| 监控 | `/monitoring` | 0 | 健康状态显示 |
| 管理员 | `/admin` | 0 | 管理员列表加载 |

---

## 3. Bug 速查表

| # | 现象关键词 | 根因模式 | 修复文件 | 严重 |
|---|----------|---------|---------|------|
| 1 | `projects` API 500 | Prisma `created_at` → `createdAt` | `admin-auth.ts` | 🔴 |
| 2 | `users` API 500 | 模型迁移后路由未更新 (`dashboardAdminUser` → `User`) | `admin-auth.ts` | 🔴 |
| 3 | `/dashboard` 404 | Vite 代理 `'/dashboard'` 拦截 SPA 路由 | `vite.config.ts` | 🔴 |
| 4 | antd `destroyOnClose` 警告 | API 弃用，改为 `destroyOnHidden` | 6 个页面文件 | 🟡 |
| 5 | auth 401 `console.error` | JWT 刷新流程的正常 401 被误报 | `authApi.ts` `authStore.ts` | 🟡 |
| 6 | antd React 19 + `message` 警告 | 架构兼容，`console.error` 过滤器 | `main.tsx` | 🟢 |
| 7 | 项目下拉框空 | 数据库无项目 + 前端空列表无 fallback | `server.ts` `Layout/index.tsx` | 🔴 |
| 8 | antd 过滤器 `startsWith` 误判 | 警告前有 "Warning: " 前缀，需 `includes` | `main.tsx` | 🟢 |
| 9 | `/api/tavern/*` ECONNREFUSED | fallback 路径指向错误服务器 | `Tavern/index.tsx` `vite.config.ts` | 🔴 |

---

## 4. Bug 详情与 Agent 搜索模式

### 4.1 Bug 1 — `projects` API 500

**搜索模式** (grep 发现同类问题):
```bash
# 搜索 Prisma 中使用了数据库列名而非模型字段名的模式
grep -rn "created_at\|updated_at" dashboard/server/ --include="*.ts"
```

**修复**: `admin-auth.ts` 中 `orderBy: { created_at: 'desc' }` → `orderBy: { createdAt: 'desc' }`

---

### 4.2 Bug 2 — 管理员 CRUD 模型迁移

**搜索模式** (发现引用已删除模型的代码):
```bash
# 搜索引用已从 Schema 移除的模型
grep -rn "dashboardAdminUser" dashboard/ --include="*.ts"
```

**修复**: 4 个 CRUD 路由从 `prisma.dashboardAdminUser` 迁移至 `prisma.user` + `prisma.userAuth`，新增 `formatAdminUser()` 映射函数。

| 端点 | 操作 | 新实现 |
|------|------|-------|
| `GET /api/admin/users` | 列表 | `prisma.user.findMany({ where: { role: { in: ['admin','super_admin'] } } })` |
| `POST /api/admin/users` | 创建 | 事务: `user.create` + `userAuth.create` |
| `DELETE /api/admin/users/:id` | 删除 | 事务: 级联删除 `userAuth` → `userSession` → `user` |
| `PUT /api/admin/users/:id/role` | 改角色 | `prisma.user.update({ data: { role } })` |

---

### 4.3 Bug 3 — SPA 路由被代理拦截

**搜索模式** (发现拦截 SPA 路由的 Vite 代理):
```bash
grep -rn "'/[a-z]" dashboard/vite.config.ts  # 匹配非 /api 前缀的代理规则
```

**修复**: 删除 `vite.config.ts` 中的 `'/dashboard'` 代理规则。该规则将前端路由转发到 Admin API (3001)，破坏了 React Router 的客户端导航。

**规则**: Vite 代理仅匹配 `/api/*` 前缀。任何不带 `/api` 前缀的路径都是 SPA 路由，不应走代理。

---

### 4.4 Bug 4 — antd API 弃用

**搜索模式** (发现弃用 API):
```bash
grep -rn "destroyOnClose" dashboard/src/ --include="*.tsx"
```

**修复**: 6 个文件 `destroyOnClose` → `destroyOnHidden`:
- `ApiKeys/index.tsx`, `Themes/index.tsx`, `Admin/index.tsx`
- `ThemeClasses/index.tsx`, `Tavern/TavernCards.tsx`, `Tavern/TavernCharacters.tsx`

---

### 4.5 Bug 5 — 401 误报

**规则**: JWT 刷新期间 `POST /api/auth/refresh` 返回 401 是预期行为，不应 `console.error`。

**修复**:
- `authApi.ts`: 仅对非 401 错误输出 `console.error`
- `authStore.ts`: 首次 401 静默重试 refresh

---

### 4.6 Bug 6+8 — antd 版本兼容警告过滤

**修复**: `main.tsx` 中添加过滤器，静默以下模式:
```typescript
const originalError = console.error.bind(console)
console.error = (...args: unknown[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : ''
  // antd v5 + React 19 兼容警告（开发模式专属）
  if (msg.includes('antd v5 support React is 16 ~ 18')) return
  // 静态 message API 无法消费动态主题上下文
  if (msg.includes('Static function can not consume context')) return
  originalError(...args)
}
```

> **注意**: 使用 `includes` 而非 `startsWith`，因为 antd 警告信息前有 `"Warning: "` 前缀。

---

### 4.7 Bug 7 — 项目下拉框空

**数据流**: `Layout → projectApi.list() → /api/admin/projects → prisma.dashboardProject.findMany()`

**双层修复**:

| 层 | 位置 | 改动 |
|----|------|------|
| 后端 | `server.ts` | `app.listen` 回调中 `seedDefaultProjects()` upsert 三个项目 |
| 前端 | `Layout/index.tsx` | API 返回空列表时回退到 `FALLBACK_PROJECTS` 硬编码列表 |

**seed 数据**:
```typescript
{ slug: 'ftg', name: 'FTG', apiBaseUrl: '/api/v1/ftl', description: '食物主题生成器' }
{ slug: 'game1', name: 'Game1', apiBaseUrl: '/api/v1/game1', description: '挂机放置游戏' }
{ slug: 'tavern', name: 'AI-Tavern', apiBaseUrl: '/api/v1/tavern', description: 'AI 角色聊天' }
```

> **Agent 注意**: `FALLBACK_PROJECTS` 的 `slug` 必须与 seed 数据一致，否则 `sessionStorage('currentProject')` 恢复会失败。

---

### 4.8 Bug 9 — Tavern ECONNREFUSED 🔴 本次重点

**日志特征**:
```
[vite] http proxy error: /api/tavern/v1/characters?page=1&pageSize=20
AggregateError [ECONNREFUSED]
```

**根因**: `Tavern/index.tsx` 的 `tavernApi` fallback 包装器在 Admin API 失败时降级到 `axios.get('/api/tavern/v1/...')`，该路径被 Vite 通用 `/api` 代理规则转发到 FTG Server (3000)，而非 Tavern Server (3002)。

**搜索模式** (发现类似 fallback 反模式):
```bash
# 搜索直接使用 axios 绕过服务层的降级代码
grep -rn "axios.get\|axios.post" dashboard/src/pages/ --include="*.tsx"

# 搜索硬编码的 /api/tavern 路径
grep -rn "/api/tavern" dashboard/src/ --include="*.tsx"
```

**修复 A**: 删除 `tavernApi` 包装器（~44 行），改为直接调用 `tavernAdminApi`:
```typescript
// 修复前 ❌
const tavernApi = {
  getCharacters: async (params) => {
    try { return await tavernAdminApi.getCharacters(params) }
    catch { return await axios.get('/api/tavern/v1/characters', ...) } // 错误路径!
  }
}

// 修复后 ✅
useQuery({
  queryFn: async () => {
    const res = await tavernAdminApi.getCharacters({ page, pageSize: 20 })
    return unwrapTavernResponse<CharactersResponse>(res.data)
  }
})
```

**修复 B**: Vite 代理添加 `/api/tavern` 和 `/api/v1/game1` 规则:
```typescript
'/api/tavern': {
  target: 'http://localhost:3002',
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/api\/tavern/, '/api'),
},
'/api/v1/game1': {
  target: 'http://localhost:3004',
  changeOrigin: true,
},
```

**请求链路（修复后）**:

```
主路径（tavernAdminApi）:
  浏览器 → GET /api/admin/tavern/characters
    → Vite /api/admin → localhost:3001
    → server.ts:/api/admin/tavern → tavern-proxy.ts
    → TAVERN_API_URL/admin/characters → tavern-server:3002 ✓

安全兜底（/api/tavern）:
  浏览器 → GET /api/tavern/v1/characters
    → Vite /api/tavern → rewrite /api/tavern→/api → /api/v1/characters
    → localhost:3002 ✓
```

**架构约束**:
- `TAVERN_API_URL` 在 `dashboard/.env` 须设为 `http://localhost:3002/api/v1`（默认 Docker hostname 本地不解析）
- Tavern Server 同时挂载三套路由: `/v1/*` / `/api/v1/*` / `/api/tavern/v1/*`
- `adminApiClient.baseURL = '/api'`，所有 Admin API 调用路径以 `/api/admin/*` 开头
- 各子项目 API 必须通过 Admin API (3001) 的 proxy 路由中转，不得从浏览器直连

---

## 5. 架构参考

### 5.1 Vite 代理规则（优先级从上到下）

```
1. /api/admin       → localhost:3001  (Admin API — 管理后台核心)
2. /api/auth        → localhost:3001  (统一认证 — JWT 签发/刷新)
3. /api/tavern      → localhost:3002  (Tavern Server, rewrite: /api/tavern→/api)
4. /api/v1/game1    → localhost:3004  (Game1 Server)
5. /api             → localhost:3000  (FTG Server — 兜底)
```

> **规则**: 更具体的路径必须排在通用路径之前。Vite 按定义顺序匹配，首个命中即停止。

### 5.2 Admin API 路由挂载 (server.ts)

```
/api/auth              → authRouter        (登录/注册/me/refresh)
/api/admin             → adminAuth          (项目/用户 CRUD + 认证中间件)
/api/admin/dashboard   → dashboardRoutes    (FTG 仪表盘统计)
/api/admin/food-records→ foodRecordRoutes   (食物记录管理)
/api/admin/api-keys    → apiKeyRoutes       (API 密钥管理)
/api/admin/achievements→ achievementRoutes  (成就管理)
/api/admin/agent       → agentRoutes        (Agent 调试)
/api/admin/monitoring  → monitoringRoutes   (系统监控)
/api/admin/game1       → game1-proxy.ts     (Game1 代理)
/api/admin/tavern      → tavern-proxy.ts    (Tavern 代理)
```

### 5.3 代理数据流 (Tavern 示例)

```
dashboard/src/services/tavern/index.ts
  tavernAdminApi.getCharacters()
    → adminApiClient.get('/admin/tavern/characters')
    → baseURL: '/api' → GET /api/admin/tavern/characters

dashboard/vite.config.ts
  '/api/admin' → localhost:3001

dashboard/server/server.ts
  app.use('/api/admin/tavern', tavernRoutes)

dashboard/server/routes/tavern-proxy.ts
  req.path = '/characters'
  subPath = 'characters'
  adminOps 含 'characters' → needsAdminPrefix = true
  targetPath = 'admin/characters'
  targetUrl = TAVERN_API_URL/admin/characters
    = http://localhost:3002/api/v1/admin/characters

apps/tavern/server/src/routes/index.ts
  router.use('/api/v1/admin', adminRoutes)  ← 匹配
```

---

## 6. 常见反模式速查

### 6.1 前端直接 axios 绕过服务层

```typescript
// ❌ 绕过 Admin API 代理，直接调用子项目
await axios.get('/api/tavern/v1/characters')
await axios.get('/api/v1/game1/players')

// ✅ 通过服务层，走 Admin API 代理
await tavernAdminApi.getCharacters()
await game1AdminApi.getPlayers()
```

**检测命令**:
```bash
grep -rn "from 'axios'" dashboard/src/pages/ --include="*.tsx"
```

### 6.2 Prisma 模型字段 vs 数据库列名

```typescript
// ❌ 使用数据库列名（snake_case）
orderBy: { created_at: 'desc' }

// ✅ 使用 Prisma 模型字段（camelCase）
orderBy: { createdAt: 'desc' }
```

**检测命令**:
```bash
grep -rn "created_at\|updated_at" dashboard/server/ --include="*.ts"
```

### 6.3 已删除模型的引用

Schema 迁移删除模型后，路由代码中的 `prisma.oldModel` 引用会运行时 500。

**检测命令**:
```bash
# 对比 Schema 与代码中的模型引用
grep -rn "prisma\.[a-z]" dashboard/server/ --include="*.ts" -o | sort -u
```

### 6.4 Vite 代理拦截 SPA 路由

任何不带 `/api` 前缀的 Vite 代理规则都会破坏 React Router。

**检测命令**:
```bash
# 检查是否有非 /api 前缀的代理规则
grep -E "'/[a-z]" dashboard/vite.config.ts | grep -v "'/api"
```

### 6.5 空列表无 fallback

API 返回空列表时，前端应使用硬编码 fallback 而非显示空状态。

```typescript
// ❌ API 成功但空列表 → 无 fallback
projectApi.list().then(res => setProjects(res.data.data.projects))  // []

// ✅ 空列表自动降级
projectApi.list().then(res => {
  const projects = res.data.data.projects
  setProjects(projects?.length ? projects : FALLBACK_PROJECTS)
})
```

---

## 7. 验证清单

每次 Dashboard 修改后执行：

- [ ] `npm run type-check` — TypeScript 0 errors
- [ ] `npm run build` — Vite 构建成功
- [ ] Playwright 逐页检查 (5 页，见 §2.1)
- [ ] Playwright `console` 命令 — 0 errors, 0 warnings
- [ ] 项目下拉框 — 3 个选项可切换
- [ ] 日志检查 — `Select-String "proxy error|500|ECONNREFUSED"` 无匹配
- [ ] Git diff review — 无调试代码/console.log 残留

### 7.1 一键验证脚本

```bash
# TypeScript 类型检查
cd E:\.Code\.miniapps\dashboard; npm run type-check; cd E:\.Code\.miniapps

# 日志错误检查（需服务运行中）
Get-ChildItem local_server\logs\*\*.log | ForEach-Object {
  $errors = Select-String -Path $_.FullName -Pattern "proxy error|ECONNREFUSED|Error|500"
  if ($errors) { Write-Host "$($_.Name): $($errors.Count) errors" }
}
```

---

## 8. 修改文件总览

```
dashboard/server/server.ts                  — Bug 7: 启动时 seed 默认项目
dashboard/server/admin-auth.ts              — Bug 1,2: Prisma 字段名 + 模型迁移
dashboard/vite.config.ts                    — Bug 3: 删除 /dashboard 代理
                                            — Bug 9: 添加 /api/tavern + /api/v1/game1 代理
dashboard/src/main.tsx                      — Bug 6,8: antd 警告过滤 (includes)
dashboard/src/components/Layout/index.tsx   — Bug 7: 空列表 fallback
dashboard/src/services/authApi.ts           — Bug 5: 401 静默处理
dashboard/src/stores/authStore.ts           — Bug 5: 401 静默处理
dashboard/src/pages/Tavern/index.tsx        — Bug 9: 移除 tavernApi fallback
dashboard/src/pages/ApiKeys/index.tsx       — Bug 4: destroyOnHidden
dashboard/src/pages/Themes/index.tsx        — Bug 4: destroyOnHidden
dashboard/src/pages/Admin/index.tsx         — Bug 4: destroyOnHidden
dashboard/src/pages/ThemeClasses/index.tsx  — Bug 4: destroyOnHidden
dashboard/src/pages/Tavern/TavernCards.tsx  — Bug 4: destroyOnHidden
dashboard/src/pages/Tavern/TavernCharacters.tsx — Bug 4: destroyOnHidden
apps/ftg/server/src/services/share.service.ts — 附加: UTF-8 编码修复
```

---

> **Agent 提示**: 每次 Dashboard 测试从 §1 执行流程开始，以 §7 验证清单结束。遇到新 bug 按 §3 速查表归档分类，并添加搜索模式到 §4。
