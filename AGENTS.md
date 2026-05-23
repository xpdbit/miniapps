# PROJECT KNOWLEDGE BASE

**Generated:** 2026-05-23
**Commit:** (pending)
**Branch:** master

## OVERVIEW
个人小程序工坊 — 统一 dashboard 集中管理多个微信小程序项目（个人项目，不接外包）。
当前 3 个子项目：FTG（食物主题生成器）、Game1（挂机放置游戏）、AI-Tavern（AI 角色聊天）。
Monorepo: 3 个独立 TypeScript 项目（H5-Frontend + 3 Server + 1 Dashboard）+ 1 个 Python 桌面工具（SuperTask），共 ~780 源文件（不含 node_modules）。

## STRUCTURE
```
.miniapps/
├── apps/
│   ├── ftg/                       # FTG 项目
│   │   ├── client/                # Taro 4.x 跨平台客户端 — FTG 食物主题生成器
│   │   └── server/                # Express 后端 API (Prisma ORM, 16路由)
│   ├── game1/                     # Game1 项目
│   │   ├── client/                # Taro 跨平台客户端 — Game1 挂机放置游戏
│   │   └── server/                # Express 后端 API (云端存档/PVP/成就)
│   └── tavern/                    # AI-Tavern 项目
│       ├── client/                # Taro 4.x 跨平台客户端 — AI-Tavern 角色聊天
│       └── server/                # Express 后端 API (角色聊天/SSE)
├── dashboard/                     # React 管理后台 — 统一管理所有项目
├── cloud-functions/               # (空目录，云函数实际位于 apps/)
├── deploy/                        # Docker Compose + Nginx 部署到 ECS
├── docs/                          # 项目文档 (按项目分类)
├── plan/                          # 项目规划 (tasks/humans/ideas)
├── prisma/                        # 4套独立 Prisma Schema (每库一套)
│   ├── schema-miniapps.prisma             # miniapps 公用库 (users/auths/sessions/dashboard)
│   ├── schema-food-theme-generator.prisma # FTG 库 (11表)
│   └── schema-game1.prisma                # Game1 库 (7表)
├── database/                      # 数据库迁移脚本
├── tools/                         # 开发工具 (Python 桌面应用等)
│   └── supertask/                 # SuperTask AI 自主开发监督系统 (PyQt6)
├── state/                         # Agent 工作状态
├── deploy_commands.sh             # 部署命令脚本
├── deploy_remote.bat              # 远程部署批处理
├── recover_and_deploy.sh          # 恢复+部署脚本
└── .sisyphus/                     # Sisyphus Agent 工作目录
```

## 架构说明
- **一管多**: dashboard 管理后台统一管理所有小程序项目
- **当前项目**: FTG (成熟) + Game1 (开发中) + AI-Tavern (开发中)
- **共享基础设施**: 部署脚本、Nginx 配置、Prisma Schema、域名配置复用
- **独立部署**: 各 servers 独立容器/Dockerfile，通过 Nginx 统一路由
- **个人项目**: 所有小程序为个人项目，不接受外包

