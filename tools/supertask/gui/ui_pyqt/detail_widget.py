# -*- coding: utf-8 -*-
"""detail_widget.py — 任务详情卡片（三行布局：id+状态 / 描述 / 按钮）"""
from PyQt6.QtWidgets import (QTextEdit, QHBoxLayout, QVBoxLayout, QWidget,
                               QSizePolicy)
from qfluentwidgets import HeaderCardWidget, CaptionLabel, PrimaryPushButton, PushButton

STATUS_COLORS = {
    "pending": "#58a6ff", "done": "#3fb950", "error": "#f85149",
    "failed_blocked": "#d29922", "cancelled": "#8b949e",
}
STATUS_LABELS = {
    "pending": "待处理", "done": "完成", "error": "失败",
    "failed_blocked": "阻塞", "cancelled": "已取消",
}


def _make_text_edit() -> QTextEdit:
    """创建统一样式的只读文本区"""
    te = QTextEdit()
    te.setReadOnly(True)
    te.setStyleSheet("""
        QTextEdit {
            background-color: #0d1117; color: #e6edf3;
            border: 1px solid #30363d; border-radius: 6px;
            padding: 8px;
            font-family: Consolas, "Microsoft YaHei", monospace;
            font-size: 12px;
        }
    """)
    te.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
    return te


class DetailWidget(HeaderCardWidget):
    """任务详情卡片 — 三行布局：id+状态 / 描述 / 按钮"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setTitle("任务详情")
        self.setBorderRadius(8)
        self._current_task: dict | None = None
        self._on_approve_cb = None
        self._on_reject_cb = None
        self._on_remove_cb = None
        self._setup_ui()
        self.show_task(None)

    def _setup_ui(self):
        """构建三行垂直布局（显式 QVBoxLayout 容器）"""
        # 用独立 QWidget+QVBoxLayout 容器保证垂直排列
        inner = QWidget()
        vl = QVBoxLayout(inner)
        vl.setContentsMargins(0, 0, 0, 0)
        vl.setSpacing(0)

        # 第一行：ID + 状态
        self._id_status_label = CaptionLabel("选择一个任务以查看详情")
        self._id_status_label.setStyleSheet(
            "color: #8b949e; font-size: 13px;"
        )
        vl.addWidget(self._id_status_label)
        vl.addSpacing(6)

        # 第二行：描述文本区
        self._desc_edit = _make_text_edit()
        vl.addWidget(self._desc_edit, 1)
        vl.addSpacing(6)

        # 第三行：操作按钮
        btn_row = QHBoxLayout()
        self._approve_btn = PrimaryPushButton("批准", self)
        self._reject_btn = PushButton("驳回", self)
        self._remove_btn = PushButton("移除", self)
        self._reject_btn.setStyleSheet(
            "QPushButton { color: #f85149; border-color: #f85149; }"
            "QPushButton:hover { background-color: rgba(248, 81, 73, 0.15); }"
        )
        self._remove_btn.setStyleSheet(
            "QPushButton { color: #f85149; border-color: #f85149; }"
            "QPushButton:hover { background-color: rgba(248, 81, 73, 0.15); }"
        )

        self._approve_btn.clicked.connect(self._on_approve_clicked)
        self._reject_btn.clicked.connect(self._on_reject_clicked)
        self._remove_btn.clicked.connect(self._on_remove_clicked)

        btn_row.addWidget(self._approve_btn)
        btn_row.addWidget(self._reject_btn)
        btn_row.addWidget(self._remove_btn)
        btn_row.addStretch()
        vl.addLayout(btn_row)

        # 将内部容器放入 HeaderCardWidget 的视图区域
        self.viewLayout.addWidget(inner)

    def _on_approve_clicked(self):
        if self._current_task and self._current_task.get("id") is not None:
            if self._on_approve_cb:
                self._on_approve_cb([self._current_task["id"]])

    def _on_reject_clicked(self):
        if self._current_task and self._current_task.get("id") is not None:
            if self._on_reject_cb:
                self._on_reject_cb([self._current_task["id"]])

    def _on_remove_clicked(self):
        if self._current_task and self._current_task.get("id") is not None:
            if self._on_remove_cb:
                self._on_remove_cb([self._current_task["id"]])

    def show_task(self, task: dict | None = None):
        """展示任务详情，task 为 None 时显示空状态"""
        self._current_task = task
        if not task:
            self._id_status_label.setText("选择一个任务以查看详情")
            self._id_status_label.setStyleSheet(
                "color: #8b949e; font-size: 13px;"
            )
            self._desc_edit.clear()
            self._approve_btn.setEnabled(False)
            self._reject_btn.setEnabled(False)
            self._remove_btn.setEnabled(False)
            return

        status = task.get("status", "pending")
        color = STATUS_COLORS.get(status, "#e6edf3")
        label = STATUS_LABELS.get(status, status)
        task_id = task.get("id", "")
        self._id_status_label.setText(f"ID: {task_id}   ● {label}")
        self._id_status_label.setStyleSheet(
            f"font-size: 13px; color: {color};"
        )

        self._desc_edit.setPlainText(task.get("desc", task.get("description", "")))

        self._approve_btn.setEnabled(True)
        self._reject_btn.setEnabled(True)
        self._remove_btn.setEnabled(True)
