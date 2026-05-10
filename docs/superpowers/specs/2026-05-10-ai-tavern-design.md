# AI 酒馆 (AI Tavern) 设计文档

> **项目状态**: 设计阶段 — 待实现
> **日期**: 2026-05-10
> **参考**: SillyTavern / TavernAI 角色扮演聊天概念

---

## 1. 项目概述

### 1.1 一句话定义
AI 酒馆是一款微信小程序，用户可以在社区市场中发现、创建 AI 角色卡，并与角色进行沉浸式 AI 对话/角色扮演。

### 1.2 核心定位
社区型角色卡市场 + AI 聊天，类似 Character.AI 的轻量化版本，但更聚焦于"角色卡"的创作、分享和社交。

### 1.3 核心目标
- 用户可浏览/搜索社区公开的角色卡
- 用户可创建自己的角色卡（可视化编辑器）
- 用户可与角色卡进行多轮 AI 对话（流式打字机效果）
- 用户可管理自己的 Persona（扮演的角色）
- 创作者可将角色卡公开到社区市场
- 支持社交互动：点赞、收藏、关注创作者
- 混合模型模式：用户自带 API Key 或使用平台免费额度

---

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────┐
│               AI 酒馆小程序 (Taro + React)            │
│  ┌─────────┐  ┌──────────┐  ┌────────┐  ┌────────┐ │
│  │ 聊天页   │  │ 角色市场  │  │ 创作工具 │  │ 个人中心 │ │
│  │ chat    │  │ market   │  │ creator │  │ profile │ │
│  └────┬────┘  └────┬─────┘  └────┬───┘  └────┬───┘ │
│       │            │             │            │      │
│  ┌────┴────────────┴─────────────┴────────────┴───┐ │
│  │              服务层 (services/)                  │ │
│  │  chatService / characterService / marketService │ │
│  └────────────────────┬───────────────────────────┘ │
└───────────────────────┼─────────────────────────────┘
                        │ HTTP/SSE
┌───────────────────────┼─────────────────────────────┐
│            AI 酒馆 Server (Express + Prisma)          │
│  ┌────────────────────┴───────────────────────────┐ │
│  │               路由层 (routes/)                   │ │
│  │  auth | characters | chat(SSE) | market |      │ │
│  │  personas | keys | admin                       │ │
│  └────────────────────┬───────────────────────────┘ │
│  ┌────────────────────┴───────────────────────────┐ │
│  │               服务层 (services/)                 │ │
│  │  ┌──────────────┐  ┌───────────────────────┐   │ │
│  │  │ ai-proxy     │  │ context.service       │   │ │
│  │  │ 模型路由+调用  │  │ Prompt拼装+上下文管理  │   │ │
│  │  └──────┬───────┘  └───────────────────────┘   │ │
│  │  ┌──────────────┐  ┌───────────────────────┐   │ │
│  │  │ character    │  │ moderation.service    │   │ │
│  │  │ 角色卡业务    │  │ 内容安全审核           │   │ │
│  │  └──────────────┘  └───────────────────────┘   │ │
│  └────────────────────┬───────────────────────────┘ │
│  ┌────────────────────┴───────────────────────────┐ │
│  │              数据层                             │ │
│  │  Prisma ORM → MySQL | Redis (会话缓存)          │ │
│  └────────────────────────────────────────────────┘ │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────┼─────────────────────────────┐
│         AI 模型 API（外部）                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ 通义千问  │  │ DeepSeek │  │ OpenAI / Claude  │  │
│  │ (平台)   │  │ (用户Key) │  │ (用户Key)         │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 2.2 Monorepo 项目结构

