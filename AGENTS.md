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

**Generated:** 2026-05-06
**Branch:** master

## OVERVIEW
个人小程序工坊 — 统一 dashboard 集中管理多个微信小程序（个人项目，不接外包）。
当前子项目：食物主题生成器 (FTG) — AI 图片识别食材 → Canvas 合成主题图片 → 管理后台数据管理。
Monorepo，3 个独立 TypeScript 项目 + 云函数。

## STRUCTURE
```
.miniapps/
├── ftg-miniapp/                   # Taro 4.x 微信小程序 (React 18 + Sass + Zustand)
├── ftg-server/                    # Express 后端 API (Prisma ORM)
├── dashboard/                     # 统一管理后台 (一管多，管理所有小程序项目)
├── cloud-functions/               # 空目录，实际云函数在 MiniApp 内
├── deploy/                        # Docker/Nginx 部署配置
├── docs/                          # 项目文档 (架构/API/数据库/开发)
├── plan/                          # 项目规划文档
│   ├── tasks/                     # 各项目任务计划
│   └── humans/                    # 人工指令记录
└── .sisyphus/                     # Sisyphus Agent 工作目录
```

## 架构说明
- **一管多**: dashboard 管理后台统一管理所有小程序项目，当前仅有 FTG 一个项目
- **当前项目**: 仅 `ftg-miniapp`(小程序) + `ftg-server`(后端) + `dashboard`(管理后台)
- **未来扩展**: 新增小程序项目时，在根目录创建 `项目名-miniapp` + `项目名-server`，dashboard 自动管理
- **个人项目**: 所有小程序为个人项目，不接受外包

## WHERE TO LOOK
| 任务 | 位置 | 说明 |
|------|------|------|
| 小程序页面/组件 | `ftg-miniapp/src/` | Taro + React，含 pages/components/hooks |
| 后端 API 路由 | `ftg-server/src/routes/` | 13 个路由模块 (含 theme-classes/theme-render)RESTful |
| 管理后台界面 | `dashboard/src/` | React + Vite + Ant Design，含 ThemeClasses |
| 数据库 Schema | `ftg-server/prisma/schema.prisma` | Prisma ORM 主 Schema (10表: User/FoodRecord/etc) |
| 部署配置 | `deploy/docker-compose.yml` | Docker 统一编排 (MySQL/Redis/AI/Server/Admin/Nginx) |
| 模板渲染引擎 | `ftg-server/src/services/theme-render.service.ts` | Markup 模板 + CSS Class 渲染 |
| Class 系统 | `ftg-server/src/services/theme-class.service.ts` | CSS 属性白名单 + CRUD |
| AI 识别服务 | `ftg-server/src/services/` | PP-ShiTuV2 食物识别 |
| MiniApp 状态管理 | `ftg-miniapp/src/stores/` | Zustand 认证状态 (authStore) |
| MiniApp HTTP 客户端 | `ftg-miniapp/src/services/httpClient.ts` | 统一 HTTP 封装 (JWT 自动携带) |
| MiniApp 认证服务 | `ftg-miniapp/src/services/authService.ts` | 微信登录 + Token 验证封装 |
| MiniApp 自定义 tabBar | `ftg-miniapp/src/custom-tab-bar/` | 自定义底部栏 (替代原生 tabBar) |
| Dashboard 主题 | `dashboard/src/components/ThemeToggle/` | 暗色模式切换 |
| Dashboard 骨架屏 | `dashboard/src/components/PageSkeleton/` | 统一加载态（4种类型）|
| Dashboard PageHeader | `dashboard/src/components/PageHeader/` | 通用页面头部组件 |
| MiniApp 组件库 | `ftg-miniapp/src/components/` | AppButton/AppCard/SectionHeader/EmptyState/Icon/Skeleton |
| MiniApp 图表 | `ftg-miniapp/src/components/charts/` | LineChart/PieChart/BarChart/CalendarHeatmap |
| CI/CD | `ftg-server/.github/workflows/` | GitHub Actions (仅 Server) |
| 项目文档 | `docs/` | ARCHITECTURE / API / DATABASE / DEVELOPMENT |

