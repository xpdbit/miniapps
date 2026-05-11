# Dashboard — 统一管理后台

## OVERVIEW
React 19 统一管理后台 (Vite + Ant Design)，集中管理所有个人小程序项目（一管多）。
双进程架构：Vite 前端(5173) + Express Admin API(3001)。

**当前管理的项目**（通过 ProjectSwitcher 切换）：
- **FTG** (Food Theme Generator) — `ftg-miniapp` + `ftg-server` (食物识别 + 主题生成)
- **Game1** (挂机放置游戏) — `game1-miniapp` + `game1-server` (玩家管理/配置/PVP/成就)
- **AI-Tavern** (AI 角色聊天) — `tavern-server` (角色审核/市场管理)

**核心设计原则**：侧边栏根据选中项目动态过滤菜单，仪表盘显示对应项目统计，API 通过 Admin API 代理分发到各项目后端。

## STRUCTURE
```
dashboard/
├── src/
│   ├── components/          # UI 组件（Layout/Sidebar/PageHeader/PageSkeleton/ThemeToggle/ProjectSwitcher/ProtectedRoute）
│   │   └── Layout/
│   │       ├── index.tsx    # 主布局（Header + 项目切换器 + Outlet）
│   │       └── Sidebar.tsx  # 项目感知侧边栏（按 currentProject 动态过滤菜单）
│   ├── pages/               # 页面组件（19个页面）
│   │   ├── Dashboard/       # 多项目感知仪表盘（跨项目/FTG/Game1/Tavern 三种视图）
│   │   ├── Login/           # 登录页
│   │   ├── Users/           # 用户管理（跨项目）
│   │   ├── FTG 专页: FoodRecords/ Themes/ ThemeClasses/ Achievements/ ApiKeys
│   │   ├── Game1 专页: Game1Players/ Game1Config/ Game1Achievements/ Game1Pvp
│   │   ├── Tavern 专页: Tavern/
│   │   └── 跨项目: Monitoring/ Admin/ AuditLogs/ Projects/ Error/ Forbidden/ NotFound
│   ├── services/            # API 调用层（按项目分组）
│   │   ├── game1/           # Game1 专属 API（game1AdminApi / game1ConfigApi）
│   │   ├── tavern/          # Tavern 专属 API（tavernAdminApi）
│   │   └── ...              # ftg-api.ts / dashboardApi.ts / adminApi.ts 等（跨项目+FTG）
│   ├── stores/              # Zustand 状态管理（authStore/themeStore/projectStore）
│   ├── constants/           # 常量（routes 含 MENU_ITEMS 项目作用域映射 / permissions 含 Game1 权限）
│   ├── hooks/               # 自定义 Hooks（useMobile/useResponsiveWidth）
│   ├── utils/               # 工具函数（token 持久化）
│   ├── styles/              # CSS Modules 样式
│   └── main.tsx             # SPA 入口
├── server/
│   ├── server.ts            # Admin API 入口 (3001端口)
│   ├── admin-auth.ts        # JWT认证 + RBAC + 审计日志 + 项目管理 CRUD
│   ├── dashboardRoutes.ts   # FTG 仪表盘统计（共享 DB 直查）
│   ├── admin-food-records.ts / admin-achievements.ts / admin-api-keys.ts  # FTG 管理
│   ├── agent-routes.ts      # Agent 调试通道
│   └── routes/
│       ├── game1-proxy.ts   # Game1 代理路由（GAME1_ADMIN_TOKEN 认证）
│       └── tavern-proxy.ts  # Tavern 代理路由（TAVERN_ADMIN_TOKEN 认证）
├── prisma/                  # ORM Schema (v6.19)
├── nginx/                   # Nginx 配置
├── vite.config.ts           # Vite 构建配置
└── tsconfig.json            # TypeScript 配置
```

