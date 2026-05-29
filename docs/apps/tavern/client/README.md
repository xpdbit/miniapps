# AI-Tavern 客户端 — 说明与规划

> **状态**: current
> **更新**: 2026-05-29
> 项目路径: `apps/tavern/client/`

---

## 一、项目概述

AI-Tavern 客户端是一个基于 **Taro 4.x** 跨平台框架的 AI 角色聊天应用，同时支持 **微信小程序 (WeApp)** 和 **H5 浏览器** 双平台。用户可在"酒馆"中浏览、创建角色卡，并通过 SSE 流式技术与 AI 角色进行沉浸式对话。

### 核心定位

- **角色扮演聊天**：用户与 AI 角色进行自然语言对话，角色拥有独立的设定、性格和对话风格
- **双模式体验**：酒馆模式（角色市场+聊天）和游戏模式（存档+群组+通信），后者将角色卡组织为游戏存档，提供类 TRPG 的沉浸体验
- **隐私优先**：支持隐私模式，AI 请求绕过服务器中转，用户自行管理 API Key 直连 AI Provider

### 技术栈

| 层 | 选型 | 版本 |
|---|---|---|
| 框架 | Taro | 4.0.13 |
| UI 框架 | React | 18.3.x |
| 状态管理 | Zustand | 5.x |
| 样式 | Sass (`.module.scss`) | 1.72.x |
| 编译工具 | Webpack 5 | 5.91.x |
| 语言 | TypeScript (strict mode) | 5.4.x |
| 代码检查 | ESLint + Prettier | 8.57.x |
| 流式通信 | SSE (EventSource, enableChunked) | — |

### 项目规模

- **12 个页面**（含 3 个 tabBar 页面 + 3 个游戏模式页面 + 6 个功能页面）
- **9 个 Zustand Store** 管理状态
- **8 个服务模块** 封装 API
- **15 个共享组件**（含 Icon 系统，33 个 SVG 图标）
- **4 个自定义 Hook**（SSE 流式 + 直连 AI + 响应式）
- **~3,500 行源文件**（不含 SCSS）

---

## 二、目录结构

