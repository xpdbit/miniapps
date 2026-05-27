# -*- coding: utf-8 -*-
"""log_interface.py — 统一日志面板"""

from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path

from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QTextEdit, QComboBox,
    QPushButton, QLabel,
)
from qfluentwidgets import (
    TitleLabel, ComboBox, PushButton, FluentIcon as FIF,
    TextEdit, BodyLabel,
)
from opencode_tui_plus.gui.core.logger import OceLogger


class LogInterface(QWidget):
    """统一日志面板 — 支持系统日志 / 终端 / Agent 状态 / 监管日志切换"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._logger = OceLogger.get_instance()

        self._init_ui()

        # 定时刷新
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._refresh_log)
        self._timer.start(3000)

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        layout.addWidget(TitleLabel("日志"))

        # 日志类型选择
        top_row = QHBoxLayout()
        top_row.addWidget(BodyLabel("日志类型:"))
        self._log_type = ComboBox()
        self._log_type.addItems(["系统日志", "终端 I/O", "Agent 状态", "监管巡检"])
        self._log_type.currentIndexChanged.connect(self._on_type_changed)
        top_row.addWidget(self._log_type)

        self._date_select = ComboBox()
        self._refresh_date_list()
        top_row.addWidget(self._date_select)
        self._date_select.currentIndexChanged.connect(self._refresh_log)

        self._refresh_btn = PushButton(FIF.SYNC, "刷新")
        self._refresh_btn.clicked.connect(self._refresh_log)
        top_row.addWidget(self._refresh_btn)
        top_row.addStretch()
        layout.addLayout(top_row)

        # 日志内容
        self._log_view = TextEdit()
        self._log_view.setReadOnly(True)
        font = self._log_view.font()
        font.setFamily("Consolas, monospace")
        font.setPointSize(10)
        self._log_view.setFont(font)
        layout.addWidget(self._log_view, 1)

        self._refresh_log()

    def _on_type_changed(self):
        self._refresh_date_list()
        self._refresh_log()

    def _refresh_date_list(self):
        """刷新日期列表"""
        self._date_select.clear()
        logs_dir = self._logger.logs_dir
        if logs_dir.is_dir():
            dates = set()
            for f in logs_dir.iterdir():
                if f.suffix == ".md":
                    date_str = f.stem[:8]  # 提取 YYYYMMDD
                    if len(date_str) == 8 and date_str.isdigit():
                        dates.add(date_str)
            sorted_dates = sorted(dates, reverse=True)
            for d in sorted_dates:
                self._date_select.addItem(d)

        if self._date_select.count() == 0:
            self._date_select.addItem(datetime.now().strftime("%Y%m%d"))

    def _refresh_log(self):
        """刷新日志显示"""
        log_type = self._log_type.currentIndex()
        date_str = self._date_select.currentText()

        # 根据类型选择日志文件
        suffix_map = {
            0: "",           # 系统日志: {date}.md
            1: "_terminal",  # 终端 I/O: {date}_terminal.md
            2: "_agent_status",  # Agent 状态: {date}_agent_status.md
            3: "_supervisor",     # 监管: {date}_supervisor.md
        }

        suffix = suffix_map.get(log_type, "")
        log_path = self._logger.logs_dir / f"{date_str}{suffix}.md"

        if log_path.exists():
            with open(log_path, "r", encoding="utf-8") as f:
                content = f.read()
            # 只显示最后 500 行
            lines = content.split("\n")
            display = "\n".join(lines[-500:])
            self._log_view.setPlainText(display)
        else:
            self._log_view.setPlainText("（无日志）")

    def cleanup(self):
        self._timer.stop()
