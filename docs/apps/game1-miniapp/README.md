> 🚫 **废弃文档** — 本文档路径结构与项目实际目录不匹配。
> 当前架构已迁移至新路径: `docs/apps/game1/client/README.md`
> 此旧文件保留作为归档参考，不再更新。

# apps/game1-miniapp — 挂机放置游戏微信小程序

**Unity 6 挂机放置游戏的小程序重构版**，基于 Taro 4.x + React 18，纯 TS 游戏逻辑引擎驱动。

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Taro 4.0.13 + React 18 + TypeScript 5.x |
| 状态管理 | Zustand 5 |
| 样式 | Sass |
| 游戏循环 | setInterval 100ms（10fps） |
| 配置驱动 | 13 个 JSON 配置文件 |

## 当前状态

🚧 **Phase 1—P2 开发阶段**。引擎核心层（GameLoop / EventBus / SaveManager）已完成，Travel / Combat / Team / Inventory 子系统移植中。

## 项目结构

```
src/
├── engine/       # 纯 TS 游戏逻辑引擎 (17 子模块)
├── stores/       # Zustand 状态管理 (10 stores)
├── pages/        # 12 个页面
├── components/   # 通用 UI 组件
└── config/       # JSON 数据配置 (13 个)
```

## 开发阶段

| 阶段 | 内容 | 工时 |
|------|------|------|
| Phase 0 | 基座搭建（GameLoop + 存档 + 配置） | 2-3 天 ✅ |
| Phase 1 | 核心玩法（旅行 + 战斗 + 队伍 + 背包） | 7-10 天 🚧 |
| Phase 2 | 系统深化（技能、卡牌、成就、事件） | 5-7 天 📅 |
| Phase 3 | 进阶内容（轮回、地图、宠物） | 5-7 天 📅 |
| Phase 4 | 社交 & 完善（PVP、分享、订阅消息） | 3-5 天 📅 |

## 快速开始

```bash
cd apps/game1-miniapp
npm install
npm run dev:weapp
```

## 关键文档

- [DESIGN.md](./DESIGN.md) — 完整重构方案（架构/模块映射/里程碑）
- [AGENTS.md](../../../apps/game1-miniapp/AGENTS.md) — AI Agent 知识库（代码地图/约定）
- [game1-server 后端 API](../servers/game1-server/README.md)

---

> 最后更新: 2026-05-13
> 修改: 从重构方案拆分为项目概述（重构内容迁移至 DESIGN.md）
