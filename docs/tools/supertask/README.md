# tools/supertask — AI 自主开发监督系统

**Python 桌面 GUI 程序**，循环驱动 opencode AI 代理自动探索项目、提出任务，经人工审批后执行开发、文档、推送等操作。

## 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | Python 3.10+ |
| GUI 框架 | PyQt6 + PyQt-Fluent-Widgets（新版）/ tkinter（旧版，保留） |
| 状态持久化 | YAML + 文本文件 |
| AI 调用 | opencode CLI 子进程 |
| 运行环境 | Windows |

## 核心功能

- **自动探索** — AI 遍历项目文件，分析代码结构，生成任务提议
- **人工审批** — GUI 中勾选/排序任务，批准后进入执行队列
- **逐项执行** — AI 按队列顺序执行开发任务，状态实时更新
- **收尾推送** — 自动更新 AGENTS.md、docs/，执行 git push

## 工作流

```
[探索] AI 扫描项目 → [提议] 生成任务列表 → [审批] 人工勾选 → [执行] AI 逐项开发 → [收尾] 文档 + 推送
```

## 控制面板布局

SuperTask 控制面板采用上下分割布局，便于实时监控和操作：

```
┌───────────────────────────────────────────────────────────────┐
│  控制面板                                                      │
├───────────────────────────┬───────────────────────────────────┤
│  上侧 35%                 │                                    │
│  ┌───────────┬──────────┐ │  ┌─────────────────────────────┐  │
│  │  统计数字  │ Agent    │ │  │  循环控制                    │  │
│  │  待审批/   │ 状态+模型│ │  │  [启动] [停止] [暂停]       │  │
│  │  排队中/   │ Phase    │ │  │  项目 [全部▼]              │  │
│  │  已完成/   │ StatusBar│ │  │  [持续探索] [执行队列]       │  │
│  │  已失败    │          │ │  │  [更新待审批]                │  │
│  └───────────┴──────────┘ │  └─────────────────────────────┘  │
│  左侧 50%                 │  右侧 50%                          │
├───────────────────────────┴───────────────────────────────────┤
│  下侧 65%                                                      │
│  ┌────────────────────────┬──────────────────────────────────┐ │
│  │  运行日志               │  队列检视                        │ │
│  │  (彩色 HTML QTextEdit) │  TableWidget (描述 + 状态)      │ │
│  │  [自动滚动] [清空]     │  底部提示: 活跃任务统计          │ │
│  └────────────────────────┴──────────────────────────────────┘ │
│  左侧 50%                 │  右侧 50%                          │
└───────────────────────────┴───────────────────────────────────┘
```

### 组件说明

| 区域 | 组件 | 说明 |
|------|------|------|
| 上左侧 | 统计数字卡片 | 4 列大字号数字：待审批(蓝)/排队中(黄)/已完成(绿)/已失败(红) |
| 上左侧 | Agent 状态条 | `PhaseStatusBar` 显示当前阶段、运行状态图标、模型名称、耗时 |
| 上右侧 | 循环控制按钮 | 启动/停止/暂停循环，状态指示灯 + 不确定进度条 |
| 上右侧 | 项目选择 | 可编辑 `QComboBox`，支持下拉选择（全部/ftg/game1/tavern）或直接输入自定义项目名 |
| 上右侧 | 手动操作按钮 | 持续探索（读取项目选择）、执行队列、更新待审批 |
| 下左侧 | 运行日志 | `QTextEdit` 只读 HTML 渲染，info(绿)/error(红)/decision(蓝)/approved(紫) 四级色彩 |
| 下右侧 | 队列检视 | `TableWidget` 2 列（描述/状态），底部显示进行中/已完成/失败统计 |

## 日志文件

日志按日期组织，位于 `tools/supertask/logs/` 目录：

| 文件格式 | 内容 |
|----------|------|
| `{YYYYMMDD}.md` | 运行日志 — 系统级日志（info/error/decision/approved），追加写入 |
| `{YYYYMMDD}_terminal.md` | Terminal 日志 — 每次 prompt 调用的完整输入输出记录 |
| `{YYYYMMDD}_agent_status.md` | Agent 状态快照 — 每个阶段开始/结束及运行中的 agent/sub-agent 状态快照 |

## 目录结构

```
tools/supertask/
├── gui/
│   ├── main.py               # 入口
│   ├── core/
│   │   ├── loop_manager.py    # 轮次调度 (QThread) + AgentTracker
│   │   ├── opencode_runner.py # opencode 子进程调用
│   │   └── file_manager.py    # 状态文件读写 + 日志管理
│   ├── ui/                    # tkinter 旧版 UI（保留）
│   └── ui_pyqt/              # PyQt6 + Fluent Design 新版 UI
│       ├── app.py             # SuperTaskWindow 主窗口
│       ├── control_interface.py  # 控制面板仪表盘
│       ├── agent_status_interface.py # Agent 状态监控
│       ├── task_interface.py  # 提议与工作
│       ├── config_interface.py # 配置面板
│       ├── detail_widget.py   # 任务详情卡片
│       ├── log_interface.py   # 日志页面
│       ├── terminal_interface.py # 终端页面
│       └── history_interface.py  # 历史页面
├── state/                     # 持久化状态（YAML + 文本）
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

- [设计文档](../../superpowers/specs/2026-05-12-supertask-pyqt-migration-design.md) — PyQt6 迁移设计

---

> 最后更新: 2026-05-13
> 修改: 更新控制面板布局说明、日志文件命名约定、目录结构
