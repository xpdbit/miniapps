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

**Generated:** 2026-05-10
**Commit:** b88252e
**Branch:** master

## OVERVIEW
个人小程序工坊 — 统一 dashboard 集中管理多个微信小程序项目（个人项目，不接外包）。
当前 3 个子项目：FTG（食物主题生成器）、Game1（挂机放置游戏）、AI-Tavern（AI 角色聊天）。
Monorepo，8 个独立 TypeScript 项目 + 云函数，共 973 文件 / 68,609 行代码。

## STRUCTURE
```
.miniapps/
├── apps/
│   ├── ftg-miniapp/               # Taro 4.x 微信小程序 — FTG 食物主题生成器
│   └── game1-miniapp/             # Taro 微信小程序 — Game1 挂机放置游戏（开发中）
├── servers/
│   ├── ftg-server/                # Express 后端 API — FTG (Prisma ORM, 16路由)
│   ├── game1-server/              # Express 后端 API — Game1 (云端存档/PVP/成就)
│   └── tavern-server/             # Express 后端 API — AI-Tavern (角色聊天/SSE)
├── dashboard/                     # React 管理后台 — 统一管理所有项目
├── cloud-functions/               # 云函数 (orchestrateAIPipeline/themeCompose)
├── deploy/                        # Docker Compose + Nginx 部署到 ECS
├── docs/                          # 项目文档 (按项目分类)
│   ├── apps/ftg-miniapp/          # FTG 小程序文档
│   ├── apps/game1-miniapp/        # Game1 小程序重构方案
│   ├── servers/ftg-server/        # FTG 后端文档
│   ├── dashboard/                 # 管理后台文档
│   ├── deploy/                    # 部署文档
│   └── game1-miniapp/             # Game1 方案
├── plan/                          # 项目规划 (tasks/humans/ideas)
├── prisma/                        # 统一 Prisma Schema (14表合并)
├── screenshots/                   # 截图
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
| 小程序页面/组件 | `apps/ftg-miniapp/src/` | Taro + React，含 pages/components/hooks |
| 后端 API 路由 | `servers/ftg-server/src/routes/` | 16 个路由模块 (含 theme-classes/theme-render)RESTful |
| 管理后台界面 | `dashboard/src/` | React + Vite + Ant Design，含 ThemeClasses |
| 数据库 Schema | `prisma/schema.prisma` | 统一 Prisma Schema (14表: User/FoodRecord/Theme/AdminUser等) |
| 部署配置 | `deploy/docker-compose.yml` | Docker 统一编排 (MySQL/Redis/AI/Server/Admin/Nginx) |
| 模板渲染引擎 | `servers/ftg-server/src/services/theme-render.service.ts` | Markup 模板 + CSS Class 渲染 |
| Class 系统 | `servers/ftg-server/src/services/theme-class.service.ts` | CSS 属性白名单 + CRUD |
| AI 识别服务 | `servers/ftg-server/src/services/` | PP-ShiTuV2 食物识别 |
| MiniApp 状态管理 | `apps/ftg-miniapp/src/stores/` | Zustand 认证状态 (authStore) |
| MiniApp HTTP 客户端 | `apps/ftg-miniapp/src/services/httpClient.ts` | 统一 HTTP 封装 (JWT 自动携带) |
| MiniApp 认证服务 | `apps/ftg-miniapp/src/services/authService.ts` | 微信登录 + Token 验证封装 |
| MiniApp 自定义 tabBar | `apps/ftg-miniapp/src/custom-tab-bar/` | 自定义底部栏 (替代原生 tabBar) |
| Dashboard 主题 | `dashboard/src/components/ThemeToggle/` | 暗色模式切换 |
| Dashboard 骨架屏 | `dashboard/src/components/PageSkeleton/` | 统一加载态（4种类型）|
| Dashboard PageHeader | `dashboard/src/components/PageHeader/` | 通用页面头部组件 |
| MiniApp 组件库 | `apps/ftg-miniapp/src/components/` | AppButton/AppCard/SectionHeader/EmptyState/Icon/Skeleton |
| MiniApp 图表 | `apps/ftg-miniapp/src/components/charts/` | LineChart/PieChart/BarChart/CalendarHeatmap |
| CI/CD | `servers/ftg-server/.github/workflows/` | GitHub Actions (lint/type-check/build/docker) |
| CI/CD (Game1) | `servers/game1-server/.github/workflows/` | GitHub Actions (Node 20 + MySQL 服务) |
| Game1 后端 API | `servers/game1-server/src/routes/` | 10 路由模块 (auth/players/save/pvp/achievements/config/social/admin) |
| Tavern 后端 API | `servers/tavern-server/src/routes/` | 10 路由模块 (auth/characters/chat/personas/keys/market/admin/builtin/export) |
| Game1 小程序引擎 | `apps/game1-miniapp/src/engine/` | 纯 TS 游戏逻辑引擎 (travel/combat/team/inventory/skill/card/event) |
| 域名共享配置 | `domain.config.js` | 所有 Taro 项目的 API_BASE 编译时配置 |
| 项目文档 | `docs/` | 按项目分类 (ftg-miniapp/ftg-server/dashboard/deploy/game1-miniapp) |

## CODE MAP
| 符号 | 类型 | 位置 | 角色 |
|------|------|------|------|
| `App` (MiniApp) | 入口 | `apps/ftg-miniapp/src/app.ts` | 小程序应用入口 |
| `App` (Server) | 入口 | `servers/ftg-server/src/app.ts` | 后端 Express 服务 |
| `main` (Dashboard) | 入口 | `dashboard/src/main.tsx` | 管理后台 SPA 入口 |
| `server` (Dashboard API) | 入口 | `dashboard/server/server.ts` | Admin 独立 API (3001端口) |
| `ProtectedRoute` (Dashboard) | 组件 | `dashboard/src/components/ProtectedRoute/` | 路由守卫（登录+权限双检查） |
| `authStore` (Dashboard) | 状态 | `dashboard/src/stores/authStore.ts` | Zustand 认证状态管理 |
| `admin-auth` (Dashboard API) | 中间件 | `dashboard/server/admin-auth.ts` | JWT 认证 + RBAC 权限中间件 |
| `token` (Dashboard) | 工具 | `dashboard/src/utils/token.ts` | Token 持久化（localStorage/sessionStorage） |
| `orchestrateAIPipeline` | 云函数 | `cloud-functions/orchestrateAIPipeline/` | AI 流水线编排 |
| `themeCompose` | 云函数 | `cloud-functions/themeCompose/` | 主题图片合成 |
| `useAuthStore` (MiniApp) | 状态 | `apps/ftg-miniapp/src/stores/authStore.ts` | Zustand 认证状态 (token/user/初始化) |
| `httpClient` (MiniApp) | 服务 | `apps/ftg-miniapp/src/services/httpClient.ts` | 统一 HTTP 客户端 (JWT) |
| `authService` (MiniApp) | 服务 | `apps/ftg-miniapp/src/services/authService.ts` | 微信登录/自动注册/Token 验证 |
| `CustomTabBar` (MiniApp) | 组件 | `apps/ftg-miniapp/src/custom-tab-bar/` | 自定义底部栏 (事件驱动高亮) |

## CONVENTIONS
- **TypeScript strict** 全项目强制 (`no-explicit-any: error`)
- **2 空格缩进**，LF 换行，UTF-8
- **路径别名** `@/*` → 各项目 `src/`
- **Dashboard 额外规则**: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`
- **Prisma** 统一 ORM (Server v5.22, Dashboard v6.19)
- **无 monorepo workspace** — 各项目独立 `npm install`

## ANTI-PATTERNS (本项目)
- ❌ **零测试覆盖** — 全项目无测试框架/文件/脚本
- ❌ `textGenerate` 云函数为占位实现（未接入混元 AI）
- ❌ `getUserStats` 云函数返回硬编码零值
- ❌ 存在无必要的 `eslint-disable` 注释
- ❌ `cloud-functions/` 根目录为空，云函数实际在 MiniApp 子目录下
- ❌ Dashboard 内联样式过多 — 已迁移 Login/Dashboard/Layout 为 CSS Modules，其余页面待迁移
- ❌ MiniApp 跨任务并行执行可能产生导入冲突 — 注意 chart types/utils 需从 `@/components/charts` 导入

## COMMANDS
```bash
# MiniApp (Taro) — cd apps/ftg-miniapp
npm run dev:weapp        # 开发模式 (watch)
npm run build:weapp      # 生产构建
npm run type-check       # TypeScript 类型检查

# Server (Express) — cd servers/ftg-server
npm run dev              # tsx watch 开发 (端口 env.PORT)
npm run build            # tsc 编译
npm run lint             # ESLint
npm run db:migrate       # Prisma 数据库迁移

# Game1 Server (Express) — cd servers/game1-server
npm run dev              # tsx watch 开发
npm run build            # tsc 编译
npm run type-check       # TypeScript 类型检查
npm run lint             # ESLint
npm run db:migrate       # Prisma 数据库迁移

# Tavern Server (Express) — cd servers/tavern-server
npm run dev              # tsx watch 开发
npm run build            # tsc 编译
npm run type-check       # TypeScript 类型检查
npm run start            # 生产启动

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
- **多项目扩展**: 新增小程序项目时，在 `apps/` 下创建 `项目名-miniapp`，在 `servers/` 下创建 `项目名-server`，dashboard 自动管理
- **MiniApp 认证流程**: wx.login() → POST /auth/login → JWT token → 本地持久化 → 自动校验(initialize)
- **MiniApp 自定义 tabBar**: CustomTabBar 组件使用 Taro eventCenter 监听 tabChange 事件驱动高亮，替代原生 tabBar
- **MiniApp HTTP 客户端**: HttpClient 类封装 Taro.request，支持超时检测和网络连接错误中文提示
- **API 代理**: Dashboard `/api` 在开发时代理到 Server `localhost:3000`
- **生产架构**: Nginx(80/443) → Dashboard SPA / API(/api/v1/) / 识别(/recognition/*)
- **识别服务**: PP-ShiTuV2 独立容器，通过 HTTP API 调用
- **Dashboard Auth 初始化**: `authStore` 初始化时 `isAuthenticated` 同步设为 `!!getToken()`，`user` 为 `null`。`restoreSession()` 异步调用 `/admin/me` 获取用户信息。`ProtectedRoute` 订阅 `initialized` 标志，仅在 `restoreSession` 完成后才进行权限判断，避免竞态条件导致 403。