## CODE MAP
| 符号 | 类型 | 位置 | 角色 |
|------|------|------|------|
| `App` (MiniApp) | 入口 | `ftg-miniapp/src/app.ts` | 小程序应用入口 |
| `App` (Server) | 入口 | `ftg-server/src/app.ts` | 后端 Express 服务 |
| `main` (Dashboard) | 入口 | `dashboard/src/main.tsx` | 管理后台 SPA 入口 |
| `server` (Dashboard API) | 入口 | `dashboard/server/server.ts` | Admin 独立 API (3001端口) |
| `ProtectedRoute` (Dashboard) | 组件 | `dashboard/src/components/ProtectedRoute/` | 路由守卫（登录+权限双检查） |
| `authStore` (Dashboard) | 状态 | `dashboard/src/stores/authStore.ts` | Zustand 认证状态管理 |
| `admin-auth` (Dashboard API) | 中间件 | `dashboard/server/admin-auth.ts` | JWT 认证 + RBAC 权限中间件 |
| `token` (Dashboard) | 工具 | `dashboard/src/utils/token.ts` | Token 持久化（localStorage/sessionStorage） |
| `orchestrateAIPipeline` | 云函数 | `cloud-functions/orchestrateAIPipeline/` | AI 流水线编排 |
| `themeCompose` | 云函数 | `cloud-functions/themeCompose/` | 主题图片合成 |
| `useAuthStore` (MiniApp) | 状态 | `ftg-miniapp/src/stores/authStore.ts` | Zustand 认证状态 (token/user/初始化) |
| `httpClient` (MiniApp) | 服务 | `ftg-miniapp/src/services/httpClient.ts` | 统一 HTTP 客户端 (JWT) |
| `authService` (MiniApp) | 服务 | `ftg-miniapp/src/services/authService.ts` | 微信登录/自动注册/Token 验证 |
| `CustomTabBar` (MiniApp) | 组件 | `ftg-miniapp/src/custom-tab-bar/` | 自定义底部栏 (事件驱动高亮) |

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
# MiniApp (Taro) — cd ftg-miniapp
npm run dev:weapp        # 开发模式 (watch)
npm run build:weapp      # 生产构建
npm run type-check       # TypeScript 类型检查

# Server (Express) — cd ftg-server
npm run dev              # tsx watch 开发 (端口 env.PORT)
npm run build            # tsc 编译
npm run lint             # ESLint
npm run db:migrate       # Prisma 数据库迁移

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
- **多项目扩展**: 新增小程序项目时，根目录添加 `项目名-miniapp` + `项目名-server`，dashboard 自动管理
- **MiniApp 认证流程**: wx.login() → POST /auth/login → JWT token → 本地持久化 → 自动校验(initialize)
- **MiniApp 自定义 tabBar**: CustomTabBar 组件使用 Taro eventCenter 监听 tabChange 事件驱动高亮，替代原生 tabBar
- **MiniApp HTTP 客户端**: HttpClient 类封装 Taro.request，支持超时检测和网络连接错误中文提示
- **API 代理**: Dashboard `/api` 在开发时代理到 Server `localhost:3000`
- **生产架构**: Nginx(80/443) → Dashboard SPA / API(/api/v1/) / 识别(/recognition/*)
- **识别服务**: PP-ShiTuV2 独立容器，通过 HTTP API 调用
- **Dashboard Auth 初始化**: `authStore` 初始化时 `isAuthenticated` 同步设为 `!!getToken()`，`user` 为 `null`。`restoreSession()` 异步调用 `/admin/me` 获取用户信息。`ProtectedRoute` 订阅 `initialized` 标志，仅在 `restoreSession` 完成后才进行权限判断，避免竞态条件导致 403。