```
.miniapps/
├── apps/
│   ├── ai-tavern-miniapp/         ← 新增
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── chat/           ← 聊天对话页
│   │   │   │   ├── market/         ← 角色卡市场/浏览
│   │   │   │   ├── character/      ← 角色详情
│   │   │   │   ├── creator/        ← 角色卡创建/编辑
│   │   │   │   ├── profile/        ← 用户主页
│   │   │   │   ├── persona/        ← Persona 管理
│   │   │   │   └── settings/       ← 设置/API Key
│   │   │   ├── components/
│   │   │   │   ├── ChatBubble/     ← 聊天气泡（支持流式渲染）
│   │   │   │   ├── CharacterCard/  ← 角色卡展示卡片
│   │   │   │   ├── ModelSelector/  ← 模型选择器
│   │   │   │   ├── TagPicker/      ← 标签选择器
│   │   │   │   └── ...
│   │   │   ├── services/
│   │   │   │   ├── httpClient.ts   ← 统一 HTTP 封装
│   │   │   │   ├── chatService.ts  ← 聊天 SSE 调用
│   │   │   │   ├── characterService.ts
│   │   │   │   └── marketService.ts
│   │   │   ├── stores/
│   │   │   │   ├── authStore.ts
│   │   │   │   ├── chatStore.ts
│   │   │   │   └── characterStore.ts
│   │   │   ├── hooks/
│   │   │   │   └── useSSE.ts       ← SSE 流式读取 Hook
│   │   │   ├── types/
│   │   │   │   ├── character.ts
│   │   │   │   ├── chat.ts
│   │   │   │   └── common.ts
│   │   │   └── app.ts             ← 应用入口
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── ftg-miniapp/               ← 已有
│   └── game1-miniapp/             ← 已有
├── servers/
│   ├── ai-tavern-server/           ← 新增
│   │   ├── src/
│   │   │   ├── index.ts           ← 入口
│   │   │   ├── app.ts             ← Express 配置
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts        ← 微信登录
│   │   │   │   ├── characters.ts  ← 角色卡 CRUD
│   │   │   │   ├── chat.ts        ← AI 对话（SSE）
│   │   │   │   ├── market.ts      ← 社区市场
│   │   │   │   ├── personas.ts    ← Persona
│   │   │   │   ├── keys.ts        ← API Key
│   │   │   │   └── admin.ts       ← 管理接口
│   │   │   ├── services/
│   │   │   │   ├── ai-proxy.service.ts
│   │   │   │   ├── context.service.ts
│   │   │   │   ├── character.service.ts
│   │   │   │   ├── market.service.ts
│   │   │   │   └── moderation.service.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   └── rateLimit.ts
│   │   │   └── utils/
│   │   │       └── promptBuilder.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── package.json
│   ├── ftg-server/                ← 已有
│   └── game1-server/              ← 已有
├── dashboard/                     ← 已有，增加 AI 酒馆管理模块
│   └── src/pages/ai-tavern/       ← 新增管理页面
└── deploy/                        ← 已有，扩展配置
```

### 2.3 技术栈

| 层 | 技术 | 备注 |
|----|------|------|
| 小程序 | Taro 4.x + React 18 + TypeScript | 与 FTG 保持一致 |
| 状态管理 | Zustand | 与现有项目一致 |
| HTTP | Taro.request + SSE 流式读取 | |
| 后端 | Express + TypeScript | 与现有项目一致 |
| ORM | Prisma | 与现有项目一致 |
| 数据库 | MySQL 8.0 + Redis 7 | Redis 用于会话缓存+限流 |
| AI 代理 | AI Proxy Layer (Express 内) | 模型路由+Key管理 |
| 部署 | Docker Compose + Nginx | 与现有项目一致 |

---

## 3. 核心数据模型

### 3.1 Prisma Schema

