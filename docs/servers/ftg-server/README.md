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

## API

详细 API 路由表（16 个模块）、服务层（16 个服务）、中间件与外部服务配置请见 [API.md](./API.md)。

## 核心流程

```
拍照 → PP-ShiTuV2 识别 → Pipeline 编排 → 主题渲染 → 卡片生成
                                              ↓
                                    用户打卡 → 成就检查 → 统计更新
```

支持**位置打卡、连续天数统计、排行榜、API 密钥管理**。

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

---

> 最后更新: 2026-05-13
> 修改: 精简 README，API 路由表迁移至 API.md
