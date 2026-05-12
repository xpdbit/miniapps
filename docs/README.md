# 📖 项目文档索引

> 个人小程序工坊 — 统一管理后台集中管理多个微信小程序项目。
> 当前 3 个子项目：FTG（食物主题生成器）、Game1（挂机放置游戏）、AI-Tavern（AI 角色聊天）。

## 📁 文档结构

```
docs/
├── apps/
│   ├── ftg-miniapp/     # FTG 微信小程序 (Taro + React)
│   │   ├── README.md    # 项目概述
│   │   ├── API.md       # 云函数 API 参考（旧架构，标记废弃）
│   │   ├── DATABASE.md  # 数据库设计（旧架构，标记废弃）
│   │   └── DEVELOPMENT.md # 开发指南
│   ├── game1-miniapp/   # Game1 挂机放置游戏
│   │   ├── README.md    # 小程序重构方案（744行）
│   │   └── Items.md     # 物品系统设计
│   └── tavern-miniapp/  # AI-Tavern 角色聊天（参考 AGENTS.md，暂无独立文档）
├── servers/
│   ├── ftg-server/      # FTG Express 后端 API
│   │   └── README.md
│   ├── game1-server/    # Game1 Express 后端 API
│   │   └── README.md
│   └── tavern-server/   # AI-Tavern Express 后端 API
│       └── README.md
├── dashboard/           # 统一管理后台
│   └── README.md
├── deploy/              # Docker/Nginx 部署配置
│   └── README.md
├── tools/
│   └── supertask/       # AI 自主开发监督系统
├── ARCHITECTURE.md      # 系统架构与数据流（跨项目）
├── superpowers/         # Agent 工作文档 (plans/specs)
├── .attachments/        # 文档附件
├── DOCUMENTATION_RULES.md  # 文档编写规则（本文档必须遵守）← 必读
└── README.md            # ← 当前文件（文档导航）
```

## 📋 项目文档入口

| 项目 | 文档位置 | 主要内容 |
|------|----------|----------|
| **FTG 小程序** | [apps/ftg-miniapp/](./apps/ftg-miniapp/) | 项目概述、API 参考、数据库、开发指南 |
| **FTG 后端 API** | [servers/ftg-server/](./servers/ftg-server/) | 项目说明、16 个路由模块 |
| **Game1 小程序** | [apps/game1-miniapp/](./apps/game1-miniapp/) | Unity 挂机放置游戏·小程序重构方案 |
| **Game1 后端 API** | [servers/game1-server/](./servers/game1-server/) | 云端存档·PVP·成就系统·10 路由模块 |
| **AI-Tavern 小程序** | [apps/tavern-miniapp/](./apps/tavern-miniapp/) | Taro 4.x 角色聊天·SSE 流式·角色市场 |
| **AI-Tavern 后端 API** | [servers/tavern-server/](./servers/tavern-server/) | AI 角色聊天·SSE·角色卡市场·10 路由模块 |
| **管理后台** | [dashboard/](./dashboard/) | React 19 + Vite + Ant Design |
| **SuperTask 桌面工具** | [tools/supertask/](./tools/supertask/) | PyQt6 AI 自主开发监督系统 |
| **部署** | [deploy/](./deploy/) | Docker Compose + Nginx 一键部署到 ECS |
| **系统架构** | [ARCHITECTURE.md](./ARCHITECTURE.md) | 整体架构与数据流 |
| **文档编写规则** | [DOCUMENTATION_RULES.md](./DOCUMENTATION_RULES.md) | 文档编写规范与模板（新增/修改文档前必读） |

## 🔗 相关资源

- [规划文档](../plan/) — 项目规划与任务分解
- [域名配置](../domain.config.js) — 所有 Taro 项目的 API_BASE 编译时配置

---

> 最后更新: 2026-05-13
> 修改: 新增 tools/supertask 文档索引
