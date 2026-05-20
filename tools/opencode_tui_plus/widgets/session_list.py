"""会话状态 DataTable — 双击跳转 + 实时刷新。"""

from __future__ import annotations

import time
from typing import cast, Optional

from textual.binding import Binding
from textual.widgets import DataTable
from textual.widgets.data_table import ColumnKey, RowKey

from app.data_store import DataStore
from core.window_focus import focus_terminal_window

COLUMNS = [
    "标题",
    "有效时长",
    "最后输出时间",
    "最后输出时距",
    "服务商",
]

SORT_COLUMNS = list(COLUMNS)


class SessionList(DataTable):
    """会话状态 DataTable。支持排序、双击跳转、每秒刷新。"""

    BINDINGS = [
        Binding("enter", "select_row", "选中行"),
        Binding("up", "cursor_up", "上移", show=False),
        Binding("down", "cursor_down", "下移", show=False),
    ]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._store = DataStore.get_instance()
        self._sort_key = "最后输出时距"
        self._sort_reverse = False
        self._row_session: dict[str, dict] = {}  # row_key -> session dict

    def on_mount(self) -> None:
        self.add_columns(*COLUMNS)
        self.set_interval(1.0, self._refresh_elapsed)
        self._refresh_data()

    def _refresh_elapsed(self) -> None:
        """每秒更新有效时长和时距列。"""
        now = time.time()
        for row_key, session in list(self._row_session.items()):
            ts_updated = session.get("time_updated", 0)
            duration_s = now - session.get("time_created", 0) / 1000

            try:
                rk = RowKey(row_key)
                self.update_cell(rk, "有效时长", DataStore.fmt_duration(duration_s))
                self.update_cell(rk, "最后输出时间", DataStore.fmt_time(ts_updated))
                ago_str = DataStore.time_ago(ts_updated)
                if ts_updated and (now - ts_updated / 1000) > 300:
                    ago_str = f"[warning]{ago_str}[/]"
                self.update_cell(rk, "最后输出时距", ago_str)
            except Exception:
                pass

    def _refresh_data(self) -> None:
        """从 DataStore 拉取数据并刷新表格。"""
        sessions = self._store.sessions
        self.clear()
        self._row_session.clear()
        for s in sessions:
            session_id = s.get("session_id", "")
            title = s.get("title", "")
            if s.get("is_subagent"):
                title = f"· {title}"
            else:
                title = f"■ {title}"
            ts_updated = s.get("time_updated", 0)
            ago_str = DataStore.time_ago(ts_updated)

            self.add_row(
                title,
                DataStore.fmt_duration(s.get("duration_ms", 0) / 1000),
                DataStore.fmt_time(ts_updated),
                ago_str,
                s.get("provider_id", "-"),
                key=session_id,
            )
            self._row_session[session_id] = s

    def on_data_table_row_selected(self, event: DataTable.RowSelected) -> None:
        """双击行时跳转到对应终端窗口。"""
        rk = event.row_key
        if not rk or not rk.value:
            return
        session = self._row_session.get(rk.value)
        if not session:
            return
        session_id = session.get("session_id", "")
        ok = focus_terminal_window(session_id)
        status_widget = self.screen.query_one("#status-footer")
        if hasattr(status_widget, "flash_message"):
            status_widget.flash_message("已跳转到终端窗口" if ok else "无法定位终端窗口",
                                        2000 if ok else 3000)

    def on_data_table_header_selected(self, event: DataTable.HeaderSelected) -> None:
        """点击列头排序。"""
        col = event.label.plain
        if col not in SORT_COLUMNS:
            return
        if col == self._sort_key:
            self._sort_reverse = not self._sort_reverse
        else:
            self._sort_key = col
            self._sort_reverse = False
        self.sort(self._sort_key, reverse=self._sort_reverse)
