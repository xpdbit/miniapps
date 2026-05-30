# AI-Tavern 设计文档

> **状态**: current
> **更新**: 2026-05-29
>
> 本文档记录 AI-Tavern 的高层设计决策、架构理念与核心权衡。
> 实现细节见 `client/README.md`、`server/README.md`、`server/API.md`。

---

## 一、产品定位与愿景

AI-Tavern 是一个 **AI 驱动的角色扮演聊天应用**，以"酒馆"为隐喻——用户在此遇见角色、开启对话、编织故事。

### 核心价值主张

| 维度 | 描述 |
|------|------|
| **沉浸式角色扮演** | AI 角色拥有独立设定、性格、对话风格与背景故事，非模板化应答 |
| **双模式体验** | 酒馆模式（自由聊天 + 角色市场）与游戏模式（TRPG 风格存档系统），满足轻度与重度用户 |
| **隐私优先** | 提供隐私模式，AI 请求绕过服务端中转，用户自行管理 API Key |
| **开放 Provider** | 支持 12 个 AI Provider，用户可自由选择模型，不被锁定 |
| **角色 UGC 生态** | 用户创建、发布、分享角色卡，形成内容社区 |

### 目标用户

- **轻度用户**：浏览角色市场，与感兴趣的角色闲聊，体验 AI 对话趣味
- **重度用户**：创建自定义角色卡，设计世界观，进行类 TRPG 的多角色群聊
- **创作者**：设计角色卡发布到市场，获得社区反馈（点赞/收藏/聊天数）

### 与通用聊天 AI 的差异

| | 通用 AI 聊天 | AI-Tavern |
|---|---|---|
| 对话对象 | 单一 AI 助手 | 可切换的具名角色（每个有独立人格） |
| 上下文 | 无预设世界 | 角色设定 + 场景设定 + 世界观 |
| 内容生态 | 无 | 角色市场 + UGC 发布审核 |
| 游戏化 | 无 | 游戏存档 / 群组 / 世界构建 |

---

## 二、系统架构概览

### 2.1 三层架构

