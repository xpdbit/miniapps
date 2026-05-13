# -*- coding: utf-8 -*-
"""agent_status_interface.py — Agent 状态监控面板（当前阶段 + sub-agent 列表 + 耗时）"""
import time

from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout,
                               QTableWidgetItem, QHeaderView, QFrame,
                               QComboBox)
from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QColor, QBrush
from qfluentwidgets import TableWidget, BodyLabel, CaptionLabel, StrongBodyLabel


STATUS_COLORS = {
    "running": "#3fb950",
    "paused": "#d29922",
    "done": "#58a6ff",
    "error": "#f85149",
    "idle": "#8b949e",
}
STATUS_ICONS = {
    "running": "●",
    "paused": "⏸",
    "done": "✓",
    "error": "✗",
    "idle": "○",
}


def _format_duration(seconds: float) -> str:
    """格式化耗时为易读字符串"""
    if seconds < 1:
        return "< 1s"
    elif seconds < 60:
        return f"{seconds:.0f}s"
    elif seconds < 3600:
        m, s = divmod(int(seconds), 60)
        return f"{m}m {s}s"
    else:
        h, r = divmod(int(seconds), 3600)
        m, s = divmod(r, 60)
        return f"{h}h {m}m {s}s"


class PhaseStatusBar(QFrame):
    """阶段状态指示条 — 显示当前活跃阶段名称、状态和模型"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._phase_elapsed_base: float = 0.0
        self._phase_start_time: float = 0.0

        self._timer = QTimer(self)
        self._timer.timeout.connect(self._tick)
        self._timer.setInterval(1000)

        self.setFrameShape(QFrame.Shape.StyledPanel)
        self.setStyleSheet("""
            PhaseStatusBar {
                background-color: #161b22;
                border: 1px solid #30363d;
                border-radius: 8px;
                padding: 12px 16px;
            }
        """)

        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        # 左侧：阶段名称 + 状态图标
        left = QVBoxLayout()
        self._phase_label = StrongBodyLabel("空闲")
        self._phase_label.setStyleSheet("font-size: 15px; color: #e6edf3;")
        left.addWidget(self._phase_label)

        self._status_label = CaptionLabel("○ 等待任务")
        self._status_label.setStyleSheet("color: #8b949e; font-size: 12px;")
        left.addWidget(self._status_label)

        layout.addLayout(left)
        layout.addStretch()

        # 中间：模型名称
        mid = QVBoxLayout()
        mid.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._model_label = CaptionLabel("")
        self._model_label.setStyleSheet("color: #bc8cff; font-size: 12px;")
        mid.addWidget(self._model_label, alignment=Qt.AlignmentFlag.AlignCenter)
        self._model_hint = CaptionLabel("")
        self._model_hint.setStyleSheet("color: #484f58; font-size: 10px;")
        mid.addWidget(self._model_hint, alignment=Qt.AlignmentFlag.AlignCenter)

        layout.addLayout(mid)
        layout.addStretch()

        # 右侧：耗时
        right = QVBoxLayout()
        right.setAlignment(Qt.AlignmentFlag.AlignRight)
        self._elapsed_label = StrongBodyLabel("")
        self._elapsed_label.setStyleSheet("font-size: 20px; color: #e6edf3;")
        right.addWidget(self._elapsed_label, alignment=Qt.AlignmentFlag.AlignRight)

        self._elapsed_hint = CaptionLabel("耗时")
        self._elapsed_hint.setStyleSheet("color: #8b949e; font-size: 11px;")
        right.addWidget(self._elapsed_hint, alignment=Qt.AlignmentFlag.AlignRight)

        layout.addLayout(right)

    def _tick(self):
        """每秒刷新耗时显示"""
        if self._phase_start_time <= 0:
            return
        now = time.time()
        elapsed = self._phase_elapsed_base + (now - self._phase_start_time)
        self._elapsed_label.setText(_format_duration(elapsed))

    def update_phase(self, phase: str, status: str, elapsed: float):
        """更新阶段显示"""
        color = STATUS_COLORS.get(status, "#8b949e")
        icon = STATUS_ICONS.get(status, "○")

        if status == "idle":
            phase_text = "空闲"
            status_text = "○ 等待任务"
        elif status == "paused":
            phase_text = phase
            status_text = f"{icon} 已暂停"
        else:
            phase_text = phase
            status_text = f"{icon} {'运行中' if status == 'running' else '完成' if status == 'done' else '错误'}"

        self._phase_label.setText(phase_text)
        self._phase_label.setStyleSheet(f"font-size: 15px; color: {color};")
        self._status_label.setText(status_text)
        self._status_label.setStyleSheet(f"color: {color}; font-size: 12px;")
        self._elapsed_label.setText(_format_duration(elapsed))
        self._elapsed_label.setStyleSheet(f"font-size: 20px; color: {color};")

        # 实时耗时刷新：running 时每秒更新，其余状态停止
        if status == "running":
            self._phase_elapsed_base = elapsed
            self._phase_start_time = time.time()
            self._timer.start()
        else:
            self._timer.stop()
            self._phase_start_time = 0.0

    def update_model(self, model: str):
        """更新模型名称显示"""
        if model:
            self._model_label.setText(model)
            self._model_hint.setText("模型")
        else:
            self._model_label.setText("—")
            self._model_hint.setText("模型未识别")

    def clear(self):
        """重置为空闲状态"""
        self._timer.stop()
        self._phase_start_time = 0.0
        self.update_phase("", "idle", 0)
        self.update_model("")


class AgentStatusInterface(QWidget):
    """Agent 状态监控页面 — 实时显示 agent/sub-agent 运行状态"""

    # 分隔符行标记（内部使用，不为 None）
    _SEPARATOR = object()

    def __init__(self, parent=None):
        super().__init__(parent)
        self._last_status: dict = {}
        self._agent_start_times: dict[str, dict] = {}
        # 内部存储：当前渲染的原始 agent 列表（含 None 分隔符）
        self._display_items: list = []

        self._elapsed_timer = QTimer(self)
        self._elapsed_timer.timeout.connect(self._refresh_elapsed)
        self._elapsed_timer.setInterval(1000)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(16)

        # ── 标题 ──
        title_row = QHBoxLayout()
        title_row.addWidget(BodyLabel("Agent 状态"))
        title_row.addStretch()
        self._agent_count_label = CaptionLabel("")
        self._agent_count_label.setStyleSheet("color: #8b949e; font-size: 12px;")
        title_row.addWidget(self._agent_count_label)
        layout.addLayout(title_row)

        # ── Agent 类型筛选 ──
        filter_row = QHBoxLayout()
        filter_label = BodyLabel("主 Agent 类型:")
        filter_label.setStyleSheet("color: #e6edf3; font-size: 13px;")
        self._type_combo = QComboBox(self)
        self._type_combo.addItem("All")
        self._type_combo.setStyleSheet("""
            QComboBox {
                background-color: #0d1117;
                color: #e6edf3;
                border: 1px solid #30363d;
                border-radius: 4px;
                padding: 4px 8px;
                min-width: 100px;
            }
            QComboBox::drop-down {
                border: none;
                padding-right: 8px;
            }
            QComboBox QAbstractItemView {
                background-color: #161b22;
                color: #e6edf3;
                border: 1px solid #30363d;
                selection-background-color: #1f6feb;
            }
        """)
        self._type_combo.currentIndexChanged.connect(self._on_filter_changed)
        filter_row.addWidget(filter_label)
        filter_row.addWidget(self._type_combo)
        filter_row.addStretch()
        layout.addLayout(filter_row)

        # ── 阶段状态指示条 ──
        self._phase_bar = PhaseStatusBar(self)
        layout.addWidget(self._phase_bar)

        # ── Sub-agent 表格（6 列） ──
        self._table = TableWidget(self)
        self._table.setColumnCount(6)
        self._table.setHorizontalHeaderLabels(
            ["Agent / Sub-agent", "类型", "模型", "状态", "Preview", "耗时"]
        )
        self._table.setBorderRadius(8)
        self._table.horizontalHeader().setStretchLastSection(False)
        self._table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self._table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.ResizeToContents)
        self._table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.ResizeToContents)
        self._table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeMode.ResizeToContents)
        self._table.horizontalHeader().setSectionResizeMode(4, QHeaderView.ResizeMode.ResizeToContents)
        self._table.horizontalHeader().setSectionResizeMode(5, QHeaderView.ResizeMode.ResizeToContents)
        self._table.setEditTriggers(TableWidget.EditTrigger.NoEditTriggers)
        self._table.setSelectionMode(TableWidget.SelectionMode.NoSelection)
        self._table.setSortingEnabled(False)  # 关闭排序以保持分组视图
        layout.addWidget(self._table)

        # ── 底部提示 ──
        self._hint_label = CaptionLabel("启动循环后，这里将实时显示 agent 运行状态")
        self._hint_label.setStyleSheet("color: #484f58; font-size: 11px;")
        layout.addWidget(self._hint_label)

    # ── 实时耗时刷新 ─────────────────────────

    def _refresh_elapsed(self):
        """每秒刷新所有运行中 agent 的耗时"""
        if not self._agent_start_times:
            return
        now = time.time()
        for i in range(self._table.rowCount()):
            display = self._display_items[i] if i < len(self._display_items) else None
            if display is None or display is self._SEPARATOR:
                continue
            agent_id = display.get("id", "")
            info = self._agent_start_times.get(agent_id)
            if info:
                elapsed = info["base"] + (now - info["at"])
                dur_item = self._table.item(i, 5)
                if dur_item:
                    dur_item.setText(_format_duration(elapsed))

    # ── 筛选交互 ─────────────────────────────

    def _on_filter_changed(self):
        """筛选下拉框变化时重新渲染表格"""
        agents = self._last_status.get("agents", [])
        self._render_table(agents, self._type_combo.currentText())

        # 刷新底部提示中的活跃计数
        self._update_hint_from_current()

    # ── 表格渲染 ─────────────────────────────

    def _render_table(self, agents: list, filter_type: str):
        """按筛选条件构建分组表格，支持 main/sub-agent 层级"""
        # 1. 筛选
        if filter_type != "All":
            # 如果筛选类型是主编排器类型，显示所有 agent（因为主编排器不是子 agent 的类型）
            main_type = self._last_status.get("main_agent_type", "")
            if filter_type == main_type:
                pass  # 不过滤，显示全部
            else:
                agents = [a for a in agents if a.get("type") == filter_type]

        # 2. 按 type 分组
        by_type: dict[str, list] = {}
        for a in agents:
            t = a.get("type", "?")
            by_type.setdefault(t, []).append(a)

        sorted_types = sorted(by_type.keys())

        # 3. 构建显示行列表（agent dict | None=分隔符）
        display_rows: list = []
        for idx, t in enumerate(sorted_types):
            group = by_type[t]
            # 主 agent（无 parent_id）排前面，sub-agent 排后面
            main_agents = [a for a in group if not a.get("parent_id")]
            sub_agents = [a for a in group if a.get("parent_id")]
            display_rows.extend(main_agents)
            display_rows.extend(sub_agents)
            # 类型组之间的分隔符
            if idx < len(sorted_types) - 1:
                display_rows.append(None)

        self._display_items = display_rows
        self._table.setRowCount(len(display_rows))

        # 4. 追踪运行中的 agent（用于实时耗时刷新）
        now = time.time()
        new_times: dict[str, dict] = {}
        has_running = False

        for i, item in enumerate(display_rows):
            if item is None:
                # ── 分隔符行 ──
                for col in range(6):
                    sep = QTableWidgetItem("")
                    sep.setFlags(
                        sep.flags()
                        & ~Qt.ItemFlag.ItemIsSelectable
                        & ~Qt.ItemFlag.ItemIsEnabled
                    )
                    sep.setBackground(QColor("#1c2128"))
                    self._table.setItem(i, col, sep)
                self._table.setRowHeight(i, 6)
                continue

            agent = item
            has_parent = bool(agent.get("parent_id"))

            # Col 0: Agent / Sub-agent
            agent_id = agent.get("id", "?")
            display_name = ("└─ " if has_parent else "") + agent_id
            id_item = QTableWidgetItem(display_name)
            name_color = "#58a6ff" if not has_parent else "#8b949e"
            id_item.setForeground(QBrush(QColor(name_color)))
            self._table.setItem(i, 0, id_item)

            # Col 1: 类型
            agent_type = agent.get("type", "?")
            type_item = QTableWidgetItem(agent_type)
            type_item.setForeground(QBrush(QColor("#8b949e")))
            self._table.setItem(i, 1, type_item)

            # Col 2: 模型
            model = agent.get("model", "")
            model_text = model if model else "—"
            model_item = QTableWidgetItem(model_text)
            model_item.setForeground(QBrush(QColor("#bc8cff")))
            self._table.setItem(i, 2, model_item)

            # Col 3: 状态
            agent_status = agent.get("status", "running")
            sc = STATUS_COLORS.get(agent_status, "#8b949e")
            icon = STATUS_ICONS.get(agent_status, "?")
            status_item = QTableWidgetItem(f"{icon} {agent_status}")
            status_item.setForeground(QBrush(QColor(sc)))
            self._table.setItem(i, 3, status_item)

            # Col 4: Preview
            preview = agent.get("preview", "")
            preview_text = preview[:40] + "…" if len(preview) > 40 else preview
            prev_item = QTableWidgetItem(preview_text)
            prev_item.setForeground(QBrush(QColor("#484f58")))
            self._table.setItem(i, 4, prev_item)

            # Col 5: 耗时
            agent_elapsed = agent.get("elapsed", 0)
            dur_text = _format_duration(agent_elapsed)
            dur_item = QTableWidgetItem(dur_text)
            dur_item.setForeground(QBrush(QColor("#e6edf3")))
            self._table.setItem(i, 5, dur_item)

            # 追踪运行中 agent 的耗时基准
            if agent_status == "running":
                new_times[agent_id] = {"base": agent_elapsed, "at": now}
                has_running = True

        self._agent_start_times = new_times

        # 启动/停止耗时刷新定时器
        if has_running:
            if not self._elapsed_timer.isActive():
                self._elapsed_timer.start()
        else:
            self._elapsed_timer.stop()

    def _update_hint_from_current(self):
        """根据当前筛选后的状态更新底部提示"""
        phase_status = self._last_status.get("phase_status", "idle")
        phase = self._last_status.get("phase", "")

        # 获取当前表格中的 agent（排除分隔符）
        agents_in_view = [
            d for d in self._display_items
            if d is not None and d is not self._SEPARATOR
        ]
        running_count = sum(
            1 for a in agents_in_view if a.get("status") == "running"
        )
        agent_count = len(agents_in_view)
        filter_type = self._type_combo.currentText()

        if phase_status == "idle":
            self._hint_label.setText("启动循环后，这里将实时显示 agent 运行状态")
        elif phase_status == "paused":
            self._hint_label.setText(f"已暂停: {phase}  —  Agent 进程已挂起")
        elif phase_status == "running":
            main_type = self._last_status.get("main_agent_type", "")
            type_info = f" [{main_type}]" if main_type else ""
            if running_count > 0:
                tag = f" [{filter_type}]" if filter_type != "All" else ""
                self._hint_label.setText(
                    f"正在运行: {phase}{type_info}{tag}  —  {running_count}/{agent_count} 活跃"
                )
            else:
                self._hint_label.setText(f"正在运行: {phase}  —  {agent_count} 个 agent")
        elif phase_status == "done":
            self._hint_label.setText(f"已完成: {phase}  —  共 {agent_count} 个 agent")
        elif phase_status == "error":
            self._hint_label.setText(f"出错: {phase}")

    # ── 外部接口 ─────────────────────────────

    def update_status(self, status: dict):
        """接收 LoopManager 发来的状态快照并更新 UI"""
        self._last_status = status

        # 更新阶段状态条
        phase = status.get("phase", "")
        phase_status = status.get("phase_status", "idle")
        elapsed = status.get("phase_elapsed", 0)
        self._phase_bar.update_phase(phase, phase_status, elapsed)
        self._phase_bar.update_model(status.get("global_model", ""))

        agents = status.get("agents", [])
        main_type = status.get("main_agent_type", "")

        # 更新 agent 计数
        self._agent_count_label.setText(f"({len(agents)} 个 sub-agent)")

        # 更新类型筛选框（保留当前选中）
        current_type = self._type_combo.currentText()
        self._type_combo.blockSignals(True)
        self._type_combo.clear()
        self._type_combo.addItem("All")
        # 添加主编排器类型（若存在）
        if main_type:
            self._type_combo.addItem(main_type)
        # 添加子 agent 类型
        types = sorted(set(a.get("type", "?") for a in agents))
        for t in types:
            self._type_combo.addItem(t)
        # 恢复之前选中的项
        idx = self._type_combo.findText(current_type)
        if idx >= 0:
            self._type_combo.setCurrentIndex(idx)
        self._type_combo.blockSignals(False)

        # 渲染表格
        self._render_table(agents, self._type_combo.currentText())

        # 更新底部提示
        self._update_hint_from_current()
