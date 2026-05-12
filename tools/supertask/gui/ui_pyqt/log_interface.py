# -*- coding: utf-8 -*-
"""log_interface.py — 彩色日志面板（QTextEdit + HTML 着色）"""
from datetime import datetime

from PyQt6.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QTextEdit, QPushButton, QScrollBar
from PyQt6.QtCore import Qt
from qfluentwidgets import BodyLabel, SwitchButton


class LogInterface(QWidget):
    """日志显示页 —— 4 级颜色日志，实时追加"""

    COLORS = {
        "info": "#3fb950",
        "error": "#f85149",
        "decision": "#58a6ff",
        "approved": "#bc8cff",
    }
    PREFIX = {"info": "·", "error": "✗", "decision": "▶", "approved": "✓"}

    def __init__(self, parent=None):
        super().__init__(parent)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)

        toolbar = QHBoxLayout()
        toolbar.addWidget(BodyLabel("运行日志"))
        toolbar.addStretch()

        self._auto_scroll = SwitchButton(self)
        self._auto_scroll.setText("自动滚动")
        self._auto_scroll.setChecked(True)
        toolbar.addWidget(self._auto_scroll)

        clear_btn = QPushButton("清空", self)
        clear_btn.setFixedWidth(80)
        toolbar.addWidget(clear_btn)
        layout.addLayout(toolbar)

        self._text = QTextEdit(self)
        self._text.setReadOnly(True)
        self._text.setStyleSheet("""
            QTextEdit {
                background-color: #0d1117; color: #c9d1d9;
                border: 1px solid #30363d; border-radius: 8px;
                padding: 8px;
                font-family: "Consolas", "Microsoft YaHei", monospace;
                font-size: 12px;
            }
        """)
        layout.addWidget(self._text)

        clear_btn.clicked.connect(self._text.clear)

    def append(self, level: str, message: str):
        ts = datetime.now().strftime("%H:%M:%S")
        prefix = self.PREFIX.get(level, "·")
        color = self.COLORS.get(level, "#c9d1d9")
        safe_msg = message.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        html = (
            f'<span style="color:#8b949e">[{ts}]</span> '
            f'<span style="color:{color}">{prefix} {safe_msg}</span><br>'
        )
        self._text.insertHtml(html)
        if self._auto_scroll.isChecked():
            sb = self._text.verticalScrollBar()
            sb.setValue(sb.maximum())