```
apps/tavern/client/
├── config/                          # Taro 构建配置
│   ├── index.ts                     # 基础构建配置（编译时注入 API_BASE_URL）
│   ├── dev.ts                       # 开发环境配置
│   └── prod.ts                      # 生产环境配置
├── src/
│   ├── app.ts                       # 应用入口（认证初始化 + 全局错误处理）
│   ├── app.config.ts                # 小程序配置（12 页面 + 3 tabBar + 自定义 tabBar）
│   ├── app.scss                     # 全局样式（温暖淡亮色主题 CSS 变量系统）
│   ├── app.d.ts                     # 类型声明
│   ├── assets/
│   │   └── icons/                   # tabBar 图标资源
│   ├── custom-tab-bar/              # 自定义底部导航栏（双模式：酒馆/游戏）
│   │   ├── index.tsx
│   │   └── index.scss
│   ├── pages/                       # 12 个页面
│   │   ├── market/                  # [酒馆] 角色市场（核心页面：浏览/搜索/子标签/创建）
│   │   ├── chat/                    # [酒馆] 聊天（SSE 流式对话）
│   │   ├── archive/                 # [酒馆] 聊天归档
│   │   ├── character/               # 角色列表页
│   │   │   └── detail/              # 角色详情页
│   │   ├── creator/                 # 角色卡编辑器（4 步向导）
│   │   ├── profile/                 # [酒馆/游戏] 个人中心
│   │   ├── persona/                 # 自定义人设管理
│   │   ├── game-setup/              # 游戏模式设置（存档创建/选卡/世界设定）
│   │   ├── chats/                   # [游戏] 通信-聊天列表
│   │   ├── contacts/                # [游戏] 通讯录
│   │   └── discover/                # [游戏] 发现
│   ├── components/                  # 15 个共享组件
│   │   ├── AppButton/               # 通用按钮（4 变体）
│   │   ├── AppCard/                 # 通用卡片
│   │   ├── SectionHeader/           # 区块标题
│   │   ├── EmptyState/              # 空状态占位
│   │   ├── Icon/                    # SVG 图标系统（33 个图标）
│   │   ├── Skeleton/                # 骨架屏（4 类型）
│   │   ├── CharacterCard/           # 角色卡片组件
│   │   ├── ChatBubble/              # 聊天气泡组件
│   │   ├── ChatMarkdown/            # Markdown 渲染组件（代码高亮/表格/列表）
│   │   ├── DesktopLoginModal/       # 桌面版登录弹窗
│   │   ├── DesktopSidebar/          # 桌面版侧边栏
│   │   ├── ModelSelector/           # AI 模型选择器（21 模型）
│   │   ├── ThemeToggle/             # 暗色/亮色主题切换开关
│   │   ├── WebNavBar/               # Web 导航栏
│   │   └── index.ts                 # 统一导出
│   ├── services/                    # 8 个服务模块
│   │   ├── httpClient.ts            # 统一 HTTP 客户端（JWT 自动携带/401 拦截/错误处理）
│   │   ├── aiClient.ts              # AI 直连客户端（12 个 Provider 配置）
│   │   ├── aiService.ts             # AI 服务端代理调用
│   │   ├── characterService.ts      # 角色卡 CRUD API
│   │   ├── marketService.ts         # 角色市场 API（列表/搜索/收藏/点赞）
│   │   ├── officialService.ts       # 官方卡片同步 API
│   │   ├── personaService.ts        # 人设管理 API
│   │   └── index.ts                 # 统一导出
│   ├── stores/                      # 9 个 Zustand Store
│   │   ├── authStore.ts             # 认证状态（微信/密码登录、JWT、tier 配额）
│   │   ├── chatStore.ts             # 聊天会话管理
│   │   ├── characterStore.ts        # 远程角色状态（API 拉取）
│   │   ├── gameStore.ts             # 游戏模式状态（存档/群组/消息）
│   │   ├── privacyStore.ts          # 隐私模式（本地 API Key 缓存）
│   │   ├── localCardsStore.ts       # 本地角色卡（Storage 持久化）
│   │   ├── syncedCardsStore.ts      # 官方同步卡片（500ms 防抖同步）
│   │   ├── themeStore.ts            # 主题设置（暗色/亮色模式切换）
│   │   └── index.ts                 # 统一导出
│   ├── hooks/                       # 4 个自定义 Hook
│   │   ├── useSSE.ts                # SSE 流式聊天 Hook（核心）
│   │   ├── useDirectAI.ts           # 隐私模式直连 AI Hook
│   │   ├── useResponsive.ts         # 响应式布局 Hook（桌面版检测）
│   │   └── index.ts                 # 统一导出
│   ├── types/                       # TypeScript 类型定义
│   │   ├── character.ts             # 角色卡类型（CardType, CharacterCard, LocalCard）
│   │   ├── chat.ts                  # 聊天类型（ChatMessage, ChatSession, SSEMessage）
│   │   ├── game.ts                  # 游戏模式类型（GameSave, GameGroup, GameMessage）
│   │   └── common.ts                # 通用类型（ApiResponse, PaginatedResult）
│   ├── utils/                       # 工具函数
│   │   └── index.ts                 # cn() / formatCount / formatRelativeTime / formatUuid
│   └── constants/                   # 常量
│       ├── index.ts                 # API_BASE_URL / PAGE_SIZE
│       └── icons.ts                 # SVG 图标常量（33 个图标）
├── scripts/
│   └── generate-icons.mjs           # tabBar 图标生成脚本
├── package.json                     # 项目配置与依赖
├── tsconfig.json                    # TypeScript 严格模式
├── .eslintrc.js                     # ESLint 配置
├── babel.config.js                  # Babel 配置
└── project.config.json              # 微信小程序项目配置
```

---

## 三、页面与路由

### 3.1 小程序页面配置

`app.config.ts` 定义了 12 个页面和 3 个 tabBar 条目。

```typescript
pages: [
  'pages/market/index',       // [tabBar] 角色市场
  'pages/chat/index',         // [tabBar] 聊天
  'pages/archive/index',      // 聊天归档
  'pages/game-setup/index',   // 游戏模式设置
  'pages/character/index',    // 角色列表
  'pages/character/detail/index', // 角色详情
  'pages/creator/index',      // 角色创建
  'pages/profile/index',      // [tabBar] 个人中心
  'pages/persona/index',      // 人设管理
  'pages/chats/index',        // [游戏] 通信
  'pages/contacts/index',     // [游戏] 通讯录
  'pages/discover/index',     // [游戏] 发现
]
```

**注意**：`app.config.ts` 的 `tabBar.list` 仅包含 3 个原生 tab 页面（market/chat/profile）。游戏模式的 chats/contacts/discover **不在原生 tabBar 中**，通过自定义 tab-bar 组件实现导航。

### 3.2 H5 路由配置

H5 模式下使用 **hash 模式**，配置了自定义路由路径：

| 小程序路径 | H5 路由 |
|---|---|
| `/pages/market/index` | `/market` |
| `/pages/chat/index` | `/chat` |
| `/pages/character/index` | `/character` |
| `/pages/character/detail/index` | `/character/detail` |
| `/pages/creator/index` | `/creator` |
| `/pages/profile/index` | `/profile` |
| `/pages/persona/index` | `/persona` |

### 3.3 页面功能详表

