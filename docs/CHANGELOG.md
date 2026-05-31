# 文档变更日志

> **状态**: current
> **更新**: 2026-05-31
> 
> ## 2026-05-31 — 全量文档同步：Tavern 配卡方案系统 + 模型管理扩展 + 工具迁移

### 核心变化

| 操作 | 详情 |
|------|------|
| **Tavern 客户端文档更新** | 页面 12→13（新增 scheme-detail），组件新增 SchemeCard，stores 8→9（新增 schemeStore），services marketService.ts→cardService.ts，新增 aiWorldBuilder.ts |
| **Tavern 服务端文档更新** | 路由 13→15（新增 cardSchemes 路由），market.service.ts 删除 → card.service.ts + cardScheme.service.ts 替代，services 14→15 |
| **Tier 服务护盾机制** | 新增内置免费模型兜底（BUILTIN_FALLBACK_MODELS），当所有活跃模型被过滤时自动降级返回 |
| **模型管理扩展** | Dashboard TavernModelManager 新增编辑弹窗 + 批量编辑 + 行选择；API 扩展 displayName/icon/description/sortOrder 字段 |
| **local_server 迁移文档** | docs/tools/local_server/README.md 已从 untracked 纳入跟踪 |
| **superpowers 新文档** | docs/superpowers/plans/ + docs/superpowers/specs/ 新增 card-scheme 和 x-knowledge 设计文档 |
| **已删除工具文档** | docs/tools/opencode-tui-enhance/ 和 docs/tools/supertask/ 已从仓库删除（迁移至 tools/oce/） |
| **knowledge FTS tokenizer 修复** | `unicode61 tokenchars` → `unicode61`（db.js），同步知识库文档 |
| **登录限流放宽** | tavern-server auth.ts loginLimiter 10→30 次/15min，兼顾正常登录重试 |
| **错误日志增强** | config-provider.service.ts 和 admin-config.service.ts 的 catch 日志兼容多种 Error 结构 |

### docs/ 文件同步

| 文件 | 变更 |
|------|------|
| `docs/README.md` | 结构树移除 opencode-tui-enhance/supertask，新增 superpowers/local_server 子目录 |
| `docs/ARCHITECTURE.md` | Tavern 子系统架构图更新；新增配卡方案/模型管理/护盾机制说明 |
| `docs/dashboard/README.md` | TavernModelManager 编辑/批量编辑功能更新 |
| `docs/urls.md` | 修复 local_server/dev_console.py 引用路径 |
| `docs/CHANGELOG.md` | ← 当前条目 |
| `docs/edge.md` | 日期更新 |
| `docs/rules.md` | 日期更新 |

---

## 2026-05-28 — 系统监控修复：CPU/内存/磁盘指标错误 + 健康探测宕机修复

### 核心变化

| 操作 | 详情 |
|------|------|
| **修复 CPU 使用率始终为 0%** | `os.loadavg()` 在 Windows 返回 `[0,0,0]`，改为 `os.cpus()` 差值计算，跨平台适配 |
| **修复磁盘信息始终为 0** | `df -k /` 是 Linux-only 命令，Windows 改为 `fsutil volume diskfree` 解析，中英文通用 |
| **修复内存百分比 Linux 过高** | Linux 使用 `/proc/meminfo` 的 `MemAvailable` 替代 `MemFree`，反映真实可用内存 |
| **修复 busy-wait 阻塞事件循环** | CPU 测量的 `while(spin)` 改为 `await setTimeout`，非阻塞 100ms 采样 |
| **修复服务健康探测永远宕机** | `project.api_base_url` 字段名错误（应为 `apiBaseUrl`），导致所有健康探测失败 |
| **修复 projectId 类型不匹配** | 后端使用 UUID 字符串但前端/缓存用 number，统一为 string |
| **修复健康探测 URL 解析** | `apiBaseUrl` 可能是前端相对路径，新增 `getHealthBaseUrl()` 按 slug 映射到实际服务器 URL |

## 2026-05-28 — 全量文档同步：工具迁移、新组件/路由/页面

### 核心变化

| 操作 | 详情 |
|------|------|
| **OCE 工具迁移** | `tools/opencode-tui-enhance` 已从仓库删除（D），迁移至 `tools/oce/`（新） |
| **Tavern 客户端文档同步** | 新增组件 ChatMarkdown/DesktopLoginModal/DesktopSidebar/ThemeToggle/WebNavBar；新增 Store themeStore；H5 支持完善 |
| **Tavern 服务端文档同步** | 路由 10→14 模块（新增 reports/upload，删除 builtin 死路由），服务 10→14 模块，数据库 8→13 表 |
| **Dashboard 文档同步** | 新增 TavernModelManager/TavernUsers 页面，监控页更新 |
| **ANTI-PATTERNS 更新** | builtin.ts 死路由已删除 → 标记已清理；personas.ts 死路由条目已修正（实际已导入）|
| **编码修复** | `docs/apps/tavern/server/README.md` 编码损坏已修复（UTF-8）|
| **统一日期戳** | 全量 docs/ 文件日期同步至 2026-05-28 |

---

## 2026-05-27 — 全量文档同步与勘误（日期/端口/表数/引用）

### 核心变化

