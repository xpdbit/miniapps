# SuperTask 监控概览 Tab 重新设计 — 实现计划

> **For agentic workers:** Inline execution. Steps use checkbox (`- [ ]`) for tracking.

**Goal:** 将概览 Tab 从纵向堆叠改为双栏仪表盘布局（KPI卡片+PyQtGraph趋势图+Agent卡片列表）

**Architecture:** 保持 MonitorInterface 对 OverviewTab 的调用接口 (`update_stats`, `update_live_agents`, `set_on_refresh`)，新增 `set_data_sources` 传递 store 引用供趋势图自主拉取数据。所有新组件集中在 `monitor_interface.py` 中。

**Tech Stack:** PyQt6 + qfluentwidgets + pyqtgraph

---

### Task 1: 添加 pyqtgraph 依赖

**Files:**
- Modify: `tools/supertask/requirements.txt`

- [ ] 添加 pyqtgraph 依赖

```txt
pyqtgraph>=0.13
```

---

### Task 2: 新增 KPICard 组件

**Files:**
- Modify: `tools/supertask/gui/ui_pyqt/monitor_interface.py` (在 SummaryCard 类之后插入)

- [ ] 在 `SummaryCard` 类之后添加 `KPICard` 类

每张卡片：彩色 3px 顶边 + 指标名 + 大号数值 + 变化百分比指示

```python
class KPICard(QFrame):
    """单指标 KPI 卡片：彩色顶边、大数值、变化指示"""

    def __init__(self, title: str, accent_color: str, parent=None):
        super().__init__(parent)
        self.setFixedHeight(90)
        self.setStyleSheet(f"""
            KPICard {{
                background-color: #161b22;
                border: 1px solid #30363d;
                border-top: 3px solid {accent_color};
                border-radius: 8px;
            }}
        """)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(12, 8, 12, 8)
        layout.setSpacing(2)

        # 标签
        self._title = CaptionLabel(title)
        self._title.setStyleSheet(f"color: {accent_color}; font-size: 11px; border: none;")
        layout.addWidget(self._title)

        # 数值
        self._value = TitleLabel("-")
        self._value.setStyleSheet("font-size: 24px; font-weight: bold; color: #e6edf3; border: none;")
        layout.addWidget(self._value)

        # 变化指示
        self._delta = CaptionLabel("")
        self._delta.setStyleSheet("font-size: 11px; border: none;")
        layout.addWidget(self._delta)

    def update_value(self, value: str, delta: str = "", delta_up: bool = True):
        self._value.setText(value)
        if delta:
            color = "#3fb950" if delta_up else "#f85149"
            arrow = "↑" if delta_up else "↓"
            self._delta.setText(f"{arrow} {delta}")
            self._delta.setStyleSheet(f"color: {color}; font-size: 11px; border: none;")
        else:
            self._delta.setText("")
```

---

### Task 3: 新增 EnhancedStatusHeader

**Files:**
- Modify: `tools/supertask/gui/ui_pyqt/monitor_interface.py` (替换 StatusHeader)

- [ ] 替换 `StatusHeader` 为 `EnhancedStatusHeader`

加高至 96px，增加今日成本显示，布局更通透：

