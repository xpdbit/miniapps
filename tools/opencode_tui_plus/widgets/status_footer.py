"""底部状态栏 — 状态圆点 + 项目名 + 快捷键提示。"""

from __future__ import annotations

from textual.containers import Horizontal
from textual.widgets import Static


class StatusFooter(Horizontal):
    """底部状态栏。"""

    DEFAULT_CSS = """
    StatusFooter {
        background: $surface-darken-1;
        color: $text-muted;
        border-top: solid $surface-lighten-1;
        height: 1;
    }
    """

    def __init__(self, **kwargs):
        super().__init__(id="status-footer", **kwargs)
        self._status = "待机中"
        self._online = False
        self._project_name = ""
        self._left = Static("●  待机中", id="status-left")
        self._center = Static("", id="status-center")
        self._right = Static("[F1 帮助] [Q 退出]", id="status-right")

    def compose(self):
        yield self._left
        yield self._center
        yield self._right

    def set_status(self, online: bool, text: str = "") -> None:
        self._online = online
        self._status = text or ("工作中" if online else "待机中")
        dot = "●" if online else "●"
        self._left.update(f"{dot}  {self._status}")

    def set_project_name(self, name: str) -> None:
        self._project_name = name
        self._center.update(f"  {name}  ")

    def set_hint(self, text: str) -> None:
        self._right.update(text)

    def flash_message(self, msg: str, duration_ms: int = 3000) -> None:
        """短暂显示一条消息到状态栏。"""
        orig = self._right.renderable if hasattr(self._right, 'renderable') else ""
        self._right.update(msg)
        self.set_timer(duration_ms / 1000, lambda: self._right.update(orig))
