# AI-Tavern 客户端

AI 角色聊天小程序，基于 Taro 4.x 跨平台框架。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | Taro 4.0.13 |
| UI | React 18 + Sass Module |
| 状态 | Zustand 5 |
| 流式通信 | SSE (EventSource, enableChunked) |
| 语言 | TypeScript strict |

## 页面

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| /pages/market/index | 角色市场 | 浏览和搜索角色卡片 |
| /pages/chat/index | 聊天 | SSE 流式对话，逐 token 展示 |
| /pages/character/detail | 角色详情 | 查看角色信息与对话风格 |
| /pages/creator/index | 角色创建 | 4 步向导：基础信息 → 人设 → 对话风格 → 预览 |
| /pages/profile/index | 个人中心 | 用户信息和统计数据 |
| /pages/persona/index | 人设管理 | 管理用户角色设定 |
| /pages/settings/index | 设置 | API Key 管理等 |

## 组件

- **CharacterCard** — 角色卡片，含头像/名称/简介/标签
- **ChatBubble** — 聊天气泡，区分用户/AI 消息
- **ModelSelector** — 21 个模型选择器
- **Icon** — SVG 图标系统
- **Skeleton** — 内容骨架屏
- **EmptyState** — 空状态占位

## 数据流

### 状态管理（5 个 Store）

- `authStore` — 登录态/JWT token 管理
- `chatStore` — 聊天会话与消息列表
- `characterStore` — 远程角色数据（API 拉取）
- `localCardsStore` — 本地创建的角色卡片，Storage 持久化
- `syncedCardsStore` — 官方同步卡片，500ms 防抖写入

### 服务层

- `httpClient` — 自动携带 JWT，401 拦截跳登录
- `characterService` — 角色 CRUD
- `marketService` — 市场查询/搜索
- `officialService` — 官方卡片同步
- `personaService` — 人设管理

### SSE 流式聊天

通过 `useSSE` hook 封装，核心逻辑：

1. 调用 `Taro.request` 并设置 `enableChunked: true`
2. 逐行解析 `data: ` 前缀的 JSON 事件
3. 流式追加 token 到当前消息
4. 断线自动重连

## 项目结构

```
apps/tavern/client/src/
├── app.ts                 # 应用入口
├── app.config.ts          # 小程序配置（3 tabBar）
├── pages/                 # 8 个页面
├── components/            # 6 个共享组件
├── stores/                # 5 个 Zustand stores
├── services/              # 5 个服务模块
├── hooks/                 # 自定义 hooks（useSSE）
├── types/                 # 类型定义
├── utils/                 # 工具函数
├── constants/             # 常量
└── custom-tab-bar/        # 自定义底部导航
```

## 开发命令

```bash
npm run dev:weapp     # 微信开发者工具（watch）
npm run dev:h5        # H5 开发（watch）
npm run build:weapp   # 生产构建
npm run build:h5      # H5 生产构建
npm run type-check    # TypeScript 类型检查
npm run lint          # ESLint
npm run format        # Prettier 格式化
```
