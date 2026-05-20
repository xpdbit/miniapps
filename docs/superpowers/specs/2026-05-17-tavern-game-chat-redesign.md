# Tavern 游戏化聊天改造设计

## 概述

将 AI-Tavern 从"选择角色→聊天"的简单模式改造为**游戏化群聊系统**，包含存档、选卡、AI 世界观构建、多群组聊天等机制。同时将模型/服务商选择移入"我的"页面，聊天界面完全模仿微信风格。

## 1. 整体导航流程

```
开始 tab
    │
    ▼
┌─ 存档选择页 ───────────────┐
│  存档 1         诸葛亮等 3人  │
│  存档 2         爱丽丝等 5人  │
│  ─ ─ ─ ─ ─ ─ ─             │
│  [+] 开始新游戏              │
└──────────────────────────────┘
        │                │
   选存档           [+] 开始新游戏
        │                │
        ▼                ▼
   进入游戏         ┌─ 选卡页 ────────────┐
                    │  [角色卡] 选 2-5 个  │
                    │  [机制卡] 选 1-2 个  │
                    │  [地图卡] 选 1 个    │
                    │  [背景卡] 选 1 个    │
                    │  [确认选择]          │
                    └──────────────────────┘
                              │
                              ▼
                    AI 构建世界观+分配群组
                              │
                              ▼
                    ┌─ 会话列表 ──────────┐
                    │  世界公告群  (置顶)   │
                    │  线人密谈组           │
                    │  探险小队             │
                    └──────────────────────┘
                              │
                         点击群组
                              │
                              ▼
                    ┌─ 聊天视图 ──────────┐
                    │  ← 线人密谈组        │
                    │  微信风格聊天气泡     │
                    └──────────────────────┘
```

## 2. 存档系统

### 2.1 数据模型

```typescript
// 存档：纯本地 JSON 持久化
interface GameSave {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  playerCount: number       // 最后参与人数（存档列表显示用）

  selectedCards: {
    characters: string[]    // 角色卡 ID
    mechanics: string[]     // 机制卡 ID
    maps: string[]          // 地图卡 ID
    backgrounds: string[]   // 背景卡 ID
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
  memberIds: string[]       // 群成员角色卡 ID
  isGroup: true
  lastMessage?: string
  updatedAt?: number
  pinned: boolean
  pinnedAt?: number
}

interface GameMessage {
  id: string
  senderId: string          // 角色卡 ID 或 'player'
  senderName: string
  content: string
  createdAt: number
}
```

### 2.2 持久化

- `Taro.setStorageSync('tavern_saves', GameSave[])` — 存档列表
- `Taro.setStorageSync('tavern_active_save_id', string)` — 当前活跃存档 ID
- 单人模式不上传服务端

### 2.3 存档选择页

新建页面 `pages/archive/index.tsx`：
- 显示所有存档列表（名称 + 人数 + 最后时间）
- 左滑删除/重命名
- 底部"开始新游戏"按钮

## 3. 选卡流程

### 3.1 选卡页

新建页面 `pages/game-setup/index.tsx`，分步选择：

**Step 1 — 角色卡（2-5个）**
- 横向网格展示可选角色卡（来自 syncedCardsStore + localCardsStore，过滤 cardType='CHARACTER'）
- 点击选中/取消，已选数显示角标
- 搜索/筛选

**Step 2 — 机制卡（1-2个）**
- 同上，过滤 cardType='MECHANISM'

**Step 3 — 地图卡（1个）**
- 单选，过滤 cardType='MAP'

**Step 4 — 背景卡（1个）**
- 单选，过滤 cardType='BACKGROUND'

**Step 5 — 确认**
- 摘要展示所有选卡 + 存档名称输入
- AI 生成的存档名称预览
- [确认进入游戏] 按钮

### 3.2 现有数据源

卡牌数据直接复用现有 store：
- `syncedCardsStore.getCardsByType(type)` — 官方同步卡牌
- `localCardsStore.getCardsByType(type)` — 本地创建卡牌
- 两者均可选，标记来源

## 4. AI 世界构建

### 4.1 流程

1. 用户确认选卡 → 前端收集所有卡牌的完整数据（名称/描述/设定等）
2. 前端直接调 AI（非流式 API），Prompt 要求以 JSON 格式返回世界观和群组分配
3. 解析返回 JSON → 生成 `GameSave` 对象
4. 保存到本地存储 → 进入会话列表

### 4.2 Prompt 设计

```
你是一个游戏世界构建师。基于以下卡牌组合，构建一个完整的游戏世界观，
并将角色分配到多个群组中。

角色卡：{角色卡数据列表}
机制卡：{机制卡数据}
地图卡：{地图卡数据}
背景卡：{背景卡数据}

请以 JSON 格式返回（不要 markdown 包裹）：
{
  "worldSetting": {
    "title": "世界观标题",
    "description": "世界观描述（200字内）",
    "rules": ["规则1", "规则2", "规则3"]
  },
  "groups": [
    {
      "name": "群组名称",
      "memberIds": ["角色ID1", "角色ID2"],
      "description": "该群组在此世界观中的定位"
    }
  ]
}

要求：
- 群组数量 2-4 个
- 每个角色至少属于一个群组
- 群组间有明确的功能区分
- 第一个群组为"世界公告群"，包含所有角色
```

### 4.3 AI 客户端直连

新建 `services/aiClient.ts`：

