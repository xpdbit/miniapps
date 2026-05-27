# 系统架构

> **状态**: current
> **更新**: 2026-05-27

## 高层面架构（多项目视图）

```
┌──────────────────────────────────────────────────────────────────┐
│                    统一管理后台 (dashboard/)                        │
│  ┌───────────┐  ┌───────────┐  ┌───────┐  ┌───────┐  ┌──────┐  │
│  │ 项目管理   │  │ 用户管理   │  │ FTG   │  │ Game1 │  │Tavern│  │
│  └─────┬─────┘  └─────┬─────┘  └──┬────┘  └──┬────┘  └──┬───┘  │
│        │               │          │          │          │       │
│  ┌─────┴───────────────┴──────────┴──────────┴──────────┴───┐  │
│  │              Admin API (port 3001)                        │  │
│  └─────────────────────────┬────────────────────────────────┘  │
└────────────────────────────┼───────────────────────────────────┘
                      │
     ┌───────────────────────┼───────────────────────┐
     ▼                       ▼                       ▼
┌────────────┐      ┌────────────┐         ┌──────────────┐
│ FTG MiniApp│      │Game1 MiniApp│        │ AI-Tavern    │
│(apps/ftg/client) │(apps/game1/client)   │(apps/tavern/client)│
│ Taro+React  │      │ Taro+React  │         │ Taro+React   │
└──────┬─────┘      └──────┬─────┘         └──────┬───────┘
       │                   │                       │
       ▼                   ▼                       ▼
┌────────────┐      ┌────────────┐         ┌──────────────┐
│ FTG Server │      │Game1 Server│         │Tavern Server  │
│ ftg-server │      │game1-server│         │tavern-server  │
│ Express API│      │ Express API│         │ Express API   │
│ port 3000  │      │ port 3001  │         │ port 3002     │
└────────────┘      └────────────┘         └──────────────┘
```

**当前状态**：3 个子项目并进。FTG 已成熟部署至 ECS；Game1（小程序前端 + Express 后端）开发中；AI-Tavern（小程序前端 + 后端 API）开发中。dashboard 管理后台统一管理所有项目。

## 当前架构（FTG 子系统 — REST API）

```
┌─────────────────────────────────────────────────────────────┐
│                  WeChat MiniApp (Taro + React)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │  Home    │  │ Settings │  │ Profile  │  │ Camera/     │ │
│  │  (home)  │  │(settings)│  │(profile) │  │ Result      │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘ │
│       │             │             │               │         │
│  ┌────┴─────────────┴─────────────┴───────────────┴──────┐  │
│  │              Service Layer (services/)                  │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │  │
│  │  │ AuthSvc  │  │HttpClient│  │  ...Service modules   │ │  │
│  │  │(JWT)     │  │(Taro.req)│  │  (user/record/checkin)│ │  │
│  │  └──────────┘  └──────────┘  └──────────────────────┘ │  │
│  │                         │                               │  │
│  │              Zustand Store (authStore)                   │  │
│  └─────────────────────────┬───────────────────────────────┘  │
│                           │  HTTP GET/POST (JWT Bearer)       │
└───────────────────────────┼───────────────────────────────────┘
                            │
┌───────────────────────────┼───────────────────────────────────┐
│              apps/ftg/server (Express + TypeScript)            │
│  ┌──────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Auth │  │ Middleware│  │ Routes   │  │ Services         │  │
│  │ JWT  │  │ auth/    │  │ (16 mods)│  │ (recognition/    │  │
│  │      │  │ admin/   │  │          │  │  theme-render/..)│  │
│  └──┬───┘  └──────────┘  └────┬─────┘  └────────┬─────────┘  │
│     │                          │                  │            │
│     └──────────────────────────┼──────────────────┘            │
│                                │                               │
│  ┌─────────────────────────────┼───────────────────────────┐   │
│  │                   Prisma ORM + MySQL 8.0                │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │   │
│  │  │ Users    │  │FoodRecord│  │ Themes   │  │ Classes │ │   │
│  │  │ Checkins │  │Achieve-  │  │ ApiKeys  │  │  ... (14│ │   │
│  │  │          │  │ments     │  │          │  │   total)│ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────┘ │   │
│  └────────────────────────────────────────────────────────┘   │
│                         │                                      │
│  ┌──────────────────────┼───────────────────────────────────┐  │
│  │          External Services                                │  │
│  │  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐   │  │
│  │  │PP-ShiTuV2│  │ 通义千问      │  │ Redis 7 Cache    │   │  │
│  │  │(Docker)  │  │ (DashScope)  │  │ (session/rate)   │   │  │
│  │  └──────────┘  └──────────────┘  └──────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## 技术架构分层

### 前端层 (MiniAPP) — 以 FTG 为例

| 层级 | 目录 | 职责 |
|------|------|------|
| **页面层** | `src/pages/` | UI 渲染、用户交互、路由跳转 |
| **组件层** | `src/components/` | 可复用 UI 组件 (18 SVG icons, charts) |
| **服务层** | `src/services/` | HTTP client, auth, business logic |
| **状态层** | `src/stores/` | Zustand stores (auth, UI state) |
| **工具层** | `src/utils/` | 纯函数工具（Canvas合成、图片处理等） |
| **类型层** | `src/types/` | TypeScript 类型定义 |
| **常量层** | `src/constants/` | 全局常量、配置数据 |

> **各 MiniApp 差异**: FTG 13 页面 + 共享组件库；Game1 12 页面 + 18 引擎模块；Tavern 7 页面 + SSE hook + 角色组件

### 后端层 (REST API)

| 层级 | 位置 | 职责 |
|------|------|------|
| **API 路由** | `apps/ftg/server/src/routes/` | 16 个路由模块 (含 auth/users/recognize/themes/theme-classes/theme-render 等) |
| **服务层** | `apps/ftg/server/src/services/` | 业务逻辑 (theme-render/class/recognition) |
| **中间件** | `apps/ftg/server/src/middleware/` | JWT 认证、RBAC 权限 |
| **ORM** | Prisma (MySQL 8.0) | 数据库访问 (14 表) |
| **外部 AI** | PP-ShiTuV2 (Docker) | 食物识别服务 |
| **外部 AI** | DashScope (通义千问) | 文本生成 |

## 核心数据流

### AI 流水线 (current REST API version)

```
User takes/selects photo
        │
        ▼
  ① Upload → POST /upload → returns filename
        │
        ▼
  ② Recognize → POST /recognition/recognize → sends image path
        │                        ┌──────────────────┐
        ├─→ apps/ftg/server      │ PP-ShiTuV2 Docker│
        │   proxies request ────→│ (port 5000)      │
        │   ← returns result     │ food name/type/  │
        │                        │ calories         │
        │                        └──────────────────┘
        │
        ▼
  ③ Generate → calls DashScope AI (通义千问) for themed description
        │
        ▼
  ④ Render → POST /theme-render/render → markup template + CSS classes
        │
        ▼
  ⑤ Save → POST /food-records → persisted to MySQL via Prisma
