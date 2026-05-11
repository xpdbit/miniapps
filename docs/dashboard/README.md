# dashboard — 统一管理后台

集中管理所有微信小程序项目的管理后台（FTG / Game1 / AI-Tavern）。

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端 | React 19 + Vite 6 + Ant Design 5 + TypeScript 5.x |
| 状态管理 | Zustand (auth/theme/projectStore) |
| Admin API | Express 5 (独立进程，端口 3001) |
| ORM | Prisma 6.19 (MySQL 8.0) |
| 样式 | CSS Modules |
| 构建 | Vite (ESBuild 压缩) |

## 核心功能

- 项目管理 (多小程序统一切换)
- 用户管理 (跨项目)
- FTG: 食物记录审查 / 主题 Class 系统 / 主题模板编辑 / 成就管理 / API 密钥
- Game1: 玩家管理 / 游戏配置 / 成就审核 / PVP 数据
- AI-Tavern: 角色卡审核 / API 密钥审计
- 数据统计看板 (按项目过滤)
- 审计日志 / 系统监控

## 架构

双进程架构：
- **Vite 前端** (端口 5173): 管理界面 SPA
- **Admin API** (端口 3001 开发 / 3003 生产): 后台数据接口 (Express + Prisma)

> Admin API 在生产 Docker 部署中运行在 3001 端口（内部），由 Nginx 代理到 `/api/v1/admin/*`。开发环境 `npx tsx server/server.ts` 默认使用 3001 端口。

开发时需同时运行两个进程：
```bash
# 终端 1: Vite 前端
npm run dev

# 终端 2: Admin API
npx tsx server/server.ts
```

## 多项目管理

侧边栏根据 `projectStore.currentProject` 动态过滤菜单：

| 项目 | Dashboard 页面 | 后端数据源 | 状态 |
|------|---------------|-----------|------|
| **FTG** | Users, FoodRecords, Themes, ThemeClasses, Stats, ApiKeys | Admin API 直查 shared DB | ✅ 线上 |
| **Game1** | Game1Players, Game1Config, Game1Achievements, Game1Pvp | Admin API → game1-proxy → game1-server | 🚧 开发 |
| **AI-Tavern** | Tavern (characters, keys) | Admin API → tavern-proxy → tavern-server | 🚧 开发 |

## 页面目录

| 页面 | 路由 | 说明 |
|------|------|------|
| Login | `/login` | 管理员登录 |
| Dashboard | `/dashboard` | 多项目仪表盘 + 快速入口 |
| Users | `/users` | 跨项目用户管理 |
| Food Records | `/food-records` | FTG 食物记录审查 |
| Themes | `/themes` | FTG 主题模板管理（含模板编辑） |
| Theme Classes | `/theme-classes` | CSS Class CRUD + 白名单预览 |
| Stats | `/stats` | FTG 数据可视化 |
| Api Keys | `/api-keys` | API 密钥管理 |
| Game1 Players | `/game1/players` | Game1 玩家管理 |
| Game1 Config | `/game1/config` | Game1 游戏配置 |
| Game1 Achievements | `/game1/achievements` | Game1 成就管理 |
| Game1 Pvp | `/game1/pvp` | Game1 PVP 数据 |
| Tavern | `/tavern` | AI-Tavern 角色审核 + API 密钥审计 |
| Monitoring | `/monitoring` | 系统监控 |
| Audit Logs | `/audit-logs` | 操作审计日志 |
| Projects | `/projects` | 项目管理 |
| Settings | `/settings` | 系统配置 |

## 关键组件

| 组件 | 路径 | 用途 |
|------|------|------|
| `ProtectedRoute` | `src/components/ProtectedRoute/` | 登录 + RBAC 双检查路由守卫 |
| `PageHeader` | `src/components/PageHeader/` | 通用页面头部 |
| `PageSkeleton` | `src/components/PageSkeleton/` | 4 种加载骨架屏 |
| `ThemeToggle` | `src/components/ThemeToggle/` | 暗色模式切换 |
| `ProjectSwitcher` | `src/components/ProjectSwitcher/` | 项目切换器 |
| `authStore` | `src/stores/authStore.ts` | Zustand 认证状态 |
| `themeStore` | `src/stores/themeStore.ts` | 暗色/亮色主题 |
| `projectStore` | `src/stores/projectStore.ts` | 当前选中项目 |

## API 架构

```
前端 (Vite 5173)
  │
  ├── /api/* (dev proxy) ──→ localhost:3000 (FTG Server)
  │
  └── Admin API (Express 3001)
        ├── /admin/*            → 直查 shared DB (Prisma)
        ├── /api/game1/*        → game1-proxy (GAME1_ADMIN_TOKEN)
        └── /api/tavern/*       → tavern-proxy (TAVERN_ADMIN_TOKEN)

生产环境 Nginx:
  /api/v1/admin/* ──→ ftg-admin:3001
  /api/v1/game1/*   ──→ game1-server:3001
  /api/tavern/*     ──→ tavern-server:3002
```

## 构建与部署

| 命令 | 说明 |
|------|------|
| `npm run dev` | Vite 开发服务器 (5173) |
| `npm run build` | tsc + vite build 生产构建 |
| `npm run type-check` | TypeScript 类型检查 |
| `npm run lint` | ESLint 代码检查 |
| `npm run db:generate` | Prisma Client 生成 |

Docker 构建拆分:
- `Dockerfile`: Vite 构建 → Nginx 静态文件 (SPA)
- `Dockerfile.admin`: tsc 编译 → Node.js 运行 (Admin API)
