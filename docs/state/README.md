# state — Agent 工作状态

## 概述

`state/` 目录存储 Sisyphus Agent 的运行时工作状态，包括任务队列、会话快照、执行历史等。

## 目录结构

```
state/
├── prompts/              # Agent 提示词模板
├── sessions/             # 会话状态快照
├── task_plan_snapshots/  # 任务计划快照
├── approved_queue.yaml   # 已审批任务队列
├── config.yaml           # Agent 配置
├── history.yaml          # 执行历史
├── cycle_counter.txt     # 运行周期计数
├── last_commit.txt       # 最后处理提交
├── proposed_tasks.yaml   # 待处理任务提案
└── task_proposals.yaml   # 任务提案
```

## 说明

- 所有文件由 Sisyphus Agent 自动维护，人工无需直接修改
- `config.yaml` 和 `prompts/` 可手动配置 Agent 行为
- `task_plan_snapshots/` 保存执行中的计划快照，用于崩溃恢复