## WHERE TO LOOK
| 任务 | 位置 | 说明 |
|------|------|------|
| 小程序页面/组件 | `apps/ftg/client/src/` | Taro + React，含 pages/components/hooks |
| 后端 API 路由 | `apps/ftg/server/src/routes/` | 16 个路由模块(含 theme-classes/theme-render)RESTful |
| 管理后台界面 | `dashboard/src/` | React + Vite + Ant Design，含 ThemeClasses |
| 数据库 Schema | `prisma/schema-*.prisma` | 3套独立 Prisma Schema + tavern 本地 |
| 部署配置 | `deploy/docker-compose.yml` | Docker 统一编排 (MySQL/Redis/AI/Server/Admin/Nginx) |
| 模板渲染引擎 | `apps/ftg/server/src/services/theme-render.service.ts` | Markup 模板 + CSS Class 渲染 |
| Class 系统 | `apps/ftg/server/src/services/theme-class.service.ts` | CSS 属性白名单 + CRUD |
| CI/CD (FTG) | `apps/ftg/server/.github/workflows/` | GitHub Actions (lint/type-check/build/docker) |
| CI/CD (Game1) | `apps/game1/server/.github/workflows/` | GitHub Actions (Node 20 + MySQL 服务) |
| CI/CD (Tavern) | `apps/tavern/server/.github/workflows/` | **路径过滤器错误** — 实际路径 apps/tavern/server/ |
| Game1 后端 API | `apps/game1/server/src/routes/` | 10 路由模块 (auth/players/save/pvp/achievements/config/social/admin) |
| Tavern 后端 API | `apps/tavern/server/src/routes/` | 13 路由模块 (auth/characters/chat/keys/market/admin/builtin/export/tier/official/ai + personas/export) |
| Game1 小游戏引擎 | `apps/game1/client/src/engine/` | 纯 TS 游戏逻辑引擎 (18 子模块) |
| Tavern SSE Hook | `apps/tavern/client/src/hooks/useSSE.ts` | SSE 流式聊天 EventSource 封装（断线重连+消息追加）|
| Tavern 游戏模式 TabBar | `apps/tavern/client/src/custom-tab-bar/index.tsx` | 双模式 TabBar：酒馆/开始/我的 ↔ 通信/通讯录/发现/我的 |
| Tavern 游戏存档 | `apps/tavern/client/src/stores/gameStore.ts` | 游戏模式状态 + 存档/群组/消息管理 (localStorage) |
| Tavern 隐私模式 | `apps/tavern/client/src/stores/privacyStore.ts` | 隐私模式 + 本地 API Key 缓存（AI 直连绕过中转）|
| Tavern 直接 AI 调用 | `apps/tavern/client/src/hooks/useDirectAI.ts` | 隐私模式下直接 AI API 调用 Hook |
| Dashboard 系统监控 | `dashboard/server/admin-monitoring.ts` | 健康检查 + 指标 + 告警规则 API |
| Dashboard Game1 管理 | `dashboard/src/services/game1/` | Game1 运营/配置/成就/PVP API |
| Dashboard Tavern 管理 | `dashboard/src/services/tavern/` | Tavern 角色/审核/统计 API |
| Dashboard 认证初始化 | `dashboard/src/stores/authStore.ts` | Zustand 认证状态管理 (isAuthenticated 同步) |
| SuperTask 桌面工具 | `tools/supertask/` | Python PyQt6 GUI，AI 开发监督系统 |

## CODE MAP
| 符号 | 类型 | 位置 | 角色 |
|------|------|------|------|
| `App` (FTG MiniApp) | 入口 | `apps/ftg/client/src/app.ts` | 小程序应用入口 |
| `App` (FTG Server) | 入口 | `apps/ftg/server/src/app.ts` | FTG 后端 Express 服务 |
| `App` (Game1 Server) | 入口 | `apps/game1/server/src/app.ts` | Game1 后端 Express 服务 |
| `App` (Tavern Server) | 入口 | `apps/tavern/server/src/app.ts` | Tavern 后端 Express 应用定义 |
| `index` (Tavern Server) | 入口 | `apps/tavern/server/src/index.ts` | Tavern 服务器启动监听（双文件模式） |
| `App` (Game1 MiniApp) | 入口 | `apps/game1/client/src/app.tsx` | Game1 小程序入口 |
| `main` (Dashboard) | 入口 | `dashboard/src/main.tsx` | 管理后台 SPA 入口 |
| `server` (Dashboard API) | 入口 | `dashboard/server/server.ts` | Admin 独立 API (3001端口) |
| `GameEngine` (Game1) | 引擎 | `apps/game1/client/src/engine/index.ts` | 纯 TS 游戏逻辑引擎总入口 |
| `useSSE` (Tavern) | Hook | `apps/tavern/client/src/hooks/useSSE.ts` | SSE 流式聊天 EventSource 封装 |
| `useDirectAI` (Tavern) | Hook | `apps/tavern/client/src/hooks/useDirectAI.ts` | 隐私模式直接 AI API 调用 |
| `gameStore` (Tavern) | Store | `apps/tavern/client/src/stores/gameStore.ts` | 游戏模式存档/群组/消息管理 |
| `privacyStore` (Tavern) | Store | `apps/tavern/client/src/stores/privacyStore.ts` | 隐私模式 + 本地 API Key 缓存 |
| `ProtectedRoute` (Dashboard) | 组件 | `dashboard/src/components/ProtectedRoute/` | 路由守卫（登录+权限双检查） |
| `admin-auth` (Dashboard API) | 中间件 | `dashboard/server/admin-auth.ts` | JWT 认证 + RBAC 权限中间件 |

