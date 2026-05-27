# 项目文档

> 个人小程序工坊 — 统一管理后台集中管理多个微信小程序项目。

## 文档结构（与项目目录一一对应）

```
docs/
├── apps/                     # 各应用文档
│   ├── ftg/{client,server}
│   ├── game1/{client,server}
│   └── tavern/{client,server}
├── dashboard/               # 统一管理后台
├── database/                # 4 库独立 Schema
├── manual/                  # 操作手册
├── ops/                     # 服务器运维 + 部署
├── standards/               # 代码约定、反模式、文档规范
├── tools/                   # 开发工具
│   ├── opencode-tui-enhance/ # 🚫 已迁移至 oce/
│   └── supertask/           # 🚫 已存档
├── ARCHITECTURE.md          # 系统架构
├── CHANGELOG.md             # 文档变更日志
├── edge.md                  # 文档关联与边界
├── rules.md                 # 文档编写规则
├── urls.md                  # URL 引用清单
└── README.md                # ← 当前文件
```

## 项目文档入口

| 项目 | 文档位置 | 主要内容 |
|------|----------|----------|
| **FTG 小程序** | [apps/ftg/client/](./apps/ftg/client/) | 13 页面、9 组件、数据流 |
| **FTG 后端 API** | [apps/ftg/server/](./apps/ftg/server/) | 16 路由模块、17 服务、API 参考 |
| **Game1 小程序** | [apps/game1/client/](./apps/game1/client/) | 17 引擎模块、12 页面 |
| **Game1 后端 API** | [apps/game1/server/](./apps/game1/server/) | 云端存档、PVP、成就、10 路由 |
| **AI-Tavern 小程序** | [apps/tavern/client/](./apps/tavern/client/) | SSE 流式、角色市场、12 页面 |
| **AI-Tavern 后端 API** | [apps/tavern/server/](./apps/tavern/server/) | 多 AI Provider、SSE、14 路由 |
| **管理后台** | [dashboard/](./dashboard/) | React 19 + Vite + Ant Design |
| **SuperTask 工具** 🚫 | [tools/supertask/](./tools/supertask/) | **已存档** — 功能整合至 OCE |
| **OCE 工具** | [tools/oce/](../tools/oce/) | PyQt6 OpenCode 监控与看门狗 |
| **部署工具** | [tools/deploy/](../tools/deploy/) | Docker Compose + Nginx → ECS |
| **数据库 Schema** | [database/](./database/) | 4 库独立 Schema 概览 |
| **系统架构** | [ARCHITECTURE.md](./ARCHITECTURE.md) | 整体架构与数据流 |
| **文档编写规则** | [standards/](./standards/) | 代码约定、反模式、文档规范 |
| **文档关联边界** | [edge.md](./edge.md) | 文档间关联与边界说明 |
| **服务器运维** | [ops/](./ops/) | ECS 信息、部署流程 |
| **URL 引用清单** | [urls.md](./urls.md) | 外部/内部/部署链接 |

## 关键文件引用

- [AGENTS.md (根)](../AGENTS.md) — Agent 导航目录（指引找代码/文档/命令）
- [plan/](../plan/) — 项目规划与任务分解
- [domain.config.js](../domain.config.js) — 所有 Taro 项目的 API_BASE 编译时配置

---

> 最后更新: 2026-05-28
> 修改: 全量文档同步 — 工具迁移、新组件/路由/页面、ANTI-PATTERNS 更新
