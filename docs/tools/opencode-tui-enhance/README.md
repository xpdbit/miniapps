# tools/opencode-tui-enhance — OpenCode 桌面监控与看门狗

**Python PyQt6 桌面 GUI 程序**，监控 OpenCode 运行时状态，检测 DeepSeek v4 场景下的中断/堵塞/误判问题，提供会话追踪、进程看护、自动恢复能力。

## 定位

OCE 不是 OpenCode 的替代品，而是 OpenCode 的**稳定性补丁层**。

| 问题 | 根因 | OCE 的解法 |
|------|------|-----------|
| 中断 | DSv4 长推理导致 session 超时/连接断开，OpenCode 不感知 | `process_monitor` — psutil 实时追踪进程存活 + 会话关联 |
| 堵塞 | subagent 卡死，整条链阻塞，无超时传播 | `supervisor` — 巡检线程检测僵死进程（5min 无输出即判定）|
| 误判 | 推理链长，中间 agent 错误结论被后续叠加，无 checkpoint/rollback | `state_manager` — 每轮 diff + 状态持久化为 YAML，支持断点恢复 |
| 状态丢失 | OpenCode session 持久化只写不读，中断后无法从最后断点继续 | `state_manager` — 任务生命周期管理 + `.bak` 自动恢复 |

## 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | Python 3.10+ |
| GUI 框架 | PyQt6 + PyQt-Fluent-Widgets |
| 进程监控 | psutil（进程扫描 + 文件句柄发现 DB 路径）|
| 数据读取 | 直接读取 OpenCode SQLite DB（session / message 表）|
| 状态持久化 | YAML + 文本文件 |
| AI 调用 | opencode CLI 子进程 |
| 运行环境 | Windows |

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    OceWindow (PyQt6)                         │
│  ┌──────────┐ ┌──────────┐ ┌───────┐ ┌──────┐ ┌─────────┐  │
│  │ 概览      │ │ API历史  │ │ 自动化 │ │ 状态  │ │ 日志    │  │
│  │ Dashboard │ │ 趋势图   │ │ Loop   │ │ Agent │ │ 面板    │  │
│  │ KPI+会话  │ │ Token/   │ │ Engine │ │ 进程  │ │ 多源    │  │
│  │ 卡片/表格 │ │ 成本     │ │        │ │ 监控  │ │ 切换    │  │
│  └─────┬─────┘ └─────┬───┘ └───┬───┘ └───┬──┘ └────┬────┘  │
│        │              │         │         │         │        │
│  ┌─────┴──────────────┴─────────┴─────────┴─────────┴────┐   │
│  │                    DataStore                            │   │
│  │    事件订阅 + 通知分发 + 概览/历史缓存                 │   │
│  └──────────────────────────┬─────────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────┐
│                      核心服务层                               │
│  ┌──────────────┐ ┌────────────┐ ┌──────────────────────┐   │
│  │ DB Reader    │ │ Process    │ │ State Manager        │   │
│  │ 读 OpenCode  │ │ Monitor    │ │ 任务 CRUD +          │   │
│  │ SQLite       │ │ psutil     │ │ YAML 持久化 +        │   │
│  │ session/     │ │ 进程扫描   │ │ .bak 自动恢复        │   │
│  │ message 表   │ │ session    │ │                      │   │
│  │              │ │ 关联匹配   │ └──────────┬───────────┘   │
│  └──────────────┘ └────────────┘            │               │
│  ┌──────────────────────────────────────────┴──────────────┐ │
│  │ Supervisor（监管 Agent / 看门狗）                       │ │
│  │ 巡检周期：600s 快检 / 3600s 慢检                       │ │
│  │ 检查项：进程僵死 / 磁盘空间 / 日志轮转 / DB 连接       │ │
│  │ 阈值：5min 无输出=僵死 / 5GB 磁盘告警 / 1GB 严重告警   │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Loop Engine（循环调度 — 可选模块）                      │ │
│  │ 定向迭代：同一 prompt 反复执行直到超时                  │ │
│  │ 探索模式：扫描→提议→评估→执行                          │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Agent Runner（opencode CLI 封装）                       │ │
│  │ 阶段→模型路由 / 重试 5 次 / diff 分析 / 进程树管理     │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 模块清单

| 模块 | 文件 | 定位 | 成熟度 |
|------|------|------|--------|
| DB Reader | `core/opencode_db_reader.py` | 直接读取 OpenCode SQLite，提取会话/Token/成本数据 | 稳定 |
| Process Monitor | `core/process_monitor.py` | psutil 扫 opencode 进程，关联 DB session，追踪 LLM 通信活跃度 | 稳定 |
| Supervisor | `core/supervisor.py` | 后台巡检线程，分级告警（info/warn/error），检测僵死/磁盘/日志/DB | 设计对，缺执行链路 |
| State Manager | `core/state_manager.py` | 任务持久化（YAML）+ 轮次管理 + `.bak` 崩溃恢复 | 核心可用 |
| DataStore | `gui/core/data_store.py` | 数据缓存 + 事件订阅 + UI 刷新驱动 | 稳定 |
| Agent Runner | `core/runner.py` | opencode CLI 子进程封装 + 阶段路由 + 重试 + diff 分析 | 可用但脆弱 |
| Loop Engine | `core/loop_engine.py` | 定向迭代 + 探索模式执行循环 | 存疑 |
| Overview | `gui/ui_pyqt/overview_interface.py` | 概览仪表盘：KPI 卡片 + 会话卡片/表格视图，1s 实时刷新 | 稳定 |
| API History | `gui/ui_pyqt/api_history_interface.py` | Token/成本趋势图（matplotlib）+ 会话搜索分页 | 稳定 |
| Log Interface | `gui/ui_pyqt/tabs/logs/log_interface.py` | 多源日志查看器（系统/终端/Agent/监管） | 稳定 |