## CONVENTIONS
- **TypeScript strict** 全项目强制 (`no-explicit-any: error`)，但各项目严格度不同
  - Dashboard 最严格：`noUnusedLocals/Parameters: true`, `verbatimModuleSyntax: true`
  - MiniApp 通用：额外启用 `noUncheckedIndexedAccess: true`（Server 未启用）
  - tavern-server 中 `no-explicit-any: off`
- **2 空格缩进**，LF 换行，UTF-8
- **路径别名** `@/*` → 各项目 `src/`，MiniApp 另有 `@utils/@components/@services` 等别名
- **Prettier**: ftg-miniapp/ftg-server/game1-server 统一 `printWidth:100, singleQuote:true, trailingComma:all`；tavern-server/dashboard 无独立配置
- **ESLint**: ftg-miniapp 含 React Hooks 规则 (`rules-of-hooks: error`)；Server 通用 `no-non-null-assertion: error`
- **Zod 校验**: game1-server 和 tavern-server 在路由层使用 Zod request validation
- **Prisma**: 统一 ORM，但版本分化 — ftg-server/dashboard v6.19, game1-server v5.22, tavern-server v5.10
- **Tavern Server 双文件入口**: `app.ts` 导出 `createServer()` 工厂函数，`index.ts` 实际启动监听（唯一个例）
- **Dashboard 无 ESLint 配置**（最严格的项目反而缺失）

## ANTI-PATTERNS（本项目）
- ❌ **零测试覆盖** — 全项目无测试框架/文件/脚本（game1-miniapp 有 vitest.config 但无测试文件）
- ❌ **Tavern CI 路径过滤器错误（3处）** — `.github/workflows/ci.yml` 的 paths、working-directory、cache-dependency-path 均使用 `servers/tavern-server/`，实际路径 `apps/tavern/server/`。同时分支监听 `master/develop`，仓库实际使用 `main`，双重原因导致 CI 永不触发
- ❌ **FTG Server CI 缺路径过滤器** — 未限制 `apps/ftg/server/**`，其他目录变更也会触发
- ❌ **SSH 部署被注释** — `deploy.yml` SSH 部署步骤完全注释，仅做 Docker build+push
- ❌ **`textGenerate` 云函数为占位实现** — 未接入混元 AI
- ❌ **`getUserStats` 云函数返回硬编码零值**
- ❌ **空 catch 块** — `apps/ftg/client/src/app.ts` 有 4 个空 catch 块（line 55/94/117/131）
- ❌ **Mock 降级代码** — 多处运行时降级（recognition.mockRecognize, textgen.generateFallback, authStore.mockAuth）
- ❌ **TODO 占位实现** — `apps/ftg/client/src/pages/result/index.tsx:108` handleSave 未完成
- ❌ **占位注释** — `apps/tavern/server/src/routes/chat.ts:149` `// Clean up if needed` 无实际逻辑
- ❌ **错误日志缺失** — `apps/game1/server/src/routes/players.ts` catch 块仅 `sendError` 无日志
- ❌ **console.log 残留** — game1/client 多个文件（app.tsx、AchievementEngine、SaveManager、PendingEventEngine）
- ❌ **Prisma 版本分化** — ftg-server/dashboard v6.19, game1-server v5.22, tavern-server v5.10
- ❌ **tavern-server 路径别名未使用** — tsconfig 已有 `@/*` 配置，但实际 import 仍使用相对路径
- ❌ **Dashboard 内联样式过多** — 仅 Login/Dashboard/Layout 已迁移 CSS Modules，其余待迁移
- ❌ **cloud-functions/ 根目录为空** — 云函数实际在 apps/ftg/client/cloudfunctions/
- ❌ **tavern-server 无独立 Prettier 配置**
- ❌ **Game1 Client 无 CI/CD** — Server 有 GitHub Actions 但 MiniApp 没有
- ❌ **Grafana 容器名拼写错误** — `apps/ftg/server/docker-compose.monitoring.yml` 中 `container_name: ftp-grafana` 应为 `ftg-grafana`
- ❌ **game1-server Dockerfile 不一致** — 生产阶段使用 `node:20-alpine`（其他 server 用 `node:20-slim`），且缺少 healthcheck
- ❌ **dashboard docker-compose 不完整** — `dashboard/docker-compose.yml` 仅构建前端，缺少 Admin API 服务
- ❌ **tavern-server 死路由文件** — `personas.ts` 和 `builtin.ts` 存在于 routes/ 但未被 routes/index.ts 导入
- ❌ **Dashboard 无 ESLint 配置** — 最严格的项目反而缺失
- ❌ **Game1 Client 无 lint 脚本** — package.json 有 eslint 但 scripts 中 lint 指向缺失的 eslint config

