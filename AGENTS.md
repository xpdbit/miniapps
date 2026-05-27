# 项目知识库 — 导航

> **状态**: current
> **更新**: 2026-05-30
>
> 本文档是 Agent 的导航入口。只存指引，不存详细内容。
> 详细约定、反模式、架构等在 `docs/` 中维护。

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

## 临时文件 / 缓存清理

### 分类与状态

| 目录 | 位置 | 类型 | git 状态 | 说明 |
|------|------|------|----------|------|
| `node_modules/` | 各项目根、`tools/*/`、`.opencode/` | 依赖 | `.gitignore` 忽略 | `npm install` 重建 |
| `dist/` | `apps/*/server/` | 构建产物 | `.gitignore` 忽略 | `npm run build` 重建 |
| `dist/` | `apps/*/client/` | 构建产物 | `.gitignore` 忽略 | `npm run build:weapp` 重建 |
| `dist-weapp/` | `apps/*/client/` | 构建产物 | `.gitignore` 忽略 | 微信小程序编译输出 |
| `dist-h5/` | `apps/tavern/client/` | 构建产物 | `.gitignore` 忽略 | H5 编译输出 |
| `dist-server/` | `dashboard/` | 构建产物 | **已跟踪** | Admin API 编译产物（已提交） |
| `dist-temp/` | `dashboard/` | 临时产物 | **未跟踪，未忽略** | 构建临时文件，可删除 |
| `__pycache__/` | 根、`local_server/` | Python 缓存 | `.gitignore` 忽略 | 自动生成 |
| `.pytest_cache/` | 根、`tools/oce/` | 测试缓存 | **未跟踪，未忽略** | `pytest` 自动生成 |
| `.swc/` | `apps/*/client/` | SWC 编译缓存 | **未跟踪，未忽略** | Taro SWC 编译器缓存 |
| `test-results/` | `apps/tavern/client/` | 测试报告 | **未跟踪，未忽略** | Playwright 测试输出 |
| `tmp/` | 根 | 临时文件 | `.gitignore` 忽略 | Playwright 截图/快照临时存储 |
| `.sisyphus/` | 根 | 工具状态 | `.gitignore` 忽略 | Sisyphus 工作计划 |
| `.playwright-mcp/` | 根 | 工具状态 | `.gitignore` 忽略 | Playwright MCP 运行时 |
| `plan/` | 根 | 规划文档 | `.gitignore` 忽略 | 设计文档/想法/任务分解 |
| `state/` | 根 | 调试脚本 | **部分跟踪** | 旧 Supertask 状态（已跟踪），新调试脚本（未跟踪）|
| `.codegraph/` | 根 | 代码分析缓存 | **未跟踪，未忽略** | OpenCode 代码图谱缓存 |
| `.oce/` | 根 | OCE 运行时 | **未跟踪，未忽略** | OCE 工具状态和日志 |
| `local_server/` | 根 | 本地开发环境 | **未跟踪，未忽略** | Docker Compose + 服务启动脚本 |
| `qc` | 根 | 未知文件 | **未跟踪，未忽略** | 根目录孤立文件 |

### 一键清理命令（请审核后再执行）

```bash
# 删除所有 node_modules（需重新 npm install）
Get-ChildItem -Path . -Directory -Recurse -Depth 3 -Force |
  Where-Object { $_.Name -eq 'node_modules' } |
  Remove-Item -Recurse -Force

# 删除构建产物
Remove-Item -Recurse -Force apps/*/client/dist, apps/*/server/dist, apps/*/client/dist-weapp, apps/*/client/dist-h5, dashboard/dist-temp -ErrorAction SilentlyContinue

# 删除 Python 缓存
Remove-Item -Recurse -Force __pycache__, local_server/__pycache__, tools/oce/__pycache__ -ErrorAction SilentlyContinue

# 删除测试缓存
Remove-Item -Recurse -Force .pytest_cache, tools/oce/.pytest_cache -ErrorAction SilentlyContinue

# 删除 SWC 编译缓存
Remove-Item -Recurse -Force apps/ftg/client/.swc, apps/game1/client/.swc, apps/tavern/client/.swc -ErrorAction SilentlyContinue

# 删除 Playwright 测试输出
Remove-Item -Recurse -Force apps/tavern/client/test-results -ErrorAction SilentlyContinue
```

### 大小概览（清理参考）

```bash
# 查看各目录大小（PowerShell）
Get-ChildItem -Directory -Force .codegraph, .oce, .opencode, .pytest_cache, state, local_server, qc, tmp, .sisyphus |
  ForEach-Object { $size = (Get-ChildItem $_.FullName -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum; [PSCustomObject]@{Name=$_.Name; SizeMB=[math]::Round($size/1MB, 2)} } |
  Sort-Object SizeMB -Descending
```

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

> **维护规则**: 新增功能/模块 → 写入所属子项目 `apps/*/AGENTS.md`，不要写入此文件。
> 新增约定/反模式 → 写入 `docs/standards/`，此文件只加一行导航链接。
