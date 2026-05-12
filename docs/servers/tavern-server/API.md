# servers/tavern-server — API 参考

所有 API 挂载于 `/api/v1` 前缀（生产环境通过 Nginx 代理到 `/api/tavern/`）。

## 认证

所有端点在 `Authorization: Bearer <token>` 头中携带 JWT token（除登录外）。

## 路由表

### 认证

| 方法 | 端点 | 说明 | 认证 |
|------|------|------|------|
| POST | `/auth/login` | 微信 code 登录，返回 JWT | ❌ |
| GET | `/auth/me` | 用户信息 | ✅ |

### 角色卡

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/characters` | 角色卡列表（分页） |
| POST | `/characters` | 创建角色卡 |
| GET | `/characters/:id` | 角色卡详情 |
| PUT | `/characters/:id` | 更新角色卡 |
| DELETE | `/characters/:id` | 删除角色卡 |

### 聊天（SSE 流式）

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/chat/send` | SSE 流式聊天（EventSource） |
| GET | `/chat/sessions` | 会话列表 |
| POST | `/chat/sessions` | 创建会话 |
| DELETE | `/chat/sessions/:id` | 删除会话 |

### 人设

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/personas` | 人设列表 |
| POST | `/personas` | 创建人设 |
| PUT | `/personas/:id` | 更新人设 |
| DELETE | `/personas/:id` | 删除人设 |

### API 密钥

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/keys` | 密钥列表（AES-256-GCM 加密存储） |
| POST | `/keys` | 添加密钥 |
| DELETE | `/keys/:id` | 删除密钥 |

### 角色市场

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/market` | 市场列表（搜索/标签/分页） |
| POST | `/market/:id/like` | 点赞角色卡 |
| POST | `/market/:id/favorite` | 收藏角色卡 |

### 管理

| 方法 | 端点 | 说明 | 权限 |
|------|------|------|------|
| GET | `/admin/pending` | 待审核角色卡 | admin |
| POST | `/admin/approve/:id` | 审核通过 | admin |
| POST | `/admin/reject/:id` | 审核拒绝 | admin |

### 内置角色

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/builtin/characters` | 系统预置角色列表 |

### 导出

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/export/:id` | 导出角色卡（V2 JSON 格式） |
| POST | `/export/import` | 导入角色卡 |

---

## 服务层（10 个服务）

| 服务 | 职责 |
|------|------|
| AI Proxy | 多 Provider 路由（通义千问/OpenAI/DeepSeek/OpenRouter） |
| Character | 角色卡 CRUD + 审核状态管理 |
| Context | 会话上下文管理 |
| Export | V2 JSON 导入导出 |
| Key | API Key 加密存储（AES-256-GCM） |
| Market | 市场搜索/标签/分页/轮播 |
| Moderation | 角色卡内容审核 |
| Persona | 用户人设 CRUD |
| Prompt Builder | 系统提示 + 示例对话 + 历史 + 当前消息 |
| Social | 点赞/收藏/互动 |

---

## 核心特性

- **SSE 流式聊天**: EventSource 推流，支持断线重连
- **多 AI Provider**: 通义千问 (DashScope) / OpenAI / DeepSeek / OpenRouter
- **API Key 加密**: 用户级 AES-256-GCM 加密存储
- **每日限额**: 用户每日 20 次免费聊天配额，小程序切前台自动刷新
- **Prompt 构建**: 系统提示 + 示例对话 + 历史消息 + 当前消息 → AI 请求

---

> 最后更新: 2026-05-13
> 修改: 首次创建本文档
