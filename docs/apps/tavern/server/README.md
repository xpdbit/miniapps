# AI-Tavern 后端服务

> **状态**: current
> **更新**: 2026-05-27

AI 角色聊天后端，支持多 AI 提供商、SSE 流式对话、角色卡市场与审核。

## 技术栈

| 层级 | 技术 |
|------|------|
| 运行时 | Node.js + TypeScript (strict) |
| 框架 | Express 4.x |
| 数据库 | MySQL 8.0 (Prisma ORM) |
| 缓存 | Redis 7 (ioredis) |
| 认证 | JWT (jsonwebtoken) |
| 安全 | Helmet + CORS + rate-limit + AES-256-GCM |
| 校验 | Zod |
| 日志 | Winston |

## 项目结构

```
src/
├── app.ts               # Express 配置 + 工厂函数
├── index.ts             # 启动入口 + 优雅关闭
├── config/              # 环境变量校验 + 敏感词表
├── lib/                 # JWT 工具
├── middleware/           # 认证 / 错误处理 / Zod 校验
├── routes/              # 10 路由模块
├── services/            # 10 服务模块
├── types/               # AuthPayload / ApiResponse
└── utils/               # crypto / logger / prisma / response
```

## 核心功能

**多 AI 提供商** — 内置通义千问 (DashScope) 和 OpenCode Go 两个免费默认模型，支持 OpenAI / DeepSeek / Anthropic / Google / 智谱 / 月之暗面 / MiniMax / OpenRouter 用户自配密钥。每日免费额度 20 次。

**SSE 流式聊天** — POST `/api/v1/chat/send` 以 Server-Sent Events 返回 token 流，支持自动会话管理、上下文保持、客户端断开检测。

**角色卡系统** — 支持用户自建角色 (CHARACTER / MECHANISM / MAP / BACKGROUND 四种类型)、官方卡片、审核发布流程。

**角色市场** — 浏览 / 搜索 / 标签筛选 / 轮播推荐 / 点赞收藏，支持多种排序。

**安全存储** — 用户 API Key 通过 AES-256-GCM 加密后存储，响应中不返回原始密钥。

**审核系统** — 管理员发布 / 审批 / 封禁 / 日志审计。

**导入导出** — V2 JSON 格式导入导出，兼容第三方角色卡交换。

## 数据库 (8 表)

User, CharacterCard, ChatSession, ChatMessage, Persona, ApiKey, ModerationLog, 点赞收藏关联表。

## 快速开始

```bash
cd apps/tavern/server
cp .env.example .env    # 配置环境变量
npm install
npm run db:migrate      # 数据库迁移
npm run db:seed         # 种子数据（内置角色）
npm run dev             # tsx watch 热重载
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式 (tsx watch, 端口 3002) |
| `npm run build` | tsc 编译 |
| `npm run start` | 生产启动 |
| `npm run type-check` | 类型检查 |
| `npm run lint` | ESLint |
| `npm run db:generate` | Prisma Client 生成 |
| `npm run db:seed` | 种子数据 |
