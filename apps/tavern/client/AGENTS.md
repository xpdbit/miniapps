# apps/tavern/client — 微信小程序 + H5 Web

## OVERVIEW
Taro 4.x 跨平台应用 (React 18 + Zustand 5 + TypeScript + Sass)，AI-Tavern 角色聊天应用。支持微信小程序和 H5 Web 双平台。
核心功能：角色市场浏览、SSE 流式聊天、角色卡创建与管理、自定义人设、双模式 TabBar（酒馆/游戏模式）。

## STRUCTURE
```
apps/tavern/client/
├── index.html                # H5 Web 入口 HTML 模板
├── src/
│   ├── app.ts                 # 应用入口 (认证初始化/配额刷新)
│   ├── app.config.ts          # 小程序配置 (12 pages + 3 tabBar)
│   ├── app.scss               # 全局样式 & CSS 变量 (暗色主题)
│   ├── custom-tab-bar/        # 自定义底部栏 (双模式)
│   ├── pages/                 # 12 个页面
│   │   ├── cards/              # 卡片集 (浏览/搜索/标签/轮播)
│   │   ├── chat/              # 聊天页面 (SSE 流式/会话管理)
│   │   ├── archive/           # 聊天归档
│   │   ├── game-setup/        # 游戏模式设置
│   │   ├── character/         # 角色详情
│   │   │   └── detail/        # 角色详情页
│   │   ├── creator/           # 角色卡编辑/发布
│   │   ├── profile/           # 个人主页
│   │   ├── persona/           # 自定义人设管理
│   │   ├── chats/             # [游戏模式] 通信-聊天列表
│   │   ├── contacts/          # [游戏模式] 通讯录
│   │   └── discover/          # [游戏模式] 发现
│   ├── components/            # 共享组件
│   │   ├── CharacterCard/     # 角色卡片
│   │   ├── ChatBubble/        # 聊天气泡
│   │   ├── ModelSelector/     # 模型选择器
│   │   └── Skeleton/          # 骨架屏
│   ├── services/              # API 封装
│   │   ├── httpClient.ts      # 统一 HTTP 客户端 (JWT 自动携带/401拦截)
│   │   ├── aiClient.ts        # AI 流式调用客户端
│   │   ├── aiService.ts       # AI 服务 (含发现模型)
│   │   ├── characterService.ts # 角色卡 CRUD
│   │   ├── marketService.ts   # 卡片集 API
│   │   └── personaService.ts  # 人设 API
│   ├── stores/                # Zustand 状态管理 (8 stores)
│   │   ├── authStore.ts       # 认证状态 (微信登录/JWT/每日配额)
│   │   ├── chatStore.ts       # 聊天状态 (会话/消息/流式/模型选择)
│   │   ├── characterStore.ts  # 角色卡状态
│   │   ├── gameStore.ts       # 游戏模式状态 (存档/群组/消息)
│   │   ├── privacyStore.ts    # 隐私模式 (本地 API Key 缓存)
│   │   ├── localCardsStore.ts # 本地角色卡缓存
│   │   └── syncedCardsStore.ts # 同步角色卡状态
│   ├── hooks/                 # 自定义 Hooks
│   │   ├── useSSE.ts          # SSE 流式聊天 Hook
│   │   └── useDirectAI.ts     # 隐私模式直接 AI 调用 Hook
│   ├── types/                 # TypeScript 类型定义
│   │   ├── character.ts       # 角色卡类型
│   │   ├── chat.ts            # 聊天类型 (会话/消息)
│   │   ├── game.ts            # 游戏模式类型 (存档/群组)
│   │   └── common.ts          # 通用类型
│   ├── utils/                 # 工具函数
│   └── constants/             # 常量定义
└── package.json               # Taro 4.x + React 18 + Zustand 5
```

