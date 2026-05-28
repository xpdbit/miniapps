# -*- coding: utf-8 -*-
"""DataStore 单例 — 异步数据管理与缓存。

v0.3.0: 全面异步化。所有 SQLite 查询委托给后台 QThread worker，
通过 Qt 信号与 UI 异步通信，消除主线程阻塞。
UI 组件通过 subscribe / 主动拉取获取最新数据。

架构:
    主线程 (UI)                    Worker 线程
    ───────────                    ──────────
    refresh_overview()  ──触发──→ DataWorker.run()
                                   ├─ list_sessions()
                                   ├─ get_summary_stats()
                                   └─ get_agent_type_stats()
    on_worker_results() ←──信号── sessions_ready
                        ←──信号── stats_ready
                        ←──信号── agent_stats_ready
    _notify() → UI 刷新
"""
from __future__ import annotations

import time
from typing import Any, Callable, Optional

from PyQt6.QtCore import QObject, pyqtSignal

from .db_adapter import OceDBAdapter
from .logger import OceLogger
from .workers import WorkerManager


class DataStore(QObject):
    """数据存储与管理单例（异步版）。

    公开 API 保持不变，内部将阻塞操作移到后台线程。
    """

    _instance: Optional[DataStore] = None
    _instance_db_path: Optional[str] = None

    # ── Qt 信号 ──
    data_updated = pyqtSignal()  # 数据刷新完成，UI 应更新

    def __init__(self, db_path: Optional[str] = None, parent: Optional[QObject] = None):
        super().__init__(parent)
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

        # ── 异步 Worker 系统 ──
        self._worker_mgr: Optional[WorkerManager] = None
        self._async_initialized: bool = False
        self._pending_overview: bool = False  # 是否有待处理的概览刷新

    @classmethod
    def get_instance(cls, db_path: Optional[str] = None) -> DataStore:
        if cls._instance is None or (db_path and db_path != cls._instance_db_path):
            cls._instance = cls(db_path)
            cls._instance_db_path = db_path
        return cls._instance

    # ── 异步初始化（在 QApplication 创建后调用） ──

    def init_async(self):
        """初始化异步 worker 系统（必须在 QApplication 创建后调用）。

        建立后台线程并连接信号槽。
        """
        if self._async_initialized:
            return

        self._worker_mgr = WorkerManager(
            db_path=self._adapter.db_path,
            parent=self,
        )
        self._worker_mgr.start_all()

        # ── 连接概览数据信号 ──
        if self._worker_mgr.data_worker:
            dw = self._worker_mgr.data_worker
            dw.signals.sessions_ready.connect(self._on_sessions_ready)
            dw.signals.stats_ready.connect(self._on_stats_ready)
            dw.signals.agent_stats_ready.connect(self._on_agent_stats_ready)
            dw.signals.error.connect(self._on_worker_error)
            dw.signals.finished.connect(self._on_overview_finished)

        # ── 连接 API 历史信号 ──
        if self._worker_mgr.api_worker:
            aw = self._worker_mgr.api_worker
            aw.signals.api_history_ready.connect(self._on_api_history_ready)
            aw.signals.error.connect(self._on_worker_error)
            aw.signals.finished.connect(self._on_api_finished)

        # ── 连接图表数据信号 ──
        if self._worker_mgr.chart_worker:
            cw = self._worker_mgr.chart_worker
            cw.signals.daily_stats_ready.connect(self._on_daily_stats_ready)
            cw.signals.error.connect(self._on_worker_error)

        self._async_initialized = True
        OceLogger.get_instance().info("DataStore 异步 worker 已启动")

    def cleanup(self):
        """停止所有 worker 线程（app 关闭时调用）"""
        if self._worker_mgr:
            self._worker_mgr.stop_all()
            self._worker_mgr = None
        self._async_initialized = False

    @property
    def worker_manager(self) -> Optional[WorkerManager]:
        return self._worker_mgr

    @property
    def adapter(self) -> OceDBAdapter:
        """公开 adapter（供外部获取 db_path 等）。"""
        return self._adapter

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
        """返回活跃会话列表，子 agent 时间聚合到父 agent。"""
        if not self._sessions:
            return []

        now_ms = time.time() * 1000

        # 第一步：构建聚合映射
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

        # 第二步：聚合 time_updated
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

        # 第三步：过滤活跃的父会话
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

            if time_compacting > 0:
                continue
            if eff_updated > 0 and (now_ms - eff_updated) > 900_000:
                continue
            # 零消息 + 创建超过 2 分钟 → 空白会话
            msg_count = s.get("message_count", 0) or 0
            time_created = s.get("time_created", 0) or 0
            if msg_count == 0 and time_created > 0 and (now_ms - time_created) > 120_000:
                continue

            active_parents.append(s)

        if not active_parents:
            return []

        # 第四步：挂载聚合字段
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
        if callback not in self._callbacks:
            self._callbacks.append(callback)

    def unsubscribe(self, callback: Callable) -> None:
        if callback in self._callbacks:
            self._callbacks.remove(callback)

    def _notify(self) -> None:
        """通知所有订阅者和 Qt 信号"""
        # 发射 Qt 信号
        try:
            self.data_updated.emit()
        except Exception:
            pass
        # 传统回调（向后兼容）
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

    # ── 异步数据刷新 ──

    def refresh_overview(self) -> None:
        """触发概览数据异步刷新。

        如果 worker 系统已初始化，将查询委托给后台线程；
        否则回退到同步查询（启动阶段的兼容模式）。
        """
        days = self._parse_period_days()

        if self._async_initialized and self._worker_mgr:
            self._pending_overview = True
            self._worker_mgr.refresh_overview(days=days)
        else:
            # 同步回退（初始化阶段或 worker 不可用时）
            self._refresh_overview_sync(days)

    def _refresh_overview_sync(self, days: int):
        """同步刷新概览数据（回退路径）"""
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
        """触发 API 历史异步刷新"""
        if self._async_initialized and self._worker_mgr:
            self._worker_mgr.refresh_api_history(
                days=self._api_days, search=search,
                agent_type=agent_type, page=page,
            )
        else:
            # 同步回退
            result = self._adapter.get_api_history(
                days=self._api_days, search=search,
                agent_type=agent_type, page=page, page_size=50,
            )
            if result:
                self._api_history = result
            self._notify()

    def get_daily_stats_for_chart(self) -> list[dict]:
        """获取每日统计（供图表使用）。

        如果 worker 系统可用，触发异步查询并返回缓存数据；
        否则同步查询。
        """
        if self._async_initialized and self._worker_mgr:
            self._worker_mgr.refresh_daily_stats(days=self._api_days)
            return self._daily_stats  # 返回缓存，结果通过信号异步更新
        else:
            result = self._adapter.get_daily_stats(days=self._api_days)
            if result:
                self._daily_stats = result
            return self._daily_stats

    # ── Worker 信号处理 ──

    def _on_sessions_ready(self, sessions: list[dict]):
        """后台线程返回会话数据"""
        if sessions is not None:
            old_count = len(self._sessions)
            self._sessions = sessions
            if not sessions and old_count > 0:
                self._consecutive_failures += 1
            else:
                self._consecutive_failures = 0

    def _on_stats_ready(self, stats: dict):
        """后台线程返回汇总统计"""
        if stats is not None:
            self._summary_stats = stats

    def _on_agent_stats_ready(self, agent_stats: list[dict]):
        """后台线程返回 Agent 类型统计"""
        if agent_stats is not None:
            self._agent_type_stats = agent_stats

    def _on_overview_finished(self):
        """概览数据全部到达"""
        self._last_refresh = time.time()
        self._pending_overview = False
        self._notify()

    def _on_api_history_ready(self, result: dict):
        """后台线程返回 API 历史"""
        if result:
            self._api_history = result

    def _on_api_finished(self):
        """API 历史数据到达"""
        self._notify()

    def _on_daily_stats_ready(self, stats: list[dict]):
        """后台线程返回每日统计"""
        if stats is not None:
            self._daily_stats = stats
        self._notify()

    def _on_worker_error(self, error: str):
        """后台线程错误"""
        self._consecutive_failures += 1
        if self._consecutive_failures >= 3:
            OceLogger.get_instance().warning(
                f"异步数据查询连续失败 {self._consecutive_failures} 次: {error}"
            )

    # ── 格式化工具 ──

    @staticmethod
    def fmt_duration(seconds: float) -> str:
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
        if not ts_ms:
            return "--:--:--"
        t = time.localtime(ts_ms / 1000)
        return time.strftime("%H:%M:%S", t)

    @staticmethod
    def fmt_elapsed_since(ts_ms: int) -> str:
        if not ts_ms:
            return "-"
        elapsed = time.time() - ts_ms / 1000
        if elapsed < 0:
            return "<1s"
        if elapsed < 60:
            return f"{int(elapsed)}s"
        if elapsed < 3600:
            return f"{int(elapsed // 60)}m {int(elapsed % 60)}s"
        return f"{int(elapsed // 3600)}h {int((elapsed % 3600) // 60)}m"

    @staticmethod
    def time_ago(ts_ms: int) -> str:
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
