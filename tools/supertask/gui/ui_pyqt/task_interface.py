# -*- coding: utf-8 -*-
"""task_interface.py — 提议与工作（QSplitter 水平 70/30 左右分栏：左侧 50/50 提议|队列，右侧详情卡片）"""
from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout,
                               QSplitter, QHeaderView, QTableWidgetItem,
                               QAbstractItemView, QApplication)
from PyQt6.QtCore import Qt, QItemSelectionModel
from PyQt6.QtGui import QColor, QBrush
from qfluentwidgets import (TableWidget, PrimaryPushButton, PushButton,
                              BodyLabel, InfoBar, InfoBarPosition)
from .detail_widget import DetailWidget, STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, PRIORITY_LABELS
from .task_plan_interface import build_prompt_preview


def _format_time(value) -> str:
    """格式化时间字段显示"""
    if not value or not isinstance(value, str):
        return "—"
    if value.startswith("0000-") or value.startswith("0001-"):
        return "—"
    return value


def _get_project_name(task: dict) -> str:
    """从任务数据中提取项目名称"""
    proj = task.get("project", "")
    if not proj:
        proj = task.get("source", "")
    if not proj:
        proj = task.get("label", "")
    return str(proj) if proj else "—"


# 统一的列定义
UNIFIED_COLUMNS = ["项目", "描述", "状态", "优先级", "时间"]


