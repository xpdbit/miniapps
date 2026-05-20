"""DataStore 单例 — 数据管理与缓存。

封装数据刷新、缓存、格式化。
UI 组件通过 subscribe / 主动拉取获取最新数据。
"""

from __future__ import annotations

import time
from typing import Any, Callable, Optional

from core.db_adapter import OcpDBAdapter


class DataStore:
    """数据存储与管理单例。"""

    _instance: Optional[DataStore] = None

    def __init__(self, db_path: Optional[str] = None):
        self._adapter = OcpDBAdapter(db_path)
        self._sessions: list[dict] = []
        self._summary_stats: dict = {}
        self._agent_type_stats: list[dict] = []
        self._daily_stats: list[dict] = []
        self._api_history: dict = {"items": [], "total": 0, "page": 1, "total_pages": 1}
        self._callbacks: list[Callable] = []
        self._last_refresh: float = 0
        self._consecutive_failures: int = 0
        self._period: str = "1d"
        self._api_days: int = 7
        self._refresh_interval: int = 10
        self._theme: str = "github-dark"

    @classmethod
    def get_instance(cls, db_path: Optional[str] = None) -> DataStore:
        if cls._instance is None:
            cls._instance = cls(db_path)
        return cls._instance

    # ── 属性 ──

    @property
    def available(self) -> bool:
        return self._adapter.is_available()

    @property
    def consecutive_failures(self) -> int:
        return self._consecutive_failures

    @property
    def sessions(self) -> list[dict]:
        return self._sessions

    @property
    def summary_stats(self) -> dict:
        return self._summary_stats

    @property
    def daily_stats(self) -> list[dict]:
        return self._daily_stats

    @property
    def api_history(self) -> dict:
        return self._api_history

    @property
    def period(self) -> str:
        return self._period

    @property
    def api_days(self) -> int:
        return self._api_days

    @property
    def refresh_interval(self) -> int:
        return self._refresh_interval

    @property
    def theme(self) -> str:
        return self._theme

    @theme.setter
    def theme(self, val: str) -> None:
        if val in ("github-dark", "github-light"):
            self._theme = val

    # ── 订阅机制 ──

    def subscribe(self, callback: Callable) -> None:
        self._callbacks.append(callback)

    def unsubscribe(self, callback: Callable) -> None:
        if callback in self._callbacks:
            self._callbacks.remove(callback)

    def _notify(self) -> None:
        for cb in self._callbacks:
            try:
                cb()
            except Exception:
                pass

    # ── 周期与间隔 ──

    def set_period(self, period: str) -> None:
        self._period = period
        self.refresh_overview()

    def set_refresh_interval(self, interval: int) -> None:
        self._refresh_interval = interval

    def set_api_days(self, days: int) -> None:
        self._api_days = days

    def _parse_period_days(self) -> int:
        mapping = {"1d": 1, "3d": 3, "1w": 7, "1m": 30, "1y": 365, "all": 9999}
        return mapping.get(self._period, 1)

    # ── 数据刷新 ──

    def refresh_overview(self) -> None:
        """刷新概览数据。"""
        days = self._parse_period_days()
        sessions = self._adapter.list_sessions(days=days)
        stats = self._adapter.get_summary_stats(days=days)
        agent_stats = self._adapter.get_agent_type_stats(days=days)

        if not sessions and not stats:
            self._consecutive_failures += 1
        else:
            self._consecutive_failures = 0

        if sessions is not None:
            self._sessions = sessions
        if stats is not None:
            self._summary_stats = stats
        if agent_stats is not None:
            self._agent_type_stats = agent_stats

        self._last_refresh = time.time()
        self._notify()

    def refresh_api_history(self, search: str = "",
                            agent_type: str = "", page: int = 1) -> None:
        result = self._adapter.get_api_history(
            days=self._api_days, search=search,
            agent_type=agent_type, page=page, page_size=50,
        )
        if result:
            self._api_history = result
        self._notify()

    def get_daily_stats_for_chart(self) -> list[dict]:
        result = self._adapter.get_daily_stats(days=self._api_days)
        if result:
            self._daily_stats = result
        return self._daily_stats

    # ── 格式化工具 ──

    @staticmethod
    def fmt_duration(seconds: float) -> str:
        if seconds < 1:
            return "<1s"
        if seconds < 60:
            return f"{int(seconds)}s"
        if seconds < 3600:
            return f"{int(seconds // 60)}m {int(seconds % 60)}s"
        if seconds < 86400:
            h = int(seconds // 3600)
            m = int((seconds % 3600) // 60)
            return f"{h}h {m}m"
        return f"{int(seconds // 86400)}d+"

    @staticmethod
    def fmt_tokens(count: int) -> str:
        if count < 1000:
            return str(count)
        if count < 1_000_000:
            return f"{count / 1000:.1f}K"
        return f"{count / 1_000_000:.2f}M"

    @staticmethod
    def fmt_cost(amount: float) -> str:
        return f"${amount:.4f}"

    @staticmethod
    def fmt_time(ts_ms: int) -> str:
        """将毫秒时间戳转为 HH:mm:ss。"""
        if not ts_ms:
            return "--:--:--"
        t = time.localtime(ts_ms / 1000)
        return time.strftime("%H:%M:%S", t)

    @staticmethod
    def time_ago(ts_ms: int) -> str:
        """计算距离现在的相对时间。"""
        if not ts_ms:
            return "-"
        elapsed = time.time() - ts_ms / 1000
        if elapsed < 1:
            return "<1s"
        if elapsed < 60:
            return f"{int(elapsed)}s"
        if elapsed < 3600:
            return f"{int(elapsed // 60)}m {int(elapsed % 60)}s"
        if elapsed < 7200:
            return f"1h+"
        return f"{int(elapsed // 3600)}h+"
