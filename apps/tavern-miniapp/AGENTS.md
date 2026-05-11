# apps/tavern-miniapp — 微信小程序

## OVERVIEW
Taro 4.x 微信小程序 (React 18 + Zustand 5 + TypeScript + Sass)，AI-Tavern 角色聊天应用。角色市场浏览、SSE 流式聊天、角色卡创建与管理、自定义人设。

## STRUCTURE
```
apps/tavern-miniapp/
├── src/
│   ├── app.ts           # 小程序入口 (认证初始化+配额刷新)
│   ├── app.config.ts    # 小程序配置 (3 tabBar 页面)
│   ├── app.scss         # 全局样式 & CSS 变量 (暗色主题)
│   ├── pages/           # 页面组件
│   │   ├── market/      # 角色市场 (浏览/搜索/标签/轮播)
│   │   ├── chat/        # 聊天页面 (SSE 流式/会话管理)
│   │   ├── character/   # 角色详情
│   │   │   └── detail/  # 角色详情页
│   │   ├── creator/     # 角色卡编辑/发布
│   │   ├── profile/     # 个人主页
│   │   ├── persona/     # 自定义人设管理
│   │   └── settings/    # 设置 (API Key/偏好)
│   ├── components/      # 共享组件
│   │   ├── CharacterCard/ # 角色卡片
│   │   ├── ChatBubble/  # 聊天气泡
│   │   ├── ModelSelector/ # 模型选择器
│   │   └── Skeleton/    # 骨架屏
│   ├── services/        # API 封装
│   │   ├── httpClient.ts  # 统一 HTTP 客户端 (JWT 自动携带/401 拦截)
│   │   ├── characterService.ts # 角色卡 CRUD
│   │   ├── marketService.ts    # 角色市场 API
│   │   └── personaService.ts   # 人设 API
│   ├── stores/          # Zustand 状态管理
│   │   ├── authStore.ts      # 认证状态 (微信登录/JWT/每日配额)
│   │   ├── chatStore.ts      # 聊天状态 (会话/消息/流式/模型选择)
│   │   └── characterStore.ts # 角色卡状态
│   ├── hooks/           # 自定义 Hooks
│   │   └── useSSE.ts    # SSE 流式聊天 Hook
│   ├── types/           # TypeScript 类型定义
│   │   ├── character.ts # 角色卡类型
│   │   ├── chat.ts      # 聊天类型 (会话/消息)
│   │   └── common.ts    # 通用类型
│   ├── utils/           # 工具函数
│   └── constants/       # 常量定义
└── package.json         # Taro 4.0.13 + React 18 + Zustand 5
```

## WHERE TO LOOK
| 关注点 | 位置 | 说明 |
|--------|------|------|
| 角色市场 | `src/pages/market/` + `src/services/marketService.ts` | 角色卡浏览/搜索/标签/轮播 |
| 聊天页面 | `src/pages/chat/` + `src/hooks/useSSE.ts` | SSE 流式聊天/会话管理 |
| 角色创建 | `src/pages/creator/` + `src/services/characterService.ts` | 角色卡编辑/发布 |
| 角色详情 | `src/pages/character/` + `src/pages/character/detail/` | 角色详情/收藏 |
| 个人设置 | `src/pages/profile/` + `src/pages/settings/` | 个人信息/API Key/偏好 |
| 人设管理 | `src/pages/persona/` | 自定义人设 |
| 认证状态 | `src/stores/authStore.ts` | 微信登录/JWT/每日配额 |
| 聊天状态 | `src/stores/chatStore.ts` | 会话/消息/流式 |
| 角色状态 | `src/stores/characterStore.ts` | 角色卡缓存/收藏 |
| HTTP 客户端 | `src/services/httpClient.ts` | JWT 自动携带/401 拦截 |
| 类型定义 | `src/types/character.ts` + `chat.ts` | 角色卡/聊天类型 |
| 小程序配置 | `src/app.config.ts` | 3 tab (市场/聊天/我的) |
| CSS 变量 | `src/app.scss` | 暗色主题/紫色主色 #8B5CF6 |
| SSE 流式 | `src/hooks/useSSE.ts` | EventSource 封装/断线重连 |

## CONVENTIONS
- Taro 4.x API (4.0.13)，构建命令 `taro build --type weapp`
- React 18 + TypeScript strict 模式
- Zustand 5 状态管理
- Sass 模块化样式 (`.module.scss`)
- 路径别名 `@/*`, `@services/*`, `@stores/*`, `@types/*`, `@hooks/*`, `@components/*`
- Prettier: printWidth 100, singleQuote, trailingComma all
- 2 空格缩进，LF 换行，UTF-8

## COMMANDS
```bash
npm run dev:weapp        # Taro 开发模式 (watch 热重载)
npm run build:weapp      # Taro 生产构建
npm run type-check       # TypeScript 类型检查
npm run lint             # ESLint 代码检查
npm run format           # Prettier 格式化
npm run generate-icons   # 生成 tabBar 图标
```

## NOTES
- **Taro 4.0.13** + React 18 + Zustand 5
- **3 个 tabBar 页面**: 市场/聊天/我的
- **API_BASE_URL 编译时注入**: 通过根目录 `domain.config.js` 配置
- **SSE 流式聊天**: `useSSE` hook 封装 EventSource，支持断线重连和流式消息追加
- **认证流程**: wx.login() → POST /auth/login → JWT → Taro Storage 持久化 → restoreSession 自动恢复
- **每日配额**: authStore 管理每日消息配额，小程序切前台时自动刷新
- **HTTP 客户端**: HttpClient 类封装 Taro.request，自动携带 JWT token，401 响应时触发登出
- **角色市场**: 支持标签筛选、分页加载、轮播推荐
- **多模型支持**: 通过 ModelSelector 组件切换 AI 模型 (通义千问等)