```python
class EnhancedStatusHeader(QFrame):
    """增强状态头部：96px，状态+进程+今日会话与成本"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setFixedHeight(96)
        self.setStyleSheet("""
            EnhancedStatusHeader {
                background-color: #0d1117;
                border: 1px solid #30363d;
                border-radius: 10px;
            }
        """)
        layout = QHBoxLayout(self)
        layout.setContentsMargins(20, 12, 20, 12)
        layout.setSpacing(16)

        # ── 左侧：状态指示灯 ──
        self._dot = QLabel("●")
        self._dot.setStyleSheet("font-size: 28px; color: #8b949e; border: none;")
        layout.addWidget(self._dot)

        status_text = QVBoxLayout()
        status_text.setSpacing(0)
        self._status_label = StrongBodyLabel("待机中")
        self._status_label.setStyleSheet("font-size: 18px; color: #8b949e; border: none;")
        status_text.addWidget(self._status_label)
        self._sub_status = CaptionLabel("没有运行中的 OpenCode 进程")
        self._sub_status.setStyleSheet("color: #484f58; font-size: 11px; border: none;")
        status_text.addWidget(self._sub_status)
        layout.addLayout(status_text)

        layout.addSpacing(12)
        sep1 = self._mk_vsep()
        layout.addWidget(sep1)
        layout.addSpacing(12)

        # ── 中间：进程数 ──
        proc_layout = QVBoxLayout()
        proc_layout.setSpacing(0)
        self._proc_count = TitleLabel("0")
        self._proc_count.setStyleSheet("font-size: 26px; font-weight: bold; color: #e6edf3; border: none;")
        proc_layout.addWidget(self._proc_count, alignment=Qt.AlignmentFlag.AlignCenter)
        proc_hint = CaptionLabel("运行中进程")
        proc_hint.setStyleSheet("color: #8b949e; font-size: 11px; border: none;")
        proc_layout.addWidget(proc_hint, alignment=Qt.AlignmentFlag.AlignCenter)
        proc_sub = CaptionLabel("")
        proc_sub.setStyleSheet("color: #484f58; font-size: 10px; border: none;")
        proc_layout.addWidget(proc_sub, alignment=Qt.AlignmentFlag.AlignCenter)
        self._proc_sub = proc_sub
        layout.addLayout(proc_layout)

        layout.addSpacing(12)
        sep2 = self._mk_vsep()
        layout.addWidget(sep2)
        layout.addSpacing(12)

        # ── 右侧：今日会话 + 成本 ──
        sess_layout = QVBoxLayout()
        sess_layout.setSpacing(0)
        self._today_sessions = TitleLabel("-")
        self._today_sessions.setStyleSheet("font-size: 26px; font-weight: bold; color: #e6edf3; border: none;")
        sess_layout.addWidget(self._today_sessions, alignment=Qt.AlignmentFlag.AlignCenter)
        sess_hint = CaptionLabel("今日会话")
        sess_hint.setStyleSheet("color: #8b949e; font-size: 11px; border: none;")
        sess_layout.addWidget(sess_hint, alignment=Qt.AlignmentFlag.AlignCenter)
        self._today_cost = CaptionLabel("")
        self._today_cost.setStyleSheet("color: #d29922; font-size: 11px; border: none;")
        sess_layout.addWidget(self._today_cost, alignment=Qt.AlignmentFlag.AlignCenter)
        layout.addLayout(sess_layout)

        layout.addStretch()

    @staticmethod
    def _mk_vsep():
        s = QFrame()
        s.setFrameShape(QFrame.Shape.VLine)
        s.setStyleSheet("color: #21262d;")
        s.setFixedWidth(1)
        return s

    def update_status(self, running_count: int, total_processes: int,
                       today_sessions: int = 0, today_cost: float = 0.0):
        if running_count > 0:
            self._dot.setStyleSheet("font-size: 28px; color: #3fb950; border: none;")
            self._status_label.setText("工作中")
            self._status_label.setStyleSheet("font-size: 18px; color: #3fb950; border: none;")
            agent_str = "个子 Agent" if running_count > 1 else "个 Agent"
            self._sub_status.setText(f"{running_count} {agent_str} 正在运行中")
        else:
            self._dot.setStyleSheet("font-size: 28px; color: #8b949e; border: none;")
            self._status_label.setText("待机中")
            self._status_label.setStyleSheet("font-size: 18px; color: #8b949e; border: none;")
            if total_processes > 0:
                self._sub_status.setText(f"{total_processes} 个进程已退出")
            else:
                self._sub_status.setText("没有运行中的 OpenCode 进程")

        self._proc_count.setText(str(running_count))
        self._proc_sub.setText(f"总计 {total_processes} 个进程")
        self._today_sessions.setText(str(today_sessions))
        self._today_cost.setText(f"成本 {_fmt_cost(today_cost)}")
```

---

### Task 4: 新增 TrendChart (PyQtGraph)

**Files:**
- Modify: `tools/supertask/gui/ui_pyqt/monitor_interface.py`

- [ ] 在 `KPICard` 后添加 `TrendChart` 组件

PyQtGraph 7 日趋势图，支持切换 4 种指标：

