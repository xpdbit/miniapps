> 🚫 **废弃文档** — 本文档路径结构与项目实际目录不匹配。
> 当前架构已迁移至新路径: `docs/apps/tavern/server/README.md`
> 此旧文件保留作为归档参考，不再更新。

# servers/tavern-server — AI-Tavern 后端 API

**AI 角色聊天**后端服务，支持 SSE 流式聊天、多 AI Provider、角色卡市场与审核系统。

## 技术栈

| 类别 | 技术 |
|------|------|
| 运行时 | Node.js / Express / TypeScript |
| ORM | Prisma (MySQL) |
| 缓存 | ioredis (Redis) |
| 认证 | JWT + 微信 code 登录 |
| AI | 通义千问 (DashScope) / OpenAI / DeepSeek / OpenRouter |
| 安全 | Helmet + CORS + rate-limit + AES-256-GCM |

## 数据库 Schema

8 张表：`User`（用户）/ `CharacterCard`（角色卡）/ `ChatSession`（会话）/ `ChatMessage`（消息）/ `Persona`（人设）/ `ApiKey`（API 密钥）/ `ModerationLog`（审核日志）/ 点赞+收藏关联表

## API 路由（挂载在 `/api/v1`）

| 路由 | 端点 | 说明 |
|------|------|------|
| auth | `POST /auth/login` | 微信 code 登录 |
| auth | `GET /auth/me` | 用户信息 |
| characters | `GET / /POST /` | 角色卡 CRUD |
| chat | `POST /send` | SSE 流式聊天 |
| chat | `GET /sessions` | 会话管理 |
| personas | `GET / /POST /` | 人设 CRUD |
| keys | `GET / /POST /` | API Key 管理（AES-256-GCM 加密） |
| market | `GET /` | 角色市场列表/搜索/标签 |
| market | `POST /:id/like` | 点赞/收藏 |
| admin | `GET /pending` | 审核系统 |
| builtin | `GET /characters` | 内置角色 |
| export | `GET /:id/export` | V2 JSON 导入导出 |

## 服务层

10 个服务：ai-proxy（路由 4 个 Provider）/ character / context / export / key / market / moderation / persona / prompt-builder / social

## 核心特性

- **SSE 流式聊天**: 支持通义千问/OpenAI/DeepSeek/OpenRouter 多 Provider
- **角色卡市场**: 发布/审核/收藏/点赞/搜索系统
- **API Key 加密**: 用户级 AES-256-GCM 加密存储
- **Prompt 构建**: 系统提示 + 示例对话 + 历史消息 + 当前消息
- **每日限额**: 用户每日 20 次免费聊天配额