## WHERE TO LOOK
| 任务 | 位置 | 说明 |
|------|------|------|
| Admin API 路由 | `server/server.ts` + 各路由文件 | 管理接口 + Game1/Tavern 代理，端口 3001 |
| 前端页面 | `src/pages/` | 19 个页面，含 4 个 Game1 新页面 |
| 项目感知导航 | `src/components/Layout/Sidebar.tsx` | 根据 projectStore 动态过滤菜单 |
| 多项目仪表盘 | `src/pages/Dashboard/index.tsx` | ProjectOverview / FtgDashboard / Game1Dashboard / TavernDashboard |
| API 调用 | `src/services/`（按项目分组）| 跨项目 / FTG / game1/ / tavern/ |
| 路由常量 | `src/constants/routes.ts` + `MENU_ITEMS` | 含 scope 字段定义项目归属 |
| 权限定义 | `src/constants/permissions.ts` | 含 GAME1_PLAYERS / CONFIG / ACHIEVEMENTS / PVP 权限 |
| 状态管理 | `src/stores/` | authStore / themeStore / projectStore（当前项目） |
| Game1 代理 | `server/routes/game1-proxy.ts` | 配置 `GAME1_ADMIN_TOKEN` 匹配 game1-server ADMIN_TOKEN |
| Tavern 代理 | `server/routes/tavern-proxy.ts` | 配置 `TAVERN_ADMIN_TOKEN` 匹配 tavern-server admin JWT |
| Prisma Schema | `prisma/schema.prisma` | AdminUser / Project / AuditLog + FTG 共享表 |

## CONVENTIONS (与项目根不同的规则)
- `noUnusedLocals: true` — 未使用变量报错
- `noUnusedParameters: true` — 未使用参数报错
- `verbatimModuleSyntax: true` — 强制显式 type import
- `moduleResolution: bundler` — Vite 打包模式
- **双进程运行**: 开发需同时启动 `npm run dev` (Vite) + `tsx server/server.ts` (Admin API)
- **API 代理**: Vite 开发时将 `/api` 代理到 Server `http://localhost:3000`

## ANTI-PATTERNS
- ❌ 禁止 `any` 类型 (`no-explicit-any: error`)
- ❌ 禁止未使用的变量/参数 (编译报错)
- ❌ 不得在 `src/` 中直接调用 Prisma Client — 通过 Admin API
- ❌ 不得忽略代理认证配置 — Game1/Tavern 代理需要 `GAME1_ADMIN_TOKEN` / `TAVERN_ADMIN_TOKEN`

## COMMANDS
```bash
npm run dev           # Vite 开发服务器 (5173端口)
npm run build         # tsc + vite build 生产构建
npm run type-check    # TypeScript 类型检查
npm run db:generate   # Prisma Client 生成
npm run db:migrate    # Prisma 数据库迁移
```

## NOTES
- **项目感知导航**: 选中项目后侧边栏只显示该项目相关菜单 + 跨项目管理项。未选中时只显示跨项目菜单。
- **多项目仪表盘**: Dashboard 页面根据 projectStore.currentProject 显示对应统计；无选中时显示快速入口卡片。
- **认证差异**: Dashboard 使用自身 JWT 体系（AdminUser 表），Game1/Tavern 需通过 proxy 的 ADMIN_TOKEN 中转认证。
- **Dashboard 双进程**: Vite 前端(5173) + Express Admin API(3001) 独立运行
- **Dashboard 暗色模式**: 通过 `themeStore` (Zustand) 控制，localStorage 持久化，ConfigProvider darkAlgorithm
- **Dashboard UI 组件体系**: PageHeader (通用头部) + PageSkeleton (4种骨架屏) + 响应式宽度常量
- Prisma 版本 v6.19，与 Server(v5.22) 不同版本但共享同一数据库
- Admin API (`server/server.ts`) 需单独启动，非 Vite 管理
- Docker 部署时前端打包为 nginx 静态文件，Admin API 合并到 Server 容器