## WHERE TO LOOK
| 关注点 | 位置 | 说明 |
|--------|------|------|
| 卡片集 | `src/pages/cards/` + `src/services/marketService.ts` | 角色卡浏览/搜索/标签/轮播 |
| 聊天页面 | `src/pages/chat/` + `src/hooks/useSSE.ts` | SSE 流式聊天/会话管理 |
| 角色创建 | `src/pages/creator/` + `src/services/characterService.ts` | 角色卡编辑/发布 |
| 角色详情 | `src/pages/character/` + `src/pages/character/detail/` | 角色详情/收藏 |
| 游戏设置 | `src/pages/game-setup/` | 游戏模式创建/选卡/世界设定 |
| 双模式 TabBar | `src/custom-tab-bar/index.tsx` | 酒馆模式 ↔ 游戏模式切换 |
| 游戏存档 | `src/stores/gameStore.ts` | 存档创建/群组/消息管理 |
| 隐私模式 | `src/stores/privacyStore.ts` | 隐私模式开关 + 本地 API Key |
| 直接 AI 调用 | `src/hooks/useDirectAI.ts` | 隐私模式绕过中转直连 AI |
| 个人设置 | `src/pages/profile/` + `src/pages/settings/` | 个人信息/API Key/偏好 |
| 人设管理 | `src/pages/persona/` | 自定义人设 |
| 通信页面 | `src/pages/chats/` | 游戏模式-通信列表 |
| 通讯录页面 | `src/pages/contacts/` | 游戏模式-联系人 |
| 发现页面 | `src/pages/discover/` | 游戏模式-发现/朋友圈 |
| SSE 流式 | `src/hooks/useSSE.ts` | EventSource 封装/断线重连，支持 events + state 事件 |
| AI Script 客户端 | `src/hooks/useAiScript.ts` | 响应 AI Script 事件，更新本地游戏状态，触发 UI 反馈 |
| AI Script 类型 | `src/types/ai-script.ts` | 客户端事件类型定义 (ScriptEvent/GameWorldState) |
| 认证状态 | `src/stores/authStore.ts` | 微信登录/JWT/每日配额 |
| HTTP 客户端 | `src/services/httpClient.ts` | JWT 自动携带/401 拦截 |
| 类型定义 | `src/types/` | character.ts/chat.ts/game.ts/ai-script.ts |

## CONVENTIONS
- Taro 4.x API，构建命令 `taro build --type weapp` / `taro build --type h5`
- React 18 + TypeScript strict 模式
- Zustand 5 状态管理
- Sass 模块化样式 (`.module.scss`)
- 路径别名 `@/*`, `@services/*`, `@stores/*`, `@types/*`, `@hooks/*`, `@components/*`
- Prettier: printWidth 100, singleQuote, trailingComma all
- 2 空格缩进，LF 换行，UTF-8

## COMMANDS
```bash
npm run dev:weapp        # 微信小程序开发模式 (watch 热重载)
npm run build:weapp      # 微信小程序生产构建
npm run dev:h5           # H5 Web 开发模式 (watch 热重载, port 5174)
npm run dev:h5:local     # H5 本地开发 (API → localhost:3002)
npm run dev:h5:remote    # H5 远程开发 (API → mnapp.top)
npm run dev:web          # H5 Web 开发快捷命令 (= dev:h5:local)
npm run build:h5         # H5 Web 开发构建
npm run build:web        # H5 Web 生产构建 (= build:h5:prod)
npm run build:h5:prod    # H5 生产构建
npm run type-check       # TypeScript 类型检查
npm run lint             # ESLint 代码检查
npm run format           # Prettier 格式化
npm run generate-icons   # 生成 tabBar 图标
```

## NOTES
- **Taro 4.x** + React 18 + Zustand 5
- **双平台**: 微信小程序 (weapp) + H5 Web 浏览器
- **H5 Dev Server**: 端口 5174，host 0.0.0.0，支持局域网访问
- **H5 路由**: hash 模式，配置 8 个自定义路由路径
- **H5 入口**: `index.html` — 通过 HtmlWebpackPlugin 自动注入 JS/CSS bundles
- **H5 认证**: 网页版仅支持账号密码登录，微信登录按钮自动隐藏
- **双模式 TabBar**: 通过 `gameStore.gameMode` 切换 — 酒馆模式(酒馆/开始/我的) ↔ 游戏模式(通信/通讯录/发现/我的)
- **游戏模式存档**: gameStore 管理 localStorage 持久化存档，含世界设定/选卡/群组/消息
- **隐私模式**: privacyStore 管理隐私开关，开启后 AI 请求绕过服务器中转，用户本地缓存 API Key
- **SSE 流式聊天**: useSSE hook 封装 Taro.request，支持断线重连和流式消息追加
- **认证流程 (weapp)**: wx.login() → POST /auth/wechat/login → JWT → Taro Storage 持久化 → restoreSession 自动恢复
- **认证流程 (H5)**: 账号密码 → POST /auth/login → JWT → Taro Storage 持久化 → restoreSession 自动恢复
- **每日配额**: authStore 管理每日消息配额，切前台时自动刷新
- **HTTP 客户端**: HttpClient 类封装 Taro.request，自动携带 JWT token，401 响应时触发登出
- **角色市场**: 支持标签筛选、分页加载、轮播推荐
- **多模型支持**: 通过 ModelSelector 组件切换 AI 模型
- **API_BASE_URL 编译时注入**: 通过根目录 `domain.config.js` 配置
- **H5 兼容性**: 已移除未使用的 `tdesign-miniprogram-taro` 依赖和 `app.config.ts` 中的 `usingComponents` 配置
- **mp-automator 工作流**: 样式/组件/导航/交互相关修改前，MUST 先通过 mp-automator 检查运行时 DOM。详见根目录 `AGENTS.md` → "微信小程序开发 — mp-automator 强制工作流"
