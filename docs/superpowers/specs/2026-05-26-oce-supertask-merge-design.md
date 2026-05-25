# OCE × SuperTask 合并设计文档

> **状态**: draft → approved
> **日期**: 2026-05-26
> **目标**: 将 `tools/opencode-tui-enhance` (oce) 与 `tools/supertask` 合并为单一工具，并新增持久化多轮定向迭代能力。

---

## 第一章：导航与 UI 结构

合并后的主导航栏：

```
┌──────────────┐
│  📊 概览     │  ← oce 原有：项目总览、最近活动
│  📋 会话     │  ← oce 原有：opencode session 列表与详情
│  🤖 自动化   │  ← SuperTask 迁入：探索/迭代/提议/审批/执行
│  📈 状态     │  ← SuperTask 迁入：Agent 运行时状态
│  📝 日志     │  ← 统一：系统日志 + Agent 终端日志
│  ⚙ 设置     │  ← 全新扩写：统一配置中心（5 分组）
└──────────────┘
```

**自动化 tab** 下两个子面板：

| 子面板 | 内容 |
|--------|------|
| 探索模式 | 项目选择 → 扫描 → 生成提议列表 → 二次评估 → 审批勾选 → 加入队列执行 |
| 定向迭代 | 输入 prompt → 设时间上限 → 启动循环 → 实时看每轮 diff → 手动暂停/继续 |

---

## 第二章：核心架构

### 模块重组

```
src/opencode_tui_plus/
├── core/
│   ├── config.py              ← 统一配置管理器
│   ├── data_store.py          ← opencode SQLite 读取 (oce)
│   ├── db_adapter.py          ← SQLite 适配 (oce)
│   ├── logger.py              ← 统一日志
│   ├── runner.py              ← 统一 Agent 执行器 (合并)
│   ├── loop_engine.py         ← 循环调度引擎 (SuperTask → 重写)
│   ├── state_manager.py       ← 状态持久化 (SuperTask schema → 重写)
│   ├── proposal_engine.py     ← 提议系统 (SuperTask)
│   ├── worktree_manager.py    ← git worktree 管理 (SuperTask)
│   ├── process_monitor.py     ← 进程监控 (合并)
│   ├── diff_analyzer.py       ← 新增：每轮 diff 统计
│   ├── supervisor.py          ← 新增：监管 Agent 心跳巡检
│   ├── window_manager.py      ← 窗口管理 (oce)
│   ├── window_focus.py        ← 窗口焦点 (oce)
│   └── localdev_manager.py    ← 本地开发工具 (oce)
└── gui/ui_pyqt/
    ├── tabs/
    │   ├── overview/          ← 概览 (oce)
    │   ├── session/           ← 会话 (oce)
    │   ├── automation/        ← 自动化 (新增)
    │   ├── agent_status/      ← Agent 状态 (SuperTask →)
    │   ├── logs/              ← 日志 (合并)
    │   └── settings/          ← 设置 (扩写)
    ├── widgets/               ← 共享 UI 组件
    └── app.py                 ← 主窗口
```

### 状态机 (loop_engine.py)

```
                    ┌─────────────┐
                    │   IDLE      │
                    └──────┬──────┘
                           │ 启动任务
                    ┌──────▼──────┐
              ┌─────│  RUNNING    │◄────────────┐
              │     └──────┬──────┘             │
              │            │ 执行一轮           │
              │     ┌──────▼──────┐             │
              │     │  ROUND_DONE │             │
              │     └──────┬──────┘             │
              │            │                    │
              │     ┌──────▼──────┐    未超时   │
              │     │ 超时？      │─────────────┘
              │     └──────┬──────┘
              │            │ 超时
              │     ┌──────▼──────┐
              │     │  COMPLETED  │
              │     └─────────────┘
              │
        ┌─────┴──────┐    手动暂停
        │   PAUSED   │──────────────► RUNNING
        └─────┬──────┘
              │ 手动停止
        ┌─────▼──────┐
        │  STOPPED   │
        └────────────┘
```

