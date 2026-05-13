# -*- coding: utf-8 -*-
"""agent_status_interface.py — Agent 状态监控面板（当前阶段 + sub-agent 列表 + 耗时）"""
from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout,
                               QTableWidgetItem, QHeaderView, QFrame, QLabel)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QColor, QBrush
from qfluentwidgets import TableWidget, BodyLabel, CaptionLabel, StrongBodyLabel


STATUS_COLORS = {
    "running": "#3fb950",
    "done": "#58a6ff",
    "error": "#f85149",
    "idle": "#8b949e",
}
STATUS_ICONS = {
    "running": "●",
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

    def update_phase(self, phase: str, status: str, elapsed: float):
        """更新阶段显示"""
        color = STATUS_COLORS.get(status, "#8b949e")
        icon = STATUS_ICONS.get(status, "○")

        if status == "idle":
            phase_text = "空闲"
            status_text = "○ 等待任务"
        else:
            phase_text = phase
            status_text = f"{icon} {'运行中' if status == 'running' else '完成' if status == 'done' else '错误'}"

        self._phase_label.setText(phase_text)
        self._phase_label.setStyleSheet(f"font-size: 15px; color: {color};")
        self._status_label.setText(status_text)
        self._status_label.setStyleSheet(f"color: {color}; font-size: 12px;")
        self._elapsed_label.setText(_format_duration(elapsed))
        self._elapsed_label.setStyleSheet(f"font-size: 20px; color: {color};")

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
        self.update_phase("", "idle", 0)
        self.update_model("")


class AgentStatusInterface(QWidget):
    """Agent 状态监控页面 — 实时显示 agent/sub-agent 运行状态"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._last_status: dict = {}

        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(16)

        # 标题
        title_row = QHBoxLayout()
        title_row.addWidget(BodyLabel("Agent 状态"))
        title_row.addStretch()
        self._agent_count_label = CaptionLabel("")
        self._agent_count_label.setStyleSheet("color: #8b949e; font-size: 12px;")
        title_row.addWidget(self._agent_count_label)
        layout.addLayout(title_row)

        # 阶段状态指示条
        self._phase_bar = PhaseStatusBar(self)
        layout.addWidget(self._phase_bar)

        # Sub-agent 表格
        self._table = TableWidget(self)
        self._table.setColumnCount(5)
        self._table.setHorizontalHeaderLabels(["Agent ID", "类型", "模型", "状态", "耗时"])
        self._table.setBorderRadius(8)
        self._table.horizontalHeader().setStretchLastSection(False)
        self._table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self._table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.ResizeToContents)
        self._table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.ResizeToContents)
        self._table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeMode.ResizeToContents)
        self._table.horizontalHeader().setSectionResizeMode(4, QHeaderView.ResizeMode.ResizeToContents)
        self._table.setEditTriggers(TableWidget.EditTrigger.NoEditTriggers)
        self._table.setSelectionMode(TableWidget.SelectionMode.NoSelection)
        self._table.setSortingEnabled(True)
        layout.addWidget(self._table)

        # 底部提示
        self._hint_label = CaptionLabel("启动循环后，这里将实时显示 agent 运行状态")
        self._hint_label.setStyleSheet("color: #484f58; font-size: 11px;")
        layout.addWidget(self._hint_label)

    def update_status(self, status: dict):
        """接收 LoopManager 发来的状态快照并更新 UI"""
        self._last_status = status

        # 更新阶段状态条
        phase = status.get("phase", "")
        phase_status = status.get("phase_status", "idle")
        elapsed = status.get("phase_elapsed", 0)
        self._phase_bar.update_phase(phase, phase_status, elapsed)
        self._phase_bar.update_model(status.get("global_model", ""))

        # 更新 sub-agent 表格
        agents = status.get("agents", [])
        self._table.setRowCount(len(agents))
        self._agent_count_label.setText(f"({len(agents)} 个 sub-agent)")

        for i, agent in enumerate(agents):
            # Agent ID
            agent_id = agent.get("id", "?")
            id_item = QTableWidgetItem(agent_id)
            id_item.setForeground(QBrush(QColor("#c9d1d9")))
            self._table.setItem(i, 0, id_item)

            # 类型
            agent_type = agent.get("type", "?")
            type_item = QTableWidgetItem(agent_type)
            type_item.setForeground(QBrush(QColor("#8b949e")))
            self._table.setItem(i, 1, type_item)

            # 模型
            model = agent.get("model", "")
            model_text = model if model else "—"
            model_item = QTableWidgetItem(model_text)
            model_item.setForeground(QBrush(QColor("#bc8cff")))
            self._table.setItem(i, 2, model_item)

            # 状态
            agent_status = agent.get("status", "running")
            color = STATUS_COLORS.get(agent_status, "#8b949e")
            icon = STATUS_ICONS.get(agent_status, "?")
            status_text = f"{icon} {agent_status}"
            status_item = QTableWidgetItem(status_text)
            status_item.setForeground(QBrush(QColor(color)))
            self._table.setItem(i, 3, status_item)

            # 耗时
            agent_elapsed = agent.get("elapsed", 0)
            duration_text = _format_duration(agent_elapsed)
            dur_item = QTableWidgetItem(duration_text)
            dur_item.setForeground(QBrush(QColor("#8b949e")))
            self._table.setItem(i, 4, dur_item)

        # 更新底部提示
        if phase_status == "idle":
            self._hint_label.setText("启动循环后，这里将实时显示 agent 运行状态")
        elif phase_status == "running":
            running_count = sum(1 for a in agents if a.get("status") == "running")
            if running_count > 0:
                self._hint_label.setText(f"正在运行: {phase}  —  {running_count} 个 agent 活跃中")
            else:
                self._hint_label.setText(f"正在运行: {phase}")
        elif phase_status == "done":
            self._hint_label.setText(f"已完成: {phase}  —  共 {len(agents)} 个 agent")
        elif phase_status == "error":
            self._hint_label.setText(f"出错: {phase}")