| 页面 | Tab | 功能 | 状态 |
|---|---|---|---|---|
| **cards** | 卡片集 tab | 角色卡浏览、按类型筛选（角色/机制/地图/背景）、搜索、刷新、本地卡片管理 | ✅ 已实现 |
| **chat** | 酒馆 tab | SSE 流式对话、会话管理、模型选择、角色选择 | ✅ 已实现 |
| **archive** | — | 聊天归档列表 | ✅ 已实现 |
| **character** | — | 角色列表 | ✅ 已实现 |
| **character/detail** | — | 角色详情（设定、对话风格、开始对话入口） | ✅ 已实现 |
| **creator** | — | 4 步角色卡创建向导（基础信息→人设→对话风格→预览） | ✅ 已实现 |
| **profile** | 我的 tab | 用户信息、配额进度、登录/注销、隐私模式、暗色模式、模型与服务商选择、API Key 管理、显示设置、功能菜单 | ✅ 已实现 |
| **persona** | — | 自定义人设管理（CRUD） | ✅ 已实现 |
| **game-setup** | — | 游戏模式存档创建、选卡组合、世界设定 | ✅ 已实现 |
| **chats** | 游戏通信 | 游戏模式通信列表 | ✅ 已实现 |
| **contacts** | 游戏通讯录 | 游戏模式联系人 | ✅ 已实现 |
| **discover** | 游戏发现 | 游戏模式发现/朋友圈 | ✅ 已实现 |

---

## 四、状态管理（Zustand Store）

项目使用 **Zustand 5** 管理状态，共 9 个 Store：

### 4.1 authStore — 认证状态

```typescript
// 核心状态
token: string | null           // JWT access token
refreshToken: string | null    // JWT refresh token
user: UserInfo | null          // 用户信息 (uuid/nickname/avatar_url/role)
tier: TierInfo | null          // 用户 tier (FREE/PAID/TESTER)
isLoggedIn: boolean            // 是否已登录
initialized: boolean           // 初始化是否完成

// 核心方法
initialize()                   // 启动时检查已保存 token 有效性
wechatLogin(code)              // 微信一键登录
passwordLogin(username, pass)  // 账号密码登录
logout()                       // 登出
restoreSession()               // 恢复会话
refreshQuota()                 // 刷新每日配额
fetchTier()                    // 获取用户 tier
retryLogin()                   // 重试登录
```

**数据流**：
1. 启动时 `initialize()` 从 `Taro.getStorageSync('tavern_token')` 读取 token
2. 若 token 存在，调用 `/auth/me` 验证，有效则自动恢复登录
3. 微信登录：`wx.login()` → POST `/auth/wechat/login` → 获取 JWT
4. 密码登录：POST `/auth/login` → 获取 JWT
5. Token 持久化到 `tavern_token` / `tavern_refresh_token`

### 4.2 chatStore — 聊天状态

```typescript
// 核心状态
sessions: ChatSession[]        // 会话列表
currentSession: ChatSession | null  // 当前会话
messages: ChatMessage[]        // 消息列表
isStreaming: boolean           // 是否正在流式响应
selectedModel: string          // 选中的 AI 模型
selectedProvider: string       // 选中的 AI Provider
pendingCharacterId: string | null  // 暂存的角色 ID

// 核心方法
loadSessions()                 // 从 API 加载会话
selectSession(session)         // 选择会话
addMessage(msg)                // 添加消息
updateLastMessage(content)     // 更新最后一条消息内容
setStreaming(v)                // 设置流式状态
clearCurrent()                 // 清空当前会话
setModel(model, provider?)     // 切换 AI 模型（持久化）
setPendingCharacter(id)        // 设置暂存角色 ID
```

**特点**：
- 模型选择持久化到 `tavern_selected_model` / `tavern_selected_provider`
- Store 默认模型：`deepseek-chat`（来自 DeepSeek Provider）
- **注意**：代码中存在两层默认值不一致——chatStore 默认是 `deepseek-chat`（deepseek），但 useSSE hook 的请求参数默认是 `qwen-turbo`（tongyi）。`qwen-turbo` 仅作为 `loadSavedModel()` catch 分支和 `useSSE.ts:63` 的请求参数兜底使用。行为流程：首次使用 → chatStore 初始化 `deepseek-chat` → 若用户未在设置中切换，useSSE 会使用 chatStore 的 selectedModel → 实际最终请求由 chatStore 的 `selectedModel` 决定。

### 4.3 characterStore — 远程角色状态

管理通过 API 从服务器拉取的角色卡片数据，支持分页加载、详情获取、创建/删除/发布操作。

### 4.4 localCardsStore — 本地卡片存储

```typescript
// 纯本地存储，不依赖服务器
// ID 格式: local_<timestamp>_<random>
// 持久化到 tavern_local_cards (Taro Storage)
```