两种模式共用同一状态机：
- **探索模式**：每轮让 agent 重新扫描项目 → 生成新提议
- **定向迭代**：每轮用同一个 prompt，以上轮 diff 摘要作为附加上下文

### 任务持久化 Schema

```yaml
# state/tasks/{task_id}/task.yaml
task_id: "iter_20260526_001"
type: directed_iteration          # directed_iteration | exploration
status: running                   # running | paused | completed | stopped | failed
project_root: "E:/path/to/project"
prompt: "优化项目代码质量..."
time_limit_minutes: 120
created_at: "2026-05-26T10:00:00"
started_at: "2026-05-26T10:05:00"
elapsed_seconds: 2740
consecutive_failures: 0
current_round: 3
rounds:
  - round: 1
    status: completed
    started_at: "2026-05-26T10:05:00"
    ended_at: "2026-05-26T10:18:00"
    duration_seconds: 780
    diff_path: "round_01.diff"
    files_changed: 15
    insertions: 340
    deletions: 120
  - round: 2
    status: completed
    started_at: "2026-05-26T10:18:05"
    ended_at: "2026-05-26T10:35:00"
    duration_seconds: 1015
    diff_path: "round_02.diff"
    files_changed: 8
    insertions: 120
    deletions: 45
  - round: 3
    status: running
    started_at: "2026-05-26T10:35:05"
```

---

## 第三章：Runner / Diff Analyzer / 模型路由

### runner.py — 统一 Agent 执行器

```python
class AgentRunner:
    def run(
        self,
        prompt: str,
        *,
        stage: Stage,
        context_files: list[str] | None = None,
        previous_diffs: list[str] | None = None,
        project_root: str,
        timeout_minutes: int = 30,
    ) -> RunResult: ...

class RunResult:
    success: bool
    exit_code: int
    duration_seconds: float
    diff_raw: str
    diff_stat: DiffStat
    agent_output: str
    error_message: str | None
```

前几轮 diff 不直接拼入 prompt（会炸上下文），而是生成摘要传入。

### diff_analyzer.py — 新增

```python
class DiffAnalyzer:
    @staticmethod
    def analyze(raw_diff: str) -> DiffStat: ...
    @staticmethod
    def is_converging(history: list[DiffStat], threshold: float = 0.3) -> bool: ...
    @staticmethod
    def summarize(history: list[DiffStat]) -> str: ...

class DiffStat:
    files_changed: int
    insertions: int
    deletions: int
    file_list: list[str]
```

### 模型路由

工具不管理 API key 和服务商——那是 opencode 的职责。工具只做阶段→模型的路由映射：

```yaml
# state/config.yaml
models:
  default_model: "deepseek/deepseek-v4-pro"
  stage_model:
    exploration: "deepseek/deepseek-chat"
    proposal_generation: "deepseek/deepseek-chat"
    proposal_evaluation: "deepseek/deepseek-v4-pro"
    code_execution: "deepseek/deepseek-v4-pro"
    diff_summary: "deepseek/deepseek-chat"
    documentation: "deepseek/deepseek-v3-0324"
    supervisor: "deepseek/deepseek-chat"
```

格式为 `provider/model`，与 opencode CLI 的 `--model` 参数一致。下拉框候选项从 `opencode.json` 的 `provider.*.models` 动态读取。

### 协作流程