```
┌──────────────────────────────────────────────────────────────┐
│                    客户端层 (Taro 4.x + React 18)              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
│  │ 微信小程序 │  │ H5 Web   │  │ Zustand  │  │ SSE / 直连  │  │
│  │ (WeApp)  │  │ (5174)   │  │ Store×9  │  │ AI Client   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘  │
│       └──────────────┴────────────┴────────────────┘         │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTPS (JWT Bearer)
┌───────────────────────────┴──────────────────────────────────┐
│                    服务端层 (Express + TypeScript)              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
│  │ 15 Routes│  │15 Services│  │Middleware│  │ AI Proxy    │  │
│  │ /api/v1/*│  │          │  │(Auth/Zod)│  │ (多Provider)│  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘  │
│       └──────────────┴────────────┴────────────────┘         │
│                            │                                   │
│  ┌─────────────────────────┼───────────────────────────────┐  │
│  │   MySQL 8.0 (Prisma, 13表)  │  Redis 7 (缓存/限流)       │  │
│  └─────────────────────────────┴───────────────────────────┘  │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────┴──────────────────────────────────┐
│                    AI Provider 层 (外部)                       │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐     │
│  │Tongyi│ │OpenAI│ │Deep- │ │Anth- │ │Google│ │Zhipu │ ...  │
│  │(免费)│ │      │ │Seek  │ │ropic │ │      │ │      │     │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘     │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 客户端双平台策略

| 平台 | 入口 | 认证方式 | 特殊适配 |
|------|------|----------|----------|
| 微信小程序 | 微信内打开 | `wx.login()` → JWT | 原生 TabBar / 订阅消息 |
| H5 Web | 浏览器访问 :5174 | 账号密码登录 | Desktop 侧边栏 / WebNavBar / 暗色跟随系统 |

**设计原则**：核心逻辑（Store/Service/Hook）平台无关，仅在页面层做平台判断（`Taro.getEnv()`）。认证层通过 `authStore` 统一抽象，微信登录按钮在 H5 自动隐藏。

### 2.3 Dashboard 管理后台集成

Tavern 服务端通过 `/api/v1/admin/*` 提供管理 API，Dashboard 通过 **tavern-proxy** 代理访问：

```
Dashboard (React 19 + Ant Design)
  └── tavern-proxy → Tavern Server (port 3002)
        └── /api/v1/admin/*
              ├── 角色审核 (pending/approve/reject/ban)
              ├── 密钥审计 (keys)
              ├── 角色导入 (import/export)
              └── AI 配置管理 (AiManager: Provider/Key/URL/QPS/权重)
```

### 2.4 数据流向总览

```
用户操作 → 客户端 (Store → Service → httpClient)
              │
    ┌─────────┴──────────┐
    │                    │
    ▼                    ▼
服务端中转              隐私模式直连
(POST /chat/send)      (aiClient 直连 Provider)
    │                    │
    ▼                    ▼
ai-proxy.service       AI Provider API
    │                    │
    ▼                    ▼
SSE 流式返回           流式响应
    │                    │
    ▼                    ▼
useSSE Hook 解析       useDirectAI Hook 解析
    │                    │
    └─────────┬──────────┘
              ▼
        ChatBubble 渲染（逐 token 追加）
```

---

## 三、核心设计决策

### 3.1 技术选型权衡

| 决策 | 选择 | 理由 | 放弃方案 |
|------|------|------|----------|
| **跨平台框架** | Taro 4.x | 一套代码覆盖微信 + H5；项目已有 FTG/Game1 经验 | uni-app（生态不如 Taro）、原生双端（维护成本高） |
| **状态管理** | Zustand 5 | 轻量（<1KB）、无 Provider 包裹、支持 selector 精确重渲染 | Redux（模板代码多）、MobX（本项目其他子项目使用，但 Tavern 状态模型较简单） |
| **流式通信** | SSE (enableChunked) | 微信小程序 Taro.request 原生支持；比 WebSocket 更简单，无需心跳维护 | WebSocket（小程序支持有限）、Polling（延迟高） |
| **数据库** | MySQL + Prisma | 与 FTG/Game1 统一技术栈，运维成本低 | MongoDB（非关系型不适合角色关系）、PostgreSQL（已有 MySQL 基础设施） |
| **缓存** | Redis 7 (ioredis) | AI Provider 配置热更新 + 限流滑动窗口 | 内存缓存（多进程不共享）、无缓存（每次查 DB 性能差） |
| **API Key 加密** | AES-256-GCM | 认证加密模式，防篡改；密钥派生自环境变量 | 明文存储（安全风险）、RSA（密钥管理复杂） |
| **暗色模式** | CSS 变量 + class 切换 | 零运行时开销；一个 class 切换所有颜色 | JS 动态样式（性能差）、CSS-in-JS（不适用 Taro） |

### 3.2 路由设计原则

- **客户端路由**：Taro Pages 配置，12 页面。TabBar 页面 3 个（market/chat/profile），游戏模式页面 3 个（chats/contacts/discover）通过 CustomTabBar 管理
- **H5 路由**：hash 模式，自定义路径映射（如 `/pages/market/index` → `/market`）
- **API 路由**：所有接口挂载 `/api/v1`，按资源模块划分（auth/chat/characters/market/admin 等）

### 3.3 错误处理策略

| 层级 | 策略 |
|------|------|
| **客户端 HTTP** | httpClient 统一拦截：超时→友好提示，401→自动登出，网络错误→重试提示 |
| **SSE 流式** | 支持 `error` 事件类型，含 code+message；断线由 EventSource 自动重连 |
| **服务端** | Zod 参数校验 → 400；业务异常 → 统一 ApiResponse 格式；未捕获 → 全局错误中间件 |
| **AI 调用** | 超时 60s；Provider 不可用 → 自动尝试其他 Provider（仅限系统免费 Provider） |

---

## 四、双模式架构

### 4.1 设计动机

酒馆模式满足"浏览-聊天"的线性体验；游戏模式满足"策划-扮演"的深度体验。两种模式的用户心智模型不同，强行合并会导致 UI 混乱。

### 4.2 模式定义

| 模式 | Tab 列表 | 核心流程 | 数据存储 |
|------|----------|----------|----------|
| **酒馆模式** | 卡片集 / 酒馆 / 我的 | 浏览角色 → 开启对话 → 流式聊天 | 服务端（ChatSession/ChatMessage） |
| **游戏模式** | 通信 / 通讯录 / 发现 / 我的 | 选择角色卡 → 设定世界观 → 群组对话 | 客户端 localStorage（GameSave） |

### 4.3 切换机制

```
gameStore.enableGameMode()
  → gameStore.gameMode = true
  → Taro.eventCenter.trigger('gameModeChange', true)
    → CustomTabBar 监听到事件
      → 更新 tabList 为游戏模式 tabs
      → Taro.reLaunch 到 chats 页面
```

**设计要点**：
- 模式切换使用 `reLaunch`（清空页面栈），避免两种模式的页面混在一起
- 原生 tabBar 页面（market/chat/profile）始终在配置中，通过 `Taro.showTabBar`/`hideTabBar` 控制可见性
- 游戏模式页面使用 `custom: true` 标记，走 CustomTabBar 渲染

### 4.4 数据隔离

```
酒馆模式数据（服务端）
  ├── ChatSession (Prisma)     ← 用户与角色的 1v1 对话
  ├── ChatMessage (Prisma)     ← 消息历史
  └── authStore.quota          ← 每日配额

游戏模式数据（客户端 localStorage）
  ├── GameSave                 ← 存档（含世界设定/选卡/群组）
  ├── GameGroup                ← 群组（含角色成员）
  └── GameMessage              ← 群组内消息（纯本地，不走 AI）
```

**为什么游戏存档存客户端？**
- 游戏存档的复杂度高（嵌套选卡/世界设定/多群组），不适合关系型扁平存储
- 存档数据不需要跨设备同步（目标场景是单设备沉浸体验）
- 后期可扩展为云端存档（上传整个 JSON blob）

---

## 五、AI 多 Provider 架构

### 5.1 统一抽象层

`ai-proxy.service.ts` 是 AI 调用的唯一入口：

```
ai-proxy.service
  ├── streamChat()        SSE 流式聊天（主要路径）
  ├── generateText()      非流式文本生成
  └── generateJSON()      JSON 结构化生成
         │
         ▼
  Provider Adapter 层（按 provider 动态选择）
  ├── tongyi    → DashScope API
  ├── opencode  → OpenCode Go API
  ├── openai    → OpenAI Chat Completions
  ├── deepseek  → DeepSeek API
  ├── anthropic → Anthropic Messages API
  ├── google    → Gemini API
  ├── zhipu     → 智谱 GLM API
  ├── moonshot  → 月之暗面 API
  ├── minimax   → MiniMax API
  └── openrouter→ OpenRouter API
```

### 5.2 Provider 配置降级链路

AI Provider 配置（Key/URL/模型/QPS）由 Dashboard 的 AiManager 页面统一管理：

```
Dashboard AiManager 页面 (管理员修改)
       │ POST /admin/ai/providers
       ▼
Tavern 服务端 config-provider.service
       │
       ├── ① 写 Redis (ai:providers, TTL 5min)  ← 主缓存
       │       │ 不可用
       │       ▼
       ├── ② 内存缓存 (60s 轮询)                ← 降级
       │       │ 为空
       │       ▼
       └── ③ Env 种子 (tongyi/opencode/deepseek) ← 兜底
```

**设计意义**：Dashboard 修改实时生效（Redis 推送），无需重启服务端；多层降级确保即使在 Dashboard 或 Redis 不可用时，用户仍可使用内置免费模型。

### 5.3 免费配额模型

| Provider | 类型 | 每日额度 | 模型 |
|----------|------|----------|------|
| tongyi (通义千问) | 系统免费 | 20 次/天 | qwen-turbo, qwen-plus |
| opencode | 系统免费 | 20 次/天 | qwen-turbo |
| 其他 (OpenAI/DeepSeek 等) | 用户自配 Key | 无限制（取决于用户自己的 API 配额） | 用户选择的模型 |

**设计原则**：系统提供基础免费额度保证可玩性（降低新用户门槛），但重度使用需要用户自行配置 API Key（控制服务成本）。

### 5.4 隐私模式架构

```
正常模式：Client → Tavern Server → AI Provider
隐私模式：Client → AI Provider (直连)
```

| 维度 | 正常模式 | 隐私模式 |
|------|----------|----------|
| 数据路径 | 用户消息 → 服务端 → AI | 用户消息 → AI 直连 |
| API Key 存储 | 服务端 AES-256-GCM 加密 | 客户端 localStorage |
| 消息存储 | 服务端 ChatMessage 表 | 客户端 `tavern_local_chat_<id>` |
| 模型选择 | Profile 页面选择 | Profile 页面选择 |
| 适用场景 | 日常使用、多设备同步 | 敏感对话、隐私优先用户 |

**为什么提供两种模式？**
- 正常模式：服务端可做 Prompt 增强、内容审核、用量统计，适合大多数用户
- 隐私模式：用户可完全掌控数据，AI 对话不经任何第三方服务器，适合对隐私敏感的用户

### 5.5 AI Script 事件驱动系统

AI Script 系统允许 AI 角色在聊天中触发游戏世界事件（如移动位置、修改属性、推进时间）：

```
AI 回复 → 解析 Script 标记 → ScriptEngine 处理
  │
  ├── character.move       → 更新角色位置
  ├── stat.modify          → 修改角色属性
  ├── world.advance_time   → 推进世界时间
  ├── item.add / remove    → 物品系统
  ├── dialogue.trigger     → 触发预设对话
  └── quest.*              → 任务系统交互
```

**事件注册表**（14 种事件类型）定义在 `src/types/ai-script.ts`，GameStateStore 管理内存世界状态，支持事件溯源重建。

**Scenario 剧本系统**是 AI Script 的上层封装：通过 JSON 剧本文件预定义世界观、角色、事件规则，AI 在对话中按剧本设定生成内容。剧本存储在 `scenarios/builtin/`（内置）和 `scenarios/custom/`（用户自定义）。

---

## 六、角色卡系统设计

### 6.1 四种卡片类型的哲学

| 类型 | 隐喻 | 示例 | 在 Prompt 中的作用 |
|------|------|------|-------------------|
| **CHARACTER** | 演员 | 勇者、商人、猫娘 | 定义"谁在说话"——人格、语气、知识背景 |
| **MECHANISM** | 规则书 | 战斗系统、交易规则 | 定义"世界怎么运转"——AI 行为约束 |
| **MAP** | 舞台 | 森林、城堡、地下城 | 定义"在哪里"——空间关系、环境描述 |
| **BACKGROUND** | 世界观 | 中世纪奇幻、赛博朋克 | 定义"时代的底色"——科技水平、社会结构 |

**设计哲学**：借鉴 TRPG 的分层设计。角色提供"人格"，机制提供"规则"，地图提供"空间"，背景提供"语境"。四者组合可构建丰富的叙事场景。

### 6.2 数据源三层模型

```
角色卡片数据来源
  ├── 官方同步卡片 (syncedCardsStore)
  │     └── 从服务端 /official/all 拉取，500ms 防抖，持久化到 Storage
  ├── 远程角色卡 (characterStore)
  │     └── 从服务端 /characters CRUD，需要登录
  └── 本地角色卡 (localCardsStore)
        └── 纯客户端创建，ID 格式 local_<timestamp>_<random>
```

**降级策略**：
- 网络可用 → 优先使用远程数据
- 网络不可用 → 从 localStorage 恢复缓存
- 未登录 → 仅显示官方同步卡 + 本地卡

### 6.3 审核发布流程

```
用户创建角色 (DRAFT)
  → 发布 → PENDING (进入审核队列)
    → 管理员 APPROVE → PUBLISHED (市场可见)
    → 管理员 REJECT → DRAFT (退回修改，附原因)
    → 管理员 BAN → BANNED (封禁，市场不可见，已收藏用户仍可见)
```

**设计要点**：
- `status` 字段控制角色卡在市场中的可见性
- 审核日志 (`ModerationLog`) 记录所有操作，支持审计回溯
- 批量审核（`batch-approve`）提高管理员效率

---

## 七、安全与隐私模型

### 7.1 认证体系

```
微信小程序：wx.login() → code → POST /auth/wechat/login → JWT
H5 Web：    账号+密码  → POST /auth/login → JWT

JWT 结构：
{
  sub: user.uuid,       // 用户唯一标识（非自增 ID）
  role: "USER"|"ADMIN",
  iat, exp
}
```

- **Refresh Token**：长期有效，用于静默续期
- **Token 存储**：`tavern_token` / `tavern_refresh_token` 持久化到 Taro Storage
- **401 处理**：httpClient 自动拦截，清除 token 并跳转登录

### 7.2 API Key 安全

```
存储：PBKDF2(Salt + ENV_SECRET) → 派生密钥 → AES-256-GCM 加密 → DB
传输：HTTPS + JWT 认证
响应：不返回原始密钥（masked: "sk-****abc"）

加密流程：
1. 用户提交 API Key
2. 服务端校验 Key 有效性（调用对应 Provider API）
3. 使用 AES-256-GCM 加密后存入 ApiKey 表
4. 响应中返回加密后的 ID，不返回明文
5. 使用时：从 DB 读取 → 解密 → 注入 ai-proxy 请求 → 用完即弃
```

### 7.3 隐私模式安全边界

| 安全边界 | 正常模式 | 隐私模式 |
|----------|----------|----------|
| API Key 存储位置 | 服务端 DB（加密） | 客户端 localStorage |
| 消息内容可见者 | 用户 + 服务端 | 用户 + AI Provider |
| 消息加密 | HTTPS 传输加密 | HTTPS 传输加密 |
| 风险 | 服务端被攻击 → Key 泄露（但已加密） | 本地设备丢失 → Key 泄露 |

**设计权衡**：隐私模式牺牲了服务端的 Prompt 增强和审核能力，换取了用户完全控制权。这是"自由 vs 安全"的经典权衡——两种模式都提供，让用户自己选择。

### 7.4 内容审核双机制

```
发布内容
  ├── ① 自动敏感词过滤（config/sensitive-words.ts）
  │      └── 命中 → 拒绝发布
  └── ② 人工审核（admin routes）
         ├── APPROVE → 上架市场
         ├── REJECT → 退回修改
         └── BAN → 封禁
```

用户可举报三种类型的目标（card/user/message），管理员在 Dashboard 处理。

---

## 八、设计 Tokens 与视觉系统

### 8.1 设计语言

以"温暖琥珀色"为主色调的**淡亮色主题**，灵感来源于中世纪酒馆的烛光与木质色调。

### 8.2 色板系统

| Token | 亮色 | 暗色 | 用途 |
|-------|------|------|------|
| `--color-primary` | `#C49A6C` 琥珀 | `#D4A574` 暖金 | 主按钮、选中态 |
| `--color-secondary` | `#7BADBF` 灰蓝 | `#8DB5C0` 浅灰蓝 | 次要元素、链接 |
| `--color-bg` | `#F5F0EB` 米白 | `#0d1117` 深黑 | 页面背景 |
| `--color-surface` | `#FFFFFF` 纯白 | `#161b22` 深灰 | 卡片、弹窗 |
| `--color-text-primary` | `#2D2A26` 深棕 | `#E6E1D9` 暖白 | 正文 |
| `--color-text-secondary` | `#7A7570` 灰棕 | `#8B949E` 中灰 | 辅助文字 |

### 8.3 暗色模式切换

```
触发方式：
├── Profile 页面 Toggle 按钮（手动，持久化到 tavern_dark_mode）
├── Desktop 自动跟随 prefers-color-scheme（仅 H5）
└── Storage 初始化时恢复

实现：<html class="dark-mode"> 切换，所有组件通过 CSS 变量自动适配
```

### 8.4 设计 Token 体系

| 类别 | Token 前缀 | 层级数 | 示例 |
|------|-----------|--------|------|
| 颜色 | `--color-*` | 30+ | primary, secondary, bg, surface, text-*, semantic-* |
| 字体 | `--font-*` | 7 级字号 + 字重 + 行高 | `--font-xs` ~ `--font-2xl` |
| 间距 | `--spacing-*` | 10 级 | `--spacing-xs`(4px) ~ `--spacing-3xl`(48px) |
| 圆角 | `--radius-*` | 10 级 | `--radius-sm`(4px) ~ `--radius-pill`(999px) |
| 阴影 | `--shadow-*` | 4 级 | `--shadow-sm` ~ `--shadow-xl` |
| 动画 | `--transition-*` | 3 级过渡 + 6 级时长 | `--transition-base`(200ms ease) |
| 层级 | `--z-*` | 7 级 | `--z-dropdown`(100) ~ `--z-modal`(1000) |
| 玻璃态 | `--glass-*` | 5 级 | `--glass-bg`, `--glass-blur` |

### 8.5 动画系统

18 个内置 CSS 动画：
- **入场**：fade-in, slide-up/down/left/right, scale-in, desktop-page-enter, profile-section-expand
- **退场**：fade-out, scale-out
- **反馈**：shimmer（闪烁加载）, pulse-soft（柔和脉冲）, ripple-press（点击波纹）
- **加载**：spin, spin-loading, pulse-loading, skeleton-shimmer
- **聊天**：blink-cursor, enter-message

### 8.6 响应式策略

| 断点 | 布局 | 导航 |
|------|------|------|
| < 768px (移动端) | 单列全宽 | CustomTabBar（底部） |
| ≥ 768px (Desktop) | DesktopSidebar + 内容区 | 侧边栏导航 + WebNavBar |

Desktop 模式通过 `useResponsive` Hook 检测，组件条件渲染 `DesktopSidebar`/`DesktopLoginModal`/`WebNavBar`。

---

## 九、已知技术债务与演进方向

### 9.1 当前反模式

| 问题 | 影响 | 优先级 |
|------|------|--------|
| 零测试覆盖 | 回归风险高 | 🔴 高 |
| 空 catch 块静默忽略错误 | 线上问题难以排查 | 🔴 高 |
| 部分路径使用相对 import（非 `@/` 别名） | 重构时易遗漏 | 🟡 中 |
| chatStore 与 useSSE 模型默认值不一致 | 首次用户体验不稳定 | 🟡 中 |
| 无 React Error Boundary | 运行时错误导致白屏 | 🟡 中 |
| 手动 Storage 持久化（未用 Zustand persist 中间件） | 持久化逻辑分散 | 🟢 低 |
| 客户端断开检测未实现（`chat.ts:149`） | SSE 资源泄漏 | 🟢 低 |

### 9.2 近期优化路线（Sprint 1-2）

1. 添加单元测试（vitest + @testing-library/react）
2. 补全 catch 块错误日志
3. 添加 React Error Boundary
4. 统一 import 为 `@/` 别名

### 9.3 中期演进（Sprint 3-4）

1. 引入 Zustand `persist` 中间件
2. 聊天消息列表虚拟化（长列表性能优化）
3. H5 SSE 兼容性完善
4. 图片上传功能

### 9.4 长期愿景

- **性能监控**：接入性能打点，追踪 AI 调用延迟和 SSE 流式质量
- **多语言**：i18n 国际化
- **推送通知**：微信订阅消息
- **云端游戏存档**：将 localStorage 存档迁移至服务端（JSON blob 存储）
- **语音交互**：微信语音输入 → ASR → AI 对话 → TTS 输出

---

## 十、附录

### A. 文档索引

| 文档 | 位置 | 内容 |
|------|------|------|
| 客户端实现细节 | `docs/apps/tavern/client/README.md` | 页面/Store/Service/Hook 完整说明 |
| 服务端实现细节 | `docs/apps/tavern/server/README.md` | 路由/服务/数据库结构 |
| API 参考 | `docs/apps/tavern/server/API.md` | 所有端点、参数、响应格式 |
| 系统架构总览 | `docs/ARCHITECTURE.md` | 多项目架构关系 |
| AI Script 设计 | `plan/specs/tavern-ai-script-design.md` | AI Script 事件系统规格 |
| Scenario 系统设计 | `plan/specs/tavern-scenario-system-design.md` | 弹性剧本系统规格 |
| 数据库 Schema | `apps/tavern/server/prisma/schema.prisma` | 13 表完整定义 |

### B. 术语表

| 术语 | 定义 |
|------|------|
| **角色卡 (Character Card)** | 定义一个 AI 角色的完整信息：名称、头像、人设、场景、开场白等 |
| **卡片类型 (CardType)** | CHARACTER / MECHANISM / MAP / BACKGROUND 四种角色卡分类 |
| **人设 (Persona)** | 用户自定义的"自我设定"，在对话中作为 user 侧的背景信息注入 Prompt |
| **酒馆模式** | 默认模式：浏览角色 → 开始对话 → 流式聊天 |
| **游戏模式** | TRPG 模式：创建存档 → 选择角色卡组合 → 设定世界观 → 群组对话 |
| **隐私模式** | AI 请求绕过服务端中转，客户端直连 AI Provider |
| **Provider** | AI 服务提供商（如 OpenAI、DeepSeek、通义千问） |
| **SSE** | Server-Sent Events，服务端向客户端推送流式数据的协议 |
| **Tier** | 用户等级（FREE/PAID/TESTER），控制每日配额和功能限制 |
| **AI Script** | AI 驱动的事件系统，允许 AI 角色在聊天中触发游戏世界事件 |
| **Scenario** | 预设的剧本文件（JSON），定义世界观、角色、事件规则 |
| **配额 (Quota)** | 用户每日可用的免费 AI 调用次数 |

---

> **最后更新**: 2026-05-29
> **编写依据**: `ARCHITECTURE.md` + `client/README.md` + `server/README.md` + `server/API.md` + `AGENTS.md` + 实际代码结构