支持按 `CardType` 筛选、CRUD 操作、`restoreFromStorage()` 从本地存储恢复。

### 4.5 syncedCardsStore — 官方同步卡片

```typescript
// 从 ECS100 同步的官方角色卡片
// 关键特性：
// - 500ms 防抖：避免频繁同步
// - 去重：正在进行的同步会复用已存在的 Promise
// - 自动持久化：同步成功后将卡片写入 tavern_synced_cards
// - 强制刷新：forceRefresh() 绕过防抖立即同步
```

### 4.6 gameStore — 游戏模式状态

```typescript
// 核心状态
saves: GameSave[]              // 游戏存档列表
activeSaveId: string | null    // 当前活跃存档 ID
gameMode: boolean              // 是否处于游戏模式

// 核心方法
restoreSaves()                 // 从 localStorage 恢复存档
createSave(data)               // 创建新存档
deleteSave(id)                 // 删除存档
renameSave(id, name)           // 重命名存档
updateSaveGroups(saveId, groups)  // 更新群组
addMessage(groupId, msg)       // 添加消息到群组
togglePinned(groupId)          // 置顶/取消置顶
enableGameMode()               // 切换到游戏模式（通过 eventCenter 广播）
disableGameMode()              // 退出游戏模式
```

**数据流**：
- 存档完全在客户端管理（localStorage）
- `tavern_saves` 存储存档列表
- `tavern_active_save_id` 存储当前活跃存档 ID
- 切换到游戏模式时通过 `eventCenter.trigger('gameModeChange')` 广播给 CustomTabBar

### 4.7 privacyStore — 隐私模式

```typescript
// 核心状态
privacyMode: boolean           // 是否启用隐私模式
localKeys: Record<string, LocalApiKey>  // 本地 API Key 缓存（按 provider 索引）

// 核心方法
setPrivacyMode(enabled)        // 切换隐私模式
setLocalKey(provider, key, baseUrl?)  // 保存 API Key
removeLocalKey(provider)       // 删除 API Key
getLocalKey(provider)          // 获取 API Key
```

**存储键**：`tavern_privacy_mode` / `tavern_local_api_keys`

### 4.8 Store 间依赖关系

```
authStore (认证基础)
  ├── chatStore (聊天需要 token)
  ├── characterStore (角色 CRUD 需要 token)
  └── syncedCardsStore (同步需要 token)

localCardsStore (独立，纯本地)
gameStore (独立，纯本地)
privacyStore (独立，纯本地)
themeStore (独立，纯本地)
```

---

## 五、服务层（Services）

### 5.1 httpClient — 统一 HTTP 客户端

```typescript
// 核心特性
// - 自动携带 JWT token (从 Storage 读取)
// - 401 自动登出 + 跳转个人中心
// - 统一的错误处理（超时/网络错误/JSON 解析错误 → 中文友好提示）
// - 支持 SSE (enableChunked)
// - GET 请求自动过滤 undefined/空字符串参数

// 方法
request<T>(config)    // 通用请求（支持 SSE）
get<T>(url, params?)  // GET
post<T>(url, data?)   // POST
put<T>(url, data?)    // PUT
delete<T>(url)        // DELETE
```

**错误处理策略**：
- 超时 → "请求超时，请检查网络"
- 网络失败 → "网络连接失败，请检查服务器状态或网络设置"
- JSON 解析错误 → "AI 服务响应异常，请重试"
- 401 → 自动登出（已初始化时跳转个人中心，未初始化时由 initialize 处理）

### 5.2 aiClient — AI 直连客户端

支持 12 个 AI Provider 的直接调用（含酒馆自持 + 9 个外部 + One API）：

| Provider | 基础 URL | 默认模型 |
|---|---|---|
| tavern (酒馆自持) | 无（通过服务器聚合 tongyi + opencode） | — |
| tongyi (阿里通义) | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | qwen-plus |
| opencode | `https://api.opcode.com/v1/chat/completions` | qwen-turbo |
| openai | `https://api.openai.com/v1/chat/completions` | gpt-4o-mini |
| anthropic | `https://api.anthropic.com/v1/messages` | claude-3-haiku |
| google | `https://generativelanguage.googleapis.com` | gemini-2.5-pro |
| deepseek | `https://api.deepseek.com/v1/chat/completions` | deepseek-chat |
| zhipu (智谱) | `https://open.bigmodel.cn/api/paas/v4/chat/completions` | glm-4-flash |
| moonshot (月之暗面) | `https://api.moonshot.cn/v1/chat/completions` | moonshot-v1-8k |
| minimax (稀宇) | `https://api.minimaxi.com/v1/chat/completions` | abab6.5s |
| openrouter | `https://openrouter.ai/api/v1/chat/completions` | auto |
| oneapi | 用户自定义 | — |