```prisma
// 用户
model User {
  id            String   @id @default(cuid())
  openid        String   @unique               // 微信 OpenID
  nickname      String?
  avatar        String?
  // 平台免费额度
  dailyQuota    Int      @default(20)          // 每日免费对话次数
  usedQuota     Int      @default(0)           // 已使用次数
  quotaDate     DateTime @default(now())       // 额度日期（每日重置）
  role          UserRole @default(USER)        // USER | ADMIN
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  characters    CharacterCard[]
  personas      Persona[]
  chats         ChatSession[]
  apiKeys       ApiKey[]
}

enum UserRole {
  USER
  ADMIN
}

// 角色卡
model CharacterCard {
  id            String         @id @default(cuid())
  name          String                        // 角色名
  avatar        String?                       // 头像 URL
  description   String                        // 角色描述（外貌、性格）
  personality   String?                       // 人格特征
  firstMsg      String                        // 开场白
  exampleDialogs Json?                        // 示例对话
  scenario      String?                       // 场景设定
  lore          String?                       // 世界观/背景知识
  systemPrompt  String?                       // 自定义 System Prompt（覆盖默认）
  nsfw          Boolean        @default(false) // 是否成人内容
  // 用户 Persona（扮演的角色）
  creatorId     String
  creator       User           @relation(fields: [creatorId], references: [id])
  tags          String[]                      // 标签
  isPublic      Boolean        @default(false)
  status        CardStatus     @default(DRAFT) // DRAFT | PENDING | PUBLISHED | BANNED
  
  // 统计
  chatCount     Int            @default(0)
  likeCount     Int            @default(0)
  favCount      Int            @default(0)
  viewCount     Int            @default(0)
  
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  likes         CharacterCardLike[]
  favs          CharacterCardFav[]
  chats         ChatSession[]
}

enum CardStatus {
  DRAFT       // 草稿
  PENDING     // 待审核
  PUBLISHED   // 已发布
  BANNED      // 已封禁
}

// 角色卡点赞
model CharacterCardLike {
  id        String   @id @default(cuid())
  cardId    String
  userId    String
  createdAt DateTime @default(now())

  card      CharacterCard @relation(fields: [cardId], references: [id])
  user      User          @relation(fields: [userId], references: [id])

  @@unique([cardId, userId])
}

// 角色卡收藏
model CharacterCardFav {
  id        String   @id @default(cuid())
  cardId    String
  userId    String
  createdAt DateTime @default(now())

  card      CharacterCard @relation(fields: [cardId], references: [id])
  user      User          @relation(fields: [userId], references: [id])

  @@unique([cardId, userId])
}

// 用户 Persona
model Persona {
  id          String  @id @default(cuid())
  userId      String
  name        String                     // 角色名
  description String?                    // 角色设定
  avatar      String?                    // 头像
  isDefault   Boolean @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User    @relation(fields: [userId], references: [id])
}

// 聊天会话
model ChatSession {
  id            String   @id @default(cuid())
  userId        String
  characterId   String
  personaId     String?
  title         String?                    // 自动生成或用户命名
  modelKey      String?                    // 使用的模型标识
  temperature   Float?                     // 模型参数
  messageCount  Int      @default(0)
  tokenCount    Int      @default(0)       // 总计 token 消耗
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user          User          @relation(fields: [userId], references: [id])
  character     CharacterCard @relation(fields: [characterId], references: [id])
  messages      ChatMessage[]
}

// 聊天消息
model ChatMessage {
  id          String   @id @default(cuid())
  sessionId   String
  role        String                     // user | character | system
  content     String
  tokens      Int?                       // 本条消息 token 数
  createdAt   DateTime @default(now())

  session     ChatSession @relation(fields: [sessionId], references: [id])
}

// 用户 API Key
model ApiKey {
  id        String   @id @default(cuid())
  userId    String
  provider  String                     // openai | deepseek | openrouter
  keyValue  String                     // 加密存储
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User     @relation(fields: [userId], references: [id])
}

// 内容审核日志
model ModerationLog {
  id          String   @id @default(cuid())
  targetType  String                     // character | message
  targetId    String
  action      String                     // approve | reject | ban
  reason      String?
  operatorId  String?
  createdAt   DateTime @default(now())
}
```

---

## 4. 核心功能模块设计

### 4.1 角色卡系统

#### 角色卡构成（参考 SillyTavern V2 规范）

| 字段 | 必需 | 说明 |
|------|------|------|
| name | ✅ | 角色名 |
| description | ✅ | 外貌、身份、性格综合描述 |
| personality | ❌ | 人格特征关键词（开朗/神秘/傲娇） |
| first_msg | ✅ | 开场白，新会话的第一条 AI 消息 |
| example_dialogs | ❌ | 示例对话，帮助模型理解角色语气 |
| scenario | ❌ | 场景设定（"深夜的酒馆里..."） |
| lore | ❌ | 世界观背景知识 |
| system_prompt | ❌ | 自定义系统提示，覆盖默认模板 |

#### 角色卡导入/导出

- **导入**: 支持标准 SillyTavern V2 格式（PNG 嵌入 JSON / 纯 JSON）
- **导出**: 导出为 SillyTavern 兼容的 JSON 格式，方便用户在 PC 端使用
- **模板**: 内置 5-10 种预设角色模板（精灵/侦探/猫娘/管家...），降低创作门槛

#### 可视化编辑器

在小程序内提供表单式编辑：
- 基本信息：角色名、头像（从相册选择或默认头像）、标签
- 详细设定：描述、人格、场景、世界观
- 开场白：富文本编辑
- 示例对话：轮次式编辑（用户说→角色答）
- 预览：编辑时可随时预览角色对话效果

