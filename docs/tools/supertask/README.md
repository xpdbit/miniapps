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

## 目录结构

```
tools/supertask/
├── gui/
│   ├── main.py               # 入口
│   ├── core/
│   │   ├── loop_manager.py    # 轮次调度
│   │   ├── opencode_runner.py # opencode 子进程调用
│   │   └── file_manager.py    # 状态文件读写
│   ├── ui/                    # tkinter 旧版 UI（保留）
│   └── ui_pyqt/              # PyQt6 + Fluent Design 新版 UI
├── state/                     # 持久化状态（YAML + 文本）
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
> 修改: 首次创建本文档