class TaskInterface(QWidget):
    """提议与工作页面：左侧 70%（AI 提议 50% | 工作队列 50% 垂直分割）+ 右侧 30% 详情"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._proposed_items: list[dict] = []
        self._approved_items: list[dict] = []
        self._detail_showing: dict | None = None
        self._on_approve_cb = None
        self._on_reject_cb = None
        self._on_remove_cb = None
        self._on_selection_cb = None
        self._on_evaluate_cb = None
        self._proposal_last_clicked = -1
        self._queue_last_clicked = -1
        self._selected_task_id: int | None = None
        self._project_filter: str = "全部"

        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.setSpacing(0)

        # ====== 水平分割：左侧 70% | 右侧 30% ======
        horiz_splitter = QSplitter(Qt.Orientation.Horizontal, self)
        horiz_splitter.setChildrenCollapsible(False)
        horiz_splitter.setHandleWidth(3)

        # ====== 左侧：垂直分割 50/50（提议 | 队列） ======
        left_splitter = QSplitter(Qt.Orientation.Vertical)
        left_splitter.setChildrenCollapsible(False)
        left_splitter.setHandleWidth(3)

        # ---- 左侧上半：AI 提议 ----
        proposed_widget = QWidget()
        proposed_layout = QVBoxLayout(proposed_widget)
        proposed_layout.setContentsMargins(0, 0, 4, 0)
        proposed_layout.setSpacing(4)

        toolbar = QHBoxLayout()
        toolbar.setSpacing(6)
        toolbar.addWidget(BodyLabel("AI 提议"))
        toolbar.addStretch()
        self._approve_btn = PrimaryPushButton("批准选中", self)
        self._approve_all_btn = PushButton("全部批准", self)
        self._reject_btn = PushButton("驳回选中", self)
        self._evaluate_btn = PrimaryPushButton("二次评估", self)
        self._evaluate_btn.setToolTip("用高级模型重新评估待审批提议的实用性、优先级，合并同类项")
        toolbar.addWidget(self._approve_btn)
        toolbar.addWidget(self._approve_all_btn)
        toolbar.addWidget(self._reject_btn)
        toolbar.addWidget(self._evaluate_btn)
        proposed_layout.addLayout(toolbar)

        self._table = TableWidget(self)
        self._table.setColumnCount(len(UNIFIED_COLUMNS))
        self._table.setHorizontalHeaderLabels(UNIFIED_COLUMNS)
        self._table.setBorderRadius(8)
        header = self._table.horizontalHeader()
        header.setStretchLastSection(False)
        # 列宽比例：项目(1) 描述(3) 状态(1) 优先级(1) 时间(2)
        header.setSectionResizeMode(0, QHeaderView.ResizeMode.Interactive)
        header.setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        header.setSectionResizeMode(2, QHeaderView.ResizeMode.Interactive)
        header.setSectionResizeMode(3, QHeaderView.ResizeMode.Interactive)
        header.setSectionResizeMode(4, QHeaderView.ResizeMode.Interactive)
        self._table.setColumnWidth(0, 80)   # 项目
        self._table.setColumnWidth(2, 70)   # 状态
        self._table.setColumnWidth(3, 70)   # 优先级
        self._table.setColumnWidth(4, 140)  # 时间
        self._table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self._table.setSelectionMode(QAbstractItemView.SelectionMode.ExtendedSelection)
        self._table.setSortingEnabled(True)
        self._table.cellClicked.connect(self._on_proposal_cell_clicked)
        proposed_layout.addWidget(self._table, 1)

        left_splitter.addWidget(proposed_widget)

        # ---- 左侧下半：工作队列 ----
        queue_widget = QWidget()
        queue_layout = QVBoxLayout(queue_widget)
        queue_layout.setContentsMargins(0, 4, 4, 0)
        queue_layout.setSpacing(4)

        queue_toolbar = QHBoxLayout()
        queue_toolbar.setSpacing(6)
        queue_toolbar.addWidget(BodyLabel("工作队列"))
        queue_toolbar.addStretch()
        self._remove_btn = PushButton("移除选中", self)
        queue_toolbar.addWidget(self._remove_btn)
        queue_layout.addLayout(queue_toolbar)

        self._queue_table = TableWidget(self)
        self._queue_table.setColumnCount(len(UNIFIED_COLUMNS))
        self._queue_table.setHorizontalHeaderLabels(UNIFIED_COLUMNS)
        self._queue_table.setBorderRadius(8)
        qheader = self._queue_table.horizontalHeader()
        qheader.setStretchLastSection(False)
        qheader.setSectionResizeMode(0, QHeaderView.ResizeMode.Interactive)
        qheader.setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        qheader.setSectionResizeMode(2, QHeaderView.ResizeMode.Interactive)
        qheader.setSectionResizeMode(3, QHeaderView.ResizeMode.Interactive)
        qheader.setSectionResizeMode(4, QHeaderView.ResizeMode.Interactive)
        self._queue_table.setColumnWidth(0, 80)
        self._queue_table.setColumnWidth(2, 70)
        self._queue_table.setColumnWidth(3, 70)
        self._queue_table.setColumnWidth(4, 140)
        self._queue_table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self._queue_table.setSelectionMode(QAbstractItemView.SelectionMode.ExtendedSelection)
        self._queue_table.setSortingEnabled(True)
        self._queue_table.cellClicked.connect(self._on_queue_cell_clicked)
        queue_layout.addWidget(self._queue_table, 1)

        left_splitter.addWidget(queue_widget)

        # 50/50 初始比例 + stretch factor 保证窗口缩放时维持比例
        left_splitter.setSizes([300, 300])
        left_splitter.setStretchFactor(0, 1)
        left_splitter.setStretchFactor(1, 1)
        horiz_splitter.addWidget(left_splitter)

        # ====== 右侧 30%：详情卡片 ======
        self._detail = DetailWidget(self)
        horiz_splitter.addWidget(self._detail)

        # 70/30 初始比例（stretch factor 确保自适应）
        horiz_splitter.setSizes([700, 300])
        # stretch factor：左侧占 7 份，右侧占 3 份
        horiz_splitter.setStretchFactor(0, 7)
        horiz_splitter.setStretchFactor(1, 3)

        layout.addWidget(horiz_splitter, 1)

        # 按钮连接
        self._approve_btn.clicked.connect(self._on_approve_clicked)
        self._approve_all_btn.clicked.connect(self._on_approve_all)
        self._reject_btn.clicked.connect(self._on_reject_clicked)
        self._remove_btn.clicked.connect(self._remove_selected)
        self._evaluate_btn.clicked.connect(self._on_evaluate_clicked)

    # ================= 提议面板 =================

    def set_proposed(self, tasks: list[dict]):
        self._proposed_items = list(tasks)
        # 按项目筛选（模糊匹配）
        tasks = [t for t in tasks if self._match_project(_get_project_name(t))]
        self._proposal_last_clicked = -1
        self._table.setRowCount(len(tasks))
        for i, t in enumerate(tasks):
            # 第 0 列：项目
            proj_item = QTableWidgetItem(_get_project_name(t))
            proj_item.setData(Qt.ItemDataRole.UserRole, t.get('id'))
            proj_item.setForeground(QBrush(QColor("#8b949e")))
            self._table.setItem(i, 0, proj_item)
            # 第 1 列：描述
            desc_text = str(t.get("description", ""))
            item = QTableWidgetItem(desc_text)
            item.setData(Qt.ItemDataRole.UserRole, t.get('id'))
            item.setToolTip(build_prompt_preview(task_desc=desc_text, project_name=_get_project_name(t)))
            self._table.setItem(i, 1, item)
            # 第 2 列：状态
            status = t.get("status", "pending")
            status_item = QTableWidgetItem(STATUS_LABELS.get(status, status))
            color = STATUS_COLORS.get(status, "#e6edf3")
            status_item.setForeground(QBrush(QColor(color)))
            self._table.setItem(i, 2, status_item)
            # 第 3 列：优先级
            priority = t.get("priority", "")
            if priority:
                p_label = PRIORITY_LABELS.get(priority, priority)
                p_color = PRIORITY_COLORS.get(priority, "#8b949e")
            else:
                p_label = "—"
                p_color = "#484f58"
            prio_item = QTableWidgetItem(p_label)
            prio_item.setForeground(QBrush(QColor(p_color)))
            self._table.setItem(i, 3, prio_item)
            # 第 4 列：时间
            proposed_at = _format_time(t.get("proposed_at", ""))
            time_item = QTableWidgetItem(proposed_at)
            time_item.setForeground(QBrush(QColor("#8b949e")))
            self._table.setItem(i, 4, time_item)

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

    def set_on_evaluate(self, callback):
        """注册二次评估按钮回调"""
        self._on_evaluate_cb = callback

    def filter_by_project(self, project_name: str):
        """按项目筛选提议和工作队列。'全部' 显示所有。
        支持模糊匹配：AI 生成的任务 project 字段可能使用显示名或项目名。"""
        self._project_filter = project_name
        # 重新渲染两个表格
        self.set_proposed(self._proposed_items)
        self.set_approved(self._approved_items)

    def _match_project(self, task_project: str) -> bool:
        """检查任务的 project 字段是否匹配当前筛选。
        支持模糊匹配：项目名、显示名、关键词均可匹配。"""
        if not self._project_filter or self._project_filter == "全部":
            return True
        f = self._project_filter.lower()
        p = task_project.lower()
        return f in p or p in f

    def get_selected_ids(self) -> list[int]:
        """返回提议表格中所有选中行的 ID（通过 UserRole，排序安全）"""
        ids: list[int] = []
        for idx in self._table.selectionModel().selectedRows():
            item = self._table.item(idx.row(), 1)
            if item:
                task_id = item.data(Qt.ItemDataRole.UserRole)
                if task_id is not None:
                    ids.append(task_id)
        return ids

    # ================= 工作队列面板 =================

    def set_approved(self, tasks: list[dict]):
        """填充工作队列表格，每项含项目、描述、状态、优先级与时间"""
        self._approved_items = list(tasks)
        # 按项目筛选（模糊匹配）
        tasks = [t for t in tasks if self._match_project(_get_project_name(t))]
        self._queue_last_clicked = -1
        self._queue_table.setRowCount(len(tasks))
        for i, t in enumerate(tasks):
            # 第 0 列：项目
            proj_item = QTableWidgetItem(_get_project_name(t))
            proj_item.setData(Qt.ItemDataRole.UserRole, t.get('id'))
            proj_item.setForeground(QBrush(QColor("#8b949e")))
            self._queue_table.setItem(i, 0, proj_item)
            # 第 1 列：描述
            desc_text = str(t.get("desc", t.get("description", "")))
            item = QTableWidgetItem(desc_text)
            item.setData(Qt.ItemDataRole.UserRole, t.get('id'))
            item.setToolTip(build_prompt_preview(task_desc=desc_text, project_name=_get_project_name(t)))
            self._queue_table.setItem(i, 1, item)
            # 第 2 列：状态
            status = t.get("status", "pending")
            status_item = QTableWidgetItem(STATUS_LABELS.get(status, status))
            color = STATUS_COLORS.get(status, "#e6edf3")
            status_item.setForeground(QBrush(QColor(color)))
            self._queue_table.setItem(i, 2, status_item)
            # 第 3 列：优先级
            priority = t.get("priority", "")
            if priority:
                p_label = PRIORITY_LABELS.get(priority, priority)
                p_color = PRIORITY_COLORS.get(priority, "#8b949e")
            else:
                p_label = "—"
                p_color = "#484f58"
            prio_item = QTableWidgetItem(p_label)
            prio_item.setForeground(QBrush(QColor(p_color)))
            self._queue_table.setItem(i, 3, prio_item)
            # 第 4 列：时间
            queued_at = _format_time(t.get("queued_at", ""))
            time_item = QTableWidgetItem(queued_at)
            time_item.setForeground(QBrush(QColor("#8b949e")))
            self._queue_table.setItem(i, 4, time_item)

            # 高亮选定的任务行
            task_id = t.get("id")
            if self._selected_task_id is not None and task_id == self._selected_task_id:
                highlight = QBrush(QColor("#1a3a5c"))
                for col in range(self._queue_table.columnCount()):
                    cell = self._queue_table.item(i, col)
                    if cell:
                        cell.setBackground(highlight)

    def set_selected_task_id(self, task_id: int | None) -> None:
        """设置当前选定的任务 ID（用于队列行高亮）"""
        self._selected_task_id = task_id

    def _remove_selected(self):
        """获取工作队列中选中行的 ID（通过 UserRole，排序安全），触发移除回调"""
        ids: list[int] = []
        for idx in self._queue_table.selectionModel().selectedRows():
            item = self._queue_table.item(idx.row(), 1)
            if item:
                task_id = item.data(Qt.ItemDataRole.UserRole)
                if task_id is not None:
                    ids.append(task_id)
        if ids and self._on_remove_cb:
            self._on_remove_cb(ids)

    # ================= 排序安全的行查找辅助 =================

    def _find_proposed_by_row(self, row: int) -> dict | None:
        """通过 UserRole 查找提议任务（排序安全：不依赖行号与数据索引的一致性）"""
        item = self._table.item(row, 1)
        if not item:
            return None
        task_id = item.data(Qt.ItemDataRole.UserRole)
        if task_id is None:
            return None
        return next((t for t in self._proposed_items if t.get("id") == task_id), None)

    def _find_approved_by_row(self, row: int) -> dict | None:
        """通过 UserRole 查找工作队列任务（排序安全）"""
        item = self._queue_table.item(row, 1)
        if not item:
            return None
        task_id = item.data(Qt.ItemDataRole.UserRole)
        if task_id is None:
            return None
        return next((t for t in self._approved_items if t.get("id") == task_id), None)

    # ================= 点击事件（多选核心逻辑） =================

    def _on_proposal_cell_clicked(self, row: int, col: int):
        """提议表格点击 — 单击单选，Shift+点击范围多选，Ctrl+点击切换"""
        modifiers = QApplication.keyboardModifiers()
        if modifiers == Qt.KeyboardModifier.ShiftModifier and self._proposal_last_clicked >= 0:
            start = min(self._proposal_last_clicked, row)
            end = max(self._proposal_last_clicked, row)
            self._table.clearSelection()
            for r in range(start, end + 1):
                self._table.selectRow(r)
        elif modifiers == Qt.KeyboardModifier.ControlModifier:
            if self._table.selectionModel().isRowSelected(row, self._table.model().index(row, 0).parent()):
                self._table.selectionModel().select(
                    self._table.model().index(row, 0),
                    QItemSelectionModel.SelectionFlag.Deselect | QItemSelectionModel.SelectionFlag.Rows,
                )
                # 取消选中后：若该项正在详情中显示，则清除详情
                deselected_task = self._find_proposed_by_row(row)
                if self._detail_showing and deselected_task is not None:
                    if self._detail_showing.get("id") == deselected_task.get("id"):
                        # 找到下一个已选中的项显示，若没有则清空
                        selected_rows = self._table.selectionModel().selectedRows()
                        if selected_rows:
                            next_task = self._find_proposed_by_row(selected_rows[0].row())
                            if next_task:
                                self._detail_showing = next_task
                                self._detail.show_task(next_task)
                                if hasattr(self, "_on_selection_cb") and self._on_selection_cb:
                                    self._on_selection_cb(next_task)
                        else:
                            self._detail_showing = None
                            self._detail.show_task(None)
            else:
                self._table.selectRow(row)
        else:
            self._table.clearSelection()
            self._table.selectRow(row)
        self._proposal_last_clicked = row
        # 更新详情面板（单行选中时，通过 UserRole 排序安全查找）
        task = self._find_proposed_by_row(row)
        if task:
            self._detail_showing = task
            self._detail.show_task(task)
            if hasattr(self, "_on_selection_cb") and self._on_selection_cb:
                self._on_selection_cb(task)

    def _on_queue_cell_clicked(self, row: int, col: int):
        """工作队列表格点击 — 单击单选 + 更新详情面板，Shift+点击范围多选"""
        modifiers = QApplication.keyboardModifiers()
        if modifiers == Qt.KeyboardModifier.ShiftModifier and self._queue_last_clicked >= 0:
            start = min(self._queue_last_clicked, row)
            end = max(self._queue_last_clicked, row)
            self._queue_table.clearSelection()
            for r in range(start, end + 1):
                self._queue_table.selectRow(r)
        elif modifiers == Qt.KeyboardModifier.ControlModifier:
            if self._queue_table.selectionModel().isRowSelected(row, self._queue_table.model().index(row, 0).parent()):
                self._queue_table.selectionModel().select(
                    self._queue_table.model().index(row, 0),
                    QItemSelectionModel.SelectionFlag.Deselect | QItemSelectionModel.SelectionFlag.Rows,
                )
            else:
                self._queue_table.selectRow(row)
        else:
            self._queue_table.clearSelection()
            self._queue_table.selectRow(row)
        self._queue_last_clicked = row
        # 更新详情面板（通过 UserRole 排序安全查找）
        task = self._find_approved_by_row(row)
        if task:
            self._detail.show_task(task)
            if hasattr(self, "_on_selection_cb") and self._on_selection_cb:
                self._on_selection_cb(task)

    # ================= 内部事件 =================

    def _on_selection_changed(self, row, col, prev_row, prev_col):
        task = self._find_proposed_by_row(row)
        if task:
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

    def _on_evaluate_clicked(self):
        """触发二次评估 — 对所有提议进行 AI 评估"""
        if self._on_evaluate_cb:
            self._on_evaluate_cb()