## 已清理的旧反模式
以下反模式在本次扫描中已确认不存在（已修复）：
- ✅ `as any` 散布 — 源码中未发现
- ✅ `@ts-ignore` / `@ts-expect-error` — 未发现
- ✅ 无必要的 `eslint-disable` 注释 — 未发现
- ✅ 硬编码密钥 — `.sisyphus/aliyun-mysql-clear.js` 已处理

## COMMANDS
```bash
# MiniApp (Taro) — cd apps/ftg/client
npm run dev:weapp        # 开发模式(watch)
npm run build:weapp      # 生产构建
npm run type-check       # TypeScript 类型检查
npm run dev:h5           # H5 开发模式(watch)
npm run build:h5         # H5 生产构建

# Game1 MiniApp (Taro) — cd apps/game1/client
npm run dev:weapp        # 开发模式(watch)
npm run build:weapp      # 生产构建
npm run type-check       # TypeScript 类型检查
npm run dev:h5           # H5 开发模式(watch)
npm run build:h5         # H5 生产构建

# Tavern MiniApp (Taro) — cd apps/tavern/client
npm run dev:weapp        # 开发模式(watch)
npm run build:weapp      # 生产构建
npm run type-check       # TypeScript 类型检查
npm run lint             # ESLint 代码检查
npm run format           # Prettier 格式化
npm run generate-icons   # 生成 tabBar 图标
npm run dev:h5           # H5 开发模式(watch)
npm run build:h5         # H5 生产构建

# Server (Express) — cd apps/ftg/server
npm run dev              # tsx watch 开发(端口 env.PORT)
npm run build            # tsc 编译
npm run lint             # ESLint
npm run db:migrate       # Prisma 数据库迁移

# Game1 Server (Express) — cd apps/game1/server
npm run dev              # tsx watch 开发
npm run build            # tsc 编译
npm run type-check       # TypeScript 类型检查
npm run lint             # ESLint
npm run db:migrate       # Prisma 数据库迁移

# Tavern Server (Express) — cd apps/tavern/server
npm run dev              # tsx watch 开发
npm run build            # tsc 编译
npm run type-check       # TypeScript 类型检查
npm run start            # 生产启动
npm run lint             # ESLint 检查
npm run db:generate      # Prisma Client 生成
npm run db:migrate       # 数据库迁移
npm run db:seed          # 种子数据（内置角色）

# Dashboard (Vite) — cd dashboard
npm run dev              # Vite 开发(5173端口)
npm run build            # 生产构建
npm run type-check       # TypeScript 类型检查
npm run db:generate      # Prisma Client 生成

# 部署
bash deploy/scripts/deploy.sh   # 一键构建+部署到 ECS
bash deploy/scripts/verify.sh   # 部署后健康检查
```

