"""API 调用 DataTable + 详情面板 + 分页。"""

from __future__ import annotations

from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.widgets import DataTable, Static

from app.data_store import DataStore

API_COLUMNS = [
    ("时间", 14),
    ("会话", 25),
    ("模型", 18),
    ("Token 消耗", 12),
    ("成本", 8),
    ("耗时", 8),
]


class ApiList(Vertical):
    """API 调用列表 + 详情面板 + 分页。"""

    BINDINGS = [
        Binding("left", "prev_page", "上一页"),
        Binding("right", "next_page", "下一页"),
        Binding("enter", "toggle_detail", "查看详情"),
        Binding("escape", "close_detail", "关闭详情"),
    ]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._store = DataStore.get_instance()
        self._table = DataTable(id="api-table")
        self._detail = Static("", id="api-detail", classes="muted")
        self._detail.visible = False
        self._pagination: Horizontal = Horizontal(id="pagination-container")
        self._page_info = Static("第 1 页 / 共 1 页", id="page-info")
        self._current_page = 1
        self._current_search = ""
        self._current_agent_type = ""
        self._selected_row_data: dict | None = None

    def compose(self):
        yield self._table
        yield self._detail
        with self._pagination:
            yield self._page_info

    def on_mount(self) -> None:
        self._table.add_columns(*[c[0] for c in API_COLUMNS])

    def refresh_data(self, search: str = "", agent_type: str = "", page: int = 1) -> None:
        self._current_search = search
        self._current_agent_type = agent_type
        self._current_page = page

        self._store.refresh_api_history(search=search, agent_type=agent_type, page=page)
        data = self._store.api_history
        items = data.get("items", [])
        total_pages = data.get("total_pages", 1)

        self._table.clear()
        for item in items:
            ts = item.get("time_created", 0)
            time_str = DataStore.fmt_time(ts) if ts else "--:--:--"
            title = item.get("title", "-")[:25]
            model = item.get("model_id", "-")[:18] or "-"
            tokens = f"{DataStore.fmt_tokens(item.get('total_tokens_input', 0))} / {DataStore.fmt_tokens(item.get('total_tokens_output', 0))}"
            cost = DataStore.fmt_cost(item.get("total_cost", 0))
            duration = DataStore.fmt_duration(item.get("duration_ms", 0) / 1000)
            self._table.add_row(
                time_str, title, model, tokens, cost, duration,
                key=item.get("session_id", ""),
            )

        self._page_info.update(f"第 {page} 页 / 共 {total_pages} 页")

    # ── 分页 ──

    def action_next_page(self) -> None:
        data = self._store.api_history
        total_pages = data.get("total_pages", 1)
        if self._current_page < total_pages:
            self.refresh_data(
                search=self._current_search,
                agent_type=self._current_agent_type,
                page=self._current_page + 1,
            )

    def action_prev_page(self) -> None:
        if self._current_page > 1:
            self.refresh_data(
                search=self._current_search,
                agent_type=self._current_agent_type,
                page=self._current_page - 1,
            )

    # ── 详情面板 ──

    def action_toggle_detail(self) -> None:
        if self._detail.visible:
            self._detail.visible = False
            return
        cursor_row = self._table.cursor_row
        if cursor_row is None:
            return
        row_key = self._table.row_key(cursor_row)
        if row_key is None:
            return

        # 通过 session_id (row_key) 匹配，唯一标识
        self._selected_row_data = None
        for item in self._store.api_history.get("items", []):
            if item.get("session_id", "") == str(row_key.value):
                self._selected_row_data = item
                break

        if not self._selected_row_data:
            return

        s = self._selected_row_data
        lines = [
            f"会话: {s.get('session_id', '-')}",
            f"模型: {s.get('provider_id', '-')}/{s.get('model_id', '-')}",
            f"Token: 输入 {DataStore.fmt_tokens(s.get('total_tokens_input', 0))} / "
            f"输出 {DataStore.fmt_tokens(s.get('total_tokens_output', 0))} / "
            f"推理 {DataStore.fmt_tokens(s.get('total_tokens_reasoning', 0))} / "
            f"缓存读 {DataStore.fmt_tokens(s.get('total_tokens_cache_read', 0))} / "
            f"写 {DataStore.fmt_tokens(s.get('total_tokens_cache_write', 0))}",
            f"文件变更: +{s.get('summary_additions', 0)} / -{s.get('summary_deletions', 0)} 行",
        ]
        summary = s.get("title", "")[:200]
        if summary:
            lines.append(f"Summary: {summary}")

        self._detail.update("\n".join(lines))
        self._detail.visible = True

    def action_close_detail(self) -> None:
        self._detail.visible = False