```

### 用户认证流程 (current)

```
MiniApp launches
    │
    ▼
Check cached JWT token in storage
    │
    ├── token exists → GET /auth/me → validate → show UI
    │
    └── no token → wx.login() → get code
                      │
                      ▼
                  POST /auth/login { code }
                      │
                      ▼
                   apps/ftg/server exchanges code via WeChat API
                      │
                      ▼
                  Returns { token, user }
                      │
                      ▼
                  Store token locally, set user state
```

## 路由与导航 (FTG MiniApp)

### TabBar 导航（3个 Tab）

| Tab | 路径 | 说明 |
|-----|------|------|
| 🏠 首页 | `pages/home/index` | 主要功能入口 |
| ⚙️ 设置 | `pages/settings/index` | 主题偏好、API配置 |
| 👤 我的 | `pages/profile/index` | 个人中心 |

### 完整路由表

| 路径 | 页面 | TabBar |
|------|------|--------|
| `pages/home/index` | 首页 | ✅ |
| `pages/settings/index` | 设置 | ✅ |
| `pages/profile/index` | 个人中心 | ✅ |
| `pages/camera/index` | 拍照页 | ❌ |
| `pages/result/index` | 结果展示页 | ❌ |
| `pages/record/index` | 打卡记录列表 | ❌ |
| `pages/record/detail/index` | 打卡详情 | ❌ |
| `pages/history/index` | 历史记录 | ❌ |
| `pages/stats/index` | 统计数据 | ❌ |
| `pages/achievements/index` | 成就页 | ❌ |
| `pages/checkin/index` | 打卡页 | ❌ |
| `pages/gallery/index` | 美食图鉴 | ❌ |
| `pages/privacy/index` | 隐私政策 | ❌ |
| `pages/favorites/index` | 收藏记录 | ❌ |

## 权限声明

| 权限 | 用途 |
|------|------|
| `scope.camera` | 拍摄食物照片 |
| `scope.userLocation` | 记录打卡位置 (GPS) |
| `requiredPrivateInfos` | `getLocation`, `chooseLocation` |

## 主题模板系统 (v2)

> 取代旧的 Canvas 2D 合成引擎。使用 HTML-like 标记模板 + CSS Class 系统。

### 架构

```
Dashboard 创建模板 + Class
        │
        ▼
