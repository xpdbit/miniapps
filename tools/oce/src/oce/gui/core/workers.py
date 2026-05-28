# -*- coding: utf-8 -*-
"""
workers.py — QThread 驱动的后台数据工作者

将 SQLite 查询、进程扫描等阻塞操作移到独立线程，
通过 Qt 信号与主线程 UI 异步通信，消除 UI 卡顿。

架构:
    UI Thread                Worker Thread(s)
    ─────────                ────────────────
    DataStore.refresh_async()
      └→ DataWorker.fetch_sessions(days) → sessions_ready signal
      └→ DataWorker.fetch_stats(days)    → stats_ready signal
    AgentStatus.refresh()
      └→ ProcessScanWorker.scan()        → processes_ready signal

线程安全:
    - 每个 Worker 在自己的线程中创建独立的 SQLite 连接
    - 通过 QMutex 保护共享缓存
    - 信号参数通过 Qt 的自动排队传递（线程安全）
"""
from __future__ import annotations

import os
import sqlite3
import time
from typing import Any, Optional

from PyQt6.QtCore import QObject, QThread, QMutex, QMutexLocker, pyqtSignal, pyqtSlot


# ─── 数据工作者信号 ──────────────────────────────

class DataWorkerSignals(QObject):
    """DataWorker 的信号容器"""
    sessions_ready = pyqtSignal(list)        # list[dict]
    stats_ready = pyqtSignal(dict)           # summary stats
    agent_stats_ready = pyqtSignal(list)     # agent type stats
    api_history_ready = pyqtSignal(dict)     # api history page
    daily_stats_ready = pyqtSignal(list)     # daily stats for chart
    error = pyqtSignal(str)                  # error message
    finished = pyqtSignal()                  # all queries done


class ProcessScanSignals(QObject):
    """ProcessScanWorker 的信号容器"""
    processes_ready = pyqtSignal(list)       # list[ProcessInfo]
    error = pyqtSignal(str)
    finished = pyqtSignal()


# ─── 数据工作者 ──────────────────────────────────

