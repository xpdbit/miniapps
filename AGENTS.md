# 项目知识库 — 导航

> **状态**: current
> **更新**: 2026-05-29
> 
> 本文档是 Agent 的导航入口。只存指引，不存详细内容。
> 详细约定、反模式、架构等在 `docs/` 中维护。
> 对于未知的知识，推荐优先去 `knowledge/` 中寻找
> 
> **约束**：OpenCode的 Agent，即你，所配置的AI模型使用中文输入输出的TOKEN消耗更低，所以请尽可能使用中文！

## 快速认知

- 项目概览：`docs/README.md`
- 系统架构：`docs/ARCHITECTURE.md`
- 代码约定：`docs/standards/CONVENTIONS.md`
- 反模式列表：`docs/standards/ANTI-PATTERNS.md`
- 项目文档均在：`docs/`相同子路径下，例如 `tools/supertask` 的文档位于 `docs/tools/supertask/`

## 找代码 / 文件

| 我想找 | 去这里 |
|--------|--------|
| 某个功能/模块在哪 | `apps/*/AGENTS.md`（各子项目的代码地图） |
| API 接口定义 | `docs/apps/{project}/{client\|server}/API.md` |
| 数据库 Schema | `docs/database/{lib}.md` |

## 找文档

| 我想找 | 去这里 |
|--------|--------|
| 架构图、数据流、跨项目关系 | `docs/ARCHITECTURE.md` |
| 服务器运维、部署流程 | `docs/ops/` |
| 设计文档、方案选型 | `plan/specs/` |
| 当前进行中的任务 | `plan/current_task.md` |
| 未成熟的想法 | `plan/ideas/` |
| 文档编写规范 | `docs/standards/` |

## 找知识

- `knowledge/` 是长期维护的知识库，优先采用知识库中的信息
- `knowledge/INDEX.md` 是知识库的快速引导
- `knowledge/knowledge.db` 是 SQLite 数据源，通过 `npm run knowledge` CLI 查询
- 搜索知识: `npm run knowledge query <关键词>`
- 写入知识: 管道 JSON 到 `npm run knowledge capture`
- 详细文档: `docs/tools/knowledge/`
- 设计 Spec: `plan/specs/2026-05-30-knowledge-base-automation-design.md`

## 手册 / 指南

| 手册 | 位置 | 用途 |
|------|------|------|
| 项目构建指南 | `docs/manual/build-guide.md` | 构建/运行/排查构建问题 |
| Dashboard 测试修复手册 | `docs/manual/dashboard-test-repair.md` | 自动化测试与修复流程 |
| Miniapps Web 修复手册 | `docs/manual/miniapps-web-repair.md` | 整体 Web 服务测试与故障排查 |
| 部署指南 | `docs/ops/deploy.md` | ECS 部署方案（docker cp / compose / 镜像推送） |
| 小程序自动化检查工作流 | `docs/standards/CONVENTIONS.md` → mp-automator 章节 | 修改样式/组件/导航前 MUST 执行 |

## 关键命令速查

| 项目 | 目录 | 构建 | 开发 |
|------|------|------|------|
| FTG 客户端 | `apps/ftg/client` | `npm run build:weapp` | `npm run dev:weapp` |
| FTG 服务端 | `apps/ftg/server` | `npm run build` | `npm run dev` |
| Game1 客户端 | `apps/game1/client` | `npm run build:weapp` | `npm run dev:weapp` |
| Game1 服务端 | `apps/game1/server` | `npm run build` | `npm run dev` |
| Tavern 客户端 | `apps/tavern/client` | `npm run build:weapp` | `npm run dev:weapp` |
| Tavern 服务端 | `apps/tavern/server` | `npm run build` | `npm run dev` |
| Dashboard | `dashboard` | `npm run build` | `npm run dev` |
| 部署 | `deploy/scripts/deploy.sh` | `bash deploy.sh` | — |

详细命令列表见 `docs/standards/CONVENTIONS.md` → COMMANDS 章节。

## 微信小程序开发

涉及任何小程序样式/组件/导航/交互修改前，MUST 先用自动化工具检查运行时状态。

详细工作流见 `docs/standards/CONVENTIONS.md` → mp-automator 强制工作流。

---

## Playwright 截图

调用 Playwright MCP 的 `browser_take_screenshot` 时，**MUST** 在 `filename` 参数中加 `tmp/` 前缀：

```
browser_take_screenshot(filename="tmp/xxx.png", ...)
```

`browser_snapshot` 同理，**MUST** 加 `tmp/` 前缀：

```
browser_snapshot(filename="tmp/xxx.yml", ...)
```

根目录截图和快照文件会破坏工作区整洁，且 `tmp/` 已在 `.gitignore` 中忽略，不会误提交。

---

## 命令执行规则

所有可能耗时或阻塞的命令（build/watch/serve/deploy/test 等），**MUST** 使用以下方式在**新窗口中异步执行**，防止阻塞 Agent 会话：

```
Start-Process -WindowStyle Normal -FilePath "cmd" -ArgumentList "/c <command>"
```

示例：
```
Start-Process -WindowStyle Normal -FilePath "cmd" -ArgumentList "/c npm run dev"
Start-Process -WindowStyle Normal -FilePath "cmd" -ArgumentList "/c bash deploy.sh"
```

**规则：**
- 快速命令（grep、ls、git status 等）可正常同步执行
- 构建/运行/部署/监听类命令 → MUST 在新窗口异步执行
- 涉及交互式输入的命令 → MUST 在新窗口异步执行
- 禁止使用 `Wait-Process` 或 `-Wait` 参数等待新窗口中的命令完成

---

> **维护规则**: 新增功能/模块 → 写入所属子项目 `apps/*/AGENTS.md`，不要写入此文件。
> 新增约定/反模式 → 写入 `docs/standards/`，此文件只加一行导航链接。