### 4.2 AI 聊天引擎

#### 4.2.1 模型路由

```
用户发送消息
  │
  ├── 用户已配置 API Key
  │     └── 路由到对应模型 API
  │           ├── OpenAI (GPT-4o-mini / GPT-4o)
  │           ├── DeepSeek (DeepSeek-Chat)
  │           ├── OpenRouter (多模型聚合)
  │           └── 兼容 OpenAI 格式的其他 API
  │
  └── 用户未配置 Key / 选择平台模型
        └── 检查每日免费额度
              ├── 有额度 → 调用通义千问 (DashScope)
              └── 无额度 → 提示充值或配置 Key
```

#### 4.2.2 Prompt 拼装

```typescript
// promptBuilder.ts
const SYSTEM_PROMPT = `你正在扮演以下角色。请完全按照角色设定来回应，不要跳出角色，不要提及你是 AI 或语言模型。`;

function buildPrompt(params: {
  character: CharacterCard;
  persona?: Persona;
  history: ChatMessage[];
  currentMessage: string;
}): ChatCompletionMessage[] {
  const messages: ChatCompletionMessage[] = [];

  // System
  messages.push({
    role: 'system',
    content: [
      SYSTEM_PROMPT,
      `\n\n【角色设定】`,
      `姓名: ${params.character.name}`,
      `外貌与性格: ${params.character.description}`,
      params.character.personality ? `人格特征: ${params.character.personality}` : '',
      params.character.scenario ? `场景: ${params.character.scenario}` : '',
      params.character.lore ? `\n【背景知识】\n${params.character.lore}` : '',
      params.character.systemPrompt ? `\n【额外指令】\n${params.character.systemPrompt}` : '',
    ].filter(Boolean).join('\n'),
  });

  // Example dialogs
  if (params.character.exampleDialogs) {
    const dialogs = JSON.parse(params.character.exampleDialogs);
    for (const d of dialogs) {
      messages.push({ role: 'user', content: d.user });
      messages.push({ role: 'assistant', content: d.char });
    }
  }

  // Persona
  if (params.persona) {
    messages.push({
      role: 'system',
      content: `用户设定: 用户名为 ${params.persona.name}${params.persona.description ? `，${params.persona.description}` : ''}`,
    });
  }

  // Chat history (sliding window — last N rounds)
  const maxHistoryRounds = 20;
  const recentHistory = params.history.slice(-maxHistoryRounds * 2);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    });
  }

  // Current message
  const userName = params.persona?.name ?? '用户';
  messages.push({ role: 'user', content: `${userName}: ${params.currentMessage}` });

  return messages;
}
```

#### 4.2.3 SSE 流式响应

```
请求: POST /api/v1/chat/send
Body: { sessionId?, characterId, personaId?, message, model?, temperature? }

响应 (SSE, text/event-stream):
data: {"type": "meta", "sessionId": "xxx", "characterId": "yyy"}
data: {"type": "token", "content": "你"}
data: {"type": "token", "content": "好"}
data: {"type": "token", "content": "，"}
data: {"type": "token", "content": "冒"}
data: {"type": "token", "content": "险"}
data: {"type": "token", "content": "者"}
data: {"type": "token", "content": "。"}
data: {"type": "token", "content": "欢"}
data: {"type": "token", "content": "迎"}
...
data: {"type": "done", "sessionId": "xxx", "tokens": 156}
data: {"type": "error", "message": "..."}
```

#### 4.2.4 上下文管理

| 场景 | 策略 |
|------|------|
| 正常对话 | 滑动窗口保留最近 20 轮 |
| 超出上下文 | 触发自动摘要：早期对话压缩为摘要插入 System |
| 新建会话 | 仅包含角色卡开场白 |
| 切换模型 | 重新计算 token，提示窗口可能变化 |

Redis 缓存活跃会话的上下文（TTL: 1 小时），减少 MySQL 频繁读取。

### 4.3 社区市场

#### 浏览与发现

- **首页推荐**: 精选角色卡轮播 + 热门推荐列表
- **分类浏览**: 按标签分类（萌娘/科幻/古风/奇幻/现实/动物...）
- **排序**: 最新发布 / 最热门（对话次数） / 最多点赞 / 最多收藏
- **搜索**: 模糊匹配角色名、描述、标签