class DataWorker(QObject):
    """在后台线程中执行 OpenCode SQLite 数据库查询。

    每个 DataWorker 实例在自己的线程中运行，创建独立的数据库连接，
    避免与主线程或其他 worker 的 SQLite 连接冲突。

    用法:
        thread = QThread()
        worker = DataWorker(db_path="path/to/opencode.db")
        worker.moveToThread(thread)
        worker.signals.sessions_ready.connect(ui.on_sessions)
        thread.started.connect(worker.run)
        thread.start()
    """

    def __init__(self, db_path: Optional[str] = None, parent: Optional[QObject] = None):
        super().__init__(parent)
        self._db_path = db_path
        self.signals = DataWorkerSignals()
        self._reader = None  # 在线程中延迟创建
        self._mutex = QMutex()

        # 请求队列
        self._pending_days: int = 1
        self._pending_api_days: int = 7
        self._pending_api_search: str = ""
        self._pending_api_agent: str = ""
        self._pending_api_page: int = 1
        self._pending_chart_days: int = 7

    def set_db_path(self, db_path: Optional[str]):
        """更新数据库路径（线程安全）"""
        with QMutexLocker(self._mutex):
            self._db_path = db_path
            self._reader = None  # 强制重建

    def set_params(self, days: int = 1, api_days: int = 7,
                   api_search: str = "", api_agent: str = "",
                   api_page: int = 1, chart_days: int = 7):
        """设置查询参数"""
        self._pending_days = days
        self._pending_api_days = api_days
        self._pending_api_search = api_search
        self._pending_api_agent = api_agent
        self._pending_api_page = api_page
        self._pending_chart_days = chart_days

    def _ensure_reader(self):
        """确保 reader 在工作线程中初始化"""
        if self._reader is not None:
            return
        from oce.core.opencode_db_reader import OpencodeDBReader
        # 在线程本地创建 reader（不共享连接）
        db = self._db_path
        if db and not os.path.isfile(db):
            db = None  # 无效路径，让 reader 自动发现
        self._reader = OpencodeDBReader(db_path=db)

    @pyqtSlot()
    def run(self):
        """执行全部数据查询（由线程启动信号触发）"""
        try:
            self._ensure_reader()
            if self._reader is None or not self._reader.is_available():
                self.signals.error.emit("数据库不可用")
                self.signals.finished.emit()
                return

            reader = self._reader
            days = self._pending_days

            # ── 1. 会话列表 ──
            try:
                records = reader.list_sessions(days=days, limit=200)
                sessions = [_session_record_to_dict(r) for r in records]
                self.signals.sessions_ready.emit(sessions)
            except Exception as e:
                self.signals.error.emit(f"会话查询失败: {e}")

            # ── 2. 汇总统计 ──
            try:
                s = reader.get_summary_stats(days=days)
                stats = {
                    "total_sessions": s.total_sessions,
                    "total_sessions_main": s.total_sessions_main,
                    "total_sessions_sub": s.total_sessions_sub,
                    "total_tokens_input": s.total_tokens_input,
                    "total_tokens_output": s.total_tokens_output,
                    "total_tokens_reasoning": s.total_tokens_reasoning,
                    "total_cost": s.total_cost,
                    "total_duration_s": s.total_duration_s,
                    "total_files_changed": s.total_files_changed,
                    "unique_models": s.unique_models,
                    "unique_agent_types": s.unique_agent_types,
                }
                self.signals.stats_ready.emit(stats)
            except Exception as e:
                self.signals.error.emit(f"统计查询失败: {e}")

            # ── 3. Agent 类型统计 ──
            try:
                agent_stats = reader.get_agent_type_stats(days=days)
                self.signals.agent_stats_ready.emit(agent_stats)
            except Exception as e:
                self.signals.error.emit(f"Agent统计失败: {e}")

        except Exception as e:
            self.signals.error.emit(f"DataWorker 异常: {e}")
        finally:
            self.signals.finished.emit()

    @pyqtSlot()
    def run_api_history(self):
        """执行 API 历史查询（独立任务）"""
        try:
            self._ensure_reader()
            if self._reader is None or not self._reader.is_available():
                self.signals.error.emit("数据库不可用")
                self.signals.finished.emit()
                return

            reader = self._reader
            api_days = self._pending_api_days
            search = self._pending_api_search
            agent = self._pending_api_agent
            page = self._pending_api_page
            page_size = 50

            # 按天数动态计算加载上限
            max_needed = (page + 2) * page_size
            limit = min(5000, max(200, max_needed, api_days * 300))
            records = reader.list_sessions(days=api_days, limit=limit)

            items = []
            for r in records:
                d = _session_record_to_dict(r)
                if search and search.lower() not in d.get("title", "").lower() \
                        and search.lower() not in d.get("session_id", "").lower() \
                        and search.lower() not in d.get("model_id", "").lower():
                    continue
                if agent and agent != "全部" \
                        and agent.lower() not in d.get("agent_name", "").lower():
                    continue
                items.append(d)

            total = len(items)
            start = (page - 1) * page_size
            end = start + page_size
            result = {
                "items": items[start:end],
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": max(1, (total + page_size - 1) // page_size),
            }
            self.signals.api_history_ready.emit(result)
        except Exception as e:
            self.signals.error.emit(f"API历史查询失败: {e}")
        finally:
            self.signals.finished.emit()

    @pyqtSlot()
    def run_daily_stats(self):
        """执行每日统计查询（供图表使用）"""
        try:
            self._ensure_reader()
            if self._reader is None or not self._reader.is_available():
                self.signals.error.emit("数据库不可用")
                self.signals.finished.emit()
                return

            records = self._reader.get_daily_stats(days=self._pending_chart_days)
            result = [_daily_record_to_dict(r) for r in records]
            self.signals.daily_stats_ready.emit(result)
        except Exception as e:
            self.signals.error.emit(f"每日统计失败: {e}")
        finally:
            self.signals.finished.emit()


# ─── 进程扫描工作者 ──────────────────────────────

