# SuperTask PyQt6 + Fluent Design 迁移设计

> **日期**: 2026-05-12
> **状态**: 已批准设计
> **目标**: 将 SuperTask GUI 从 tkinter 完全迁移到 PyQt6 + PyQt-Fluent-Widgets

---

## 1. 动机

当前 SuperTask GUI 使用 tkinter + ttk 构建，存在以下问题：
- 界面风格陈旧，缺乏现代化设计
- 自定义 Canvas 卡片列表维护成本高
- 暗色主题需手动配置 ttk.Style
- 缺少 Fluent Design 的动效和视觉层次

迁移到 PyQt6 + Fluent-Widgets 可获得：
- Windows 11 Fluent Design 原生风格
- 内置暗色/亮色主题自动切换
- 丰富的现代化组件（卡片、导航、通知）
- 更好的 DPI 和 HiDPI 支持
- 更清晰的信号/槽异步架构

## 2. 架构变更

```
旧架构 (tkinter):                 新架构 (PyQt6 + Fluent):
gui/main.py                       gui/main.py (入口改为 PyQt)
├── core/          (保留)          ├── core/          (改造)
│   ├── file_manager.py 不变       │   ├── file_manager.py 不变
│   ├── loop_manager.py threading  │   ├── loop_manager.py → QThread
│   └── opencode_runner.py subproc│   └── opencode_runner.py → QProcess
└── ui/     ──→ 整个替换 →         └── ui_pyqt/     (全新)
    ├── main_window.py tk               ├── app.py FluentWindow + Nav
    ├── control_panel.py                ├── control_interface.py
    ├── task_panel.py + card_list.py    ├── task_interface.py + TableWidget
    ├── detail_panel.py                 ├── detail_widget.py CardWidget
    ├── log_panel.py                    ├── log_interface.py
    ├── terminal_panel.py               ├── terminal_interface.py
    ├── history_panel.py                ├── history_interface.py
    └── theme.py                        └── (主题由 Fluent 管理)
```

### 2.1 导航结构

```
FluentWindow
├── 侧边导航栏
│   ├── 🏠 控制面板     → control_interface.py
│   ├── 📋 提议与工作   → task_interface.py
│   │                    └── 嵌入 detail_widget.py
│   ├── 📝 日志         → log_interface.py
│   ├── 💻 终端         → terminal_interface.py
│   └── 🕐 历史         → history_interface.py
└── 右侧内容区 (StackedWidget)
     └── 当前选中的页面
```

### 2.2 线程模型

```
QApplication (主线程)
  ├── FluentWindow (UI)
  │     ├── 信号: log_received, state_changed, task_selected
  │     └── 槽: update_log, refresh_panels, show_detail
  │
  ├── LoopManager (QThread 子类)
  │     ├── 信号: log_emitted(level, msg), state_changed()
  │     ├── 持有: FileManager (纯 Python)
  │     └── 驱动: QTimer(5s间隔) 替代 time.sleep
  │
  └── OpencodeRunner (QProcess)
        ├── 信号: output_ready(text), finished(success)
        ├── 同步: run(prompt) → QProcess.execute()
        └── 异步: run_async(prompt) → readyReadStandardOutput
```

## 3. 组件映射

### 3.1 窗口框架

```python
class SuperTaskWindow(FluentWindow):
    def __init__(self):
        super().__init__()
        # 启用暗色主题
        setTheme(Theme.DARK)
        setThemeColor("#58a6ff")
        
        # 添加导航页面
        self.control_page = ControlInterface(self)
        self.addSubInterface(self.control_page, FIF.HOME, "控制面板")
        
        self.task_page = TaskInterface(self)
        self.addSubInterface(self.task_page, FIF.LIST, "提议与工作")
        
        self.log_page = LogInterface(self)
        self.addSubInterface(self.log_page, FIF.DOCUMENT, "日志")
        
        self.terminal_page = TerminalInterface(self)
        self.addSubInterface(self.terminal_page, FIF.MTERMINAL, "终端")
        
        self.history_page = HistoryInterface(self)
        self.addSubInterface(self.history_page, FIF.HISTORY, "历史",
                           position=NavigationItemPosition.BOTTOM)
```

### 3.2 控制面板 (ControlInterface)

- 顶部：SimpleCardWidget + State统计
  - "待审批 N" / "排队中 N" / "已完成 N" / "已失败 N" 四色标签
- 中间：PrimaryPushButton "启动循环" + PushButton "手动探索" / "手动执行"
- 状态指示：SwitchButton 显示运行/暂停状态

### 3.3 提议与工作 (TaskInterface)

- 左右分栏布局使用 QSplitter（替代 PanedWindow）
- 左侧（weight=6）：提议任务列表
  - TableWidget 3列：[描述] [状态色徽标] [操作按钮]
  - 顶部工具栏：PushButton "批准选中" "全部批准" "驳回选中"