提供两个函数：
- `aiGenerateText()` — 标准文本生成
- `aiGenerateJSON()` — JSON 结构化生成（从响应中提取 JSON）

### 5.3 aiService — AI 服务端代理

通过 tavern 服务器中转调用 AI，而非客户端直连。超时设为 60s（适用于较长的世界构建任务）。

### 5.4 其他 Service

| Service | 端点 | 功能 |
|---|---|---|
| characterService | `/characters` | 角色卡 CRUD + 发布 |
| marketService | `/market` | 市场浏览/搜索/标签/点赞/收藏 |
| officialService | `/official/all` | 官方卡片同步 |
| personaService | `/personas` | 人设 CRUD + 设置默认 |

---

## 六、自定义 Hook

### 6.1 useSSE — SSE 流式聊天（核心）

```typescript
// 核心流程
1. sendMessage() 调用 Taro.request with enableChunked: true
2. 逐行解析 "data: " 前缀的 SSE 事件
3. 支持 4 种事件类型:
   - meta: sessionId 元信息
   - token: 流式 token 追加
   - done: 流式完成
   - error: 流式错误
4. 断线自动处理

// 返回
{
  messages,           // ChatMessage[] 消息列表
  isStreaming,        // boolean 是否流式中
  currentSessionId,   // 当前会话 ID
  sendMessage,        // 发送消息（参数含 characterId/personaId/message/model/provider/cardData）
  clearMessages,      // 清空消息
  stopStreaming,      // 手动停止流式
}
```

**SSE 数据流**：
```
← data: {"type":"meta","sessionId":"xxx"}
← data: {"type":"token","content":"你好"}
← data: {"type":"token","content":"，我是"}
← data: {"type":"token","content":"小助手"}
← data: {"type":"done","sessionId":"xxx"}
```

### 6.2 useDirectAI — 隐私模式直连

当隐私模式开启时，跳过服务器中转，直接从客户端调用 AI Provider API。

**特性**：
- 支持 OpenAI 兼容格式（Tongyi/DeepSeek/Zhipu/Moonshot/MiniMax/OpenAI/OpenCode）
- 支持 Anthropic Messages API 特殊格式
- 本地对话持久化（按 characterId 存储到 `tavern_local_chat_<characterId>`）
- 自定义 System Prompt 构建（角色设定 + 人设设定）
- `loadHistory()` 恢复历史对话

---

## 七、共享组件

| 组件 | 功能 | 使用场景 |
|---|---|---|
| **AppButton** | 4 变体按钮（primary/secondary/outline/ghost） | 全局通用 |
| **AppCard** | 通用卡片容器 | 全局通用 |
| **SectionHeader** | 区块标题（含可选的查看更多） | 页面分区 |
| **EmptyState** | 空状态占位（图标 + 标题 + 描述） | 列表为空 |
| **Icon** | SVG 图标系统（33 个图标，Feather 风格，支持 CSS 变量颜色） | 全局通用 |
| **Skeleton** | 4 类型骨架屏（list/card/text/custom） | 数据加载 |
| **CharacterCard** | 角色卡片（头像/名称/简介/标签） | 市场页/角色列表 |
| **ChatBubble** | 聊天气泡（user/character 角色区分） | 聊天页 |
| **ChatMarkdown** | Markdown 渲染（代码高亮/表格/列表） | Chat 页面 |
| **DesktopLoginModal** | 桌面版登录弹窗 | H5 页面 |
| **DesktopSidebar** | 桌面版侧边栏导航 | H5 页面 |
| **ModelSelector** | AI 模型选择器（21 个模型） | 聊天页设置 |
| **ThemeToggle** | 暗色/亮色主题切换开关 | Profile |
| **WebNavBar** | Web 导航栏 | H5 页面 |

---

## 八、双模式 TabBar

### 8.1 模式切换

```typescript
// CustomTabBar 组件通过 gameStore.gameMode 切换两种模式

// 酒馆模式（Tavern Mode）
tabList: [卡片集(cards), 酒馆(chat), 我的(profile)]

// 游戏模式（Game Mode）
tabList: [通信(chats), 通讯录(contacts), 发现(discover), 我的(profile)]
```

### 8.2 切换机制

1. `gameStore.enableGameMode()` / `disableGameMode()` 调用
2. 通过 `eventCenter.trigger('gameModeChange', boolean)` 广播
3. CustomTabBar 监听模式变更，更新 tab 列表并导航到第一个 tab
4. 导航方式：原生 tabBar 页面用 `switchTab`，游戏专属页面用 `reLaunch`

### 8.3 事件监听