## 当前能力边界

### 已实现

- 实时会话监控（KPI 卡片 + 状态指示 + 1s 刷新）
- 进程级 Agent 监控（CPU/内存/模型/LLM 通信活跃度）
- Token 消耗趋势图（日/周/月粒度，切换 Token/成本模式）
- 会话搜索与分页浏览
- 配置文件编辑（project.ocp）
- 监管巡检（进程僵死/磁盘/日志/DB）
- 任务持久化与崩溃恢复
- 快捷键体系（Ctrl+R 刷新 / F1 帮助 / Ctrl+Q 退出）

### 未完成（执行链路断点）

| 缺口 | 影响 | 对应代码位置 |
|------|------|-------------|
| `_check_process_stale()` 空实现 | 检测到僵死但无动作 | `supervisor.py:167-181` |
| `_check_failure_counter()` 空实现 | 失败累计但不熔断 | `supervisor.py:182-184` |
| 检测→告警→**自动 kill** 链路缺失 | 只能看不能打 | `supervisor` 缺 `act()` 方法 |
| OpenCode session 级超时传播 | subagent 卡死不处理 | 需配合 `process_monitor` 杀进程 |

## 快速开始

```bash
cd tools/opencode-tui-enhance
pip install -r requirements.txt  # 或 pip install pyyaml PyQt6-Fluent-Widgets matplotlib psutil pydantic pywin32
python -m opencode_tui_plus
# 或双击 oce.bat（无控制台窗口启动）
```

启动参数：

| 参数 | 用途 |
|------|------|
| `-p` / `--project` | 指定项目根目录（自动检测 project.ocp） |
| `-c` / `--config` | 指定 project.ocp 路径 |
| `-d` / `--db-path` | 指定 OpenCode SQLite 路径（自动检测失败时使用） |

## 与 SuperTask 的关系

OCE 与 SuperTask 共享代码模式和部分模块（DB Reader、State Manager），但定位不同：

| 维度 | OCE | SuperTask |
|------|-----|-----------|
| 核心目的 | OpenCode 稳定性补丁 | AI 自主开发监督 |
| 监控 | ✅ 实时进程/session 监控 | ❌ 无 |
| 看门狗 | ✅ 巡检 + 告警（链路未闭环） | ❌ 无 |
| 自动化 | ❌ 可选（Loop Engine） | ✅ Cycle/Dispatch 模式 |
| GUI | PyQt6 仪表盘 | PyQt6 控制面板 |

## 已知问题与修复

### 暗色主题下文本底部色块

**现象**：页面文本（尤其是含下延字母 g/j/p/q/y 的区域）底部出现与周围背景不一致的色块，视觉不协调。

**根因**：qfluentwidgets `Theme.DARK` 给 `FluentWindow` 内容区（`QStackedWidget`）设置的默认背景色（如 `#202020`）与各页面自定义的 `#0d1117` 不一致。没有自行设置背景的页面（`LogInterface`、`AgentStatusInterface`、`SettingsInterface`、`AutomationInterface`）通过 `QStackedWidget` 的透明背景透出了这个不一致的颜色，而文本组件（`BodyLabel` 等）的 `background: transparent` 又继承了这个错误颜色。

**背景色不一致的传播链路**：

```
FluentWindow (qfluentwidgets Theme.DARK 默认背景 #202020)
  └── QStackedWidget (transparent → 透出上层 #202020)
        ├── OverviewInterface  (自设 #0d1117 ✓，看不到色差)
        ├── LogInterface       (无自设背景 ✗ → 看到 #202020)
        ├── SettingsInterface  (无自设背景 ✗ → 看到 #202020)
        └── ...
              └── BodyLabel (transparent → 继承 #202020 → 色块!)
```

**修复方案**（`app.py` → `OceWindow._init_window()`，2026-05-26）：

1. **OceWindow 自身背景** → `#0d1117`（兜底最外层）
2. **`self.stackedWidget` 实例级样式** → `background-color: #0d1117`（实例级优先级高于全局 QSS，强制内容区统一）
3. **全局 QSS 覆盖**：
   - 文本组件（`BodyLabel`、`QLabel`、`QTextEdit` 等 14+ 种）→ `background-color: transparent`（继承容器背景）
   - `QStackedWidget` → 保持 `transparent`（让实例级覆盖生效，同时不影响其他页内的 `QStackedWidget` 实例）
   - `QTableWidget` → 默认 `#0d1117` / `alternate #161b22`（无自设样式的表格也能正确显示）

**涉及文件**：`src/opencode_tui_plus/gui/ui_pyqt/app.py:194-255`

## 关键文档

- [远景规划](./VISION.md) — 看门狗闭环与演进路线

---

> 最后更新: 2026-05-27
> 修改: 全量文档同步 — 日期戳统一
