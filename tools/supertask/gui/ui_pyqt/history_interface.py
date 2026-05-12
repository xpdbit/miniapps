# -*- coding: utf-8 -*-
"""history_interface.py — 历史记录（历史执行 / 历史驳回 标签页表格）"""
from PyQt6.QtWidgets import QVBoxLayout, QHBoxLayout, QHeaderView, QWidget, QTableWidgetItem
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QColor, QBrush
from qfluentwidgets import TableWidget, BodyLabel, TabWidget, PushButton, CaptionLabel


class HistoryTableWidget(TableWidget):
    """带统一样式的历史子表格"""

    STATUS_LABELS = {
        "done": "完成",
        "error": "失败",
        "failed_blocked": "阻塞",
        "cancelled": "已取消",
        "rejected": "已驳回",
        "pending": "待处理",
    }
    STATUS_COLORS = {
        "done": "#3fb950",
        "error": "#f85149",
        "failed_blocked": "#d29922",
        "cancelled": "#8b949e",
        "rejected": "#f85149",
        "pending": "#58a6ff",
    }

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setColumnCount(3)
        self.setHorizontalHeaderLabels(["描述", "状态", "完成时间"])
        self.setBorderRadius(8)
        self.horizontalHeader().setStretchLastSection(False)
        self.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.setEditTriggers(TableWidget.EditTrigger.NoEditTriggers)
        self.setSelectionMode(TableWidget.SelectionMode.NoSelection)

    def set_tasks(self, tasks: list[dict]):
        """填充表格数据"""
        self.setRowCount(len(tasks))
        for i, t in enumerate(tasks):
            # 描述列
            desc = t.get("desc", t.get("description", "?"))
            item = QTableWidgetItem(str(desc))
            item.setToolTip(str(desc))
            self.setItem(i, 0, item)

            # 状态列
            status = t.get("resolution", t.get("status", "pending"))
            label = self.STATUS_LABELS.get(status, status)
            color = self.STATUS_COLORS.get(status, "#e6edf3")
            status_item = QTableWidgetItem(label)
            status_item.setForeground(QBrush(QColor(color)))
            self.setItem(i, 1, status_item)

            # 时间列
            resolved_at = t.get("resolved_at", "")
            time_item = QTableWidgetItem(resolved_at)
            time_item.setForeground(QBrush(QColor("#8b949e")))
            self.setItem(i, 2, time_item)


class HistoryInterface(QWidget):
    """历史记录页面 — 历史执行 / 历史驳回 双标签页"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._all_history: list[dict] = []

        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)

        # 标题栏
        toolbar = QHBoxLayout()
        toolbar.addWidget(BodyLabel("历史记录"))
        toolbar.addStretch()
        self._refresh_btn = PushButton("刷新", self)
        self._clear_btn = PushButton("清空", self)
        self._clear_btn.setFixedWidth(80)
        toolbar.addWidget(self._refresh_btn)
        toolbar.addWidget(self._clear_btn)
        layout.addLayout(toolbar)

        layout.addSpacing(8)

        # 标签页
        self._tab = TabWidget(self)

        # Tab 1: 历史执行
        self._done_tab = QWidget()
        done_layout = QVBoxLayout(self._done_tab)
        done_layout.setContentsMargins(0, 8, 0, 0)
        self._done_table = HistoryTableWidget(self)
        done_layout.addWidget(self._done_table)
        self._tab.addTab(self._done_tab, "历史执行")

        # Tab 2: 历史驳回
        self._rejected_tab = QWidget()
        rejected_layout = QVBoxLayout(self._rejected_tab)
        rejected_layout.setContentsMargins(0, 8, 0, 0)
        self._rejected_table = HistoryTableWidget(self)
        rejected_layout.addWidget(self._rejected_table)
        self._tab.addTab(self._rejected_tab, "历史驳回")

        layout.addWidget(self._tab)

        # 底部统计
        self._stats_label = CaptionLabel("")
        self._stats_label.setStyleSheet("color: #8b949e;")
        layout.addWidget(self._stats_label)

        # 连接事件
        self._refresh_btn.clicked.connect(self._refresh)
        self._clear_btn.clicked.connect(self._clear_all)

    def set_tasks(self, tasks: list[dict]):
        """设置历史任务列表，自动按 resolution 分类到两个标签页"""
        self._all_history = list(tasks)

        # "历史执行"包含所有已执行/完成的终端状态
        done_resolutions = {"done", "error", "failed_blocked"}
        done_statuses = {"done", "error", "failed_blocked"}
        done_tasks = [
            t for t in tasks
            if t.get("resolution") in done_resolutions
               or (not t.get("resolution") and t.get("status") in done_statuses)
        ]
        # "历史驳回"包含被驳回/取消的任务
        rejected_resolutions = {"rejected", "cancelled"}
        rejected_statuses = {"cancelled"}
        rejected_tasks = [
            t for t in tasks
            if t.get("resolution") in rejected_resolutions
               or (not t.get("resolution") and t.get("status") in rejected_statuses)
        ]

        self._done_table.set_tasks(done_tasks)
        self._rejected_table.set_tasks(rejected_tasks)

        total = len(tasks)
        done_count = len(done_tasks)
        rejected_count = len(rejected_tasks)
        self._stats_label.setText(
            f"共 {total} 条记录  |  已执行 {done_count}  |  已驳回 {rejected_count}"
        )

    def _refresh(self):
        """Override in subclass or connect externally"""
        pass

    def set_on_clear(self, callback):
        """注册清空回调，参数无，触发文件级清空"""
        self._on_clear_cb = callback

    def _clear_all(self):
        """清空历史表格（若注册了文件回调，也清空文件）"""
        self._all_history.clear()
        self._done_table.setRowCount(0)
        self._rejected_table.setRowCount(0)
        self._stats_label.setText("共 0 条记录")
        if hasattr(self, "_on_clear_cb") and self._on_clear_cb:
            self._on_clear_cb()