class ProcessScanWorker(QObject):
    """在后台线程中执行进程扫描。

    将 psutil.process_iter() 和 SQLite session 关联移到后台线程，
    避免 5 秒轮询造成的 UI 微卡顿。

    用法:
        thread = QThread()
        worker = ProcessScanWorker(db_path="...")
        worker.moveToThread(thread)
        worker.signals.processes_ready.connect(ui.on_processes)
        timer.timeout.connect(worker.scan)  # 在主线程触发
        thread.start()
    """

    def __init__(self, db_path: Optional[str] = None, parent: Optional[QObject] = None):
        super().__init__(parent)
        self._db_path = db_path
        self.signals = ProcessScanSignals()
        self._monitor = None  # 在线程中延迟创建

    def set_db_path(self, db_path: Optional[str]):
        """更新数据库路径"""
        self._db_path = db_path
        self._monitor = None

    def _ensure_monitor(self):
        """确保 ProcessMonitor 在工作线程中初始化"""
        if self._monitor is not None:
            return
        from oce.core.opencode_db_reader import OpencodeDBReader
        from oce.core.process_monitor import ProcessMonitor

        db = self._db_path
        if db and not os.path.isfile(db):
            db = None
        reader = OpencodeDBReader(db_path=db) if db else None
        self._monitor = ProcessMonitor(opencode_reader=reader)

    @pyqtSlot()
    def scan(self):
        """执行一次进程扫描（在后台线程中运行）"""
        try:
            self._ensure_monitor()
            if self._monitor is None:
                self.signals.processes_ready.emit([])
                return

            processes = self._monitor.scan()
            self.signals.processes_ready.emit(processes)
        except Exception as e:
            self.signals.error.emit(f"进程扫描失败: {e}")
        finally:
            self.signals.finished.emit()


# ─── 线程管理器 ──────────────────────────────────

class WorkerManager(QObject):
    """管理所有后台工作线程的生命周期。

    提供统一的启动/停止接口，确保线程安全清理。

    用法:
        mgr = WorkerManager(db_path="...")
        mgr.data_worker.signals.sessions_ready.connect(ui.on_sessions)
        mgr.start_all()
        # ... app runs ...
        mgr.stop_all()
    """

    def __init__(self, db_path: Optional[str] = None, parent: Optional[QObject] = None):
        super().__init__(parent)
        self._db_path = db_path
        self._data_thread: Optional[QThread] = None
        self._data_worker: Optional[DataWorker] = None
        self._api_thread: Optional[QThread] = None
        self._api_worker: Optional[DataWorker] = None
        self._chart_thread: Optional[QThread] = None
        self._chart_worker: Optional[DataWorker] = None
        self._scan_thread: Optional[QThread] = None
        self._scan_worker: Optional[ProcessScanWorker] = None

    # ── 属性 ──

    @property
    def data_worker(self) -> Optional[DataWorker]:
        return self._data_worker

    @property
    def api_worker(self) -> Optional[DataWorker]:
        return self._api_worker

    @property
    def chart_worker(self) -> Optional[DataWorker]:
        return self._chart_worker

    @property
    def scan_worker(self) -> Optional[ProcessScanWorker]:
        return self._scan_worker

    # ── 生命周期 ──

    def start_all(self):
        """启动所有后台工作线程"""
        self._start_data_thread()
        self._start_scan_thread()

    def stop_all(self):
        """停止所有后台工作线程并等待清理"""
        self._stop_thread(self._data_thread)
        self._stop_thread(self._api_thread)
        self._stop_thread(self._chart_thread)
        self._stop_thread(self._scan_thread)
        self._data_thread = None
        self._api_thread = None
        self._chart_thread = None
        self._scan_thread = None
        self._data_worker = None
        self._api_worker = None
        self._chart_worker = None
        self._scan_worker = None

    def update_db_path(self, db_path: Optional[str]):
        """更新所有 worker 的数据库路径"""
        self._db_path = db_path
        if self._data_worker:
            self._data_worker.set_db_path(db_path)
        if self._api_worker:
            self._api_worker.set_db_path(db_path)
        if self._chart_worker:
            self._chart_worker.set_db_path(db_path)
        if self._scan_worker:
            self._scan_worker.set_db_path(db_path)

    # ── 线程创建 ──

    def _start_data_thread(self):
        """启动数据查询线程（概览数据）"""
        self._data_thread = QThread(self)
        self._data_worker = DataWorker(self._db_path)
        self._data_worker.moveToThread(self._data_thread)
        self._data_thread.started.connect(self._data_worker.run)
        self._data_thread.start()

        # API 历史独立线程（避免被概览查询阻塞）
        self._api_thread = QThread(self)
        self._api_worker = DataWorker(self._db_path)
        self._api_worker.moveToThread(self._api_thread)
        self._api_thread.start()  # 不自动执行，由外部触发 run_api_history

        # 图表数据独立线程
        self._chart_thread = QThread(self)
        self._chart_worker = DataWorker(self._db_path)
        self._chart_worker.moveToThread(self._chart_thread)
        self._chart_thread.start()

    def _start_scan_thread(self):
        """启动进程扫描线程"""
        self._scan_thread = QThread(self)
        self._scan_worker = ProcessScanWorker(self._db_path)
        self._scan_worker.moveToThread(self._scan_thread)
        self._scan_thread.start()

    @staticmethod
    def _stop_thread(thread: Optional[QThread]):
        """安全停止一个 QThread"""
        if thread is None:
            return
        if thread.isRunning():
            thread.quit()
            thread.wait(3000)  # 最多等待 3 秒
        if thread.isRunning():
            thread.terminate()
            thread.wait(1000)

    # ── 触发查询 ──

    def refresh_overview(self, days: int = 1):
        """触发概览数据刷新（异步）"""
        if self._data_worker and self._data_thread and self._data_thread.isRunning():
            self._data_worker.set_params(days=days)
            # 使用 invokeMethod 确保跨线程安全调用
            from PyQt6.QtCore import QMetaObject, Qt as QtCore
            QMetaObject.invokeMethod(
                self._data_worker, "run",
                QtCore.ConnectionType.QueuedConnection,
            )

    def refresh_api_history(self, days: int = 7, search: str = "",
                            agent_type: str = "", page: int = 1):
        """触发 API 历史刷新（异步）"""
        if self._api_worker and self._api_thread and self._api_thread.isRunning():
            self._api_worker.set_params(
                api_days=days, api_search=search,
                api_agent=agent_type, api_page=page,
            )
            from PyQt6.QtCore import QMetaObject, Qt as QtCore
            QMetaObject.invokeMethod(
                self._api_worker, "run_api_history",
                QtCore.ConnectionType.QueuedConnection,
            )

    def refresh_daily_stats(self, days: int = 7):
        """触发每日统计刷新（异步）"""
        if self._chart_worker and self._chart_thread and self._chart_thread.isRunning():
            self._chart_worker.set_params(chart_days=days)
            from PyQt6.QtCore import QMetaObject, Qt as QtCore
            QMetaObject.invokeMethod(
                self._chart_worker, "run_daily_stats",
                QtCore.ConnectionType.QueuedConnection,
            )

    def scan_processes(self):
        """触发进程扫描（异步）"""
        if self._scan_worker and self._scan_thread and self._scan_thread.isRunning():
            from PyQt6.QtCore import QMetaObject, Qt as QtCore
            QMetaObject.invokeMethod(
                self._scan_worker, "scan",
                QtCore.ConnectionType.QueuedConnection,
            )


