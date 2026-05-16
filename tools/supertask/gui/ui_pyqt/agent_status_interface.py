# -*- coding: utf-8 -*-
"""agent_status_interface.py — Agent 状态监控面板（当前阶段 + agent 列表 + 耗时）"""
import time

from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout,
                                QTableWidgetItem, QHeaderView, QFrame)
from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QColor, QBrush
from qfluentwidgets import (
    TableWidget, BodyLabel, CaptionLabel, StrongBodyLabel,
    PushButton, FluentIcon as FIF,
)


# FIF 图标版本兼容
_FIF_PAUSE = getattr(FIF, 'PAUSE', None) or getattr(FIF, 'PAUSE_BADGE', None) or FIF.SYNC
_FIF_PLAY = getattr(FIF, 'PLAY', None) or getattr(FIF, 'PLAY_BADGE', None) or FIF.SYNC

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
            self._model_label.setText("")
            self._model_hint.setText("")

    def clear(self):
        """重置为空闲状态"""
        self._timer.stop()
        self._phase_start_time = 0.0
        self.update_phase("", "idle", 0)
        self.update_model("")


class AgentStatusInterface(QWidget):
    """Agent 状态监控页面 — 实时显示 agent 运行状态"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._last_status: dict = {}
        self._agent_start_times: dict[str, dict] = {}
        # 内部存储：当前渲染的 agent 列表
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

        # ── 阶段状态指示条 ──
        self._phase_bar = PhaseStatusBar(self)
        layout.addWidget(self._phase_bar)

        # ── Agent 表格（5 列） ──
        self._table = TableWidget(self)
        self._table.setColumnCount(5)
        self._table.setHorizontalHeaderLabels(
            ["Agent", "模型", "状态", "Preview", "耗时"]
        )
        self._table.setBorderRadius(8)
        self._table.horizontalHeader().setStretchLastSection(False)
        self._table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self._table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.ResizeToContents)
        self._table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.ResizeToContents)
        self._table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeMode.ResizeToContents)
        self._table.horizontalHeader().setSectionResizeMode(4, QHeaderView.ResizeMode.ResizeToContents)
        self._table.setEditTriggers(TableWidget.EditTrigger.NoEditTriggers)
        self._table.setSelectionMode(TableWidget.SelectionMode.NoSelection)
        self._table.setSortingEnabled(False)
        layout.addWidget(self._table)

        # ── 底部提示 ──
        self._hint_label = CaptionLabel("启动循环后，这里将实时显示 agent 运行状态")
        self._hint_label.setStyleSheet("color: #484f58; font-size: 11px;")
        layout.addWidget(self._hint_label)

        # ════════════════════════════════════════
        # Agent 控制栏（暂停/继续切换开关）
        # ════════════════════════════════════════
        ctrl_bar = QHBoxLayout()
        ctrl_bar.setSpacing(8)

        self._agent_ctrl_btn = PushButton(_FIF_PAUSE, "暂停")
        self._agent_ctrl_btn.setToolTip("未开始 — Agent 未运行")
        self._agent_ctrl_btn.setEnabled(False)
        self._agent_ctrl_btn.setStyleSheet("""
            PushButton {
                background-color: #161b22;
                border: 1px solid #30363d;
                border-radius: 6px;
                padding: 8px 20px;
                font-size: 13px;
                min-width: 100px;
            }
            PushButton:hover {
                border-color: #58a6ff;
                background-color: #1c2433;
            }
            PushButton:pressed {
                background-color: #0d419d;
            }
            PushButton:disabled {
                color: #484f58;
                border-color: #21262d;
                background-color: #0d1117;
            }
        """)

        ctrl_bar.addWidget(BodyLabel("Agent 控制:"))
        ctrl_bar.addWidget(self._agent_ctrl_btn)
        ctrl_bar.addStretch()

        layout.addLayout(ctrl_bar)

    # ── 实时耗时刷新 ─────────────────────────

    def _refresh_elapsed(self):
        """每秒刷新所有运行中 agent 的耗时"""
        if not self._agent_start_times:
            return
        now = time.time()
        for i in range(self._table.rowCount()):
            display = self._display_items[i] if i < len(self._display_items) else None
            if display is None:
                continue
            agent_id = display.get("id", "")
            info = self._agent_start_times.get(agent_id)
            if info:
                elapsed = info["base"] + (now - info["at"])
                dur_item = self._table.item(i, 4)
                if dur_item:
                    dur_item.setText(_format_duration(elapsed))

    # ── 表格渲染 ─────────────────────────────

    def _render_table(self, agents: list):
        """构建纯平铺表格，列出所有 agent 状态"""
        display_rows: list = list(agents)
        self._display_items = display_rows
        self._table.setRowCount(len(display_rows))

        # 追踪运行中的 agent（用于实时耗时刷新）
        now = time.time()
        new_times: dict[str, dict] = {}
        has_running = False

        for i, agent in enumerate(display_rows):
            # Col 0: Agent
            agent_id = agent.get("id", "?")
            id_item = QTableWidgetItem(agent_id)
            id_item.setForeground(QBrush(QColor("#58a6ff")))
            self._table.setItem(i, 0, id_item)

            # Col 1: 模型
            model = agent.get("model", "")
            model_text = model if model else "—"
            model_item = QTableWidgetItem(model_text)
            model_item.setForeground(QBrush(QColor("#bc8cff")))
            self._table.setItem(i, 1, model_item)

            # Col 2: 状态
            agent_status = agent.get("status", "running")
            sc = STATUS_COLORS.get(agent_status, "#8b949e")
            icon = STATUS_ICONS.get(agent_status, "?")
            status_item = QTableWidgetItem(f"{icon} {agent_status}")
            status_item.setForeground(QBrush(QColor(sc)))
            self._table.setItem(i, 2, status_item)

            # Col 3: Preview
            preview = agent.get("preview", "")
            preview_text = preview[:40] + "…" if len(preview) > 40 else preview
            prev_item = QTableWidgetItem(preview_text)
            prev_item.setForeground(QBrush(QColor("#484f58")))
            self._table.setItem(i, 3, prev_item)

            # Col 4: 耗时
            agent_elapsed = agent.get("elapsed", 0)
            dur_text = _format_duration(agent_elapsed)
            dur_item = QTableWidgetItem(dur_text)
            dur_item.setForeground(QBrush(QColor("#e6edf3")))
            self._table.setItem(i, 4, dur_item)

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

    def _update_hint(self):
        """更新底部提示"""
        phase_status = self._last_status.get("phase_status", "idle")
        phase = self._last_status.get("phase", "")

        agents_in_view = [d for d in self._display_items if d is not None]
        running_count = sum(
            1 for a in agents_in_view if a.get("status") == "running"
        )
        agent_count = len(agents_in_view)

        if phase_status == "idle":
            self._hint_label.setText("启动循环后，这里将实时显示 agent 运行状态")
        elif phase_status == "paused":
            self._hint_label.setText(f"已暂停: {phase}  —  Agent 进程已挂起")
        elif phase_status == "running":
            if running_count > 0:
                self._hint_label.setText(
                    f"正在运行: {phase}  —  {running_count}/{agent_count} 活跃"
                )
            else:
                self._hint_label.setText(f"正在运行: {phase}  —  {agent_count} 个 agent")
        elif phase_status == "done":
            self._hint_label.setText(f"已完成: {phase}  —  共 {agent_count} 个 agent")
        elif phase_status == "error":
            self._hint_label.setText(f"出错: {phase}")

    # ── Agent 控制按钮状态管理 ────────────────

    def set_agent_running(self, running: bool, suspended: bool = False):
        """更新 Agent 控制按钮状态：根据当前 agent 进程状态调整按钮文本和启用状态。
        
        Args:
            running: Agent 进程是否正在运行
            suspended: Agent 进程是否处于暂停状态
        """
        if not running:
            # 未开始：禁用
            self._agent_ctrl_btn.setEnabled(False)
            self._agent_ctrl_btn.setText("暂停")
            self._agent_ctrl_btn.setIcon(_FIF_PAUSE)
            self._agent_ctrl_btn.setToolTip("未开始 — Agent 未运行")
        elif suspended:
            # 已暂停：显示「继续」
            self._agent_ctrl_btn.setEnabled(True)
            self._agent_ctrl_btn.setText("继续")
            self._agent_ctrl_btn.setIcon(_FIF_PLAY)
            self._agent_ctrl_btn.setToolTip("点击恢复已暂停的 Agent 进程")
        else:
            # 运行中：显示「暂停」
            self._agent_ctrl_btn.setEnabled(True)
            self._agent_ctrl_btn.setText("暂停")
            self._agent_ctrl_btn.setIcon(_FIF_PAUSE)
            self._agent_ctrl_btn.setToolTip("点击挂起当前运行的 Agent 进程")

    def get_agent_ctrl_btn(self):
        """返回 Agent 控制按钮引用（供 app.py 连接信号）"""
        return self._agent_ctrl_btn

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

        # 更新 agent 计数
        self._agent_count_label.setText(f"({len(agents)} 个 agent)")

        # 渲染表格
        self._render_table(agents)

        # 更新底部提示
        self._update_hint()