| 事件 | 触发者 | 用途 |
|---|---|---|
| `gameModeChange` | gameStore | 模式切换时通知 TabBar |
| `tabChange` | 各页面 useDidShow | 页面显示时更新选中态 |
| `modalOverlayChange` | 模态弹窗 | 弹窗时隐藏 TabBar |

---

## 九、认证与数据流

### 9.1 认证流程

```
app.componentDidMount()
  → setTimeout → authStore.initialize()
    → Taro.getStorageSync('tavern_token')
    → 有 token → GET /auth/me
      → 成功 → 恢复登录态
      → 失败 → 清除 token → 显示登录提示
    → 无 token → 显示登录提示

app.componentDidShow()
  → authStore.isLoggedIn 时 → refreshQuota()
```

### 9.2 数据流

```
角色市场：
  market/index (useDidShow)
    → syncedCardsStore.syncCards()
      → officialService.getAll() (500ms 防抖)
      → 同步成功 → 持久化到 tavern_synced_cards
      → 失败 → 从 tavern_synced_cards 恢复缓存
    → localCardsStore.restoreFromStorage()
      → 从 tavern_local_cards 恢复本地卡片

聊天：
  chat/index
    → useSSE hook
    → POST /chat/send (enableChunked)
    → 逐 token 流式展示
    → 完成 → chatStore 管理会话

角色创建：
  creator/index
    → 已登录 → characterService.create() (服务器端存储)
    → 未登录 → localCardsStore.createCard() (本地存储降级)
```

---

## 十、类型系统

### 10.1 角色卡类型 (character.ts)

```typescript
type CardType = 'CHARACTER' | 'MECHANISM' | 'MAP' | 'BACKGROUND'

interface CharacterCard {
  id: string
  name: string
  avatar?: string | null
  description: string
  prompt?: string        // 对话提示
  scenario?: string     // 场景设定
  firstMsg?: string     // 开场白
  tags?: string[]
  cardType: CardType
  isOfficial: boolean
  status?: 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'BANNED'
  // ... likeCount, chatCount, favCount 等
}

interface LocalCard {
  id: string            // 格式: local_<timestamp>_<random>
  name: string
  cardType: CardType
  description: string
  prompt?: string
  scenario?: string
  firstMsg?: string
  tags?: string[]
  avatar?: string
  createdAt: number     // 时间戳（毫秒）
  updatedAt: number
}
```

### 10.2 聊天类型 (chat.ts)

```typescript
interface ChatMessage {
  id?: string
  sessionId?: string
  role: 'user' | 'character' | 'system'
  content: string
  tokens?: number
  createdAt?: string
}

interface ChatSession {
  id: string
  characterName?: string
  characterAvatar?: string
  lastMessage?: string
  messageCount?: number
  title?: string
  updatedAt?: string
  pinned?: boolean
  pinnedAt?: number      // 置顶时间戳（仅在 pinned=true 时有值）
  isGroup?: boolean
  memberIds?: string[]
}

interface SSEMessage {
  type: 'meta' | 'token' | 'done' | 'error'
  sessionId?: string
  characterId?: string
  content?: string
  messageId?: string
  tokens?: number
  code?: string
  message?: string
}
```

### 10.3 游戏模式类型 (game.ts)

```typescript
interface GameSave {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  playerCount: number
  selectedCards: {
    characters: string[]
    mechanics: string[]
    maps: string[]
    backgrounds: string[]
  }
  worldSetting: {
    title: string
    description: string
    rules: string[]
  }
  groups: GameGroup[]
}

interface GameGroup {
  id: string
  name: string
  memberIds: string[]
  isGroup: true
  lastMessage?: string
  updatedAt?: number
  pinned: boolean
  pinnedAt?: number     // 置顶时间戳
  _messages?: GameMessage[]
}

interface GameMessage {
  id: string
  senderId: string
  senderName: string
  content: string
  createdAt: number
}
```

### 10.4 通用类型 (common.ts)

```typescript
interface ApiResponse<T> {
  code: number          // 0 = success (tavern 约定)
  message: string
  data: T
}

interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

interface PaginationParams {
  page?: number
  pageSize?: number
}
```

### 10.5 人设类型 (character.ts)

```typescript
interface CharacterPersona {
  id: string
  name: string
  description: string
  avatar: string
}
```

---

## 十一、CSS 变量系统

全局样式定义在 `app.scss`，使用 CSS 变量实现 **温暖淡亮色主题**（奶油色系优雅风格），并完整支持 **暗色模式**。

### 亮色色板

| 类别 | 色值 | 用途 |
|---|---|---|
| 主色调 | `#C49A6C` 琥珀色 | 按钮、选中态、强调 |
| 辅色调 | `#7BADBF` 灰蓝 | 次要元素 |
| 背景色 | `#F5F0EB` 米白 | 页面背景 |
| 卡片背景 | `#FFFFFF` 纯白 | 卡片、Surface |
| 主要文字 | `#2D2A26` 深灰 | 正文 |
| 次要文字 | `#7A7570` 中灰 | 辅助文字 |

