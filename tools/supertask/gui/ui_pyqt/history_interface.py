# -*- coding: utf-8 -*-
"""history_interface.py — 历史记录（历史执行 / 历史驳回 标签页表格）

支持原生 QTableWidget 行选中（MultiSelection），通过 SelectionModel 读取选中行。
"""
from PyQt6.QtWidgets import (QVBoxLayout, QHBoxLayout, QHeaderView,
                               QWidget, QTableWidgetItem, QApplication,
                               QAbstractItemView)
from PyQt6.QtCore import Qt, QItemSelectionModel
from PyQt6.QtGui import QColor, QBrush
from qfluentwidgets import TableWidget, BodyLabel, TabWidget, PushButton, CaptionLabel


class HistoryTableWidget(TableWidget):
    """带统一样式的历史子表格（原生 MultiSelection + Shift 多选）"""

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
        # 列：描述 | 状态 | 完成时间
        self.setColumnCount(3)
        self.setHorizontalHeaderLabels(["描述", "状态", "完成时间"])
        self.setBorderRadius(8)
        self.horizontalHeader().setStretchLastSection(False)
        self.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.setEditTriggers(TableWidget.EditTrigger.NoEditTriggers)
        self.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.setSelectionMode(TableWidget.SelectionMode.NoSelection)
        self.setSortingEnabled(True)

        self._last_clicked_row = -1  # Shift 多选锚点

    # ─── 填充数据 ──────────────────────────────

    def set_tasks(self, tasks: list[dict]):
        """填充表格数据（描述存入 UserRole 供 get_selected_ids 使用，排序安全）"""
        self.setRowCount(len(tasks))
        for i, t in enumerate(tasks):
            # 第 0 列：描述（ID 存入 UserRole）
            desc = t.get("desc", t.get("description", "?"))
            item = QTableWidgetItem(str(desc))
            item.setToolTip(str(desc))
            item.setData(Qt.ItemDataRole.UserRole, t.get("id", 0))
            self.setItem(i, 0, item)

            # 第 1 列：状态
            status = t.get("resolution", t.get("status", "pending"))
            label = self.STATUS_LABELS.get(status, status)
            color = self.STATUS_COLORS.get(status, "#e6edf3")
            status_item = QTableWidgetItem(label)
            status_item.setForeground(QBrush(QColor(color)))
            self.setItem(i, 1, status_item)

            # 第 2 列：时间
            resolved_at = t.get("resolved_at", "")
            time_item = QTableWidgetItem(resolved_at)
            time_item.setForeground(QBrush(QColor("#8b949e")))
            self.setItem(i, 2, time_item)

        self._last_clicked_row = -1  # 重置 Shift 多选锚点

    # ─── 选中行获取 ────────────────────────────

    def get_selected_ids(self) -> list[int]:
        """获取所有选中行的 ID 列表（通过 SelectionModel，排序安全）"""
        ids = []
        for idx in self.selectionModel().selectedRows():
            row = idx.row()
            item = self.item(row, 0)
            if item:
                tid = item.data(Qt.ItemDataRole.UserRole)
                if tid:
                    ids.append(tid)
        return ids

    # ─── 点击事件 ──────────────────────────────

    def on_cell_clicked(self, row: int, col: int):
        """点击单元格 → 更新选中状态（原生 MultiSelection + Shift 范围选择）"""
        modifiers = QApplication.keyboardModifiers()
        if modifiers == Qt.KeyboardModifier.ShiftModifier and self._last_clicked_row >= 0:
            # Shift + 点击选中范围
            start = min(self._last_clicked_row, row)
            end = max(self._last_clicked_row, row)
            self.clearSelection()
            for r in range(start, end + 1):
                self.selectRow(r)
        elif modifiers == Qt.KeyboardModifier.ControlModifier:
            # Ctrl + 点击切换单行
            if self.selectionModel().isRowSelected(row, self.model().index(row, 0).parent()):
                self.selectionModel().select(
                    self.model().index(row, 0),
                    QItemSelectionModel.SelectionFlag.Deselect | QItemSelectionModel.SelectionFlag.Rows,
                )
            else:
                self.selectRow(row)
        else:
            # 普通点击 → 单选
            self.clearSelection()
            self.selectRow(row)
        self._last_clicked_row = row