apps/ftg/server 存储模板配置
        │
        ├── theme.service.ts       — 主题 CRUD + 使用统计
        ├── theme-class.service.ts  — Class CRUD + CSS 白名单校验
        └── theme-render.service.ts — 模板渲染引擎
                │
                ▼
API 输出渲染后的 HTML/CSS
        │
        ├── MiniApp RichText 渲染 (mode=miniapp, class→inline)
        └── H5 完整 HTML (mode=h5, <style> + class)
```

### 模板语法

```html
<div class="item-card">
  <div class="item-name">{{foodName}}</div>
  <div class="item-desc">{{foodDescription}}</div>
  <div class="item-calories">{{calories}} 大卡</div>
</div>
```

| 语法 | 说明 |
|------|------|
| `{{variable}}` | 变量替换 |
| `{{#if var}}...{{/if}}` | 条件渲染 |
| `{{#each list}}...{{/each}}` | 循环渲染 |
| `class="name"` | 引用 Class 定义 |
| `style="..."` | 内联样式（覆盖 class） |

### Class 系统

- **官方 Class**: Dashboard Class 管理页面创建，CSS 属性白名单校验
- **社区 Class**: 预留 `category=community`，支持第三方扩展
- **CSS 白名单**: 65+ 安全 CSS 属性（布局、字体、颜色等），禁止 `position:fixed`、`!important` 等

### 旧版兼容

`config_json` 字段保留在新主题模型中，用于旧版 Canvas 主题的前向兼容。

## 主题系统重构依赖链 (2026-05-05)

```
T1(Prisma Schema扩展) — 新增 ThemeClass/ThemeUsageLog 表 + Theme 字段
    │
    ├──► T2(Class 系统服务) — CRUD + CSS 白名单校验
    │         │
    │         └──► T3(模板渲染引擎) — 变量/条件/循环 + class展开
    │                    │
    │                    ├──► T4(Dashboard Class管理) — Table + Modal + 实时预览
    │                    │
    │                    └──► T5(Dashboard 主题编辑器) — 模板编辑器 + class选择器 + 预览
    │                               │
    │                               └──► T6(MiniApp 主题渲染) — API 主题列表 + RichText
    │                                          │
    │                                          └──► T7(使用统计 + 短链接) — 计数 + by-short 路由
    │
    └──► 旧版 configJson 保留兼容
```

所有 7 个实现任务已完成并部署至 ECS。

## Game1 子系统 — 挂机放置游戏

### 架构

```
Game1 MiniApp (apps/game1/client, Taro 4 + React 18)
  │
  ├── engine/          # 纯 TS 游戏逻辑引擎 (18 子模块)
  │   ├── core/        # GameLoop/EventBus/SaveManager/TimeManager
  │   ├── combat/      # CombatEngine/StateMachine/DamageCalculator
  │   ├── travel/      # TravelEngine/MileageManager/RouteEvent
  │   ├── team/        # TeamEngine/JobSystem 队伍管理
  │   ├── inventory/   # InventoryEngine/EquipmentSystem/DropEngine
  │   ├── skill/       # SkillEngine/SkillData 技能系统
  │   ├── card/        # CardEngine 卡牌系统
  │   ├── event/       # EventChainEngine/EventTreeEngine/PendingEventEngine
  │   ├── achievement/ # AchievementEngine/TaskEngine 成就任务
  │   ├── prestige/    # PrestigeEngine 轮回系统
  │   ├── idle/        # IdleRewardEngine 离线收益
  │   ├── pet/         # PetEngine 宠物系统
  │   ├── map/         # RegionGenerator 地图生成
  │   ├── race/        # RaceEngine 种族系统
  │   ├── actor/       # PlayerActor/ActorTemplate 角色系统
  │   └── activity/    # ActivityEngine 活动系统
  │
  ├── config/          # 13 个 JSON 配置文件驱动所有游戏数据
  ├── stores/          # Zustand 状态管理 (12 stores)
  ├── pages/           # 12 个页面
  └── services/        # HTTP 客户端 + GameSyncManager
         │
         ▼
Game1 Server (apps/game1/server, Express + TypeScript)
  │
  ├── routes/          # 10 路由模块 (auth/players/save/pvp/achievements/config/social/admin)
  ├── services/        # 10 个服务 (auth/player/save/pvp/achievement/config/admin/share/event/message)
  └── Prisma           # 7 张表 (players/cloud_saves/pvp_matches/pvp_rankings/achievements/share_logs/configs)
         │
         ▼
Dashboard Game1 管理 (通过 game1-proxy 代理到 game1-server)
  │
  ├── pages/           # Game1Players/Game1Config/Game1Achievements/Game1Pvp
  └── services/        # dashboard/src/services/game1/
```

### 核心数据流

```
MiniApp 本地游戏 (玩家操作)
   │
   ▼
GameEngine 处理逻辑 (纯 TS，离线友好)
   │
   ├── auto-save → GameSyncManager → PUT /save/:playerId → MySQL 云端存档
   ├── PVP result → POST /pvp/result → ELO 计算 → 排行榜
   └── achievement → POST /achievements/check → 解锁条件判断
```

### 关键特性

- **离线挂机**: IdleRewardEngine 计算离线收益，重连时一次性发放
- **云端存档**: JSON 格式 + 版本号 + MD5 checksum，1MB 上限
- **PVP 对战**: ELO 评分系统 (K=32)，5 个段位 (Bronze→Silver→Gold→Platinum→Diamond)
- **成就系统**: 11 个内置成就（里程/等级/PVP/轮回/登录）
- **数据驱动**: 13 个 JSON 配置文件覆盖所有游戏数值

## AI-Tavern 子系统 — 角色聊天

### 架构

```
Tavern MiniApp (apps/tavern/client, Taro 4 + React 18)
  │
  ├── pages/           # 12 页面 (market/chat/archive/game-setup/character/detail/creator/
  │                    #        profile/persona/settings + chats/contacts/discover)
  ├── components/      # CharacterCard/ChatBubble/ModelSelector/Skeleton
  ├── stores/          # 8 stores (authStore/chatStore/characterStore/gameStore/
  │                    #           privacyStore/localCardsStore/syncedCardsStore)
  ├── services/        # httpClient/aiClient/aiService/characterService/marketService/personaService
  └── hooks/           # useSSE (SSE 流式) + useDirectAI (隐私模式直连)
         │
         ▼
Tavern Server (apps/tavern/server, Express + TypeScript)
  │
  ├── routes/          # 13 路由模块 (auth/characters/chat/keys/market/admin/builtin/export/
  │                    #           tier/official/ai + personas/export)
  ├── services/        # 14 服务 (ai-proxy/character/context/export/key/market/moderation/
  │                    #          persona/prompt-builder/social/tier/model-discovery/model-sync)
  └── Prisma           # 13 表 (TavernUser/Card/Like/Fav/Persona/ChatSession/ChatMessage/
                         #         ModerationLog/CardRevision/ApiKey/UserTier/ModelMeta/UserProfile)
         │
         ▼
Dashboard Tavern 管理 (通过 tavern-proxy 代理到 tavern-server)
  │
  ├── pages/           # Tavern (角色审核/密钥审计/角色导入)
  └── services/        # dashboard/src/services/tavern/
```

### 核心数据流 - SSE 流式聊天

```
用户发送消息
   │
   ▼
POST /chat/send → tavern-server → ai-proxy.service
   │                       ├── DashScope (通义千问)
   │                       ├── OpenAI
   │                       ├── DeepSeek
   │                       └── OpenRouter
   │
   ▼
SSE EventSource 流式返回 (useSSE hook)
   │
   ├── 逐 token 追加到 ChatBubble
   ├── 断线自动重连 (EventSource 重连)
   └── 消息历史持久化 (ChatSession/ChatMessage)
```

### 关键特性

- **多 AI Provider**: 支持通义千问/OpenAI/DeepSeek/OpenRouter/MiniMax/Google/Anthropic/智谱/月之暗面 无缝切换
- **模型自动发现**: model-discovery.service 自动探测各 Provider 可用模型列表
- **用户等级系统**: FREE/PAID/TESTER 三级，等级路由和 API
- **角色卡市场**: 发布/审核/收藏/点赞/标签搜索完整链路
- **AI 直连代理**: `/api/v1/ai/generate` 代理端点，支持隐私模式直连
- **双模式 TabBar**: 酒馆模式(酒馆/开始/我的) ↔ 游戏模式(通信/通讯录/发现/我的)
- **游戏存档系统**: gameStore 管理 localStorage 存档，含世界设定/选卡/群组/消息
- **隐私模式**: 本地 API Key 缓存，AI 请求绕过服务器中转直连 Provider
- **暗色模式**: CSS 变量驱动，通过 `<html class="dark-mode">` 切换，Storage 持久化偏好
- **模型发现**: model-discovery.service 自动探测各 Provider 可用模型列表，Profile 页面支持服务商筛选和模型切换
- **API Key 加密**: 用户级 AES-256-GCM 加密存储
- **Prompt 构建**: 系统提示 + 角色定义 + 示例对话 + 历史消息 + 当前消息
- **内容审核**: 敏感词过滤 + 人工审核双机制
- **每日限额**: 用户每日 20 次免费聊天配额