### 暗色模式

通过 `<html class="dark-mode">` 切换暗色模式，所有 CSS 变量自动映射到暗色色板。暗色模式下背景使用 `#0d1117`（GitHub 风格深色），文字使用 `#E6E1D9`（暖灰白）。颜色映射通过 `--color-*` CSS 变量统一处理，切换时无需修改组件代码。

触发方式：
- `app.scss` 提供 `dark-mode` class 控制，Profile 页面通过 `tavern_dark_mode` Storage key 持久化切换
- 使用 `Taro.eventCenter.trigger('darkModeChange', boolean)` 广播模式变更
- desktop 版自动跟随系统 `prefers-color-scheme: dark`

### 设计 Token 系统

```
--color-*     颜色系统（主色/辅色/中性色/语义色）
--font-*      字体系统（7 级字号 + 字重 + 行高）
--spacing-*   间距系统（10 级间距）
--radius-*    圆角系统（10 级圆角：xs/sm/base/md/lg/xl/round/pill/full/none）
--shadow-*    阴影系统（4 级阴影）
--transition-* 动画系统（3 级过渡 + 6 级时长）
--z-*         Z-Index 系统（7 级层级）
--glass-*     玻璃态效果
```

### 动画

内置 18 个 CSS 动画：fade-in/out, slide-up/down/left, scale-in/out, shimmer, pulse-soft, spin, blink-cursor, enter-message, ripple-press, spin-loading, pulse-loading, skeleton-shimmer, desktop-page-enter, profile-section-expand

### 工具类

内置丰富的工具类：text-*（颜色/字号/字重/对齐）、flex（弹性布局）、mt/mb/pt/pb/px（间距快捷类）、btn/card 基础类

---

## 十二、编译与构建配置

### 12.1 Taro 构建配置

- **设计稿宽度**: 750px（微信小程序标准）
- **输出目录**: `dist-weapp`（微信）/ `dist-h5`（H5）
- **编译器**: Webpack 5
- **CSS Modules**: 关闭（`enable: false`），但保留命名模式配置
- **插件**: `@tarojs/plugin-platform-weapp`, `@tarojs/plugin-platform-h5`, `@tarojs/plugin-framework-react`, `@tarojs/plugin-html`

### 12.2 API_BASE_URL 注入

通过 `domain.config.js`（项目根目录）在编译时注入：

```typescript
// config/index.ts
const apiBase = process.env.TARO_APP_API_BASE || 
  (mode === 'production' ? domain.TAVERN.PROD : domain.TAVERN.DEV)
```

也可通过环境变量覆盖：`set TARO_APP_API_BASE=https://xxx && taro build --type weapp`

### 12.3 TypeScript 配置

- 严格模式全部启用（`strict: true`, `noImplicitAny`, `strictNullChecks` 等）
- 额外检查：`noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`
- 路径别名：`@/*` → `./src/*`，另有 `@utils/*`, `@components/*`, `@services/*` 等

### 12.4 构建命令

```bash
npm run dev:weapp              # 微信小程序开发（watch）
npm run dev:weapp:local        # 本地 API 开发
npm run dev:weapp:remote       # 远程 API 开发
npm run build:weapp            # 微信小程序构建
npm run build:weapp:prod       # 微信小程序生产构建
npm run dev:h5                 # H5 开发（watch）
npm run dev:h5:local           # H5 本地 API 开发
npm run build:h5               # H5 构建
npm run build:h5:prod          # H5 生产构建
npm run type-check             # TypeScript 类型检查
npm run lint                   # ESLint 检查
npm run format                 # Prettier 格式化
npm run generate-icons         # 生成 tabBar 图标
```

---

## 十三、已知反模式与改进点

### 13.1 代码质量问题

| 问题 | 位置 | 说明 |
|---|---|---|
| ❌ console.log 残留 | `app.ts` | 启动时输出环境信息（可接受，但不是最佳实践） |
| ❌ 空 catch 块 | 多处 | authStore/localCardsStore 等多处 try/catch 静默忽略 |
| ❌ 错误日志不完整 | market/index.tsx | 部分错误未记录到 console |
| ❌ 类型不严谨 | marketService | 大量使用 `<T = unknown>` 泛型 |
| ✅ hooks/index.ts | `hooks/index.ts:1-4` | 已修复：正确导出所有 Hook（useSSE/useDirectAI/useResponsive） |
| ❌ 路径别名未完全使用 | 各处 | 部分 import 使用相对路径而非 `@/` 别名 |

### 13.2 架构优化点

