# -*- coding: utf-8 -*-
"""DataStore 单例 — 数据管理与缓存。

封装数据刷新、缓存、格式化。
UI 组件通过 subscribe / 主动拉取获取最新数据。

迁移自 app/data_store.py，去除 Textual 依赖。
"""
from __future__ import annotations

import time
from typing import Any, Callable, Optional

from .db_adapter import OceDBAdapter
from .logger import OceLogger


class DataStore:
    """数据存储与管理单例。"""

    _instance: Optional[DataStore] = None
    _instance_db_path: Optional[str] = None

    def __init__(self, db_path: Optional[str] = None):
        self._adapter = OceDBAdapter(db_path)
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
        if cls._instance is None or (db_path and db_path != cls._instance_db_path):
            cls._instance = cls(db_path)
            cls._instance_db_path = db_path
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
    def sessions_with_aggregated_duration(self) -> list[dict]:
        """返回活跃会话列表，子 agent 时间聚合到父 agent。

        过滤规则：
        - 排除子 agent（由父 agent 聚合展示）
        - 排除超过 15 分钟无更新的已关闭/已完成会话
        - 排除零消息零时长的空白会话
        - 子 agent 的 duration 正确聚合到父 agent
        """
        if not self._sessions:
            return []

        now_ms = time.time() * 1000

        # 第一步：从所有会话构建聚合映射（含子 agent，保持原始行为）
        duration_map: dict[str, int] = {}
        parent_map: dict[str, str] = {}

        for s in self._sessions:
            sid = s.get("session_id", "")
            duration_map[sid] = s.get("duration_ms", 0)
            parent_id = s.get("parent_id")
            if parent_id:
                parent_map[sid] = parent_id

        aggregated: dict[str, int] = {}
        for sid, duration in duration_map.items():
            if sid in parent_map:
                parent_id = parent_map[sid]
                aggregated[parent_id] = aggregated.get(parent_id, 0) + duration
            else:
                aggregated[sid] = aggregated.get(sid, 0) + duration

        # 第二步：聚合 time_updated（取父 + 所有子 agent 的最大值）
        time_updated_agg: dict[str, int] = {}
        for s in self._sessions:
            sid = s.get("session_id", "")
            ts = s.get("time_updated", 0) or 0
            parent_id = s.get("parent_id")
            if parent_id:
                time_updated_agg[parent_id] = max(
                    time_updated_agg.get(parent_id, 0), ts)
            else:
                time_updated_agg[sid] = max(
                    time_updated_agg.get(sid, 0), ts)

        # 第三步：过滤出活跃的父会话（使用聚合后的 time_updated）
        active_parents = []
        seen_sids: set[str] = set()

        for s in self._sessions:
            if s.get("is_subagent"):
                continue

            sid = s.get("session_id", "")
            if sid in seen_sids:
                continue
            seen_sids.add(sid)

            time_compacting = s.get("time_compacting", 0) or 0
            eff_updated = time_updated_agg.get(sid, 0)
            duration_ms = s.get("duration_ms", 0) or 0
            msg_count = s.get("message_count", 0) or 0
            time_created = s.get("time_created", 0) or 0

            # 已压缩 → 已关闭，不显示
            if time_compacting > 0:
                continue

            # 超过 15 分钟无更新（含子 agent）→ 已关闭
            if eff_updated > 0 and (now_ms - eff_updated) > 900_000:
                continue

            # 零消息 + 创建超过 2 分钟 → 空白会话
            if msg_count == 0 and time_created > 0 and (now_ms - time_created) > 120_000:
                continue

            active_parents.append(s)

        if not active_parents:
            return []

        # 第四步：将聚合后的字段挂到父会话上
        result = []
        for s in active_parents:
            sid = s.get("session_id", "")
            result.append({
                **s,
                "duration_ms": aggregated.get(sid, s.get("duration_ms", 0)),
                "time_updated_effective": time_updated_agg.get(
                    sid, s.get("time_updated", 0)),
            })

        return result

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
            if self._consecutive_failures >= 3:
                OceLogger.get_instance().warning(
                    f"数据刷新连续失败 {self._consecutive_failures} 次 (周期={self._period})"
                )
        else:
            if self._consecutive_failures > 0 and sessions and stats:
                OceLogger.get_instance().info(
                    f"数据刷新已恢复 (之前连续失败 {self._consecutive_failures} 次)"
                )
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
        """完整时长格式化，始终显示到秒级精度。

        格式：Xd Yh Zm Zs（XXs / Xm Ys / Xh Ym Zs / Xd Yh Zm）
        """
        if seconds < 1:
            return "<1s"

        days = int(seconds // 86400)
        hours = int((seconds % 86400) // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)

        parts: list[str] = []
        if days > 0:
            parts.append(f"{days}d")
        if days > 0 or hours > 0:
            parts.append(f"{hours}h")
        if days > 0 or hours > 0 or minutes > 0:
            parts.append(f"{minutes}m")
        if days == 0 and hours == 0:
            # 仅当小于 1 小时时显示秒
            parts.append(f"{secs}s")

        return " ".join(parts)

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
    def fmt_idle_countdown(ts_ms: int, idle_threshold_s: int = 900) -> str:
        """计算距空闲移除的倒计时。

        基于 idle_threshold_s（默认 900s=15min）计算剩余时间。
        返回格式：XXm YYs / XXs / 即将移除
        """
        if not ts_ms:
            return "-"
        elapsed = time.time() - ts_ms / 1000
        remaining = idle_threshold_s - elapsed
        if remaining <= 0:
            return "即将移除"
        if remaining < 60:
            return f"{int(remaining)}s"
        if remaining < 3600:
            return f"{int(remaining // 60)}m {int(remaining % 60)}s"
        return f"{int(remaining // 3600)}h+"

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
            return "1h+"
        return f"{int(elapsed // 3600)}h+"
