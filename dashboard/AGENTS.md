# Dashboard — 统一管理后台

## OVERVIEW
React 19 统一管理后台 (Vite + Ant Design)，集中管理所有个人小程序项目（一管多）。
双进程架构：Vite 前端(5173) + Express Admin API(3001)。

当前管理项目：**FTG (Food Theme Generator)** — `ftg-miniapp` + `ftg-server`。
后续新增小程序项目时，dashboard 提供统一的项目管理、用户管理、数据看板功能。

## STRUCTURE
```
dashboard/
├── src/
│   ├── components/      # UI 组件（PageHeader/PageSkeleton/ThemeToggle/ProjectSwitcher/ProtectedRoute/Layout/Sidebar）
│   ├── pages/           # 页面组件（15个页面，含 ThemeClasses 管理页面）
│   ├── hooks/           # 自定义 Hooks（useMobile/useResponsiveWidth）
│   ├── services/        # API 调用层
│   ├── stores/          # Zustand 状态管理（authStore/themeStore/projectStore）
│   ├── constants/       # 常量（routes/permissions/layout）
│   ├── utils/           # 工具函数
│   ├── styles/          # CSS Modules 样式（pages/等子目录）
│   └── main.tsx         # SPA 入口
├── server/
│   ├── server.ts        # Admin API 入口 (3001端口)
│   └── dashboardRoutes.ts # 管理路由
├── prisma/              # ORM Schema (v6.19)
├── nginx/               # Nginx 配置
├── vite.config.ts       # Vite 构建配置
└── tsconfig.json        # TypeScript 配置
```

## WHERE TO LOOK
| 任务 | 位置 | 说明 |
|------|------|------|
| Admin API 路由 | `server/server.ts` + `server/dashboardRoutes.ts` | 管理接口，端口 3001 |
| 前端页面 | `src/pages/` | 15 个页面 (含 ThemeClasses 管理页面) |
| 共享组件 | `src/components/` | 可复用 UI 组件 |
| API 调用 | `src/services/` | 对 Server/Admin API 的请求封装 |
| 自定义 Hook | `src/hooks/` | 状态逻辑复用（useMobile/useResponsiveWidth）|
| 状态管理 | `src/stores/` | Zustand stores（authStore/themeStore/projectStore）|
| 常量配置 | `src/constants/` | 路由/权限/布局响应式宽度常量 |
| Prisma Schema | `prisma/schema.prisma` | 管理后台专用数据模型 |

## CONVENTIONS (与项目根不同的规则)
- `noUnusedLocals: true` — 未使用变量报错
- `noUnusedParameters: true` — 未使用参数报错
- `verbatimModuleSyntax: true` — 强制显式 type import
- `moduleResolution: bundler` — Vite 打包模式
- **双进程运行**: 开发需同时启动 `npm run dev` (Vite) + 独立运行 `server/server.ts`
- **API 代理**: Vite 开发时将 `/api` 代理到 Server `http://localhost:3000`

## ANTI-PATTERNS
- ❌ 禁止 `any` 类型 (`no-explicit-any: error`)
- ❌ 禁止未使用的变量/参数 (编译报错)
- ❌ 不得在 `src/` 中直接调用 Prisma Client — 通过 Admin API

## COMMANDS
```bash
npm run dev           # Vite 开发服务器 (5173端口)
npm run build         # tsc + vite build 生产构建
npm run type-check    # TypeScript 类型检查
npm run db:generate   # Prisma Client 生成
npm run db:migrate    # Prisma 数据库迁移
```

## NOTES
- **Dashboard 双进程**: Vite 前端(5173) + Express Admin API(3001) 独立运行
- **Dashboard 暗色模式**: 通过 `themeStore` (Zustand) 控制，localStorage 持久化，ConfigProvider darkAlgorithm
- **Dashboard UI 组件体系**: PageHeader (通用头部) + PageSkeleton (4种骨架屏) + 响应式宽度常量
- Prisma 版本 v6.19，与 Server(v5.22) 不同版本但共享同一数据库
- Admin API (`server/server.ts`) 需单独启动，非 Vite 管理
- Docker 部署时前端打包为 nginx 静态文件，Admin API 合并到 Server 容器