```python
class TrendChart(QFrame):
    """7 日趋势图（PyQtGraph），支持切换指标"""

    METRICS = [
        ("会话数", "sessions_total", "#3fb950"),
        ("Token", "total_tokens", "#58a6ff"),
        ("成本", "total_cost", "#d29922"),
        ("耗时", "total_duration_s", "#f0883e"),
    ]

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setStyleSheet("""
            TrendChart {
                background-color: #0d1117;
                border: 1px solid #30363d;
                border-radius: 10px;
            }
        """)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 12, 16, 12)
        layout.setSpacing(8)

        # 标题行 + 切换按钮
        header = QHBoxLayout()
        title = StrongBodyLabel("7 日趋势")
        title.setStyleSheet("font-size: 15px; color: #e6edf3; border: none;")
        header.addWidget(title)
        header.addStretch()

        self._metric_btns = []
        self._active_metric = 0
        for i, (name, _, color) in enumerate(self.METRICS):
            btn = PushButton(name)
            btn.setFixedHeight(26)
            btn.clicked.connect(lambda checked, idx=i: self._switch_metric(idx))
            header.addWidget(btn)
            self._metric_btns.append(btn)
        layout.addLayout(header)

        # 更新按钮样式
        self._update_btn_styles()

        # PyQtGraph PlotWidget
        import pyqtgraph as pg
        pg.setConfigOptions(background=None, foreground="#8b949e")
        self._plot = pg.PlotWidget()
        self._plot.setStyleSheet("border: none;")
        self._plot.setMinimumHeight(180)
        self._plot.showGrid(x=True, y=True, alpha=0.15)
        self._plot.getAxis("bottom").setStyle(tickFont=QFont("", 8))
        self._plot.getAxis("left").setStyle(tickFont=QFont("", 8))
        self._plot.getAxis("bottom").setPen(QColor("#30363d"))
        self._plot.getAxis("left").setPen(QColor("#30363d"))
        self._plot.setLabel("bottom", "")
        self._plot.setLabel("left", "")
        self._plot.getViewBox().setMouseEnabled(False, False)
        self._plot.getViewBox().setMenuEnabled(False)
        self._plot.hideButtons()
        self._curve = None
        layout.addWidget(self._plot)

        self._daily_data = []

    def set_data(self, daily_aggregates: List[dict]):
        self._daily_data = daily_aggregates
        self._plot_metric(self._active_metric)

    def _switch_metric(self, idx: int):
        self._active_metric = idx
        self._update_btn_styles()
        self._plot_metric(idx)

    def _update_btn_styles(self):
        for i, btn in enumerate(self._metric_btns):
            if i == self._active_metric:
                btn.setStyleSheet(f"""
                    PushButton {{
                        background-color: {self.METRICS[i][2]}22;
                        color: {self.METRICS[i][2]};
                        border: 1px solid {self.METRICS[i][2]}44;
                    }}
                """)
            else:
                btn.setStyleSheet("""
                    PushButton {
                        background-color: transparent;
                        color: #8b949e;
                        border: 1px solid #30363d;
                    }
                """)

    def _plot_metric(self, idx: int):
        _, key, color = self.METRICS[idx]
        self._plot.clear()
        if not self._daily_data:
            return

        # 按日期排序（ascending）
        sorted_data = sorted(self._daily_data, key=lambda d: d.get("date", ""))
        if len(sorted_data) < 2:
            return

        dates = []
        values = []
        for d in sorted_data:
            dates.append(d.get("date", "")[-5:])  # MM-DD
            if key == "total_tokens":
                v = (d.get("total_tokens_input", 0) or 0) + (d.get("total_tokens_output", 0) or 0)
            else:
                v = d.get(key, 0) or 0
            values.append(v)

        # 绘制曲线
        pen = pg.mkPen(color=color, width=2)
        self._curve = self._plot.plot(values, pen=pen, symbol="o",
                                       symbolSize=6, symbolBrush=color,
                                       symbolPen=color)

        # X 轴刻度
        ax = self._plot.getAxis("bottom")
        ticks = [(i, dates[i]) for i in range(len(dates))]
        ax.setTicks([ticks])
        self._plot.setXRange(-0.2, len(dates) - 0.8)
```

---

### Task 5: 新增 AgentCardList

**Files:**
- Modify: `tools/supertask/gui/ui_pyqt/monitor_interface.py`

- [ ] 在 `TrendChart` 后添加 `AgentCardList` 组件（替换 `LiveAgentPanel`）

