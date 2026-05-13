# -*- coding: utf-8 -*-
"""task_interface.py — 提议与工作（QSplitter 水平左右分栏：左侧提议|队列，右侧详情卡片）"""
from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout,
                               QSplitter, QHeaderView, QTableWidgetItem,
                               QAbstractItemView, QApplication)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QColor, QBrush
from qfluentwidgets import (TableWidget, PrimaryPushButton, PushButton,
                             BodyLabel, InfoBar, InfoBarPosition)
from .detail_widget import DetailWidget, STATUS_COLORS, STATUS_LABELS


class TaskInterface(QWidget):
    """提议与工作页面：左侧（AI 提议 | 工作队列 垂直分割）+ 右侧详情"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._proposed_items: list[dict] = []
        self._approved_items: list[dict] = []
        self._detail_showing: dict | None = None
        self._on_approve_cb = None
        self._on_reject_cb = None
        self._on_remove_cb = None
        self._proposal_last_clicked = -1
        self._queue_last_clicked = -1

        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)

        # ====== 水平分割：左侧（提议 | 队列 上下各50%） | 右侧（详情卡片） ======
        horiz_splitter = QSplitter(Qt.Orientation.Horizontal, self)

        # ====== 左侧：垂直分割（提议 | 队列） ======
        left_splitter = QSplitter(Qt.Orientation.Vertical)

        # ---- 左侧上半：AI 提议 ----
        proposed_widget = QWidget()
        proposed_layout = QVBoxLayout(proposed_widget)
        proposed_layout.setContentsMargins(0, 0, 0, 0)

        toolbar = QHBoxLayout()
        toolbar.addWidget(BodyLabel("AI 提议"))
        toolbar.addStretch()
        self._approve_btn = PrimaryPushButton("批准选中", self)
        self._approve_all_btn = PushButton("全部批准", self)
        self._reject_btn = PushButton("驳回选中", self)
        toolbar.addWidget(self._approve_btn)
        toolbar.addWidget(self._approve_all_btn)
        toolbar.addWidget(self._reject_btn)
        proposed_layout.addLayout(toolbar)

        self._table = TableWidget(self)
        self._table.setColumnCount(4)
        self._table.setHorizontalHeaderLabels(["", "描述", "状态", "优先级"])
        self._table.setBorderRadius(8)
        self._table.horizontalHeader().setStretchLastSection(False)
        self._table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
        self._table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        self._table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self._table.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self._table.setSortingEnabled(True)
        self._table.currentCellChanged.connect(self._on_selection_changed)
        self._table.cellClicked.connect(self._on_proposal_cell_clicked)
        proposed_layout.addWidget(self._table)

        left_splitter.addWidget(proposed_widget)

        # ---- 左侧下半：工作队列 ----
        queue_widget = QWidget()
        queue_layout = QVBoxLayout(queue_widget)
        queue_layout.setContentsMargins(0, 8, 0, 0)

        queue_toolbar = QHBoxLayout()
        queue_toolbar.addWidget(BodyLabel("工作队列"))
        queue_toolbar.addStretch()
        self._remove_btn = PushButton("移除选中", self)
        queue_toolbar.addWidget(self._remove_btn)
        queue_layout.addLayout(queue_toolbar)

        self._queue_table = TableWidget(self)
        self._queue_table.setColumnCount(3)
        self._queue_table.setHorizontalHeaderLabels(["", "描述", "状态"])
        self._queue_table.setBorderRadius(8)
        self._queue_table.horizontalHeader().setStretchLastSection(False)
        self._queue_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
        self._queue_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        self._queue_table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self._queue_table.setSelectionMode(QAbstractItemView.SelectionMode.MultiSelection)
        self._queue_table.setSortingEnabled(True)
        self._queue_table.cellClicked.connect(self._on_queue_cell_clicked)
        queue_layout.addWidget(self._queue_table)

        left_splitter.addWidget(queue_widget)

        left_splitter.setSizes([200, 200])
        horiz_splitter.addWidget(left_splitter)

        # ====== 右侧：详情卡片 ======
        self._detail = DetailWidget(self)
        horiz_splitter.addWidget(self._detail)

        horiz_splitter.setSizes([400, 400])
        layout.addWidget(horiz_splitter)

        # 按钮连接
        self._approve_btn.clicked.connect(self._on_approve_clicked)
        self._approve_all_btn.clicked.connect(self._on_approve_all)
        self._reject_btn.clicked.connect(self._on_reject_clicked)
        self._remove_btn.clicked.connect(self._remove_selected)

    # ================= 勾选框工具方法 =================

    @staticmethod
    def _make_check_item(checked: bool = False) -> QTableWidgetItem:
        """创建带勾选框的表格项"""
        item = QTableWidgetItem()
        item.setFlags(
            Qt.ItemFlag.ItemIsUserCheckable
            | Qt.ItemFlag.ItemIsEnabled
            | Qt.ItemFlag.ItemIsSelectable
        )
        item.setCheckState(
            Qt.CheckState.Checked if checked else Qt.CheckState.Unchecked
        )
        return item

    @staticmethod
    def _toggle_checkbox(table: TableWidget, row: int):
        """切换指定行的勾选框状态"""
        item = table.item(row, 0)
        if item and (item.flags() & Qt.ItemFlag.ItemIsUserCheckable):
            new_state = (
                Qt.CheckState.Unchecked
                if item.checkState() == Qt.CheckState.Checked
                else Qt.CheckState.Checked
            )
            item.setCheckState(new_state)

    @staticmethod
    def _toggle_range(table: TableWidget, from_row: int, to_row: int):
        """Shift 多选：统一切换 from_row → to_row 范围内勾选状态"""
        start = min(from_row, to_row)
        end = max(from_row, to_row)
        target = table.item(to_row, 0)
        if not target or not (target.flags() & Qt.ItemFlag.ItemIsUserCheckable):
            return
        # 以目标行状态为基准：目标行勾选 → 全部取消；目标行未勾选 → 全部勾选
        new_state = (
            Qt.CheckState.Unchecked
            if target.checkState() == Qt.CheckState.Checked
            else Qt.CheckState.Checked
        )
        for r in range(start, end + 1):
            item = table.item(r, 0)
            if item and (item.flags() & Qt.ItemFlag.ItemIsUserCheckable):
                item.setCheckState(new_state)

    def _get_checked_ids(self, table, items_source) -> list[int]:
        """获取指定表格中所有勾选行的 ID 列表"""
        ids = []
        for row in range(table.rowCount()):
            item = table.item(row, 0)
            if item and item.checkState() == Qt.CheckState.Checked:
                if 0 <= row < len(items_source):
                    ids.append(items_source[row].get("id", 0))
        return ids

    # ================= 提议面板 =================

    def set_proposed(self, tasks: list[dict]):
        self._proposed_items = list(tasks)
        self._proposal_last_clicked = -1  # 重置 shift 多选锚点
        self._table.setRowCount(len(tasks))
        for i, t in enumerate(tasks):
            # 第 0 列：勾选框
            self._table.setItem(i, 0, self._make_check_item())
            # 第 1 列：描述
            item = QTableWidgetItem(str(t.get("description", "")))
            item.setToolTip(str(t.get("description", "")))
            self._table.setItem(i, 1, item)
            # 第 2 列：状态
            status = t.get("status", "pending")
            status_item = QTableWidgetItem(STATUS_LABELS.get(status, status))
            color = STATUS_COLORS.get(status, "#e6edf3")
            status_item.setForeground(QBrush(QColor(color)))
            self._table.setItem(i, 2, status_item)
            # 第 3 列：优先级
            self._table.setItem(i, 3, QTableWidgetItem(str(t.get("priority", ""))))

    def set_on_selection_change(self, callback):
        self._on_selection_cb = callback

    def set_on_approve(self, callback):
        self._on_approve_cb = callback
        self._detail._on_approve_cb = callback

    def set_on_reject(self, callback):
        self._on_reject_cb = callback
        self._detail._on_reject_cb = callback

    def set_on_remove(self, callback):
        self._on_remove_cb = callback
        self._detail._on_remove_cb = callback

    def get_selected_ids(self) -> list[int]:
        """返回提议表格中所有勾选行的 ID"""
        return self._get_checked_ids(self._table, self._proposed_items)

    # ================= 工作队列面板 =================

    def set_approved(self, tasks: list[dict]):
        """填充工作队列表格，每项含勾选框、描述与状态"""
        self._approved_items = list(tasks)
        self._queue_last_clicked = -1  # 重置 shift 多选锚点
        self._queue_table.setRowCount(len(tasks))
        for i, t in enumerate(tasks):
            # 第 0 列：勾选框
            self._queue_table.setItem(i, 0, self._make_check_item())
            # 第 1 列：描述
            item = QTableWidgetItem(str(t.get("desc", t.get("description", ""))))
            item.setToolTip(str(t.get("desc", t.get("description", ""))))
            self._queue_table.setItem(i, 1, item)
            # 第 2 列：状态
            status = t.get("status", "pending")
            status_item = QTableWidgetItem(STATUS_LABELS.get(status, status))
            color = STATUS_COLORS.get(status, "#e6edf3")
            status_item.setForeground(QBrush(QColor(color)))
            self._queue_table.setItem(i, 2, status_item)

    def _remove_selected(self):
        """获取工作队列中勾选行的 ID，触发移除回调"""
        ids = self._get_checked_ids(self._queue_table, self._approved_items)
        if ids and self._on_remove_cb:
            self._on_remove_cb(ids)

    # ================= 点击事件（多选核心逻辑） =================

    def _on_proposal_cell_clicked(self, row: int, col: int):
        """提议表格点击事件"""
        modifiers = QApplication.keyboardModifiers()
        if col == 0:
            # 点击勾选框列 → 切换单行
            self._toggle_checkbox(self._table, row)
        elif modifiers == Qt.KeyboardModifier.ShiftModifier and self._proposal_last_clicked >= 0:
            # Shift + 点击 → 范围多选
            self._toggle_range(self._table, self._proposal_last_clicked, row)
        # 非 shift 点击非勾选列 → 仅切换选中态（用于详情展示），不操作勾选框
        self._proposal_last_clicked = row

    def _on_queue_cell_clicked(self, row: int, col: int):
        """工作队列表格点击事件 — 同时更新详情面板"""
        modifiers = QApplication.keyboardModifiers()
        if col == 0:
            self._toggle_checkbox(self._queue_table, row)
        elif modifiers == Qt.KeyboardModifier.ShiftModifier and self._queue_last_clicked >= 0:
            self._toggle_range(self._queue_table, self._queue_last_clicked, row)
        self._queue_last_clicked = row
        # 更新详情面板
        if 0 <= row < len(self._approved_items):
            task = self._approved_items[row]
            self._detail.show_task(task)
            if hasattr(self, "_on_selection_cb") and self._on_selection_cb:
                self._on_selection_cb(task)

    # ================= 内部事件 =================

    def _on_selection_changed(self, row, col, prev_row, prev_col):
        if 0 <= row < len(self._proposed_items):
            task = self._proposed_items[row]
            self._detail_showing = task
            self._detail.show_task(task)
            if hasattr(self, "_on_selection_cb") and self._on_selection_cb:
                self._on_selection_cb(task)

    def _on_approve_clicked(self):
        ids = self.get_selected_ids()
        if ids and self._on_approve_cb:
            self._on_approve_cb(ids)

    def _on_approve_all(self):
        ids = [t.get("id", 0) for t in self._proposed_items if t.get("id")]
        if ids and self._on_approve_cb:
            self._on_approve_cb(ids)

    def _on_reject_clicked(self):
        ids = self.get_selected_ids()
        if ids and self._on_reject_cb:
            self._on_reject_cb(ids)
