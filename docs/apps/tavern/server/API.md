# AI-Tavern 后端 API 文档

> **状态**: current
> **更新**: 2026-05-27

所有接口挂载于 `/api/v1` 前缀下，响应统一格式：

```json
{ "code": 0, "data": {}, "message": "ok" }
```

认证方式：`Authorization: Bearer <token>`

---

## 健康检查

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/v1/health` | - | 服务健康检查 |

---

## 认证 (auth)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/v1/auth/login` | - | 微信登录 (code 换 token) |
| GET | `/api/v1/auth/me` | 需登录 | 获取当前用户信息 |

---

## 聊天 (chat)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/v1/chat/send` | 需登录 | SSE 流式发送消息 |
| GET | `/api/v1/chat/sessions` | 需登录 | 我的会话列表 (分页) |
| GET | `/api/v1/chat/sessions/:id` | 需登录 | 会话详情 (含消息历史) |
| DELETE | `/api/v1/chat/sessions/:id` | 需登录 | 删除会话 |

### POST /chat/send

SSE 事件流：

| 事件类型 | 说明 |
|----------|------|
| `meta` | 会话元信息 (sessionId, characterId) |
| `token` | AI 回复文本片段 |
| `done` | 回复完成 (含 messageId, tokens 用量) |
| `error` | 错误信息 (code + message) |

错误码：`SESSION_NOT_FOUND`, `CHARACTER_NOT_FOUND`, `QUOTA_EXCEEDED`, `KEY_MISSING`, `AI_ERROR`, `CLIENT_DISCONNECT`, `INVALID_PARAMS`, `SERVER_ERROR`

---

## 角色卡 (characters)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/v1/characters` | 需登录 | 我的角色卡列表 (分页) |
| POST | `/api/v1/characters` | 需登录 | 创建角色卡 |
| GET | `/api/v1/characters/:id` | 需登录 | 角色卡详情 |
| PUT | `/api/v1/characters/:id` | 需登录 | 更新角色卡 |
| DELETE | `/api/v1/characters/:id` | 需登录 | 删除角色卡 |
| POST | `/api/v1/characters/:id/publish` | 需登录 | 提交审核 |

### POST /characters 请求体

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 角色名 (1-50 字) |
| description | string | 是 | 描述 (1-2000 字) |
| firstMsg | string | 是 | 开场白 (1-500 字) |
| avatar | string | 否 | 头像 URL |
| personality | string | 否 | 人格设定 (最多 500 字) |
| scenario | string | 否 | 场景设定 (最多 1000 字) |
| lore | string | 否 | 背景故事 (最多 5000 字) |
| systemPrompt | string | 否 | 系统提示词 (最多 2000 字) |
| tags | string[] | 否 | 标签 (最多 10 个，每个 20 字) |
| cardType | enum | 否 | CHARACTER / MECHANISM / MAP / BACKGROUND |
| exampleDialogs | any | 否 | 示例对话 |
| nsfw | boolean | 否 | 是否包含 NSFW 内容 |

---

## 人设 (personas)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/v1/personas` | 需登录 | 人设列表 |
| POST | `/api/v1/personas` | 需登录 | 创建人设 |
| PUT | `/api/v1/personas/:id` | 需登录 | 更新人设 |
| DELETE | `/api/v1/personas/:id` | 需登录 | 删除人设 |
| POST | `/api/v1/personas/:id/default` | 需登录 | 设为默认人设 |

---

## API Key (keys)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/v1/keys` | 需登录 | 我的 API Key 列表 (不返回原始密钥) |
| POST | `/api/v1/keys` | 需登录 | 添加 API Key (自动校验 + AES-256-GCM 加密存储) |
| POST | `/api/v1/keys/:id/verify` | 需登录 | 校验 API Key 有效性 |
| DELETE | `/api/v1/keys/:id` | 需登录 | 删除 API Key |

### 支持的提供商

| 提供商 | 代码 | 类型 |
|--------|------|------|
| 通义千问 (DashScope) | `tongyi` | 系统免费 (每日 20 次) |
| OpenCode Go | `opencode` | 系统免费 (每日 20 次) |
| OpenAI | `openai` | 用户自配密钥 |
| DeepSeek | `deepseek` | 用户自配密钥 |
| Anthropic | `anthropic` | 用户自配密钥 |
| Google Gemini | `google` | 用户自配密钥 |
| 智谱 GLM | `zhipu` | 用户自配密钥 |
| 月之暗面 Moonshot | `moonshot` | 用户自配密钥 |
| MiniMax | `minimax` | 用户自配密钥 |
| OpenRouter | `openrouter` | 用户自配密钥 |

---

## 市场 (market)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/v1/market` | - | 市场列表 (分页，支持 sort / tag / cardType 筛选) |
| GET | `/api/v1/market/featured` | - | 轮播推荐卡片 |
| GET | `/api/v1/market/search` | - | 搜索卡片 (?q=关键字) |
| GET | `/api/v1/market/tags` | - | 所有标签 |
| GET | `/api/v1/market/:id` | - | 市场卡片详情 |
| POST | `/api/v1/market/:id/like` | 需登录 | 点赞 |
| DELETE | `/api/v1/market/:id/like` | 需登录 | 取消点赞 |
| POST | `/api/v1/market/:id/fav` | 需登录 | 收藏 |
| DELETE | `/api/v1/market/:id/fav` | 需登录 | 取消收藏 |
| GET | `/api/v1/market/favs` | 需登录 | 我的收藏列表 |

### GET /market 排序参数

| 值 | 说明 |
|----|------|
| `latest` | 最新发布 (默认) |
| `popular` | 聊天数最多 |
| `mostLiked` | 点赞数最多 |
| `mostFaved` | 收藏数最多 |

---

## 内置角色 (builtin)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/v1/builtin/characters` | - | 获取系统内置角色列表 |

---

## 官方卡片 (official)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/v1/official/all` | - | 获取所有已发布的官方卡片 (客户端同步用) |

---

## 导入导出 (export)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/v1/characters/:id/export` | 需登录 | 导出角色卡 (V2 JSON 格式) |
| POST | `/api/v1/characters/import` | 需登录 | 导入角色卡 (V2 JSON) |

---

## 管理后台 (admin)

所有管理后台接口需 `ADMIN` 角色。

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/v1/admin/pending` | 管理员 | 待审核列表 (分页) |
| POST | `/api/v1/admin/approve/:id` | 管理员 | 通过审核 |
| POST | `/api/v1/admin/reject/:id` | 管理员 | 拒绝审核 (需提供 reason) |
| POST | `/api/v1/admin/ban/:id` | 管理员 | 封禁角色卡 (需提供 reason) |
| GET | `/api/v1/admin/logs/:cardId` | 管理员 | 审核日志 |
| GET | `/api/v1/admin/characters` | 管理员 | 所有角色卡列表 (管理员视图) |
| POST | `/api/v1/admin/characters` | 管理员 | 创建官方角色卡 |
| PUT | `/api/v1/admin/characters/:id` | 管理员 | 更新官方角色卡 |
| POST | `/api/v1/admin/batch-approve` | 管理员 | 批量通过审核 |
| POST | `/api/v1/admin/export` | 管理员 | 批量导出角色卡 JSON |
| GET | `/api/v1/admin/dashboard/stats` | 管理员 | 仪表盘统计 (总角色/总对话/活跃用户/待审核) |

---

## 通用错误码

| code | 说明 |
|------|------|
| 0 | 成功 |
| 400 | 参数错误 |
| 401 | 未登录或 token 过期 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
| 502 | 上游服务不可用 |
