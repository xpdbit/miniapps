# -*- coding: utf-8 -*-
"""log_terminal_interface.py — 日志+终端合并面板（QTabWidget 子 tab 切换）"""
from PyQt6.QtWidgets import QWidget, QVBoxLayout, QTabWidget

from gui.ui_pyqt.log_interface import LogInterface
from gui.ui_pyqt.terminal_interface import TerminalInterface


# ─── 子 tab 样式（与 config_interface 的 pill 风格保持一致） ───
_SUB_TAB_STYLE = """
    QTabWidget::pane {
        border: 1px solid #30363d; border-radius: 10px;
        background: #0d1117; padding: 6px 4px 4px 4px;
        top: -1px;
    }
    QTabBar::tab {
        color: #8b949e; background: transparent;
        border: 1px solid transparent; border-radius: 20px;
        padding: 8px 22px; margin: 0px 3px;
        font-size: 13px; font-weight: 500;
    }
    QTabBar::tab:hover {
        color: #c9d1d9; background: #21262d;
        border-color: #30363d;
    }
    QTabBar::tab:selected {
        color: #ffffff; background: #1f6feb;
        border-color: #1f6feb;
    }
    QTabBar::tab:selected:hover {
        background: #388bfd;
        border-color: #388bfd;
    }
"""


class LogTerminalInterface(QWidget):
    """日志+终端合并面板 — 通过子 tab 切换两个视图。

    对外暴露 .log 和 .terminal 属性，保持与原有信号连接的兼容性。
    """

    def __init__(self, working_dir: str = "", parent=None):
        super().__init__(parent)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(0)

        # 子 tab 控件
        self._sub_tabs = QTabWidget(self)
        self._sub_tabs.setStyleSheet(_SUB_TAB_STYLE)

        # 日志面板
        self.log = LogInterface()
        self._sub_tabs.addTab(self.log, "运行日志")

        # 终端面板
        self.terminal = TerminalInterface(working_dir=working_dir)
        self._sub_tabs.addTab(self.terminal, "终端")

        layout.addWidget(self._sub_tabs)

    # ─── 便捷属性（保持 app.py 中对 terminal_interface 的引用兼容） ───

    @property
    def log_interface(self) -> LogInterface:
        return self.log

    @property
    def terminal_interface(self) -> TerminalInterface:
        return self.terminal
