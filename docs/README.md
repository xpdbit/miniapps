# 📖 项目文档索引

> 个人小程序工坊 — 统一管理后台集中管理多个微信小程序项目。
> 当前 3 个子项目：FTG（食物主题生成器）、Game1（挂机放置游戏）、AI-Tavern（AI 角色聊天）。

## 📁 文档结构（与项目目录一一对应）

```
docs/
├── apps/
│   ├── ftg/
│   │   ├── client/       # FTG 小程序 (Taro + React)
│   │   │   └── README.md
│   │   └── server/       # FTG Express 后端 API
│   │       ├── README.md
│   │       └── API.md
│   ├── game1/
│   │   ├── client/       # Game1 挂机放置游戏 (Taro)
│   │   │   └── README.md
│   │   └── server/       # Game1 Express 后端 API
│   │       ├── README.md
│   │       └── API.md
│   └── tavern/
│       ├── client/       # AI-Tavern 角色聊天 (Taro)
│       │   └── README.md
│       └── server/       # AI-Tavern Express 后端 API
│           ├── README.md
│           └── API.md
├── dashboard/            # 统一管理后台
│   └── README.md
├── deploy/               # Docker/Nginx 部署
│   └── README.md
├── prisma/               # 统一数据库 Schema
│   └── README.md
├── tools/
│   └── supertask/        # AI 自主开发监督系统
├── ARCHITECTURE.md       # 系统架构与数据流
├── superpowers/          # Agent 工作文档 (plans/specs)
├── .attachments/         # 文档附件
├── DOCUMENTATION_RULES.md
└── README.md             # ← 当前文件

旧路径已废弃：docs/apps/*-miniapp/ → docs/apps/*/client/，docs/servers/*/ → docs/apps/*/server/
```

## 📋 项目文档入口

| 项目 | 文档位置 | 主要内容 |
|------|----------|----------|
| **FTG 小程序** | [apps/ftg/client/](./apps/ftg/client/) | 页面/组件/服务/架构说明 |
| **FTG 后端 API** | [apps/ftg/server/](./apps/ftg/server/) | 16 路由模块/17 服务/API 参考 |
| **Game1 小程序** | [apps/game1/client/](./apps/game1/client/) | 17 引擎模块/12 页面/数据流 |
| **Game1 后端 API** | [apps/game1/server/](./apps/game1/server/) | 云端存档/PVP/成就/10 路由模块 |
| **AI-Tavern 小程序** | [apps/tavern/client/](./apps/tavern/client/) | SSE 流式/角色市场/8 页面 |
| **AI-Tavern 后端 API** | [apps/tavern/server/](./apps/tavern/server/) | AI 多 Provider/SSE/10 路由模块 |
| **管理后台** | [dashboard/](./dashboard/) | React 19 + Vite + Ant Design |
| **SuperTask 桌面工具** | [tools/supertask/](./tools/supertask/) | PyQt6 AI 开发监督系统 |
| **部署** | [deploy/](./deploy/) | Docker Compose + Nginx → ECS |
| **数据库 Schema** | [prisma/](./prisma/) | 统一 14 表 Schema |
| **系统架构** | [ARCHITECTURE.md](./ARCHITECTURE.md) | 整体架构与数据流 |
| **文档编写规则** | [DOCUMENTATION_RULES.md](./DOCUMENTATION_RULES.md) | 文档编写规范与模板 |

## 🔗 相关资源

- [规划文档](../plan/) — 项目规划与任务分解
- [域名配置](../domain.config.js) — 所有 Taro 项目的 API_BASE 编译时配置
- [AGENTS.md (根)](../AGENTS.md) — AI Agent 知识库（代码地图/约定/反模式）

---

> 最后更新: 2026-05-16
> 修改: 文档结构调整为与项目目录一一对应。旧路径已废弃 (apps/*-miniapp/, servers/*/)
