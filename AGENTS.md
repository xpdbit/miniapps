# -*- coding: utf-8 -*-
"""
OpenCode 全局指令 - 中文模式
所有交互默认使用简体中文
"""

# 语言设置
你必须使用简体中文进行思考和回答。
所有解释、代码注释、变量命名建议和输出都应使用中文。

# 思考风格
- 分析问题时使用中文逐步思考
- 回复用户时语言简洁明了，避免中英文混杂
- 代码注释使用中文

# 交流风格
- 保持简洁直接的风格
- 如需补充细节，再进行说明
- 遇到问题主动确认

---

# PROJECT KNOWLEDGE BASE

**Generated:** 2026-05-14
**Commit:** (current HEAD)
**Branch:** master

## OVERVIEW
个人小程序工坊 — 统一 dashboard 集中管理多个微信小程序项目（个人项目，不接外包）。
当前 3 个子项目：FTG（食物主题生成器）、Game1（挂机放置游戏）、AI-Tavern（AI 角色聊天）。
Monorepo，7 个独立 TypeScript 项目（3 H5-Frontend + 3 Server + 1 Dashboard）+ 1 个 Python 桌面工具（SuperTask），共 ~780 源文件（不含 node_modules）。

## STRUCTURE
```
.miniapps/
├── apps/
│   ├── ftg/                       # FTG 项目
│   │   ├── h5-core/              # 跨平台共享代码（types/utils/constants）
│   │   ├── h5-weapp/             # Taro 4.x 微信小程序 — FTG 食物主题生成器
│   │   ├── h5-webview/           # H5 独立 Web 版本（预留）
│   │   └── server/               # Express 后端 API (Prisma ORM, 16路由)
│   ├── game1/                     # Game1 项目
│   │   ├── h5-core/              # 跨平台共享代码
│   │   ├── h5-weapp/             # Taro 微信小程序 — Game1 挂机放置游戏（开发中）
│   │   ├── h5-webview/           # H5 独立 Web 版本（预留）
│   │   └── server/               # Express 后端 API (云端存档/PVP/成就)
│   └── tavern/                    # AI-Tavern 项目
│       ├── h5-core/              # 跨平台共享代码
│       ├── h5-weapp/             # Taro 4.x 微信小程序 — AI-Tavern 角色聊天（开发中）
│       ├── h5-webview/           # H5 独立 Web 版本（预留）
│       └── server/               # Express 后端 API (角色聊天/SSE)
├── dashboard/                     # React 管理后台 — 统一管理所有项目
├── cloud-functions/               # (空目录，云函数实际位于 apps/) 
├── deploy/                        # Docker Compose + Nginx 部署到 ECS
├── docs/                          # 项目文档 (按项目分类)
│   ├── apps/ftg-miniapp/          # FTG 小程序文档
│   ├── apps/game1-miniapp/        # Game1 小程序重构方案
│   ├── servers/ftg-server/        # FTG 后端文档
│   ├── servers/game1-server/      # Game1 后端文档
│   ├── servers/tavern-server/     # Tavern 后端文档
│   ├── dashboard/                 # 管理后台文档
│   ├── deploy/                    # 部署文档
│   └── superpowers/               # Agent 工作文档
├── plan/                          # 项目规划 (tasks/humans/ideas)
├── prisma/                        # 统一 Prisma Schema (14表合并)
├── tools/                         # 开发工具 (Python 桌面应用等)
│   └── supertask/                 # SuperTask AI 自主开发监督系统 (PyQt6)
├── state/                         # 超级任务状态跟踪
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
| 小程序页面/组件 | `apps/ftg/h5-weapp/src/` | Taro + React，含 pages/components/hooks |
| 后端 API 路由 | `apps/ftg/server/src/routes/` | 16 个路由模块 (含 theme-classes/theme-render)RESTful |
| 管理后台界面 | `dashboard/src/` | React + Vite + Ant Design，含 ThemeClasses |
| 数据库 Schema | `prisma/schema.prisma` | 统一 Prisma Schema (14表: User/FoodRecord/Theme/AdminUser等) |
| 部署配置 | `deploy/docker-compose.yml` | Docker 统一编排 (MySQL/Redis/AI/Server/Admin/Nginx) |
| 模板渲染引擎 | `apps/ftg/server/src/services/theme-render.service.ts` | Markup 模板 + CSS Class 渲染 |
| Class 系统 | `apps/ftg/server/src/services/theme-class.service.ts` | CSS 属性白名单 + CRUD |
| AI 识别服务 | `apps/ftg/server/src/services/` | PP-ShiTuV2 食物识别 |
| MiniApp 状态管理 | `apps/ftg/h5-weapp/src/stores/` | Zustand 认证状态 (authStore) |
| MiniApp HTTP 客户端 | `apps/ftg/h5-weapp/src/services/httpClient.ts` | 统一 HTTP 封装 (JWT 自动携带) |
| MiniApp 认证服务 | `apps/ftg/h5-weapp/src/services/authService.ts` | 微信登录 + Token 验证封装 |
| MiniApp 自定义 tabBar | `apps/ftg/h5-weapp/src/custom-tab-bar/` | 自定义底部栏 (替代原生 tabBar) |
| Dashboard 主题 | `dashboard/src/components/ThemeToggle/` | 暗色模式切换 |
| Dashboard 骨架屏 | `dashboard/src/components/PageSkeleton/` | 统一加载态（4种类型）|
| Dashboard PageHeader | `dashboard/src/components/PageHeader/` | 通用页面头部组件 |
| MiniApp 组件库 | `apps/ftg/h5-weapp/src/components/` | AppButton/AppCard/SectionHeader/EmptyState/Icon/Skeleton |
| MiniApp 图表 | `apps/ftg/h5-weapp/src/components/charts/` | LineChart/PieChart/BarChart/CalendarHeatmap |
| CI/CD | `apps/ftg/server/.github/workflows/` | GitHub Actions (lint/type-check/build/docker) |
| CI/CD (Game1) | `apps/game1/server/.github/workflows/` | GitHub Actions (Node 20 + MySQL 服务) |
| Game1 后端 API | `apps/game1/server/src/routes/` | 10 路由模块 (auth/players/save/pvp/achievements/config/social/admin) |
| Tavern 后端 API | `apps/tavern/server/src/routes/` | 10 路由模块 (auth/characters/chat/personas/keys/market/admin/builtin/export) |
| Game1 小程序引擎 | `apps/game1/h5-weapp/src/engine/` | 纯 TS 游戏逻辑引擎 (18 子模块：travel/combat/team/inventory/skill/card/event/achievement/prestige/idle/pet/map 等) |
| Game1 游戏数据配置 | `apps/game1/h5-weapp/src/config/` | 13 个 JSON 配置文件驱动所有游戏数据 |
| Tavern 小程序 | `apps/tavern/h5-weapp/AGENTS.md` | Taro 4.x 角色聊天小程序 (AI-Tavern) |
| Tavern 小程序源码 | `apps/tavern/h5-weapp/src/` | 8 页面 + 4 组件 + services/stores/hooks |
| Tavern SSE Hook | `apps/tavern/h5-weapp/src/hooks/useSSE.ts` | SSE 流式聊天 EventSource 封装（断线重连 + 消息追加） |
| Dashboard 骨架屏 | `dashboard/src/components/PageSkeleton/` | ⚠️ 纯内联样式，待迁移为 CSS Modules |
| Dashboard 主题切换 | `dashboard/src/components/ThemeToggle/` | ⚠️ 纯内联样式 |
| 域名共享配置 | `domain.config.js` | 所有 Taro 项目的 API_BASE 编译时配置 |
| 项目文档 | `docs/` | 按项目分类 (ftg-miniapp/ftg-server/game1-server/tavern-server/dashboard/deploy) |
| Dashboard Game1 服务 | `dashboard/src/services/game1/` | Game1 运营/配置/成就/PVP API |
| Dashboard Tavern 服务 | `dashboard/src/services/tavern/` | Tavern 角色/审核/统计 API |
| Dashboard FTG 服务 | `dashboard/src/services/ftg/` | FTG 用户/主题/Class/成就 API |
| SuperTask 桌面工具 | `tools/supertask/` | Python PyQt6 GUI，AI 开发监督系统 |

## CODE MAP
| 符号 | 类型 | 位置 | 角色 |
|------|------|------|------|
| `App` (MiniApp) | 入口 | `apps/ftg/h5-weapp/src/app.ts` | 小程序应用入口 |
| `App` (Server) | 入口 | `apps/ftg/server/src/app.ts` | FTG 后端 Express 服务 |
| `App` (Game1 Server) | 入口 | `apps/game1/server/src/app.ts` | Game1 后端 Express 服务 |
| `App` (Tavern Server) | 入口 | `apps/tavern/server/src/app.ts` | Tavern 后端 Express 应用定义 |
| `index` (Tavern Server) | 入口 | `apps/tavern/server/src/index.ts` | Tavern 服务器启动监听 |
| `App` (Game1 MiniApp) | 入口 | `apps/game1/h5-weapp/src/app.tsx` | Game1 小程序入口 |
| `main` (Dashboard) | 入口 | `dashboard/src/main.tsx` | 管理后台 SPA 入口 |
| `server` (Dashboard API) | 入口 | `dashboard/server/server.ts` | Admin 独立 API (3001端口) |
| `ProtectedRoute` (Dashboard) | 组件 | `dashboard/src/components/ProtectedRoute/` | 路由守卫（登录+权限双检查） |
| `authStore` (Dashboard) | 状态 | `dashboard/src/stores/authStore.ts` | Zustand 认证状态管理 |
| `admin-auth` (Dashboard API) | 中间件 | `dashboard/server/admin-auth.ts` | JWT 认证 + RBAC 权限中间件 |
| `token` (Dashboard) | 工具 | `dashboard/src/utils/token.ts` | Token 持久化（localStorage/sessionStorage） |
| `useAuthStore` (FTG) | 状态 | `apps/ftg/h5-weapp/src/stores/authStore.ts` | Zustand 认证状态 (token/user/初始化) |
| `httpClient` (FTG) | 服务 | `apps/ftg/h5-weapp/src/services/httpClient.ts` | 统一 HTTP 客户端 (JWT) |
| `authService` (FTG) | 服务 | `apps/ftg/h5-weapp/src/services/authService.ts` | 微信登录/自动注册/Token 验证 |
| `CustomTabBar` (FTG) | 组件 | `apps/ftg/h5-weapp/src/custom-tab-bar/` | 自定义底部栏 (事件驱动高亮) |
| `App` (Tavern MiniApp) | 入口 | `apps/tavern/h5-weapp/src/app.ts` | Tavern 小程序入口 |
| `useSSE` (Tavern) | Hook | `apps/tavern/h5-weapp/src/hooks/useSSE.ts` | SSE 流式聊天 EventSource 封装 |
| `GameEngine` (Game1) | 引擎 | `apps/game1/h5-weapp/src/engine/index.ts` | 纯 TS 游戏逻辑引擎总入口 |

## CONVENTIONS
- **TypeScript strict** 全项目强制 (`no-explicit-any: error`)，但各项目严格度不同
  - Dashboard 最严格：`noUnusedLocals/Parameters: true`, `verbatimModuleSyntax: true`
  - MiniApp 通用：额外启用 `noUncheckedIndexedAccess: true`（Server 未启用）
  - tavern-server 为 `no-explicit-any: off`
- **2 空格缩进**，LF 换行，UTF-8
- **路径别名** `@/*` → 各项目 `src/`，MiniApp 另有 `@utils/@components/@services` 等别名
- **Prettier**: ftg-miniapp/ftg-server/game1-server 统一 `printWidth:100`, `singleQuote:true`, `trailingComma:all`；tavern-server/dashboard 无独立配置
- **ESLint**: ftg-miniapp 含 React Hooks 规则 (`rules-of-hooks: error`)，Server 通用 `no-non-null-assertion: error`
- **Zod 校验**: game1-server 和 tavern-server 在路由层使用 Zod request validation
- **Prisma**: 统一 ORM，但版本分化 — ftg-server/dashboard v6.19, game1-server v5.22, tavern-server v5.10
- **无 monorepo workspace** — 各项目独立 `npm install`

## ANTI-PATTERNS (本项目)
- ❌ **零测试覆盖** — 全项目无测试框架/文件/脚本（game1-miniapp 有 vitest.config 但无测试文件）
- ❌ `textGenerate` 云函数为占位实现（未接入混元 AI）
- ❌ `getUserStats` 云函数返回硬编码零值
- ❌ 存在无必要的 `eslint-disable` 注释
- ❌ `cloud-functions/` 根目录为空，云函数实际在 MiniApp 子目录下
- ❌ Dashboard 内联样式过多 — 已迁移 Login/Dashboard/Layout 为 CSS Modules，其余页面待迁移
- ❌ MiniApp 跨任务并行执行可能产生导入冲突 — 注意 chart types/utils 需从 `@/components/charts` 导入
- ❌ **空 catch 块** — apps/ftg/h5-weapp/src/app.ts 有 4 个空 catch 块（line 55/94/117/131）
- ❌ **Mock 降级代码** — 多处运行时降级（recognition.service mockRecognize, textgen.service generateFallback, authStore mockAuth），生产环境需清理
- ❌ **类型断言** — apps/game1/h5-weapp/src/app.tsx 多处 `as` 断言，dashboard ThemeClasses `as Record<string, unknown>`
- ❌ **占位注释** — apps/tavern/server/src/routes/chat.ts line 149 `// Clean up if needed` 无实际逻辑
- ❌ **错误日志缺失** — apps/game1/server/src/routes/players.ts catch 块仅 `sendError` 无日志
- ❌ **硬编码密钥** — `.sisyphus/aliyun-mysql-clear.js` 含明文阿里云 AK ID/SECRET，需迁移到环境变量
- ❌ **缺失 ESLint 配置** — tavern-server 和 dashboard 无 ESLint 配置（其他项目均有）
- ❌ **console.log 残留** — game1/h5-weapp 多个文件（app.tsx、AchievementEngine、SaveManager、PendingEventEngine）使用 console.log 而非日志框架
- ❌ **result/index.tsx 假保存** — apps/ftg/h5-weapp/src/pages/result/index.tsx line 108 TODO 未实现，Toast "保存成功" 时无实际 API 调用
- ❌ **`as any` 散布** — 全仓库约 10 处 `as any` 类型断言（gallery/DropEngine/chat/user.service/export.service 等）
- ❌ **Prisma 版本分化** — ftg-server/dashboard v6.19、game1-server v5.22、tavern-server v5.10
- ❌ **tavern-server 无路径别名** — apps/tavern/server 未配置 `@/*` 路径别名，使用相对路径 import
- ❌ **tavern-server 无超时配置** — apps/tavern/server 未设置 keepAliveTimeout/headersTimeout/timeout

## COMMANDS
```bash
# MiniApp (Taro) — cd apps/ftg/h5-weapp
npm run dev:weapp        # 开发模式 (watch)
npm run build:weapp      # 生产构建
npm run type-check       # TypeScript 类型检查
npm run dev:h5           # H5 开发模式 (watch)
npm run build:h5         # H5 生产构建

# Game1 MiniApp (Taro) — cd apps/game1/h5-weapp
npm run dev:weapp        # 开发模式 (watch)
npm run build:weapp      # 生产构建
npm run type-check       # TypeScript 类型检查
npm run dev:h5           # H5 开发模式 (watch)
npm run build:h5         # H5 生产构建

# Tavern MiniApp (Taro) — cd apps/tavern/h5-weapp
npm run dev:weapp        # 开发模式 (watch)
npm run build:weapp      # 生产构建
npm run type-check       # TypeScript 类型检查
npm run lint             # ESLint 代码检查
npm run format           # Prettier 格式化
npm run generate-icons   # 生成 tabBar 图标
npm run dev:h5           # H5 开发模式 (watch)
npm run build:h5         # H5 生产构建

# Server (Express) — cd apps/ftg/server
npm run dev              # tsx watch 开发 (端口 env.PORT)
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
npm run dev              # Vite 开发 (5173端口)
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
- **多项目扩展**: 新增小程序项目时，在 `apps/` 下创建 `项目名/h5-weapp` + `项目名/server`，dashboard 自动管理
- **MiniApp 认证流程**: wx.login() → POST /auth/login → JWT token → 本地持久化 → 自动校验(initialize)
- **MiniApp 自定义 tabBar**: CustomTabBar 组件使用 Taro eventCenter 监听 tabChange 事件驱动高亮，替代原生 tabBar
- **MiniApp HTTP 客户端**: HttpClient 类封装 Taro.request，支持超时检测和网络连接错误中文提示
- **MiniApp 降级模式**: 开发时可通过 `TARO_APP_MOCK_AUTH=true` 启用 mock 登录绕过微信授权
- **API 代理**: Dashboard `/api` 在开发时代理到 Server `localhost:3000`
- **生产架构**: Nginx(80/443) → Dashboard SPA / FTG API(/api/ftl/) / Game1 API(/api/v1/game1/) / Tavern API(/api/tavern/) / Admin API(/api/v1/admin/) / 识别(/recognition/*)
- **识别服务**: PP-ShiTuV2 独立容器，通过 HTTP API 调用，开发模式可用 `RECOGNITION_MOCK_MODE=true` 降级
- **Dashboard Auth 初始化**: `authStore` 初始化时 `isAuthenticated` 同步设为 `!!getToken()`，`user` 为 `null`。`restoreSession()` 异步调用 `/admin/me` 获取用户信息。`ProtectedRoute` 订阅 `initialized` 标志，仅在 `restoreSession` 完成后才进行权限判断，避免竞态条件导致 403。
- **Game1 CI 触发条件**: `.github/workflows/ci.yml` 使用 `paths` 过滤，仅 `apps/game1/server/**` 变化时触发，含 MySQL 8.0 服务容器
- **FTG Server 部署流水线**: `deploy.yml` 的 SSH 部署步骤被注释，需手动启用
- **Dashboard 和 MiniApp 无独立 CI** — 只有 ftg-server 和 game1-server 有 GitHub Actions 配置