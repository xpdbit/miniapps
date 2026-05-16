# -*- coding: utf-8 -*-
"""detail_widget.py — 任务详情卡片（结构化布局：标题行 + 时间线 + 描述 + 按钮）"""
from PyQt6.QtWidgets import (QTextEdit, QHBoxLayout, QVBoxLayout, QWidget,
                               QSizePolicy, QLabel)
from PyQt6.QtCore import Qt, pyqtSignal
from qfluentwidgets import HeaderCardWidget, CaptionLabel, PrimaryPushButton, PushButton

from .task_plan_interface import build_prompt_preview

STATUS_COLORS = {
    "pending": "#58a6ff", "done": "#3fb950", "error": "#f85149",
    "failed_blocked": "#d29922", "cancelled": "#8b949e",
}
STATUS_LABELS = {
    "pending": "待处理", "done": "完成", "error": "失败",
    "failed_blocked": "阻塞", "cancelled": "已取消",
    "proposed": "待审批", "running": "执行中",
}

PRIORITY_COLORS = {
    "fix P0": "#f85149",
    "fix P1": "#f0883e",
    "fix P2": "#d29922",
    "fix P3": "#8b949e",
    "idea": "#58a6ff",
    "high": "#bc8cff",
}
PRIORITY_LABELS = {
    "fix P0": "P0 紧急",
    "fix P1": "P1 高",
    "fix P2": "P2 中",
    "fix P3": "P3 低",
    "idea": "点子",
    "high": "高",
}


def _is_valid_time(value) -> bool:
    """检查时间值是否有效"""
    if not value or not isinstance(value, str):
        return False
    if value.startswith("0000-") or value.startswith("0001-"):
        return False
    return True


def _make_text_edit() -> QTextEdit:
    """创建统一样式的只读文本区"""
    te = QTextEdit()
    te.setReadOnly(True)
    te.setStyleSheet("""
        QTextEdit {
            background-color: #0d1117; color: #e6edf3;
            border: 1px solid #30363d; border-radius: 6px;
            padding: 10px;
            font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
            font-size: 13px;
            line-height: 1.6;
        }
    """)
    te.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
    return te




