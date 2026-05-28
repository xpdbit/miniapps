# -*- coding: utf-8 -*-
"""agent_status_interface.py — Agent 运行时状态面板（异步版）

v0.3.0: 使用 ProcessScanWorker 在后台线程扫描进程，
通过 Qt 信号异步更新 UI，消除主线程阻塞。
"""
from __future__ import annotations

from typing import Optional

from PyQt6.QtCore import QTimer
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout,
    QTableWidgetItem, QHeaderView,
)
from qfluentwidgets import (
    TitleLabel, SubtitleLabel, BodyLabel, TableWidget,
)

from oce.core.process_monitor import ProcessInfo
from oce.gui.core.data_store import DataStore


class AgentStatusInterface(QWidget):
    """Agent 运行时状态监控面板（异步版）

    通过 DataStore 的 WorkerManager 获取后台扫描结果，
    使用 QTimer 定期触发扫描请求，结果通过信号异步到达。
    """

    def __init__(self, parent=None):
        super().__init__(parent)
        self._store = DataStore.get_instance()
        self._processes: list[ProcessInfo] = []
        self._init_ui()

        # 定时触发后台扫描
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._request_scan)
        self._timer.start(5000)  # 5 秒触发一次

        # 连接 worker 信号（延迟初始化，确保 WorkerManager 已就绪）
        QTimer.singleShot(1000, self._connect_worker)

    def _connect_worker(self):
        """连接到 ProcessScanWorker 的信号"""
        mgr = self._store.worker_manager
        if mgr and mgr.scan_worker:
            mgr.scan_worker.signals.processes_ready.connect(self._on_processes_ready)
            mgr.scan_worker.signals.error.connect(self._on_scan_error)
            # 立即触发首次扫描
            mgr.scan_processes()

    def _init_ui(self):
        self.setStyleSheet("background-color: #0d1117;")
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
        self._agent_table.setColumnCount(6)
        self._agent_table.setHorizontalHeaderLabels([
            "PID", "类型", "模型", "状态", "CPU", "运行时间"
        ])
        hdr = self._agent_table.horizontalHeader()
        if hdr:
            hdr.setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        self._agent_table.setMaximumHeight(400)
        layout.addWidget(self._agent_table)

        layout.addStretch()

    def _request_scan(self):
        """触发后台进程扫描"""
        mgr = self._store.worker_manager
        if mgr:
            mgr.scan_processes()

    def _on_processes_ready(self, processes: list):
        """后台扫描完成，更新 UI"""
        self._processes = processes
        self._refresh_table()

    def _on_scan_error(self, error: str):
        """扫描错误处理"""
        self._summary_label.setText(f"扫描异常: {error[:50]}")

    def _refresh_table(self):
        """刷新 Agent 表格（在主线程中执行）"""
        processes = self._processes
        self._agent_table.setRowCount(len(processes))

        running = 0
        for i, p in enumerate(processes):
            self._agent_table.setItem(i, 0, QTableWidgetItem(str(p.pid)))
            self._agent_table.setItem(i, 1, QTableWidgetItem(p.agent_type or "-"))
            self._agent_table.setItem(i, 2, QTableWidgetItem(
                (p.model_id or "-").split("/")[-1][:25]))
            self._agent_table.setItem(i, 3, QTableWidgetItem(p.status))
            self._agent_table.setItem(i, 4, QTableWidgetItem(
                f"{p.cpu_percent:.1f}%" if p.cpu_percent > 0 else "-"))
            mins = int(p.elapsed // 60) if p.elapsed > 0 else 0
            secs = int(p.elapsed % 60) if p.elapsed > 0 else 0
            if mins > 0:
                self._agent_table.setItem(i, 5, QTableWidgetItem(f"{mins}分{secs}秒"))
            else:
                self._agent_table.setItem(i, 5, QTableWidgetItem(f"{secs}秒"))
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
        # 断开 worker 信号
        mgr = self._store.worker_manager
        if mgr and mgr.scan_worker:
            try:
                mgr.scan_worker.signals.processes_ready.disconnect(self._on_processes_ready)
                mgr.scan_worker.signals.error.disconnect(self._on_scan_error)
            except (TypeError, RuntimeError):
                pass