#### 社交互动

| 功能 | 说明 |
|------|------|
| 点赞 | 用户可点赞角色卡，去重 |
| 收藏 | 收藏到个人角色库 |
| 使用 | 一键将角色卡加入"我的角色"并开始对话 |
| 创作者关注 | 关注创作者，新角色发布时通知（微信订阅消息） |

#### 角色卡状态流转

```
DRAFT (草稿)
  │  用户提交公开
  ▼
PENDING (待审核)
  │  管理员审核
  ├──→ PUBLISHED (已发布) → 出现在市场中
  └──→ BANNED (已封禁) → 仅创建者可见，提示违规原因
```

### 4.4 用户系统

#### 微信登录流程

```
小程序启动
  │
  ├── wx.login() → 获取 code
  ├── POST /api/v1/auth/login → { code }
  │     └── Server: 调微信接口换取 openid → JWT → 返回 token
  └── 前端持久化 token → 后续请求携带
```

#### Persona 管理

用户可创建多个 Persona（扮演的角色），在开始对话时选择使用哪个 Persona。

```
Persona 示例:
  名称: 勇者艾伦
  描述: 来自北境的年轻剑士，性格直率，有点冒失
```

#### API Key 管理

| 功能 | 说明 |
|------|------|
| 添加 Key | 选择 Provider（OpenAI/DeepSeek/OpenRouter），输入 Key |
| 加密存储 | Server 端使用 AES 加密后存入 MySQL |
| 验证 Key | 添加时自动验证 Key 有效性 |
| 切换 | 聊天时可选择使用哪个已配置的 Key |
| 删除 | 移除 Key |

### 4.5 内容审核

#### 审核策略

| 阶段 | 措施 |
|------|------|
| 角色卡提交 | 自动敏感词检测 + 人工审核（PENDING 状态） |
| 用户对话 | 客户端 + 服务端敏感词过滤 |
| 角色卡名称/描述 | 敏感词库匹配，自动拒绝 |
| 举报机制 | 用户可举报违规角色卡或对话 |

#### 审核后台（Dashboard）

管理员可在 Dashboard 中：
- 查看待审核角色卡列表
- 审核通过/拒绝（附原因）
- 封禁已发布角色卡
- 查看审核日志

---

## 5. API 设计

### 5.1 路由总览

```
前缀: /api/v1

# 认证
POST   /auth/login          ← 微信登录
GET    /auth/me             ← 获取当前用户信息

# 角色卡
GET    /characters          ← 获取我的角色卡列表
POST   /characters          ← 创建角色卡
GET    /characters/:id      ← 获取角色卡详情
PUT    /characters/:id      ← 更新角色卡
DELETE /characters/:id      ← 删除角色卡
POST   /characters/:id/publish  ← 提交公开审核

# 市场
GET    /market              ← 市场角色卡列表（分页+筛选+排序）
GET    /market/featured     ← 精选推荐
GET    /market/search?q=    ← 搜索角色卡
POST   /market/:id/like     ← 点赞
DELETE /market/:id/like     ← 取消点赞
POST   /market/:id/fav      ← 收藏
DELETE /market/:id/fav      ← 取消收藏

# AI 对话
POST   /chat/send           ← 发送消息（SSE 流式响应）
GET    /chat/sessions       ← 获取会话列表
GET    /chat/sessions/:id   ← 获取会话详情（消息列表）
DELETE /chat/sessions/:id   ← 删除会话
POST   /chat/sessions/:id/summary ← 触发自动摘要

# Persona
GET    /personas            ← 获取 Persona 列表
POST   /personas            ← 创建 Persona
PUT    /personas/:id        ← 更新 Persona
DELETE /personas/:id        ← 删除 Persona

# API Key
GET    /keys                ← 获取 Key 列表
POST   /keys                ← 添加 Key
DELETE /keys/:id            ← 删除 Key
POST   /keys/:id/verify     ← 验证 Key 有效性

# 管理
GET    /admin/pending       ← 待审核角色卡
POST   /admin/approve/:id   ← 审核通过
POST   /admin/reject/:id    ← 审核拒绝
POST   /admin/ban/:id       ← 封禁
```

### 5.2 SSE 聊天接口详细