# ─── 序列化辅助（将 dataclass 转为 dict 以通过信号传递） ──

def _session_record_to_dict(r) -> dict:
    """将 SessionRecord 转为可序列化的 dict"""
    return {
        "session_id": r.session_id,
        "project_id": r.project_id,
        "parent_id": r.parent_id,
        "slug": r.slug,
        "title": r.title,
        "summary_additions": r.summary_additions,
        "summary_deletions": r.summary_deletions,
        "summary_files": r.summary_files,
        "time_created": r.time_created,
        "time_updated": r.time_updated,
        "time_compacting": r.time_compacting,
        "duration_ms": r.duration_ms,
        "total_tokens_input": r.total_tokens_input,
        "total_tokens_output": r.total_tokens_output,
        "total_tokens_reasoning": r.total_tokens_reasoning,
        "total_tokens_cache_read": r.total_tokens_cache_read,
        "total_tokens_cache_write": r.total_tokens_cache_write,
        "total_cost": r.total_cost,
        "model_id": r.model_id,
        "provider_id": r.provider_id,
        "agent_name": r.agent_name,
        "message_count": r.message_count,
        "is_subagent": r.is_subagent,
        "total_tokens": r.total_tokens,
    }


def _daily_record_to_dict(d) -> dict:
    """将 DailyStats 转为可序列化的 dict"""
    return {
        "date": d.date,
        "sessions_total": d.sessions_total,
        "sessions_main": d.sessions_main,
        "sessions_sub": d.sessions_sub,
        "total_tokens_input": d.total_tokens_input,
        "total_tokens_output": d.total_tokens_output,
        "total_tokens_reasoning": d.total_tokens_reasoning,
        "total_tokens_cache": d.total_tokens_cache,
        "total_cost": d.total_cost,
        "total_duration_s": d.total_duration_s,
        "unique_models": d.unique_models,
        "unique_agents": d.unique_agents,
        "files_changed": d.files_changed,
    }
