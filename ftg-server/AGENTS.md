# ftg-server — 后端 API 服务

## OVERVIEW
Express 后端 API 服务，Prisma ORM 数据层，提供 RESTful API 和 AI 食物识别集成。

## STRUCTURE
```
ftg-server/
├── src/
│   ├── app.ts           # Express 应用入口
│   ├── routes/          # 15 个路由模块 (RESTful)
│   ├── services/        # 业务逻辑层 (含 AI 识别)
│   ├── middleware/       # Express 中间件
│   ├── lib/             # 共享工具库
│   ├── config/          # 配置管理
│   ├── types/           # TypeScript 类型定义
│   └── constants/       # 常量定义
├── prisma/
│   ├── schema.prisma    # 数据库 Schema (主)
│   └── migrations/      # 数据库迁移记录
├── .github/workflows/   # CI/CD (ci.yml + deploy.yml)
├── nginx/               # Nginx 配置
├── monitoring/          # 监控配置
└── tsconfig.json        # TypeScript 配置
```

## WHERE TO LOOK
| 任务 | 位置 | 说明 |
|------|------|------|
| API 入口 | `src/app.ts` | Express 应用启动，中间件注册 |
| 路由定义 | `src/routes/` | 15 个路由模块，按功能域拆分 (新增 theme-classes/theme-render) |
| 业务逻辑 | `src/services/` | AI 识别、数据处理、主题模板渲染等核心逻辑 |
| 中间件 | `src/middleware/` | 鉴权、日志、错误处理等 |
| 数据库 Schema | `prisma/schema.prisma` | 所有表的定义 (主 Schema) |
| 类型定义 | `src/types/` | 共享类型和接口 |
| CI/CD | `.github/workflows/` | GitHub Actions (lint → type-check → build → docker) |

## CONVENTIONS
- `no-explicit-any: error` — 禁止 any
- `no-non-null-assertion: error` — 禁止 `!` 断言
- `strict-boolean-expressions: warn` — 布尔表达式检查
- 路由无独立 controller 层 — route handler 直接调用 services
- Prisma v5.22，数据库迁移通过 `prisma db push` 或 `prisma migrate`

## ANTI-PATTERNS
- ❌ 不得在路由中直接写数据库查询 — 需通过 services
- ❌ 禁止 `@ts-ignore` / `@ts-expect-error` — 类型错误需正确修复
- ❌ 不得跳过 Prisma migration — Schema 变更必须生成迁移

## COMMANDS
```bash
npm run dev           # tsx watch 热重载开发 (端口 env.PORT)
npm run build         # tsc 编译到 dist/
npm run start         # node dist/app.js 生产启动
npm run lint          # ESLint 代码检查
npm run type-check    # tsc --noEmit 类型检查
npm run db:generate   # Prisma Client 生成
npm run db:migrate    # Prisma 数据库迁移
npm run db:seed       # Prisma 种子数据
```

## NOTES
- 生产端口由环境变量 `PORT` 指定
- AI 识别服务 PP-ShiTuV2 为独立容器，通过 HTTP API 调用
- CI 流程: lint → type-check → build → docker-build → (deploy)
- deploy.yml 中 SSH 部署部分需按实际环境配置后启用
