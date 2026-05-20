"""概览 Tab — 选项区 + 状态区(KPI) + 会话列表。"""

from __future__ import annotations

from textual.containers import Horizontal, Vertical
from textual.widgets import Select, Static

from app.data_store import DataStore
from widgets.kpi_card import KPICard
from widgets.session_list import SessionList

PERIOD_OPTIONS = [
    ("日", "1d"),
    ("3日", "3d"),
    ("周", "1w"),
    ("月", "1m"),
    ("年", "1y"),
    ("全部", "all"),
]

REFRESH_OPTIONS = [
    ("1s", "1"),
    ("3s", "3"),
    ("10s", "10"),
    ("30s", "30"),
    ("60s", "60"),
    ("手动", "0"),
]


class OverviewTab(Vertical):
    """概览 Tab 主要内容。"""

    DEFAULT_CSS = """
    OverviewTab {
        background: $surface-darken-1;
    }
    #filter-bar {
        height: 3;
        padding: 1 2;
        dock: top;
    }
    #kpi-container {
        height: 6;
        padding: 0 1;
    }
    #error-banner {
        height: 1;
        padding: 0 2;
    }
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._store = DataStore.get_instance()
        self._kpi_cards: dict[str, KPICard] = {}
        self._session_list = SessionList(id="session-list")
        self._error_banner = Static("", id="error-banner", classes="muted")
        self._error_banner.visible = False

    def compose(self):
        # 错误提示条
        yield self._error_banner
        # 选项区
        with Horizontal(id="filter-bar"):
            yield Select(
                PERIOD_OPTIONS, value="1d", id="period-select", prompt="周期"
            )
            yield Select(
                REFRESH_OPTIONS, value="10", id="refresh-select", prompt="刷新"
            )
        # KPI 状态区
        with Horizontal(id="kpi-container"):
            self._kpi_cards["sessions"] = KPICard(
                label="活跃会话数",
                value="--",
                delta="",
                accent="green",
                id="kpi-sessions",
            )
            self._kpi_cards["duration"] = KPICard(
                label="活跃时长",
                value="--",
                delta="",
                accent="orange",
                id="kpi-duration",
            )
            self._kpi_cards["tokens"] = KPICard(
                label="TOKEN",
                value="--",
                delta="",
                accent="blue",
                id="kpi-tokens",
            )
            self._kpi_cards["cost"] = KPICard(
                label="成本",
                value="--",
                delta="",
                accent="gold",
                id="kpi-cost",
            )
            for card in self._kpi_cards.values():
                yield card
        # 会话列表
        yield self._session_list

    def on_mount(self) -> None:
        self._store.subscribe(self._on_data_updated)
        self._update_all()

    def _update_all(self) -> None:
        """从 DataStore 刷新 KPI 和会话列表。"""
        self._update_kpi()
        self._update_error_banner()
        self._session_list._refresh_data()

    def _update_kpi(self) -> None:
        """更新 4 个 KPI 卡片数据。"""
        stats = self._store.summary_stats
        sessions = self._store.sessions

        if not stats and not sessions:
            for card in self._kpi_cards.values():
                card.value = "--"
                card.delta = ""
            return

        # 计算变化指示（与上一周期对比）
        # 用概览周期的2倍天数作为"上一周期"
        import time as _time
        _now = _time.time()
        active_count = len(sessions)
        total_duration = stats.get("total_duration_s", 0)
        total_tokens = (
            stats.get("total_tokens_input", 0)
            + stats.get("total_tokens_output", 0)
            + stats.get("total_tokens_reasoning", 0)
        )
        total_cost = stats.get("total_cost", 0)

        # 活跃会话数
        self._kpi_cards["sessions"].value = str(active_count)
        # 活跃时长
        self._kpi_cards["duration"].value = DataStore.fmt_duration(total_duration)
        # TOKEN
        self._kpi_cards["tokens"].value = DataStore.fmt_tokens(total_tokens)
        # 成本
        self._kpi_cards["cost"].value = DataStore.fmt_cost(total_cost)

    def _update_error_banner(self) -> None:
        failures = self._store.consecutive_failures
        if failures >= 3 and not self._store.available:
            self._error_banner.update("数据获取失败，请检查 opencode 状态（Ctrl+R 重试）")
            self._error_banner.visible = True
        else:
            self._error_banner.visible = False

    def _on_data_updated(self) -> None:
        """DataStore 数据更新回调。"""
        try:
            self.app.call_from_thread(self._update_all)
        except Exception:
            pass

    def on_select_changed(self, event: Select.Changed) -> None:
        value = event.value
        str_val = str(value) if value is not None else ""
        if event.select.id == "period-select":
            self._store.set_period(str_val)
        elif event.select.id == "refresh-select":
            interval = 10
            if str_val:
                try:
                    interval = int(str_val)
                except ValueError:
                    interval = 10
            self._store.set_refresh_interval(interval)

    def refresh_now(self) -> None:
        """强制刷新。"""
        self._store.refresh_overview()
        self._update_all()