```
loop_engine              runner(stage=)              model used
    │                        │
    │ 探索模式：扫描项目      │
    │───────────────────────►│ CODE_EXECUTION → premium
    │                        │
    │ 生成提议列表            │
    │───────────────────────►│ PROPOSAL_GENERATION → cheap
    │                        │
    │ 二次评估（可选）        │
    │───────────────────────►│ PROPOSAL_EVALUATION → premium
    │                        │
    │ 执行审批通过的任务      │
    │───────────────────────►│ CODE_EXECUTION → premium
    │                        │
    │ 定向迭代：每轮改进      │
    │───────────────────────►│ CODE_EXECUTION → premium
    │                        │
    │ 生成 diff 摘要          │
    │───────────────────────►│ DIFF_SUMMARY → cheap
    │                        │
    │ 收尾：更新文档          │
    │───────────────────────►│ DOCUMENTATION → standard
    │                        │
    │ 监管巡检                │
    │───────────────────────►│ SUPERVISOR → cheap
```

---

## 第四章：工作流

### 4.1 定向迭代

```
用户操作                    系统行为
────────                    ────────
打开 自动化→定向迭代
├─ 输入 prompt
├─ 设时间上限 (如 2h)
├─ 选项目
└─ 点击「启动」
                            创建 state/tasks/{id}/task.yaml
                            status: running
                    ┌───────▼────────┐
                    │  第 1 轮         │
                    │  runner(prompt) │
                    │  → diff → save  │
                    └───────┬────────┘
                            │ 超时? → 否
                    ┌───────▼────────┐
                    │  第 2 轮         │
                    │  runner(prompt  │
                    │   + 前轮摘要)    │
                    └───────┬────────┘
                            │ ...
                    ┌───────▼────────┐
                    │  elapsed ≥ 上限 │
                    │  → COMPLETED   │
                    └────────────────┘
```

运行中可暂停/停止/查看实时 diff 统计。

### 4.2 探索模式

```
打开 自动化→探索模式
├─ 选项目 → 开始探索
│               系统扫描 → 生成提议列表 → proposals.yaml
│  用户审阅提议表格 → 勾选批准 → 逐项执行 (premium 模型)
└─ [可选] 二次评估 → 更新文档并推送
```

### 4.3 断点恢复

工具启动时扫描 `state/tasks/`：
- `status: running` → 弹窗提示恢复/放弃/稍后
- `status: paused` → 自动化面板显示"已暂停"，可继续
- 恢复时从 `current_round` 重新开始（丢弃中断轮次的 partial data）

---

## 第五章：设置面板

左侧分组导航：通用 → Agent → 自动化 → 模型路由 → 外观

### 通用
opencode 路径、opencode.json 路径、DB 路径、日志级别、日志保留天数

### Agent
默认模型、单次超时 (分钟)、并发数、连续失败阻塞阈值

### 自动化
默认迭代时间上限、循环间隔、worktree 开关、自动提交开关

### 模型路由

| 阶段 | 模型选择 | 默认 |
|------|---------|------|
| 项目扫描 | 下拉 | cheap |
| 提议生成 | 下拉 | cheap |
| 提议二次评估 | 下拉 | premium |
| 代码执行 | 下拉 | premium |
| Diff 摘要 | 下拉 | cheap |
| 文档更新 | 下拉 | standard |
| 监管巡检 | 下拉 | cheap |

下方「从 opencode.json 刷新模型列表」按钮。

### 外观
主题（浅色/深色/跟随系统）、字体、字号、日志颜色方案

---

## 第六章：错误处理与鲁棒性

### 错误分类

| 类别 | 策略 |
|------|------|
| 可恢复 (超时、网络) | 重试 5 次，间隔递增 (5s→10s→20s→40s→60s)，全失败则暂停 |
| 可跳过 (单文件失败) | 记录失败，继续下一项 |
| 阻塞性 (opencode.exe 未找到) | 弹窗阻断 |
| 数据损坏 (state 文件) | 尝试备份恢复，失败则标记 corrupted |

### 监管 Agent (Supervisor)

独立心跳线程，分两级巡检：

| 巡检项 | 间隔 | 说明 |
|--------|------|------|
| 进程僵死 / 进程存在 / 失败计数器 / 自检 | 600s (10min) | 高频关键项 |
| 磁盘空间 / 日志 rotate / state 可写 / DB | 3600s (1h) | 低频资源项 |

