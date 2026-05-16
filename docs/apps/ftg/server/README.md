# apps/ftg/server — Express 后端 API

FTG（Food Theme Generator）后端服务，为 Taro 客户端提供 RESTful API。支持 AI 食物识别、主题模板渲染、打卡记录、成就系统等功能。

属于 `.miniapps` monorepo 的一个子项目，位于 `apps/ftg/server/`。

## 技术栈

| 层级 | 技术 |
|------|------|
| 运行时 | Node.js + TypeScript (tsx watch 开发) |
| 框架 | Express 4.x |
| ORM | Prisma 6.19 + MySQL 8.0 |
| 缓存 | Redis 7 (ioredis + rate-limit-redis) |
| 鉴权 | JWT (jsonwebtoken) |
| AI 识别 | PP-ShiTuV2（独立 Docker 容器） |
| AI 文本 | DashScope（通义千问 API） |
| 文件存储 | 阿里云 OSS (ali-oss) + Sharp 图片处理 |
| 日志 | Winston |
| API 文档 | Swagger (swagger-jsdoc) |

## 核心功能

- **AI 食物识别** — 上传图片 → PP-ShiTuV2 识别 → 返回食物名称/类别/热量
- **主题模板渲染** — Markup 模板 + CSS Class 系统，将识别结果渲染为食物卡片
- **打卡记录** — 记录美食打卡，含 GPS + IP 定位
- **成就系统** — 基于打卡次数、记录数等条件解锁成就
- **主题管理** — 模板主题的 CRUD 和分类管理
- **分享功能** — 生成分享图和链接
- **收藏/API 密钥** — 用户收藏管理和第三方 API 密钥管理
- **签到** — 每日签到积分系统

## 目录结构

```
apps/ftg/server/
├── src/
│   ├── app.ts             # Express 入口，中间件注册
│   ├── routes/            # 16 个路由模块 (RESTful)
│   ├── services/          # 17 个业务服务
│   ├── middleware/        # 4 个中间件 (auth/rate-limiter/request-logger)
│   ├── lib/               # 共享工具库 (JWT/Redis/Prisma/OSS/加密)
│   ├── config/            # 环境变量配置
│   ├── types/             # 类型定义
│   └── constants/         # 常量定义
├── prisma/                # 数据库 Schema + 迁移
├── .github/workflows/     # CI/CD (lint → type-check → build → docker)
├── nginx/                 # Nginx 反向代理配置
└── monitoring/            # Prometheus 监控配置
```

## API 文档

所有 API 挂载在 `/api/v1` 前缀下，共 16 个路由模块：

| 路由 | 说明 |
|------|------|
| `auth` | 登录注册（wx.login JWT 签发） |
| `users` | 用户信息管理 |
| `records` | 食物打卡记录 CRUD |
| `pipeline` | 识别流水线（上传 → 识别 → 渲染 → 存储） |
| `recognize` | AI 食物识别 |
| `textgen` | AI 文本生成（DashScope） |
| `themes` | 主题模板管理 |
| `theme-classes` | CSS Class 属性管理 |
| `theme-render` | 主题渲染引擎 |
| `checkins` | 每日签到 |
| `achievements` | 成就系统 |
| `apikeys` | API 密钥管理 |
| `favorites` | 收藏管理 |
| `share` | 分享功能 |
| `upload` | 文件上传 |
| `index` | 健康检查 / 信息 |

详细 API 文档见 [API.md](API.md)。

## 核心流程

```
┌────────────┐   ┌────────────┐   ┌──────────────┐   ┌──────────┐
│  Taro 客户端 │──▶│ Routes     │──▶│  Services     │──▶│  Prisma   │
│  (小程序/H5) │   │ /api/v1/*  │   │  业务逻辑层    │   │  MySQL 8   │
└────────────┘   └─────┬──────┘   └──────┬───────┘   └──────────┘
                        │                 │
                        │           ┌─────▼──────┐
                        │           │  AI 识别     │
                        └──────────▶│  PP-ShiTuV2 │
                                    │  (Docker)   │
                                    └────────────┘
                         Middleware: Auth → Rate-Limit → Logger
```

## CI/CD

GitHub Actions 自动执行 CI 流程：lint → type-check → build → Docker 构建并推送。生产部署通过 Docker Compose 编排到 ECS。

- `.github/workflows/ci.yml` — 代码质量检查 + 构建
- `.github/workflows/deploy.yml` — Docker 镜像构建与推送

## 数据库

统一 Prisma Schema 位于 `prisma/schema.prisma`，共 14 张表（与 dashboard 和其他服务共享）。包括：用户、食物记录、主题、CSS Class、成就、打卡、API 密钥、收藏等。

## 快速开始

```bash
cd apps/ftg/server
npm install
npm run dev        # tsx watch 热重载 (端口 env.PORT)
npm run db:generate   # Prisma Client 生成
npm run lint          # ESLint 检查
npm run type-check    # 类型检查
```
