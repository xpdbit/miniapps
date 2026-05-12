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
2. **人工审批** — 在 GUI 中勾选任务，批准后进入执行队列
3. **逐项执行** — AI 按队列顺序执行，状态实时更新
4. **收尾** — 自动更新 AGENTS.md、docs/，git push

## 目录结构

```
tools/supertask/
├── gui/
│   ├── main.py              # 入口
│   ├── core/
│   │   ├── loop_manager.py   # 轮次调度
│   │   ├── opencode_runner.py # opencode 调用
│   │   └── file_manager.py   # 状态文件读写
│   ├── ui/                   # tkinter 旧版 UI（保留）
│   └── ui_pyqt/             # PyQt6 + Fluent Design 新版 UI
├── state/                    # 持久化状态
│   ├── proposed_tasks.yaml
│   ├── approved_queue.yaml
│   └── cycle_counter.txt
├── logs/                     # 运行日志
├── screenshots/
├── requirements.txt
└── miniapps_supertask.bat
```

## 约束

- 永不自动停止（除非手动暂停）
- 提议与执行分离
- 异常不中断循环
- 连续失败 2 次自动阻塞