监管 Agent 使用独立的模型路由，日志写入 `logs/{date}_supervisor.md`。

### 并发保护
- 定向迭代：同时只能 1 个
- 探索 + 定向迭代：可并行（独立进程）
- 监管 Agent：始终 1 个，不占并发配额

---

## 第七章：迁移方案

### 阶段

| 阶段 | 内容 | 预估 |
|------|------|------|
| 0 | 备份：`git checkout -b feat/merge-oce-supertask` | 30min |
| 1 | 核心模块迁移：loop_engine, runner, state_manager, proposal_engine, worktree, process_monitor, diff_analyzer, supervisor | 2h |
| 2 | UI 整合：automation/agent_status/settings/logs tabs | 3h |
| 3 | 状态与日志合并：state/ 和 logs/ 目录统一 | 1h |
| 4 | 配置与入口：pyproject.toml / requirements.txt 合并 | 1h |
| 5 | 测试验证 | 2h |
| 6 | 清理：删除 tools/supertask | 30min |

### 核心模块迁移映射

| SuperTask 源 | oce 目标 | 处理 |
|---|---|---|
| `gui/core/loop_manager.py` | `core/loop_engine.py` | 重命名 + 适配新状态机 |
| `gui/core/opencode_runner.py` | `core/runner.py` | 合并 + 模型路由 |
| `gui/core/proposal_merger.py` | `core/proposal_engine.py` | 重命名 |
| `gui/core/worktree_manager.py` | `core/worktree_manager.py` | 不动 |
| `gui/core/process_monitor.py` | `core/process_monitor.py` | 合并 |
| `gui/core/schema.py` | `core/state_manager.py` | 重写 schema |
| `gui/core/file_manager.py` | 分散到 `state_manager` + `logger` | 拆解 |
| — | `core/diff_analyzer.py` | 新增 |
| — | `core/supervisor.py` | 新增 |

### 回退
不删 `tools/supertask` 即可随时 `git checkout` 回退。

---

## 第八章：最终目录结构

```
tools/opencode-tui-enhance/
├── .git/
├── .gitignore
├── pyproject.toml
├── requirements.txt
├── oce.bat
├── oce.ico
├── icon.png
├── build_oce/
├── state/
│   ├── config.yaml
│   ├── proposals.yaml
│   └── tasks/{task_id}/
│       ├── task.yaml
│       └── round_N.diff
├── logs/
│   ├── {date}.md
│   ├── {date}_terminal.md
│   ├── {date}_agent_status.md
│   └── {date}_supervisor.md
├── resources/*.svg
└── src/opencode_tui_plus/
    ├── __init__.py
    ├── __main__.py
    ├── main.py
    ├── core/
    │   ├── config.py
    │   ├── data_store.py
    │   ├── db_adapter.py
    │   ├── logger.py
    │   ├── runner.py
    │   ├── loop_engine.py
    │   ├── state_manager.py
    │   ├── proposal_engine.py
    │   ├── worktree_manager.py
    │   ├── process_monitor.py
    │   ├── diff_analyzer.py
    │   ├── supervisor.py
    │   ├── window_manager.py
    │   ├── window_focus.py
    │   └── localdev_manager.py
    └── gui/
        ├── main.py
        └── ui_pyqt/
            ├── app.py
            ├── tabs/
            │   ├── overview/
            │   ├── session/
            │   ├── automation/
            │   │   ├── exploration_panel.py
            │   │   └── iteration_panel.py
            │   ├── agent_status/
            │   ├── logs/
            │   └── settings/
            └── widgets/
                ├── model_selector.py
                ├── task_table.py
                └── status_bar.py
```

---

> **约束**: 所有设计确认于 2026-05-26 头脑风暴会话。实施前需参考此文档。
