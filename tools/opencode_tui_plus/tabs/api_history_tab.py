"""API历史 Tab — 筛选区 + 趋势图 + 调用列表 + 汇总统计。"""

from __future__ import annotations

from textual.containers import Horizontal, Vertical
from textual.widgets import Input, Select, Static

from app.data_store import DataStore
from widgets.api_list import ApiList
from widgets.trend_chart import TrendChart

TIME_RANGE_OPTIONS = [
    ("今天", "1"),
    ("3天", "3"),
    ("7天", "7"),
    ("30天", "30"),
    ("全部", "9999"),
]

AGENT_TYPE_OPTIONS = [
    ("全部", ""),
    ("explore", "explore"),
    ("oracle", "oracle"),
    ("sisyphus", "sisyphus"),
    ("librarian", "librarian"),
    ("build", "build"),
    ("其他", "other"),
]


class ApiHistoryTab(Vertical):
    """API历史 Tab 主要内容。"""

    DEFAULT_CSS = """
    ApiHistoryTab {
        background: $surface-darken-1;
    }
    #api-filter-bar {
        height: 5;
        padding: 0 1;
    }
    #api-filter-bar > Horizontal {
        height: 3;
    }
    #summary-bar {
        height: 1;
        padding: 0 2;
    }
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._store = DataStore.get_instance()
        self._trend_chart = TrendChart(id="trend-chart")
        self._api_list = ApiList(id="api-list")
        self._search_input = Input(placeholder="搜索会话...", id="api-search")
        self._summary_bar = Static("", id="summary-bar", classes="muted")

    def compose(self):
        # 筛选区
        with Horizontal(id="api-filter-bar"):
            with Vertical():
                with Horizontal():
                    yield Select(
                        TIME_RANGE_OPTIONS, value="7", id="time-range-select",
                        prompt="时间范围",
                    )
                    yield Select(
                        AGENT_TYPE_OPTIONS, value="", id="agent-type-select",
                        prompt="Agent 类型",
                    )
                yield self._search_input
        # 汇总统计
        yield self._summary_bar
        # 趋势图
        yield self._trend_chart
        # 调用列表
        yield self._api_list

    def on_mount(self) -> None:
        self._store.subscribe(self._on_data_updated)
        self._refresh_all()

    def _refresh_all(self) -> None:
        self._update_summary()
        self._api_list.refresh_data()
        self._trend_chart.refresh_chart()

    def _update_summary(self) -> None:
        data = self._store.api_history
        total = data.get("total", 0)
        days = self._store.api_days
        # 从 summary_stats 获取汇总数据
        stats = self._store.summary_stats
        if stats:
            total_tokens = (
                stats.get("total_tokens_input", 0)
                + stats.get("total_tokens_output", 0)
                + stats.get("total_tokens_reasoning", 0)
            )
            total_cost = stats.get("total_cost", 0)
            self._summary_bar.update(
                f"{days}日内共 {total} 次调用  |  总Token: {DataStore.fmt_tokens(total_tokens)}  |  "
                f"总成本: {DataStore.fmt_cost(total_cost)}"
            )
        else:
            self._summary_bar.update(f"{days}日内共 {total} 次调用")

    def _on_data_updated(self) -> None:
        try:
            self.app.call_from_thread(self._refresh_all)
        except Exception:
            pass

    # ── 事件处理 ──

    def on_select_changed(self, event: Select.Changed) -> None:
        value = event.value
        str_val = str(value) if value is not None else ""
        if event.select.id == "time-range-select":
            days = 7
            if str_val:
                try:
                    days = int(str_val)
                except ValueError:
                    days = 7
            self._store.set_api_days(days)
            self._refresh_all()
        elif event.select.id == "agent-type-select":
            self._api_list.refresh_data(
                search=self._search_input.value,
                agent_type=str_val,
            )

    def on_input_submitted(self, event: Input.Submitted) -> None:
        if event.input.id == "api-search":
            self._api_list.refresh_data(search=event.value)

    def refresh_now(self) -> None:
        """强制刷新。"""
        self._store.refresh_api_history()
        self._store.get_daily_stats_for_chart()
        self._refresh_all()