class DetailWidget(HeaderCardWidget):
    """任务详情卡片 — 结构化布局：标题 + 时间线 + 描述 + 按钮"""

    # 信号：选定/取消选定任务时发出
    task_selected = pyqtSignal(dict)     # 携带任务数据
    task_deselected = pyqtSignal()       # 取消选定时发出

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setTitle("任务详情")
        self.setBorderRadius(8)
        self._current_task: dict | None = None
        self._selected_task_id: int | None = None  # 当前被全局选定的任务 ID
        self._on_approve_cb = None
        self._on_reject_cb = None
        self._on_remove_cb = None
        self._setup_ui()
        self.show_task(None)

    def _setup_ui(self):
        """构建垂直布局：标题行 + 时间线 + 描述 + 按钮"""
        inner = QWidget()
        vl = QVBoxLayout(inner)
        vl.setContentsMargins(0, 0, 0, 0)
        vl.setSpacing(8)

        # 第一行：ID + 优先级 + 状态
        self._id_status_label = CaptionLabel("选择一个任务以查看详情")
        self._id_status_label.setStyleSheet(
            "color: #8b949e; font-size: 13px;"
        )
        vl.addWidget(self._id_status_label)

        # 优先级行（介于 ID/状态 与 时间线 之间）
        self._priority_label = QLabel("")
        self._priority_label.setVisible(False)
        self._priority_label.setStyleSheet("""
            QLabel {
                font-size: 12px; font-weight: bold;
                padding: 2px 10px; border-radius: 4px;
                background: #161b22; border: 1px solid #21262d;
            }
        """)
        vl.addWidget(self._priority_label)

        # 时间线区域（显示所有记录的时间）
        self._timeline_label = QLabel("")
        self._timeline_label.setWordWrap(True)
        self._timeline_label.setStyleSheet("""
            QLabel {
                color: #8b949e; font-size: 11px;
                background: #161b22; border-radius: 6px;
                padding: 8px 12px; border: 1px solid #21262d;
            }
        """)
        self._timeline_label.setVisible(False)
        vl.addWidget(self._timeline_label)

        # 描述文本区
        self._desc_edit = _make_text_edit()
        vl.addWidget(self._desc_edit, 1)

        # 操作按钮
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

        # 「选定任务」按钮 — 右下角
        self._select_btn = PrimaryPushButton("★ 选定任务", self)
        self._select_btn.setStyleSheet("""
            QPushButton {
                background-color: #1f6feb;
                color: #ffffff;
                border: 2px solid #388bfd;
                border-radius: 6px;
                font-weight: bold;
                padding: 6px 16px;
            }
            QPushButton:hover {
                background-color: #388bfd;
                border-color: #58a6ff;
            }
            QPushButton:disabled {
                background-color: #21262d;
                color: #484f58;
                border-color: #30363d;
            }
        """)
        self._select_btn.clicked.connect(self._on_select_clicked)
        btn_row.addWidget(self._select_btn)
        vl.addLayout(btn_row)

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

    def _on_select_clicked(self):
        """用户点击「选定任务」按钮 → toggle 选定/取消"""
        if not self._current_task or self._current_task.get("id") is None:
            return

        task_id = self._current_task["id"]
        if self._selected_task_id == task_id:
            # 当前任务已被选定 → 取消选定
            self.task_deselected.emit()
        else:
            # 选定当前任务
            self.task_selected.emit(self._current_task)

    def set_selected_task_id(self, task_id: int | None):
        """由外部（app.py）调用，更新当前选定任务 ID，用于按钮状态反馈"""
        self._selected_task_id = task_id
        if task_id is not None and self._current_task and self._current_task.get("id") == task_id:
            self._select_btn.setText("★ 已选定")
            self._select_btn.setStyleSheet("""
                QPushButton {
                    background-color: #3fb950;
                    color: #ffffff;
                    border: 2px solid #2ea043;
                    border-radius: 6px;
                    font-weight: bold;
                    padding: 6px 16px;
                }
                QPushButton:hover {
                    background-color: #2ea043;
                    border-color: #3fb950;
                }
                QPushButton:disabled {
                    background-color: #21262d;
                    color: #484f58;
                    border-color: #30363d;
                }
            """)
        else:
            self._select_btn.setText("★ 选定任务")
            self._select_btn.setStyleSheet("""
                QPushButton {
                    background-color: #1f6feb;
                    color: #ffffff;
                    border: 2px solid #388bfd;
                    border-radius: 6px;
                    font-weight: bold;
                    padding: 6px 16px;
                }
                QPushButton:hover {
                    background-color: #388bfd;
                    border-color: #58a6ff;
                }
                QPushButton:disabled {
                    background-color: #21262d;
                    color: #484f58;
                    border-color: #30363d;
                }
            """)

    def show_task(self, task: dict | None = None):
        """展示任务详情，task 为 None 时显示空状态"""
        self._current_task = task
        if not task:
            self._id_status_label.setText("选择一个任务以查看详情")
            self._id_status_label.setStyleSheet(
                "color: #8b949e; font-size: 13px;"
            )
            self._priority_label.setVisible(False)
            self._timeline_label.setVisible(False)
            self._desc_edit.clear()
            self._approve_btn.setEnabled(False)
            self._reject_btn.setEnabled(False)
            self._remove_btn.setEnabled(False)
            self._select_btn.setEnabled(False)
            return

        status = task.get("status", "pending")
        color = STATUS_COLORS.get(status, "#e6edf3")
        label = STATUS_LABELS.get(status, status)
        task_id = task.get("id", "")
        self._id_status_label.setText(f"ID: {task_id}   ● {label}")
        self._id_status_label.setStyleSheet(
            f"font-size: 13px; color: {color};"
        )

        # ── 优先级 ──
        priority = task.get("priority", "")
        if priority:
            p_color = PRIORITY_COLORS.get(priority, "#8b949e")
            p_label = PRIORITY_LABELS.get(priority, priority)
            self._priority_label.setText(f"⚑ {p_label}")
            self._priority_label.setStyleSheet(
                f"font-size: 12px; font-weight: bold;"
                f"padding: 2px 10px; border-radius: 4px;"
                f"background: #161b22; border: 1px solid {p_color};"
                f"color: {p_color};"
            )
            self._priority_label.setVisible(True)
        else:
            self._priority_label.setVisible(False)

        # ── 时间线 ──
        timeline_parts = []
        time_fields = [
            ("📥 提议", "proposed_at"),
            ("📋 入队", "queued_at"),
            ("✅ 完成", "completed_at"),
            ("🗑 删除", "deleted_at"),
        ]
        for emoji_label, field in time_fields:
            val = task.get(field, "")
            if _is_valid_time(val):
                timeline_parts.append(
                    f'<span style="color:#58a6ff;">{emoji_label}</span> '
                    f'<span style="color:#c9d1d9;">{val}</span>'
                )
        if timeline_parts:
            self._timeline_label.setText(
                "<br>".join(timeline_parts)
            )
            self._timeline_label.setVisible(True)
        else:
            self._timeline_label.setVisible(False)

        # ── 描述（格式化提示词预览） ──
        desc = task.get("desc", task.get("description", ""))
        project = task.get("project", "")
        expected = task.get("expected", task.get("expected_outcome", ""))
        constraints = task.get("constraints", "")
        qa_history = task.get("qa_history", task.get("brainstorm", None))
        preview = build_prompt_preview(
            task_desc=desc,
            project_name=project,
            expected=expected,
            constraints=constraints,
            qa_history=qa_history,
        )
        if not preview:
            preview = desc
        self._desc_edit.setPlainText(preview)

        self._approve_btn.setEnabled(True)
        self._reject_btn.setEnabled(True)
        self._remove_btn.setEnabled(True)
        self._select_btn.setEnabled(True)

        # 根据当前选定状态更新按钮外观
        current_id = task.get("id")
        if current_id is not None and self._selected_task_id == current_id:
            self._select_btn.setText("★ 已选定")
            self._select_btn.setStyleSheet("""
                QPushButton {
                    background-color: #3fb950;
                    color: #ffffff;
                    border: 2px solid #2ea043;
                    border-radius: 6px;
                    font-weight: bold;
                    padding: 6px 16px;
                }
                QPushButton:hover {
                    background-color: #2ea043;
                    border-color: #3fb950;
                }
                QPushButton:disabled {
                    background-color: #21262d;
                    color: #484f58;
                    border-color: #30363d;
                }
            """)
        else:
            self._select_btn.setText("★ 选定任务")
            self._select_btn.setStyleSheet("""
                QPushButton {
                    background-color: #1f6feb;
                    color: #ffffff;
                    border: 2px solid #388bfd;
                    border-radius: 6px;
                    font-weight: bold;
                    padding: 6px 16px;
                }
                QPushButton:hover {
                    background-color: #388bfd;
                    border-color: #58a6ff;
                }
                QPushButton:disabled {
                    background-color: #21262d;
                    color: #484f58;
                    border-color: #30363d;
                }
            """)
