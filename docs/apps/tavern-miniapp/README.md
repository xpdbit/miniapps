> 🚫 **废弃文档** — 本文档路径结构与项目实际目录不匹配。
> 当前架构已迁移至新路径: `docs/apps/tavern/client/README.md`
> 此旧文件保留作为归档参考，不再更新。

# apps/tavern-miniapp — AI-Tavern 微信小程序

**AI 角色聊天**小程序前端，基于 Taro 4.x + React 18，支持 SSE 流式聊天、角色卡市场、自定义人设。

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Taro 4.0.13 (React 18) |
| 语言 | TypeScript (strict) |
| 样式 | Sass (.module.scss) |
| 状态管理 | Zustand 5 |
| HTTP 客户端 | Taro.request 封装 (JWT 自动携带) |
| 流式聊天 | SSE EventSource (useSSE hook) |

## 页面

| 页面 | 路径 | 说明 |
|------|------|------|
| 角色市场 | `pages/market/index` | 角色卡浏览/搜索/标签/轮播 |
| 聊天 | `pages/chat/index` | SSE 流式聊天/会话管理 |
| 角色详情 | `pages/character/index` | 角色信息展示 |
| 角色详情页 | `pages/character/detail/index` | 完整角色详情 |
| 角色创建 | `pages/creator/index` | 角色卡编辑/发布 |
| 个人主页 | `pages/profile/index` | 个人信息 |
| 人设管理 | `pages/persona/index` | 自定义人设 CRUD |
| 设置 | `pages/settings/index` | API Key 管理/偏好设置 |

## 组件

| 组件 | 位置 | 说明 |
|------|------|------|
| CharacterCard | `src/components/CharacterCard/` | 角色卡片展示 |
| ChatBubble | `src/components/ChatBubble/` | 聊天气泡 |
| ModelSelector | `src/components/ModelSelector/` | AI 模型选择器 |
| Skeleton | `src/components/Skeleton/` | 骨架屏 |

## 核心服务

- **认证**: 微信登录 (`wx.login`) → JWT token → 每日配额自动刷新
- **SSE 流式**: EventSource 封装，支持断线重连和流式消息追加
- **HTTP 客户端**: HttpClient 封装（JWT 自动携带 + 401 拦截登出）
- **多 AI 模型**: ModelSelector 组件切换通义千问/OpenAI/DeepSeek/OpenRouter

## 相关文档

- [tavern-server 后端 API](../servers/tavern-server/README.md)
- [tavern-miniapp AGENTS.md](../../apps/tavern-miniapp/AGENTS.md)