卡片列表风格的 Agent 追踪面板，替代表格：

```python
class AgentCardList(QFrame):
    """卡片列表风格实时 Agent 追踪"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setStyleSheet("""
            AgentCardList {
                background-color: #161b22;
                border: 1px solid #30363d;
                border-radius: 10px;
            }
        """)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(14, 12, 14, 12)
        layout.setSpacing(4)

        # 标题
        header = QHBoxLayout()
        title = StrongBodyLabel("实时 Agent 追踪")
        title.setStyleSheet("font-size: 15px; color: #e6edf3; border: none;")
        header.addWidget(title)
        header.addStretch()
        self._count_label = CaptionLabel("0 运行中")
        self._count_label.setStyleSheet("color: #8b949e; font-size: 11px; border: none;")
        header.addWidget(self._count_label)
        layout.addLayout(header)

        sep = QFrame()
        sep.setFrameShape(QFrame.Shape.HLine)
        sep.setStyleSheet("color: #21262d;")
        layout.addWidget(sep)

        # Agent 卡片容器
        self._container = QVBoxLayout()
        self._container.setSpacing(4)
        layout.addLayout(self._container)
        layout.addStretch()

    def update_processes(self, processes: List[dict]):
        # 清除旧卡片
        self._clear_layout(self._container)

        if not processes:
            empty = CaptionLabel("暂无运行中的 Agent")
            empty.setStyleSheet("color: #484f58; padding: 16px; border: none;")
            self._container.addWidget(empty, alignment=Qt.AlignmentFlag.AlignCenter)
            self._count_label.setText("0 运行中")
            return

        running = 0
        for p in processes:
            card = self._build_agent_card(p)
            self._container.addWidget(card)
            if p.get("status") == "running":
                running += 1

        self._count_label.setText(f"{running} 运行中 / {len(processes)} 总计")

    def _build_agent_card(self, p: dict) -> QFrame:
        card = QFrame()
        card.setStyleSheet("background-color: #0d1117; border: 1px solid #21262d; border-radius: 6px;")
        card.setFixedHeight(52)
        layout = QHBoxLayout(card)
        layout.setContentsMargins(10, 6, 10, 6)

        # 状态圆点
        status = p.get("status", "running")
        dot_color = "#3fb950" if status == "running" else "#8b949e"
        dot = QLabel("●")
        dot.setStyleSheet(f"font-size: 12px; color: {dot_color}; border: none;")
        layout.addWidget(dot)

        # Agent 名称 + 模型
        info = QVBoxLayout()
        info.setSpacing(0)
        agent = p.get("agent_type", "") or f"PID:{p.get('pid', '')}"
        name = StrongBodyLabel(agent[:18])
        name.setStyleSheet("font-size: 12px; color: #e6edf3; border: none;")
        info.addWidget(name)

        model = p.get("model_id", "") or ""
        model_short = model.split("/")[-1][:15] if "/" in model else model[:15]
        if model_short:
            mlabel = CaptionLabel(model_short)
            mlabel.setStyleSheet("font-size: 10px; color: #484f58; border: none;")
            info.addWidget(mlabel)
        layout.addLayout(info, 1)

        # 耗时 + 成本
        stats = QVBoxLayout()
        stats.setSpacing(0)
        elapsed = p.get("elapsed", 0) or 0
        elapsed_label = CaptionLabel(_fmt_duration(elapsed))
        elapsed_label.setStyleSheet("font-size: 11px; color: #8b949e; border: none;")
        elapsed_label.setAlignment(Qt.AlignmentFlag.AlignRight)
        stats.addWidget(elapsed_label)

        cost = p.get("cumulative_cost", 0) or 0
        cost_label = CaptionLabel(_fmt_cost(cost))
        cost_label.setStyleSheet("font-size: 10px; color: #d29922; border: none;")
        cost_label.setAlignment(Qt.AlignmentFlag.AlignRight)
        stats.addWidget(cost_label)
        layout.addLayout(stats)

        return card

    @staticmethod
    def _clear_layout(layout):
        while layout.count():
            item = layout.takeAt(0)
            w = item.widget()
            if w:
                w.deleteLater()
```

---

### Task 6: 新增 AgentDistBar 和 DailySummary

