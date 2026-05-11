# servers/ftg-server — Express 后端 API

**食物主题生成器 (FTG)** 的后端服务，提供 RESTful API。

## 技术栈

| 类别 | 技术 |
|------|------|
| 运行时 | Node.js 20 + Express 4.21 + TypeScript 5.x |
| ORM | Prisma 6.19 (MySQL 8.0) |
| 缓存 | ioredis (Redis 7) |
| 认证 | JWT (jsonwebtoken) + 微信 code 登录 |
| 安全 | Helmet + CORS + express-rate-limit |
| 日志 | Winston |
| AI 识别 | PP-ShiTuV2 (Docker 独立容器) |
| AI 文本 | DashScope 通义千问 |

## 核心功能

- 用户认证 (微信登录 / JWT)
- 食物记录 CRUD + 分页
- 主题模板系统 (Markup + CSS Class 渲染)
- 位置打卡 + 连续打卡统计
- AI 识别服务编排 (PP-ShiTuV2)
- AI 文本生成 (DashScope)
- 成就系统
- API 密钥管理

## 目录结构

```
servers/ftg-server/src/
├── routes/           # 16 个 RESTful 路由模块
├── services/         # 业务逻辑层 (含 AI 识别/主题渲染)
├── middleware/       # 中间件 (认证/权限/限速)
├── lib/             # 共享工具
├── config/          # 环境变量配置
├── types/           # TypeScript 类型定义
└── constants/       # 常量定义
```

## API 路由 (挂载于 `/api/v1`)

| 模块 | 主要端点 | 说明 |
|------|----------|------|
| auth | `POST /auth/login`, `GET /auth/me` | 微信登录 + JWT 签发 |
| users | `GET /users/:id`, `PUT /users/:id`, `GET /leaderboard` | 用户管理 + 排行榜 |
| food-records | `POST /`, `GET /:id`, `GET /user/:userId`, `DELETE /:id` | 食物记录 CRUD |
| checkins | `POST /`, `GET /user/:userId`, `GET /stats/streak` | 位置打卡 |
| stats | `GET /summary`, `GET /calendar`, `GET /distribution` | 数据统计面板 |
| achievements | `GET /`, `POST /check` | 成就解锁 |
| themes | `GET /`, `GET /:id`, `POST /`, `PUT /:id` | 主题 CRUD |
| theme-classes | `GET /`, `POST /`, `PUT /:id`, `DELETE /:id` | CSS Class 管理 |
| theme-render | `POST /render`, `GET /preview/:id` | Markup 模板渲染 |
| theme-usage | `POST /log`, `GET /stats` | 使用统计 + 短链接 |
| recognition | `POST /recognize` | PP-ShiTuV2 识别代理 |
| upload | `POST /`, `GET /uploads/:filename` | 文件上传 (multer) |
| health | `GET /health` | 健康检查 |
| admin | `GET /users`, `GET /records` | 管理接口 |
| api-keys | `POST /`, `GET /`, `DELETE /:id` | API 密钥管理 |
| location | `POST /ip` | IP 定位 |

## 服务层

| 服务 | 文件 | 职责 |
|------|------|------|
| Auth | `services/auth.service.ts` | JWT 生成/验证 + 微信 code 交换 |
| Food Record | `services/food-record.service.ts` | 食物记录 CRUD + 分页 |
| Checkin | `services/checkin.service.ts` | 打卡 + 连续天数计算 |
| Stats | `services/stats.service.ts` | 数据聚合查询 |
| Achievement | `services/achievement.service.ts` | 成就解锁条件判断 |
| Theme | `services/theme.service.ts` | 主题 CRUD + 使用统计 |
| Theme Class | `services/theme-class.service.ts` | CSS Class CRUD + 白名单校验 |
| Theme Render | `services/theme-render.service.ts` | Markup 模板 → HTML/CSS 渲染 |
| Theme Usage | `services/theme-usage.service.ts` | 使用日志 + 短 URL 生成 |
| Recognition | `services/recognition.service.ts` | PP-ShiTuV2 HTTP 客户端 (支持 mock 模式) |
| Upload | `services/upload.service.ts` | 文件存储管理 |

## 中间件

| 中间件 | 文件 | 用途 |
|--------|------|------|
| Auth | `middleware/auth.ts` | JWT 验证，注入 `req.user` |
| AdminGuard | `middleware/admin-guard.ts` | RBAC 管理员权限检查 |
| RateLimit | `middleware/rate-limit.ts` | 按路由的速率限制 |
| Upload | `middleware/upload.ts` | Multer 文件上传配置 |

## CI/CD

| 配置 | 位置 | 内容 |
|------|------|------|
| CI | `.github/workflows/ci.yml` | lint → type-check → build → docker-build-test |
| Deploy | `.github/workflows/deploy.yml` | Docker 构建 + push + SSH 部署 (SSH 步骤已注释) |

Dockerfile: 多阶段构建 (node:20-alpine builder → dist runner, 非 root `appuser`, HEALTHCHECK)

## 数据库

统一 Prisma Schema 位于 `prisma/schema.prisma`，覆盖 14 张表：
- FTG 核心: User, FoodRecord, Checkin, Theme, ThemeClass, Achievement, ApiKey, PipelineRecord, Favorite
- 管理: AdminUser, Project, AuditLog
- 枚举: FoodType, PipelineStatus, AdminRole, AdminStatus, ProjectStatus

## 外部服务

| 服务 | 协议 | 用途 |
|------|------|------|
| PP-ShiTuV2 (Docker) | HTTP API (port 5000) | 食物识别 |
| DashScope (通义千问) | HTTP API | AI 文本生成 |
| Redis 7 | TCP (port 6379) | 缓存 / 会话 |
| WeChat API | HTTPS | code 换 session_key / openid |