| 项目 | 现状 | 建议 |
|---|---|---|
| **测试覆盖** | 零测试 | 至少为 stores 和 services 添加单元测试 |
| **错误边界** | 无 | 添加 React Error Boundary 包裹页面 |
| **离线支持** | 部分（localCards/localKeys） | 扩展离线缓存策略 |
| **性能优化** | 无 | 聊天消息列表虚拟化、图片懒加载 |
| **状态持久化** | 手动管理 | 引入 Zustand 中间件 `persist` |
| **H5 兼容** | 基础可用 | 需验证 H5 下 SSE 和微信特有 API 的降级 |
| **eslint 配置** | 使用 taro 默认 | 增加自定义规则统一风格 |

### 13.3 功能规划

| 功能 | 优先级 | 说明 |
|---|---|---|
| **多语言支持** | 低 | i18n 国际化 |
| **角色图片上传** | 中 | 支持用户上传自定义头像 |
| **聊天记录搜索** | 中 | 本地搜索历史消息 |
| **主题切换** | ✅ 已完成 | 暗色模式切换已实现（CSS 变量 + Storage 持久化） |
| **通知推送** | 中 | 微信订阅消息通知 |
| **语音输入** | 低 | 微信语音输入转文字 |
| **批量删除会话** | 低 | 多选删除聊天会话 |
| **导出聊天记录** | 低 | 导出为文本/JSON |

---

## 十四、开发规划

### 14.1 近期计划（Sprint 1-2）

- [ ] 添加单元测试（vitest + @testing-library/react）
- [ ] 补全错误处理（所有 catch 块至少输出日志）
- [ ] 统一路径别名为 `@/` 风格
- [ ] 添加 React Error Boundary

### 14.2 中期计划（Sprint 3-4）

- [ ] 引入 Zustand persist 中间件简化持久化
- [ ] 聊天消息虚拟化（长列表优化）
- [ ] H5 平台兼容性完善（SSE、微信特有 API 降级）
- [ ] 图片上传功能

### 14.3 长期规划

- [ ] 性能优化与监控
- [ ] 多语言支持
- [ ] 通知推送接入

---

## 十五、相关文档

| 文档 | 位置 |
|---|---|
| Tavern 后端 API | `docs/apps/tavern/server/` |
| 项目架构总览 | `docs/ARCHITECTURE.md` |
| 数据库 Schema | `prisma/schema-ai-tavern.prisma` |
| 部署配置 | `deploy/` |
| 微信小程序开发工作流 | `AGENTS.md` (根) → mp-automator |

---

## 十六、附录

### 16.1 角色卡卡片类型说明

| 类型 | 说明 | 示例 |
|---|---|---|
| `CHARACTER` | 角色卡 | 勇者、商人、猫娘 |
| `MECHANISM` | 机制卡 | 战斗系统、交易规则 |
| `MAP` | 地图卡 | 森林、城堡、地下城 |
| `BACKGROUND` | 背景卡 | 中世纪、科幻、奇幻世界观 |

### 16.2 用户 Tier 系统

| Tier | 说明 | 每日配额 | 限制 |
|---|---|---|---|
| FREE | 免费用户 | ~20 条 | 最大 3 会话/5 角色/2 人设 |
| PAID | 付费用户 | ~100 条 | 较高上限 |
| TESTER | 测试用户 | 无限制 | 完全访问 |

### 16.3 Storage Key 清单

| Key | Store | 类型 |
|---|---|---|
| `tavern_token` | authStore | JWT access token |
| `tavern_refresh_token` | authStore | JWT refresh token |
| `tavern_selected_model` | chatStore | 模型选择 |
| `tavern_selected_provider` | chatStore | Provider 选择 |
| `tavern_saves` | gameStore | 游戏存档列表 |
| `tavern_active_save_id` | gameStore | 当前活跃存档 ID |
| `tavern_privacy_mode` | privacyStore | 隐私模式开关 |
| `tavern_local_api_keys` | privacyStore | 本地 API Key 缓存 |
| `tavern_local_cards` | localCardsStore | 本地角色卡 |
| `tavern_synced_cards` | syncedCardsStore | 官方同步卡片 |
| `tavern_local_chat_<id>` | useDirectAI | 直连模式对话历史 |
| `tavern_dark_mode` | themeStore | 暗色模式开关 |
| `tavern_cards_per_row` | gameStore | 卡片每行显示数量 |

---

> **最后更新**: 2026-05-29
> **修改**: 侧边栏"开始"→"酒馆"、路由同步至 */tavern、移除卡片集返回按钮、Profile 按钮尺寸调整、全宽布局、搜索居中对齐、卡片子标签风格对齐、Creator 服务端保存、下拉菜单溢出修复、硬编码颜色替换为 CSS 变量