**Files:**
- Modify: `tools/supertask/gui/ui_pyqt/monitor_interface.py`

- [ ] 在 `AgentCardList` 后添加 `AgentDistBar`

水平条形图组件：

```python
class AgentDistBar(QFrame):
    """Agent 类型分布水平条形图"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setStyleSheet("""
            AgentDistBar {
                background-color: #161b22;
                border: 1px solid #30363d;
                border-radius: 10px;
            }
        """)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(14, 10, 14, 10)
        layout.setSpacing(6)

        title = StrongBodyLabel("Agent 分布")
        title.setStyleSheet("font-size: 13px; color: #e6edf3; border: none;")
        layout.addWidget(title)

        self._bar_container = QVBoxLayout()
        self._bar_container.setSpacing(4)
        layout.addLayout(self._bar_container)
        layout.addStretch()

    def update_data(self, agent_usage: List[dict]):
        self._clear_layout(self._bar_container)

        if not agent_usage:
            empty = CaptionLabel("暂无数据")
            empty.setStyleSheet("color: #484f58; border: none;")
            self._bar_container.addWidget(empty)
            return

        max_val = max(a.get("total_sessions", 0) or 0 for a in agent_usage[:5])
        if max_val == 0:
            max_val = 1

        for a in agent_usage[:5]:
            atype = a.get("agent_type", "?")[:14]
            count = a.get("total_sessions", 0) or 0

            row = QFrame()
            row.setStyleSheet("border: none;")
            rl = QHBoxLayout(row)
            rl.setContentsMargins(0, 0, 0, 0)
            rl.setSpacing(6)

            name_lbl = CaptionLabel(atype)
            name_lbl.setFixedWidth(60)
            name_lbl.setStyleSheet("color: #8b949e; font-size: 11px; border: none;")
            rl.addWidget(name_lbl)

            # 条形（QPainter 模拟用 QFrame + 背景色宽度）
            bar = QFrame()
            bar.setFixedHeight(12)
            ratio = count / max_val
            bar.setStyleSheet(f"""
                background-color: #58a6ff; border-radius: 3px;
                min-width: 4px; max-width: {int(ratio * 140)}px;
            """)
            rl.addWidget(bar)

            cnt_lbl = CaptionLabel(str(count))
            cnt_lbl.setStyleSheet("color: #e6edf3; font-size: 11px; border: none;")
            cnt_lbl.setFixedWidth(30)
            cnt_lbl.setAlignment(Qt.AlignmentFlag.AlignRight)
            rl.addWidget(cnt_lbl)

            rl.addStretch()
            self._bar_container.addWidget(row)

    @staticmethod
    def _clear_layout(layout):
        while layout.count():
            item = layout.takeAt(0)
            w = item.widget()
            if w:
                w.deleteLater()
```

- [ ] 在 `AgentDistBar` 后添加 `DailySummary`

```python
class DailySummary(QFrame):
    """今日关键数字摘要"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setStyleSheet("""
            DailySummary {
                background-color: #161b22;
                border: 1px solid #30363d;
                border-radius: 10px;
            }
        """)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(14, 10, 14, 10)
        layout.setSpacing(4)

        title = StrongBodyLabel("今日摘要")
        title.setStyleSheet("font-size: 13px; color: #e6edf3; border: none;")
        layout.addWidget(title)

        self._lines = []
        for label in ["会话", "Token 入/出", "文件变更"]:
            row = QHBoxLayout()
            lbl = CaptionLabel(label)
            lbl.setStyleSheet("color: #8b949e; font-size: 11px; border: none;")
            row.addWidget(lbl)
            row.addStretch()
            val = CaptionLabel("-")
            val.setStyleSheet("color: #e6edf3; font-size: 11px; border: none;")
            row.addWidget(val)
            self._lines.append((row, val))
            layout.addLayout(row)

    def update_data(self, day_summary: dict):
        """day_summary 来自 MonitorStore.get_summary(days=1)"""
        def v(d, k): return d.get(k, 0) or 0 if d else 0

        main_sessions = v(day_summary, "total_sessions_main")
        sub_sessions = v(day_summary, "total_sessions_sub")
        self._lines[0][1].setText(f"{main_sessions} 主 / {sub_sessions} 子")

        tin = v(day_summary, "total_tokens_input")
        tout = v(day_summary, "total_tokens_output")
        self._lines[1][1].setText(f"{_fmt_tokens(tin)} / {_fmt_tokens(tout)}")

        files = v(day_summary, "files_changed")
        self._lines[2][1].setText(str(files))
```