```typescript
type AiProvider = 'opencode' | 'tongyi' | 'openai' | 'anthropic' | ...

interface AiClientConfig {
  provider: AiProvider
  model: string
  apiKey?: string           // 本地存储，从 profile 页配置
  baseUrl?: string
}

// 非流式调用（世界构建）
async function aiGenerate(config: AiClientConfig, messages: Message[]): Promise<string>

// 流式调用（聊天）
function aiStream(config: AiClientConfig, messages: Message[]): AbortableSSE
```

Provider 适配：
| Provider | Endpoint | Key 来源 |
|----------|----------|---------|
| OpenCode Go | `https://api.opencode.com/v1/chat/completions` | 免费免 Key |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | 免费免 Key |
| OpenAI | `https://api.openai.com/v1/chat/completions` | 用户配置 |
| DeepSeek | `https://api.deepseek.com/v1/chat/completions` | 用户配置 |
| Anthropic | `https://api.anthropic.com/v1/messages` | 用户配置 |

### 4.4 复用现有 Hook

`hooks/useSSE.ts` 改造为通用 SSE hook，支持指定端点：
```typescript
function useSSE(config?: { 
  baseUrl?: string       // 不传则走 tavern 服务端
  apiKey?: string
  model?: string 
}): { messages, sendMessage, isStreaming, clearMessages }
```

## 5. 聊天界面（微信风格）

### 5.1 双状态视图

聊天页（`pages/chat/index.tsx`）改造为两个状态：

**状态 A — 会话列表**
- 私聊与群聊混合排列
- 置顶会话在顶部独立分区
- 每条显示：头像/名称/最后消息/时间
- 群聊显示最后一条消息的发送者前缀
- 左滑置顶/取消置顶/删除
- 右上角 "+" 新建对话
- 无会话时显示空状态引导

**状态 B — 聊天视图**
- 头部：返回按钮 + 群组名称
- 消息气泡列表

### 5.2 气泡规格（精确微信风格）

| 元素 | 用户（我） | 角色（对方） |
|------|-----------|------------|
| 对齐 | 右 | 左 |
| 背景色 | `#07C160` | `#FFFFFF` |
| 文字色 | `#FFFFFF` | `#1A1A1A` |
| 圆角 | 10rpx + 右侧三角尾巴 | 10rpx + 左侧三角尾巴 |
| 头像 | 气泡右侧显示 | 气泡左侧显示 |
| 最大宽度 | ~65% | ~65% |
| 内边距 | 12rpx 16rpx | 12rpx 16rpx |
| 字号 | 32rpx | 32rpx |
| 阴影 | 无 | 0 2rpx 4rpx rgba(0,0,0,0.05) |

### 5.3 时间分隔

```
      ─── 昨天 15:30 ───
```
首条消息/间隔 >5min 时显示居中灰色分隔线。

### 5.4 底部输入栏

```
[🎤] | 输入消息... | [😊] [+]
```
- 语音按钮（左）、输入框（中间自适应）、表情按钮、加号按钮
- 输入框获得焦点时，加号按钮变为"发送"文字按钮
- 输入框高度随文字自动增高（最多 4 行）

### 5.5 样式调整

- 移除 `ModelSelector` 组件
- 移除头部设置图标
- 移除角色选择横向滚动条
- 移除现有渐变/动画效果
- 背景纯白/浅灰（微信风格）

## 6. Profile 页面改造

### 6.1 新增"模型与服务商"区块

```
┌─ Header（头像/昵称/UUID）
├─ 配额信息（剩余/总次数 + 进度条）
├─ 模型与服务商 ◀ 新增
│  ├─ 当前模型: [通义千问 Turbo ▼]  ← Picker
│  └─ API Key: 3/8 已配置 ›
│     └─ [展开] 服务商配置列表
│        各服务商: 状态标记 + 添加/删除
├─ 菜单（我的角色/创建角色/人设管理）
└─ Footer（版本号）
```

### 6.2 移除 settings 页面

- 删除 `pages/settings/` 目录
- 从 `app.config.ts` 中移除 settings 页面注册
- 所有功能合入 profile

### 6.3 模型选择器行为

- 选择模型后影响 `aiClient.ts` 的配置（Provider + model）
- 状态存于 `chatStore.selectedModel`（现有）
- API Key 存本地 `Taro.setStorageSync`

## 7. 文件变更清单

### 新建文件
| 文件 | 用途 |
|------|------|
| `src/types/game.ts` | GameSave/GameGroup/GameMessage 类型 |
| `src/pages/archive/index.tsx` + `.scss` | 存档选择页 |
| `src/pages/game-setup/index.tsx` + `.scss` | 选卡页 |
| `src/services/aiClient.ts` | 客户端 AI 直连封装 |
| `src/stores/gameStore.ts` | 游戏状态管理（存档/活跃存档） |

### 修改文件
| 文件 | 修改内容 |
|------|---------|
| `src/pages/chat/index.tsx` | 改为双状态视图，移除 ModelSelector/设置图标/角色选择条 |
| `src/pages/chat/index.scss` | 完全重写为微信风格 |
| `src/pages/profile/index.tsx` | 新增"模型与服务商"区块 |
| `src/pages/profile/index.scss` | 新增区块样式 |
| `src/components/ChatBubble/index.tsx` | 重写为微信风格气泡 |
| `src/components/ChatBubble/index.scss` | 完全重写样式（绿/白 + 三角尾巴） |
| `src/hooks/useSSE.ts` | 改为通用，支持指定端点 |
| `src/app.config.ts` | 移除 settings 页面，新增 archive/game-setup 页面 |
| `src/stores/chatStore.ts` | 扩展 session 模型（pinned/isGroup/members） |

### 删除文件
| 文件 | 原因 |
|------|------|
| `src/components/ModelSelector/` | 功能合入 profile |
| `src/pages/settings/` | 功能合入 profile |