```
POST /api/v1/chat/send
Content-Type: application/json
Accept: text/event-stream

Request:
{
  "sessionId": null,        // null = 新建会话
  "characterId": "xxx",
  "personaId": "yyy",       // 可选
  "message": "你好，酒保先生！",
  "model": "tongyi",        // 平台模型 或 用户 Key 的 provider
  "temperature": 0.8        // 可选，默认 0.8
}

Response (SSE):
data: {"type":"meta","sessionId":"abc123","characterId":"xxx"}
data: {"type":"token","content":"欢"}
data: {"type":"token","content":"迎"}
...
data: {"type":"done","sessionId":"abc123","tokens":234}
data: {"type":"error","message":"配额不足"}

Error codes:
- QUOTA_EXCEEDED: 免费额度已用完
- KEY_INVALID: 用户 Key 无效
- MODEL_UNAVAILABLE: 模型暂时不可用
- CONTENT_FILTERED: 内容被过滤
```

---

## 6. 非功能需求

### 6.1 性能要求

| 指标 | 目标 |
|------|------|
| 首屏加载 | < 2s |
| SSE 首 token 延迟 | < 3s（含模型推理时间） |
| 市场列表加载 | < 1s（含分页） |
| 角色卡搜索 | < 500ms |
| 并发用户 | 初期 100 同时在线对话 |

### 6.2 安全要求

- API Key 加密存储（AES-256-GCM）
- JWT 鉴权（access token 7 天有效期）
- 微信登录 code 一次性使用
- 用户间角色卡隔离（未公开的仅创建者可见）
- 对话内容加密传输（HTTPS）
- 敏感词过滤（服务端+客户端双校验）

### 6.3 内容合规

- 所有公开角色卡需人工审核
- 支持举报机制
- 敏感词库持续更新
- 未成年人保护：默认过滤 NSFW 内容
- 遵守微信小程序内容规范

---

## 7. 实施路线图

### Phase 1 — MVP（预计 3-4 周）
- [x] 项目设计文档完成
- [ ] 初始化 `ai-tavern-server` + Prisma Schema
- [ ] 微信登录 + JWT 鉴权
- [ ] 角色卡 CRUD（基本字段）
- [ ] 角色卡市场（列表+详情）
- [ ] AI 聊天 SSE 流式对话（仅通义千问平台模型）
- [ ] 初始化 `ai-tavern-miniapp` 基础框架
- [ ] 聊天页面（消息发送+流式渲染）
- [ ] 角色卡浏览页面

### Phase 2 — 社区功能（2-3 周）
- [ ] 角色卡创建/编辑（可视化编辑器）
- [ ] Persona 管理
- [ ] 点赞/收藏/关注
- [ ] 角色卡公开审核流程
- [ ] 搜索+分类筛选
- [ ] 用户主页

### Phase 3 — 进阶功能（2-3 周）
- [ ] API Key 管理（自带模型）
- [ ] 自动摘要
- [ ] 角色卡导入/导出（SillyTavern 兼容）
- [ ] Dashboard 管理模块
- [ ] 内容审核后台
- [ ] 推送通知（订阅消息）

### Phase 4 — 打磨（持续）
- [ ] 角色卡模板库
- [ ] 推荐算法优化
- [ ] 对话分支/书签
- [ ] 多角色群聊
- [ ] 性能优化

---

## 8. 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 后端架构 | Express + Prisma | 与现有项目一致，复用 Dashboard 和部署 |
| AI 模型接入 | 混合模式（自带 Key + 平台模型） | 降低平台成本，给用户灵活性 |
| 流式方案 | SSE | 微信小程序支持 enableChunked，实现简单 |
| 上下文缓存 | Redis | 减少 MySQL 读取，适合高频读写场景 |
| 角色卡格式 | 兼容 SillyTavern V2 | 利用现有社区生态，降低创作门槛 |
| 审核机制 | 人工审核 | MVP 阶段先确保内容安全 |
| 会话管理 | 树形结构（支持分支） | 后续迭代，MVP 用线性结构 |

---

## 9. 与现有项目的关系

| 项目 | 关系 |
|------|------|
| `dashboard` | 新增 AI 酒馆管理模块，复用用户管理/统计框架 |
| `ftg-server` | 独立服务，不共享数据库，可复用部署脚本 |
| `deploy/` | 扩展 docker-compose，新增 AI 酒馆容器 |
| 无依赖 | AI 酒馆是独立子项目，不依赖 FTG 或 Game1 |