## NOTES
- **Dashboard 双进程**: Vite 前端(5173) + Express Admin API(3001) 独立运行
- **Dashboard 暗色模式**: 通过 `themeStore` (Zustand) 控制，localStorage 持久化，ConfigProvider darkAlgorithm
- **Dashboard UI 组件体系**: PageHeader (通用头部) + PageSkeleton (4种骨架屏) + 响应式宽度常量
- **MiniApp 共享组件库**: AppButton (4变体) + AppCard + SectionHeader + EmptyState + Icon (18个SVG) + Skeleton (4类型)
- **MiniApp 图表**: 原生 Canvas 2D 图表组件 (LineChart/PieChart/BarChart/CalendarHeatmap)
- **MiniApp CSS 变量系统**: `app.scss` 定义了完整的颜色/字体/间距/阴影/z-index 变量
- **MiniApp 认证流程**: wx.login() → POST /api/auth/wechat/login → JWT access_token + refresh_token → 本地持久化
- **统一认证**: 所有项目共享 `/api/auth/*` (Dashboard Admin API 承载)，统一 JWT_SECRET。多绑定模式：`users` + `user_auths` (password/wechat/phone)
- **MiniApp 自定义 tabBar**: CustomTabBar 组件使用 Taro eventCenter 监听 tabChange 事件驱动高亮
- **MiniApp HTTP 客户端**: HttpClient 类封装 Taro.request，支持超时检测和网络连接错误中文提示
- **MiniApp 降级模式**: 开发时可通过 `TARO_APP_MOCK_AUTH=true` 启用 mock 登录绕过微信授权
- **API 代理**: Dashboard `/api` 在开发时代理到 Server `localhost:3000`
- **生产架构**: Nginx(80/443) → Dashboard SPA / FTG API(/api/ftl/) / Game1 API(/api/v1/game1/) / Tavern API(/api/tavern/) / Admin API(/api/v1/admin/) / 识别(/recognition/*)
- **识别服务**: PP-ShiTuV2 独立容器，通过 HTTP API 调用，开发模式可用 `RECOGNITION_MOCK_MODE=true` 降级
- **Dashboard Auth 初始化**: authStore 初始化时 `isAuthenticated` 同步设为 `!!getToken()`，`user` 为 `null`。`restoreSession()` 异步调用 `/api/auth/me` 获取用户信息。`ProtectedRoute` 订阅 `initialized` 标志，仅在 `restoreSession` 完成后才进行权限判断
- **数据库架构 (2026-05-20 重构)**: 4 个独立数据库 — `miniapps`(公用: users/auths/sessions/dashboard, 5表) + `food_theme_generator`(FTG, 11表) + `ai_tavern`(Tavern, 13表) + `game1`(不动, 7表)。跨库 UUID 软引用，4套独立 Prisma Schema。
- **Tavern 双模式 TabBar**: CustomTabBar 通过 `gameStore.gameMode` 状态切换 Tavern 模式（酒馆/开始/我的）↔ Game 模式（通信/通讯录/发现/我的），通过 eventCenter 广播 mode 变更事件
- **Tavern 游戏存档**: gameStore 管理多个游戏存档（localStorage），每个存档包含群组/消息/世界设定/选卡，客户端本地管理
- **Tavern 隐私模式**: privacyStore 管理隐私模式开关，开启后 AI 请求绕过服务器中转向 AI Provider 直连，用户本地缓存 API Key
- **Dockerfile 散落**: 8 个 Dockerfile 分布于各项目（ftg/server/ppshituv2/nginx, game1/server, tavern/server, dashboard, dashboard.admin）
- **Monorepo 非标准**: 无 root package.json workspaces，无 packages/ 共享目录，各项目独立 node_modules
- **需修复 CI**: tavern-server CI 路径过滤器错误；ftg-server CI 缺路径过滤器；deploy.yml SSH 部署注释未启用
