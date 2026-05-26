# tools/supertask — AI 自主开发监督系统 🚫 已存档

> **状态**: archived
> **更新**: 2026-05-26
>
> SuperTask 已从仓库移除（代码已清空），功能整合至 [OCE (opencode-tui-enhance)](../opencode-tui-enhance/README.md)。
> 此文档仅作历史参考，不再维护。

**Python 桌面 GUI 程序**，循环驱动 AI 代理自动探索项目、提出任务，经人工审批后执行开发、文档、推送等操作。

## 定位

SuperTask 不是执行加速器，而是**认知减负器**。

| 问题 | 影响 | SuperTask 的解法 |
|------|------|------------------|
| 不知道改什么 | 面对 750+ 源文件，很难主动发现技术债和改进点 | 探索模式 — AI 定期扫描代码库，生成任务提议清单 |
| AI 难以持久化 | 单次会话无法持续追踪项目状态 | 状态化循环 — 持久化 YAML 状态 + session checkpoint |

适用场景：维护期的多项目管理、低决策成本的碎片化改进、开发者疲劳期的低认知启动。

## 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | Python 3.10+ |
| GUI 框架 | PyQt6 + PyQt-Fluent-Widgets |
| 状态持久化 | YAML + 文本文件 |
| AI 调用 | opencode CLI 子进程 |
| 运行环境 | Windows |

## 工作模式

### Cycle 模式（主动探索）

```
[探索] AI 扫描项目 → [提议] 生成任务列表 → [审批] 人工勾选 → [执行] AI 逐项开发 → [循环]
```

适用于：不确定做什么、项目太久没巡检、想发现技术债。

### Dispatch 模式（按需执行）

```
[收到任务] → [执行] AI 立即开工 → [审查] 人工验收 → [完成]
```

适用于：有明确任务、PM 派工、紧急修复。两种模式可无缝切换。

## 核心功能

- **自动探索** — AI 遍历项目文件，分析代码结构，生成任务提议
- **人工审批** — GUI 中勾选/排序任务，批准后进入执行队列
- **逐项执行** — AI 按队列顺序执行开发任务，状态实时更新
- **任务规划** — 输入高级描述，AI 生成多选问题引导细化规约
- **Agent 状态监控** — 实时追踪 agent/sub-agent 运行状态和耗时
- **事件驱动** — Webhook（支持 GitHub）/ Cron 定时触发
- **断点续跑** — Session checkpoint 支持崩溃后恢复
- **Worktree 隔离** — 可选 Git worktree 模式，避免任务间文件冲突

## 控制面板布局

SuperTask 控制面板采用上下分割布局，便于实时监控和操作：

```
┌───────────────────────────────────────────────────────────────┐
│  控制面板                                                      │
├───────────────────────────┬───────────────────────────────────┤
│  上侧 35%                 │                                    │
│  ┌───────────┬──────────┐ │  ┌─────────────────────────────┐  │
│  │  统计数字  │ Agent    │ │  │  操作区                      │  │
│  │  待审批/   │ 状态+模型│ │  │  [持续探索] [执行队列]       │  │
│  │  排队中/   │ Phase    │ │  │  [更新待审批] [检查成果]     │  │
│  │  已完成/   │ StatusBar│ │  │  [更新文档并推送]            │  │
│  │  已失败    │          │ │  │  项目 [全部▼]               │  │
│  └───────────┴──────────┘ │  └─────────────────────────────┘  │
│  左侧 50%                 │  右侧 50%                          │
├───────────────────────────┴───────────────────────────────────┤
│  下侧 65%                                                      │
│  ┌────────────────────────┬──────────────────────────────────┐ │
│  │  运行日志               │  队列检视                        │ │
│  │  (彩色 HTML)           │  TableWidget (描述 + 状态)       │ │
│  └────────────────────────┴──────────────────────────────────┘ │
│  左侧 50%                 │  右侧 50%                          │
└───────────────────────────┴───────────────────────────────────┘
```

## 日志文件

日志按日期组织，位于 `tools/supertask/logs/` 目录：

| 文件格式 | 内容 |
|----------|------|
| `{YYYYMMDD}.md` | 运行日志 — info/error/decision/approved |
| `{YYYYMMDD}_terminal.md` | Terminal 日志 — 每次 prompt 的完整输入输出 |
| `{YYYYMMDD}_agent_status.md` | Agent 状态快照 — 阶段/agent 运行时状态 |

## 目录结构

```
tools/supertask/
├── gui/
│   ├── main.py               # 入口
│   ├── core/
│   │   ├── loop_manager.py    # 轮次调度 (QThread) + AgentTracker
│   │   ├── opencode_runner.py # opencode 子进程调用
│   │   ├── file_manager.py    # 状态文件读写 + 日志管理
│   │   ├── prompt_manager.py  # 提示词模板管理器
│   │   ├── prompt_orchestrator.py # 动态 Prompt 组装引擎
│   │   ├── worktree_manager.py    # Git Worktree 生命周期管理
│   │   ├── session_manager.py     # 会话持久化与断点续跑
│   │   ├── event_driven.py        # Webhook + Cron 事件驱动
│   │   └── schema.py              # Pydantic 数据模型校验
│   ├── ui/                    # tkinter 旧版 UI（保留）
│   └── ui_pyqt/              # PyQt6 + Fluent Design 新版 UI
│       ├── app.py             # SuperTaskWindow 主窗口
│       ├── control_interface.py  # 控制面板仪表盘
│       ├── agent_status_interface.py # Agent 状态监控
│       ├── task_interface.py  # 提议与工作
│       ├── task_plan_interface.py # AI 任务规划
│       ├── config_interface.py # 配置面板
│       ├── detail_widget.py   # 任务详情卡片
│       ├── log_interface.py   # 日志页面
│       ├── terminal_interface.py # 终端页面
│       └── history_interface.py  # 历史页面
├── state/                     # 持久化状态（YAML）
│   ├── proposed_tasks.yaml    # 待审批提议列表
│   ├── approved_queue.yaml    # 已批准工作队列
│   ├── config.yaml            # 用户配置
│   ├── history.yaml           # 历史执行记录
│   ├── cycle_counter.txt      # 轮次计数
│   └── last_commit.txt        # 上次推送的 commit hash
├── logs/                      # 运行日志
├── screenshots/
├── requirements.txt
└── miniapps_supertask.bat     # Windows 一键启动
```

## 快速开始

```bash
cd tools/supertask
pip install -r requirements.txt
python gui/main.py
# 或双击 miniapps_supertask.bat
```

## 核心约束

- **永不自动停止** — 除非手动暂停，循环持续运行
- **提议与执行分离** — 杜绝未经审批的自动操作
- **异常不中断** — 单任务失败不影响后续任务
- **自动阻塞** — 连续失败 2 次暂停循环，等待人工介入

## 关键文档

- [远景规划](./VISION.md) — 长期演进方向和设计思考
- [设计文档](../../../plan/specs/2026-05-12-supertask-pyqt-migration-design.md) — PyQt6 迁移设计

---

> 最后更新: 2026-05-24
> 修改: 修复设计文档链接（docs/superpowers/ → plan/specs/）