class HistoryInterface(QWidget):
    """历史记录页面 — 历史执行 / 历史驳回 双标签页"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._all_history: list[dict] = []
        self._on_delete_cb = None
        self._on_revert_cb = None

        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)

        # 标题栏
        toolbar = QHBoxLayout()
        toolbar.addWidget(BodyLabel("历史记录"))
        toolbar.addStretch()
        self._delete_btn = PushButton("删除选中", self)
        self._revert_btn = PushButton("回归至提议", self)
        self._refresh_btn = PushButton("刷新", self)
        self._clear_btn = PushButton("清空", self)
        self._clear_btn.setFixedWidth(80)
        toolbar.addWidget(self._delete_btn)
        toolbar.addWidget(self._revert_btn)
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
        self._done_table.cellClicked.connect(self._done_table.on_cell_clicked)
        done_layout.addWidget(self._done_table)
        self._tab.addTab(self._done_tab, "历史执行")

        # Tab 2: 历史驳回
        self._rejected_tab = QWidget()
        rejected_layout = QVBoxLayout(self._rejected_tab)
        rejected_layout.setContentsMargins(0, 8, 0, 0)
        self._rejected_table = HistoryTableWidget(self)
        self._rejected_table.cellClicked.connect(self._rejected_table.on_cell_clicked)
        rejected_layout.addWidget(self._rejected_table)
        self._tab.addTab(self._rejected_tab, "历史驳回")

        layout.addWidget(self._tab)

        # 底部统计
        self._stats_label = CaptionLabel("")
        self._stats_label.setStyleSheet("color: #8b949e;")
        layout.addWidget(self._stats_label)

        # 连接事件（_refresh_btn 由外部 app.py 连接 _refresh_all）
        self._delete_btn.clicked.connect(self._on_delete_clicked)
        self._revert_btn.clicked.connect(self._on_revert_clicked)
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

    # ─── 获取当前标签页选中 ID ────────────────

    def _get_current_selected_ids(self) -> list[int]:
        """获取当前可见标签页中所有选中行的 ID"""
        current_widget = self._tab.currentWidget()
        if current_widget == self._done_tab:
            return self._done_table.get_selected_ids()
        elif current_widget == self._rejected_tab:
            return self._rejected_table.get_selected_ids()
        return []

    # ─── 按钮回调 ──────────────────────────────

    def _on_delete_clicked(self):
        """删除选中历史记录"""
        ids = self._get_current_selected_ids()
        if not ids:
            return
        if self._on_delete_cb:
            self._on_delete_cb(ids)

    def _on_revert_clicked(self):
        """回归选中历史记录至提议"""
        ids = self._get_current_selected_ids()
        if not ids:
            return
        if self._on_revert_cb:
            self._on_revert_cb(ids)

    def set_on_delete(self, callback):
        """注册删除回调，参数 ids: list[int]"""
        self._on_delete_cb = callback

    def set_on_revert(self, callback):
        """注册回归至提议回调，参数 ids: list[int]"""
        self._on_revert_cb = callback

    # ─── 刷新与清空 ────────────────────────────

    def _refresh(self):
        """Override in subclass or connect externally"""
        pass

    def set_on_clear(self, callback):
        """注册清空回调"""
        self._on_clear_cb = callback

    def _clear_all(self):
        """清空历史表格"""
        self._all_history.clear()
        self._done_table.setRowCount(0)
        self._rejected_table.setRowCount(0)
        self._stats_label.setText("共 0 条记录")
        if hasattr(self, "_on_clear_cb") and self._on_clear_cb:
            self._on_clear_cb()
