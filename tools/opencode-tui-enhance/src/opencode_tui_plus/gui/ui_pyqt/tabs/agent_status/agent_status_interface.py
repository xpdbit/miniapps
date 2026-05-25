# -*- coding: utf-8 -*-
"""agent_status_interface.py — Agent 运行时状态面板"""

from __future__ import annotations

from PyQt6.QtCore import QTimer
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QLabel,
    QTableWidget, QTableWidgetItem, QHeaderView,
)
from qfluentwidgets import (
    TitleLabel, SubtitleLabel, BodyLabel, TableWidget,
)

from opencode_tui_plus.core.process_monitor import ProcessMonitor
from opencode_tui_plus.core.runner import AgentRunner


class AgentStatusInterface(QWidget):
    """Agent 运行时状态监控面板"""

    def __init__(self, runner: AgentRunner, parent=None):
        super().__init__(parent)
        self._runner = runner
        self._monitor = ProcessMonitor()

        self._init_ui()

        # 定时刷新
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._refresh)
        self._timer.start(5000)  # 5 秒刷新

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        layout.addWidget(TitleLabel("Agent 状态"))

        # 状态摘要
        self._summary_label = BodyLabel("无运行中的 Agent")
        layout.addWidget(self._summary_label)

        # Agent 表格
        layout.addWidget(SubtitleLabel("活跃 Agent"))
        self._agent_table = TableWidget()
        self._agent_table.setColumnCount(5)
        self._agent_table.setHorizontalHeaderLabels([
            "PID", "类型", "模型", "状态", "运行时间"
        ])
        hdr = self._agent_table.horizontalHeader()
        if hdr:
            hdr.setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        self._agent_table.setMaximumHeight(300)
        layout.addWidget(self._agent_table)

        layout.addStretch()

    def _refresh(self):
        """刷新 Agent 状态"""
        processes = self._monitor.scan()
        self._agent_table.setRowCount(len(processes))

        running = 0
        for i, p in enumerate(processes):
            self._agent_table.setItem(i, 0, QTableWidgetItem(str(p.pid)))
            self._agent_table.setItem(i, 1, QTableWidgetItem(p.agent_type or "-"))
            self._agent_table.setItem(i, 2, QTableWidgetItem(p.model_id or "-"))
            self._agent_table.setItem(i, 3, QTableWidgetItem(p.status))
            mins = int(p.elapsed // 60) if p.elapsed > 0 else 0
            self._agent_table.setItem(i, 4, QTableWidgetItem(f"{mins}分"))
            if p.status == "running":
                running += 1

        if running > 0:
            self._summary_label.setText(
                f"运行中: {running} 个 Agent  |  共 {len(processes)} 个进程"
            )
        else:
            self._summary_label.setText("无运行中的 Agent")

    def cleanup(self):
        """清理资源"""
        self._timer.stop()