| 操作 | 详情 |
|------|------|
| **修复 Game1 端口号** | `docs/ops/servers.md` 和 `docs/ops/game1-server/README.md` 中 Game1 Server 端口从 3001 更正为 3004 |
| **修复 ARCHITECTURE.md stores 数** | FTG "Zustand Stores (7 stores)" → "Zustand Store (authStore)" |
| **修复 ARCHITECTURE.md 表数** | Tavern "20+ 表" → "13 表"（与实际 Prisma Schema 一致） |
| **修复 tavern.md 表数** | 20+ → 13，同步实际 schema |
| **修复 database/README.md** | tavern Schema 路径从 `schema-ai-tavern.prisma` 更正为 `apps/tavern/server/prisma/schema.prisma` |
| **修复 AGENTS.md 引用** | `plan/active/` → `plan/current_task.md` |
| **统一日期戳** | 全量 docs/ 文件日期同步至 2026-05-27（含 ops 子文档从 05-18 更新） |

---

## 2026-05-26 — 文档同步：Tavern 客户端变更 + 全量审查

### 核心变化

| 操作 | 详情 |
|------|------|
| **Tavern 客户端文档同步** | 反映近期代码变更——Profile 页面重构、暗色模式、图标系统迁移、UI 打磨 |
| **文档日期同步** | AGENTS.md、ARCHITECTURE.md、standards 等入口日期统一 |

---

## 2026-05-26 — OCE 合并、Supertask 移除、新增手册

### 核心变化

| 操作 | 详情 |
|------|------|
| **OCE 文档新增** | `docs/tools/opencode-tui-enhance/README.md` + `VISION.md` — OpenCode 桌面监控工具 |
| **Supertask 标记废弃** | `docs/tools/supertask/README.md` 标记为已存档，工具已从仓库移除 |
| **新增手册** | `docs/manual/build-guide.md`、`dashboard-test-repair.md`、`miniapps-web-repair.md` |
| **新增数据库文档** | `docs/database/` — 4 库独立 Schema 文档 |
| **新增运维文档** | `docs/ops/` — ECS 部署 + 容器编排 |
| **新增代码约定** | `docs/standards/CONVENTIONS.md` + `ANTI-PATTERNS.md` |
| **OCE-SuperTask 合并设计** | 已移至 `plan/specs/`（非 git 跟踪） |

### 文档结构

```
docs/
├── README.md              ← 总入口
├── ARCHITECTURE.md        ← 系统架构
├── CHANGELOG.md           ← 本文档
├── edge.md                ← 文档边界
├── rules.md               ← 编写规则
├── urls.md                ← URL 汇总
├── apps/                  ← 各子项目文档
│   ├── ftg/{client,server}
│   ├── game1/{client,server}
│   └── tavern/{client,server}
├── dashboard/             ← 管理后台
├── database/              ← 4 库 Schema
├── manual/                ← 操作手册
├── ops/                   ← 运维部署
├── standards/             ← 约定反模式
├── tools/                 ← 工具文档
│   ├── opencode-tui-enhance/
│   └── supertask/         ← 🚫 已存档（工具已移除）
```

### AGENTS.md 改造

- AGENTS.md 从 226 行英文版精简为 70 行中文导航
- 详细约定、反模式、架构拆分到 `docs/standards/`
- 新增手册导航、命令速查表

### 删除/迁移

| 操作 | 旧路径 | 新路径/状态 |
|------|--------|-------------|
| 删除 | `docs/prisma/README.md` | → `docs/database/` |
| 删除 | `docs/server/` (3 文件) | → `docs/ops/` |
| 删除 | `docs/server_info/ecs100.md` | → `docs/ops/servers.md` |
| 删除 | `docs/superpowers/specs/` (4 旧过时文件) | 已从 git 移除，新设计文档 → `plan/specs/` |
| 删除 | `docs/superpowers/plans/` (6 旧过时文件) | 已从 git 移除，新计划 → `.sisyphus/plans/` |

## 2026-05-24 — 文档结构重组

### 核心变化

| 操作 | 详情 |
|------|------|
| **AGENTS.md 瘦身** | 从 279 行精简至 ~50 行，改为纯导航目录 |
| **拆分 CONVENTIONS.md** | `docs/standards/CONVENTIONS.md` — 代码约定、mp-automator 工作流 |
| **拆分 ANTI-PATTERNS.md** | `docs/standards/ANTI-PATTERNS.md` — 完整反模式列表 |
| **合并 ops/** | `docs/server/` + `docs/server_info/` → `docs/ops/` |
| **迁移 specs/** | `docs/superpowers/specs/` → `plan/specs/` |
| **删除 superpowers/plans/** | 内容已过时，由 `.sisyphus/` 替代 |
| **重命名 ideas/** | `plan/humans/` → `plan/ideas/` |
| **重命名 database/** | `docs/prisma/` → `docs/database/`，补全 4 库文档 |
| **修复断链** | `docs/README.md` 中指向 `tools/deploy/` 的链接 |
| **新增状态头** | 所有顶层文档添加 `状态: current` 标记 |

### 新结构预览

```
AGENTS.md              ← 导航目录
docs/
├── README.md          ← 入口
├── ARCHITECTURE.md    ← 跨项目架构
├── standards/         ← 约定、反模式、文档规范
├── apps/              ← 各子项目文档
├── database/          ← 4 库 Schema
├── ops/               ← 运维 + 部署
├── CHANGELOG.md       ← 本文档
└── ...
plan/
├── specs/             ← 设计文档
├── ideas/             ← 未成熟想法
├── active/            ← 进行中的任务
└── archive/           ← 已完成计划
```