- 右侧（weight=4）：详情面板
  - HeaderCardWidget 带滚动描述区
  - 动态显示/隐藏错误信息区
  - 元数据栏（优先级/失败次数）

### 3.4 日志 (LogInterface)

- QTextEdit 只读模式
- 4 级颜色：info(绿) error(红) decision(蓝) approved(紫)
- 使用 QTextCharFormat 逐行着色
- 工具栏：自动滚动 SwitchButton + 清空按钮

### 3.5 终端 (TerminalInterface)

- 显示区：QTextEdit 只读 + ANSI 颜色解析
- 输入区：QLineEdit + 历史记录(Up/Down)
- 子进程：QProcess 驱动
- 状态栏：显示运行/空闲状态

### 3.6 历史 (HistoryInterface)

- QTextEdit 只读模式
- 已完成/失败任务列表，状态色标签
- 工具栏：刷新 + 清空

## 4. 数据流

```
用户操作 → UI信号 → LoopManager(QThread) → FileManager → YAML文件
                                    ↓
                              OpencodeRunner(QProcess)
                                    ↓
                              opencode CLI (子进程)
                                    ↓
                              QProcess信号 → UI更新
```

1. 用户点击"启动循环"
2. QThread 启动 _loop() 进入主循环
3. 每阶段通过 QTimer 驱动（5s间隔）
4. 每阶段调用 FileManager 读写 YAML
5. Execute 阶段启动 QProcess 执行 opencode
6. QProcess 输出信号更新终端显示
7. 状态变化 → pyqtSignal → UI 刷新面板

## 5. 文件清单

| 文件 | 说明 | 行数(估) |
|------|------|----------|
| `gui/main.py` | 入口改为 PyQt 启动 | 20 |
| `gui/core/loop_manager.py` | 改造为 QThread 子类 | 280 |
| `gui/core/opencode_runner.py` | 改造为 QProcess 封装 | 120 |
| `gui/ui_pyqt/__init__.py` | 包初始化 | 2 |
| `gui/ui_pyqt/app.py` | FluentWindow 主窗口 | 80 |
| `gui/ui_pyqt/control_interface.py` | 控制面板页 | 120 |
| `gui/ui_pyqt/task_interface.py` | 提议与工作页 | 200 |
| `gui/ui_pyqt/detail_widget.py` | 任务详情组件 | 150 |
| `gui/ui_pyqt/log_interface.py` | 日志页 | 100 |
| `gui/ui_pyqt/terminal_interface.py` | 终端页 | 200 |
| `gui/ui_pyqt/history_interface.py` | 历史页 | 80 |
| `gui/ui_pyqt/worker.py` | LoopManager QThread 子类 | 200 |
| `tools/supertask/requirements.txt` | 添加 PyQt6 依赖 | 2 行追加 |

**总计**: ~1550 行新代码 + ~400 行改造代码

## 6. 迁移策略

### Wave 1: 基础设施
1. 安装依赖 + 创建目录 ui_pyqt/
2. 创建 app.py (FluentWindow) + 空页面框架
3. 改造 core/ 中的线程/进程模型

### Wave 2: 核心页面
4. 控制面板 (control_interface.py)
5. 提议与工作 + 任务详情 (task_interface.py + detail_widget.py)
6. 日志面板 (log_interface.py)

### Wave 3: 剩余页面
7. 终端面板 (terminal_interface.py)
8. 历史面板 (history_interface.py)

### Wave 4: 集成验收
9. 入口 main.py 改为 PyQt 启动
10. 端到端测试 + 修复

## 7. 验收标准

- [ ] FluentWindow 启动，侧边导航 5 项均可见
- [ ] 暗色主题正确，主题色蓝色(#58a6ff)
- [ ] 控制面板显示统计，按钮触发 LoopManager
- [ ] 提议与工作页：左侧提议列表 + 右侧详情面板
- [ ] 批准/驳回/全部批准按钮回调正确
- [ ] 日志面板彩色日志实时追加
- [ ] 终端面板通过 QProcess 执行命令，ANSI 颜色正确
- [ ] 历史面板显示已完成/失败任务
- [ ] QThread 方式运行无 UI 卡顿
- [ ] 窗口关闭时 QProcess 安全终止
- [ ] HiDPI 适配正常

## 8. 约束

- Python 3.10+ 要求（保持与现有一致）
- 保留 core/file_manager.py 不变
- 保留 state/ 和 logs/ 目录结构不变
- 不修改 tools/supertask/ 目录内容（已于 2026-05-12 从 plan/supertask/ 迁移至此）
- 旧 gui/ui/ 目录保留（不删除），入口改为新路径