---

### Task 7: 重写 OverviewTab

**Files:**
- Modify: `tools/supertask/gui/ui_pyqt/monitor_interface.py` (替换 OverviewTab 类)

- [ ] 替换 `OverviewTab` 为新布局

双向布局 + 连接新组件：

```python
class OverviewTab(QWidget):
    """概览面板：双栏仪表盘布局"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._layout = QVBoxLayout(self)
        self._layout.setContentsMargins(0, 0, 0, 0)
        self._layout.setSpacing(10)

        # 状态头部
        self._status_header = EnhancedStatusHeader()
        self._layout.addWidget(self._status_header)

        # 双栏主体
        body = QHBoxLayout()
        body.setSpacing(10)

        # 左栏 60%
        left = QVBoxLayout()
        left.setSpacing(10)

        # 4 张 KPI 卡片横排
        kpi_row = QHBoxLayout()
        kpi_row.setSpacing(8)
        self._kpi_cards = {}
        kpi_configs = [
            ("耗时", "#f0883e", _fmt_duration),
            ("Token", "#58a6ff", _fmt_tokens),
            ("会话", "#3fb950", str),
            ("成本", "#d29922", _fmt_cost),
        ]
        for title, color, _ in kpi_configs:
            card = KPICard(title, color)
            kpi_row.addWidget(card)
            self._kpi_cards[title] = card
        self._kpi_formatters = {t: f for t, _, f in kpi_configs}
        left.addLayout(kpi_row)

        # 趋势图
        self._trend_chart = TrendChart()
        left.addWidget(self._trend_chart, 1)
        left_widget = QWidget()
        left_widget.setLayout(left)

        # 右栏 40%
        right = QVBoxLayout()
        right.setSpacing(10)
        self._agent_cards = AgentCardList()
        right.addWidget(self._agent_cards)
        self._agent_dist = AgentDistBar()
        right.addWidget(self._agent_dist)
        self._daily_summary = DailySummary()
        right.addWidget(self._daily_summary)
        right.addStretch()
        right_widget = QWidget()
        right_widget.setLayout(right)

        body.addWidget(left_widget, 3)
        body.addWidget(right_widget, 2)
        self._layout.addLayout(body, 1)

        # 数据源
        self._monitor_store = None
        self._on_refresh_callback = None
        self._last_day_summary: dict = {}
        self._last_running_count = 0
        self._last_total_count = 0

    def set_data_sources(self, monitor_store):
        self._monitor_store = monitor_store

    def set_on_refresh(self, callback):
        self._on_refresh_callback = callback

    def update_stats(self, day: dict, week: dict, month: dict, total: dict):
        """更新 KPI 卡片和状态头部"""
        day = day or {}
        week = week or {}
        self._last_day_summary = day

        # 更新状态头部
        today_sessions = day.get("total_sessions", 0) or 0
        today_cost = day.get("total_cost", 0) or 0.0
        self._status_header.update_status(
            running_count=self._last_running_count,
            total_processes=self._last_total_count,
            today_sessions=today_sessions,
            today_cost=today_cost,
        )

        # 更新 KPI 卡片
        def v(d, k): return d.get(k, 0) or 0 if d else 0

        # 计算昨日对比（通过 daily_aggregates）
        yesterday_sessions = 0
        yesterday_cost = 0.0
        yesterday_tokens = 0
        yesterday_duration = 0.0

        daily_data = []
        if self._monitor_store:
            daily_data = self._monitor_store.get_daily_aggregates(days=7)
            # 找昨天（日期第二大的记录）
            sorted_data = sorted(daily_data, key=lambda d: d.get("date", ""), reverse=True)
            if len(sorted_data) >= 2:
                yd = sorted_data[1]
                yesterday_sessions = v(yd, "sessions_total")
                yesterday_cost = v(yd, "total_cost")
                yesterday_tokens = v(yd, "total_tokens_input") + v(yd, "total_tokens_output")
                yesterday_duration = v(yd, "total_duration_s")

        # 耗时卡片
        today_dur = v(day, "total_duration_s")
        dur_str = self._kpi_formatters["耗时"](today_dur)
        if yesterday_duration and yesterday_duration > 0:
            dur_delta = (today_dur - yesterday_duration) / yesterday_duration * 100
            self._kpi_cards["耗时"].update_value(dur_str, f"{abs(dur_delta):.0f}%", dur_delta >= 0)
        else:
            self._kpi_cards["耗时"].update_value(dur_str)

        # Token 卡片
        today_tok = v(day, "total_tokens_input") + v(day, "total_tokens_output") + v(day, "total_tokens_reasoning")
        tok_str = self._kpi_formatters["Token"](today_tok)
        if yesterday_tokens and yesterday_tokens > 0:
            tok_delta = (today_tok - yesterday_tokens) / yesterday_tokens * 100
            self._kpi_cards["Token"].update_value(tok_str, f"{abs(tok_delta):.0f}%", tok_delta >= 0)
        else:
            self._kpi_cards["Token"].update_value(tok_str)

        # 会话卡片
        today_sess = v(day, "total_sessions")
        sess_str = self._kpi_formatters["会话"](today_sess)
        if yesterday_sessions and yesterday_sessions > 0:
            sess_delta = today_sess - yesterday_sessions
            self._kpi_cards["会话"].update_value(sess_str, str(abs(int(sess_delta))), sess_delta >= 0)
        else:
            self._kpi_cards["会话"].update_value(sess_str)

        # 成本卡片
        today_cost_val = v(day, "total_cost")
        cost_str = self._kpi_formatters["成本"](today_cost_val)
        if yesterday_cost and yesterday_cost > 0:
            cost_delta = (today_cost_val - yesterday_cost) / yesterday_cost * 100
            self._kpi_cards["成本"].update_value(cost_str, f"{abs(cost_delta):.0f}%", cost_delta >= 0)
        else:
            self._kpi_cards["成本"].update_value(cost_str)

        # 更新趋势图
        if daily_data:
            self._trend_chart.set_data(daily_data)

        # 更新 Agent 分布
        if self._monitor_store:
            try:
                agent_data = self._monitor_store.get_agent_type_usage(days=7)
                self._agent_dist.update_data(agent_data)
            except Exception:
                pass

        # 更新今日摘要
        self._daily_summary.update_data(day)

    def update_live_agents(self, processes: List[dict]):
        """更新实时 agent 列表"""
        self._agent_cards.update_processes(processes)

        running = sum(1 for p in processes if p.get("status") == "running")
        total = len(processes)
        self._last_running_count = running
        self._last_total_count = total

        self._status_header.update_status(
            running_count=running,
            total_processes=total,
            today_sessions=self._last_day_summary.get("total_sessions", 0) if self._last_day_summary else 0,
            today_cost=self._last_day_summary.get("total_cost", 0) if self._last_day_summary else 0.0,
        )
```

