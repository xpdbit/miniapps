# SuperTask — AI 自主开发监督系统

基于 Python GUI 程序，循环驱动 AI 代理（opencode）自动探索项目、提出任务，经人工审批后执行开发、文档、推送等操作。

## 快速开始

```bash
pip install -r requirements.txt
python gui/main.py
# 或双击 miniapps_supertask.bat
```

## 工作流

1. **探索与提议** — AI 遍历项目，生成任务提议列表
2. **人工审批** — 在 GUI 中选中任务行，批准后进入执行队列
3. **逐项执行** — AI 按队列顺序执行，状态实时更新
4. **收尾** — 自动更新 AGENTS.md、docs/，git push

## 任务规划

任务规划 Tab（导航栏「任务规划」）提供 AI 驱动的任务细化功能：

- **AI 规划** — 用户输入高级任务描述，AI 生成 3-5 个关键规划问题
- **多选问答** — 每个问题以卡片形式展示 2-4 个选项（支持单选/多选）
- **规约生成** — 用户选择答案后，自动组合生成精细化的任务规约

## 控制面板

控制面板采用上下 35:65 分割布局：

**上侧 35%** — 左右 50:50 分割
- **左侧**: 统计数字（待审批/排队中/已完成/已失败）+ Agent 状态条（阶段/模型/耗时，耗时每秒实时刷新）
- **右侧**: 项目选择（可编辑下拉框）+ 5 个 4:3 方块卡片按钮水平排列（持续探索/执行队列/更新待审批/检查成果/更新文档并推送）+ Agent 控制（暂停/继续）

**下侧 65%** — 左右 50:50 分割
- **左侧**: 彩色 HTML 运行日志
- **右侧**: 工作队列检视表格

## Agent 状态面板

Agent 状态监控页面（导航栏「Agent 状态」）和控制面板顶部均实时显示 agent 运行状态：

- **阶段状态条** — 当前阶段名称 + 模型名称 + 实时耗时（每秒自增刷新）
- **Agent 类型筛选** — 通过下拉框按主 Agent 类型（如 sisyphus/sisyphus-pro）和子 Agent 类型（explore/oracle 等）筛选显示
- **Agent 详情表格** — 6 列信息：
  - Agent / Sub-agent — 主 agent 青色，子 agent 灰色 + `└─ ` 层级前缀
  - 类型 — 如 explore、oracle、librarian
  - 模型 — 当前使用的 AI 模型
  - 状态 — 带图标（● 运行中 / ⏸ 暂停 / ✓ 完成 / ✗ 错误）
  - Preview — 任务描述预览（截断 40 字）
  - 耗时 — 每秒实时刷新
- **视觉分组** — 不同类型的 agent 组之间以分隔行隔开

## 控制面板按钮

手动操作区采用 5 个 4:3 方块卡片水平排列，每项操作有独立边框 + hover 高亮效果：
- 持续探索、执行队列、更新待审批、检查成果、**更新文档并推送**（Github）

## 目录结构

```
tools/supertask/
├── gui/
│   ├── main.py              # 入口
│   ├── core/
│   │   ├── loop_manager.py   # 轮次调度 + AgentTracker
│   │   ├── opencode_runner.py # opencode 调用
│   │   └── file_manager.py   # 状态文件读写 + 日志管理
│   ├── ui/                   # tkinter 旧版 UI（保留）
│   └── ui_pyqt/             # PyQt6 + Fluent Design 新版 UI
│       ├── task_plan_interface.py  # AI 任务规划界面
├── state/                    # 持久化状态
│   ├── proposed_tasks.yaml
│   ├── approved_queue.yaml
│   ├── config.yaml
│   ├── history.yaml
│   ├── cycle_counter.txt
│   └── last_commit.txt
├── logs/                     # 运行日志
│   ├── {date}.md             # 系统运行日志
│   ├── {date}_terminal.md    # agent 终端输入输出日志
│   └── {date}_agent_status.md # agent 状态快照日志
├── screenshots/
├── requirements.txt
└── miniapps_supertask.bat
```

## 日志命名

| 文件 | 内容 |
|------|------|
| `{YYYYMMDD}.md` | 系统运行日志（info/error/decision/approved） |
| `{YYYYMMDD}_terminal.md` | agent 每次 prompt 调用的完整输入输出 |
| `{YYYYMMDD}_agent_status.md` | agent/sub-agent 运行时状态快照 |

## 约束

- 永不自动停止（除非手动暂停）
- 提议与执行分离
- 异常不中断循环
- 连续失败 2 次自动阻塞