---

### Task 8: 更新 MonitorInterface

**Files:**
- Modify: `tools/supertask/gui/ui_pyqt/monitor_interface.py` (MonitorInterface.set_data_sources 方法)

- [ ] 在 `MonitorInterface.set_data_sources` 中传递 store 引用给 OverviewTab

在 `set_data_sources` 方法中找到 `self._overview_tab` 相关代码，添加：

```python
# 传递 store 给概览页（用于趋势图等自主拉取数据）
self._overview_tab.set_data_sources(monitor_store)
```

---

### Task 9: 清理旧组件

**Files:**
- Modify: `tools/supertask/gui/ui_pyqt/monitor_interface.py`

- [ ] 确认旧组件可以保留（不删除以免破坏兼容，标记为已弃用）

旧类 `StatusHeader`、`PeriodStatsGrid`、`LiveAgentPanel` 不再被引用，可安全保留在文件中（或删除）。

---

### Task 10: 验证

- [ ] 运行 `python gui/main.py` 检查界面加载是否正常
- [ ] 确认概览 Tab 显示新布局（双栏、KPI 卡片、趋势图占位）
- [ ] 确认数据刷新流程正常（自动 60s 或手动全部刷新）
- [ ] 检查 `pyqtgraph` 导入是否正常
- [ ] 确认其他 Tab 不受影响
