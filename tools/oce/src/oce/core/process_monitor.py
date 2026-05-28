# -*- coding: utf-8 -*-
"""
process_monitor.py — 实时 OpenCode 进程监控器

基于 psutil 扫描所有运行中的 opencode 进程，关联 OpenCode SQLite DB
获取会话信息，实现低开销的实时进程监控。

性能设计：
- 扫描间隔 10 秒，避免高频轮询
- psutil.process_iter() 高效迭代（不创建进程对象）
- CPU % 使用 interval=0 读取缓存值，不阻塞
- 仅在进程列表变化时触发 UI 更新
- DB 查询按需执行（仅对新增进程）
"""

import os
import sqlite3
import time
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional, Set

import psutil

from .opencode_db_reader import OpencodeDBReader


# ─── 数据模型 ──────────────────────────────────


@dataclass
class ProcessInfo:
    """单个 opencode 进程的信息"""
    pid: int
    create_time: float        # Unix timestamp
    working_dir: str = ""
    cmdline: str = ""
    cpu_percent: float = 0.0
    memory_mb: float = 0.0
    status: str = "running"   # running | idle | zombie
    comm_elapsed: float = -1.0  # 距上次 LLM 服务商通信的秒数（-1=未知）

    # 关联的会话信息（从 DB 关联）
    session_id: str = ""
    session_title: str = ""
    agent_type: str = ""
    model_id: str = ""
    provider_id: str = ""
    cumulative_cost: float = 0.0
    session_started_at: float = 0.0
    session_tokens_used: int = 0

    # 与 LLM 服务商通信追踪（按 session 查询 message 表）
    last_provider_comm_time: float = 0.0  # 该 session 最后一条 assistant 消息的 Unix 时间戳（秒）

    # 内部追踪字段
    _last_active_time: float = 0.0   # 最后一次检测到通信活动的时间戳

    @property
    def elapsed(self) -> float:
        """进程已运行时长（秒）"""
        return time.time() - self.create_time

    @property
    def session_elapsed(self) -> float:
        """会话已运行时长（秒）"""
        if self.session_started_at > 0:
            return time.time() - self.session_started_at
        return self.elapsed


# ─── 进程扫描器 ──────────────────────────────


class ProcessMonitor:
    """OpenCode 进程监控器

    用法:
        monitor = ProcessMonitor(opencode_reader)
        processes = monitor.scan()           # 单次扫描
        monitor.start(callback)              # 持续监控（后台线程）
        monitor.stop()
    """

    # opencode 进程名（跨平台）
    _PROCESS_NAMES = {"opencode", "opencode.exe"}

    def __init__(self, opencode_reader: Optional[OpencodeDBReader] = None):
        self._reader = opencode_reader
        self._known: Dict[int, ProcessInfo] = {}   # pid -> ProcessInfo
        self._running = False
        self._interval = 10  # 扫描间隔（秒）
        self._callback: Optional[Callable[[List[ProcessInfo]], None]] = None
        self._thread = None
        self._scan_counter = 0  # 扫描次数计数，用于周期性刷新 session 关联

        # ── 缓存优化 ──
        self._last_scan_time: float = 0.0
        self._last_scan_result: List[ProcessInfo] = []
        self._scan_cache_ttl: float = 2.0  # 2 秒内复用缓存（避免高频重复扫描）
        self._quick_mode: bool = False  # 快速模式：跳过 DB 关联查询

    # ─── 扫描 ──────────────────────────────

    def scan(self) -> List[ProcessInfo]:
        """扫描所有运行中的 opencode 进程

        性能说明：
        - 使用 psutil.process_iter() 单次系统调用获取所有进程属性
        - 对比 _known 中的 PID 列表检测新增/退出进程
        - 默认缓存 2 秒内的结果，避免高频重复扫描
        - 支持快速模式（quick_mode=True）：跳过 DB 查询，仅更新进程指标

        Returns:
            当前活跃的 ProcessInfo 列表
        """
        now = time.time()

        # ── 缓存命中：2 秒内返回缓存 ──
        if now - self._last_scan_time < self._scan_cache_ttl and self._last_scan_result:
            return self._last_scan_result

        current_pids: Set[int] = set()
        results: List[ProcessInfo] = []

        # 扫描计数器递增，每 3 次扫描（~30s）强制刷新 session 关联，避免 agent 信息过时
        self._scan_counter += 1
        should_relink = (self._scan_counter % 3 == 0)

        try:
            for proc in psutil.process_iter(
                attrs=['pid', 'create_time', 'name', 'cmdline', 'cwd', 'memory_info'],
                ad_value=None,
            ):
                name = proc.info.get('name', '')
                if not name or name.lower() not in self._PROCESS_NAMES:
                    continue

                pid = proc.info['pid']
                if pid is None:
                    continue
                current_pids.add(pid)

                # 检查是否已在缓存中
                if pid in self._known:
                    pinfo = self._known[pid]
                    # 更新运行时指标（轻量操作）
                    try:
                        p = psutil.Process(pid)
                        pinfo.cpu_percent = p.cpu_percent(interval=0)
                        mem = proc.info.get('memory_info')
                        if mem:
                            pinfo.memory_mb = mem.rss / (1024 * 1024)

                        # ── 快速模式：跳过 DB 查询 ──
                        if not self._quick_mode:
                            self._refresh_comm_time(pinfo)

                            if should_relink and pinfo.status == "running":
                                self._link_session(pinfo)
                            comm_elapsed = -1.0
                            if pinfo.last_provider_comm_time > 0:
                                comm_elapsed = now - pinfo.last_provider_comm_time
                            pinfo.comm_elapsed = comm_elapsed
                            comm_active = comm_elapsed > 0 and comm_elapsed <= 20
                            if comm_active:
                                pinfo._last_active_time = now

                        pinfo.status = self._map_status(p.status())
                        # 状态降级：running 但超过 60s 无通信活动 → idle
                        if (pinfo.status == "running"
                                and now - pinfo._last_active_time > 60):
                            pinfo.status = "idle"
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pinfo.status = "zombie"
                    results.append(pinfo)
                else:
                    # 新进程：创建 ProcessInfo
                    pinfo = self._build_process_info(proc, now)
                    # 快速模式跳过 DB 关联
                    if not self._quick_mode:
                        self._link_session(pinfo)
                    # 首扫获取指标
                    try:
                        p2 = psutil.Process(pid)
                        pinfo.cpu_percent = p2.cpu_percent(interval=0)
                        mem = proc.info.get('memory_info')
                        if mem:
                            pinfo.memory_mb = mem.rss / (1024 * 1024)
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass
                    # 新进程默认记为活跃
                    pinfo._last_active_time = now
                    self._known[pid] = pinfo
                    results.append(pinfo)

        except (psutil.Error, OSError):
            pass

        # 检测已退出的进程（不在 current_pids 中的旧 PID）
        dead_pids = set(self._known.keys()) - current_pids
        for pid in dead_pids:
            pinfo = self._known[pid]
            pinfo.status = "zombie"
            results.append(pinfo)

        # 清理僵尸缓存，防止 _known 无限增长
        self.cleanup_dead()

        # ── 缓存结果 ──
        self._last_scan_time = now
        self._last_scan_result = results

        return results

    def _build_process_info(self, proc: psutil.Process, now: float) -> ProcessInfo:
        """从 psutil 进程对象构建 ProcessInfo"""
        create_time = proc.info.get('create_time') or now

        # 尝试获取工作目录
        working_dir = ""
        try:
            working_dir = proc.info.get('cwd') or ""
        except Exception:
            pass

        # 尝试获取 cmdline（含 --model 参数等）
        cmdline = ""
        try:
            parts = proc.info.get('cmdline') or []
            if parts:
                # 截取关键参数：model, agent 等
                filtered = []
                skip_next = False
                for i, p in enumerate(parts):
                    if skip_next:
                        skip_next = False
                        continue
                    if p.startswith('-'):
                        # 只保留关键参数
                        if p in ('--model', '-m', '--agent'):
                            filtered.append(p)
                            skip_next = True  # 跳过参数值
                    elif not p.endswith('.exe') and 'node' not in p.lower():
                        # 跳过 exe 路径和 node
                        filtered.append(p)
                cmdline = ' '.join(filtered)
        except Exception:
            pass

        pinfo = ProcessInfo(
            pid=proc.info['pid'],
            create_time=create_time,
            working_dir=working_dir,
            cmdline=cmdline,
            status="running",
        )

        # 尝试关联 OpenCode 会话
        self._link_session(pinfo)

        return pinfo

    def _link_session(self, pinfo: ProcessInfo):
        """将进程与 OpenCode DB 中的会话关联

        策略（按优先级）：
        1. 从运行中 opencode 进程的文件句柄发现实际使用的 DB
        2. 精确匹配：按工作目录 + 进程创建时间 ±5 分钟
        3. 模糊匹配：仅按创建时间 ±1 分钟内最近的 session
        4. 回退：按时间降序取最近 session

        性能：仅在首次发现进程时执行，不重复查询。
        """
        if not self._reader:
            return

        # 刷新 DB 路径：确保能发现新启动的 opencode 进程的实际 DB
        self._reader.refresh_db_path()

        if not self._reader.is_available():
            return

        try:
            # 放宽时间范围以确保能找到进程对应的会话
            sessions = self._reader.list_sessions(days=30, limit=200)
            if not sessions:
                # 回退：不加时间限制搜索
                sessions = self._reader.list_sessions(days=365, limit=200)
            if not sessions:
                return

            best_match = None
            best_score = 0
            proc_cwd_normalized = ""
            if pinfo.working_dir:
                proc_cwd_normalized = os.path.normpath(pinfo.working_dir).lower()

            for sess in sessions:
                score = 0

                # 1. 目录匹配：对会话的项目路径和进程工作目录做部分匹配
                sess_path = (sess.project_id or "").lower()
                if proc_cwd_normalized and sess_path:
                    # 精确路径匹配
                    if proc_cwd_normalized == sess_path:
                        score += 15
                    # 包含关系（进程在项目子目录下运行，或项目路径包含进程目录）
                    elif sess_path in proc_cwd_normalized or proc_cwd_normalized in sess_path:
                        score += 8

                # 2. 时间匹配：进程创建时间 vs 会话创建时间
                time_diff = abs((sess.time_created / 1000) - pinfo.create_time)
                if time_diff < 30:       # 30 秒内 → 高度置信
                    score += 25
                elif time_diff < 120:    # 2 分钟内
                    score += 15
                elif time_diff < 600:    # 10 分钟内
                    score += 8
                elif time_diff < 3600:   # 1 小时内
                    score += 3

                # 3. 子 agent 降权：有 parent_id 的 session 可能不是独立的 opencode 进程
                if sess.is_subagent:
                    score -= 5

                if score > best_score:
                    best_score = score
                    best_match = sess

            # 即使匹配分较低，只要有时序关联就建立连接
            if best_match and best_score >= 3:
                pinfo.session_id = best_match.session_id
                pinfo.session_title = best_match.title or ""
                pinfo.model_id = best_match.model_id or ""
                pinfo.session_tokens_used = (
                    best_match.total_tokens_input +
                    best_match.total_tokens_output +
                    best_match.total_tokens_reasoning
                )
                pinfo.session_started_at = best_match.time_created / 1000

                # 提取 agent 类型：优先从标题提取，回退到 session 的 agent_name
                if hasattr(self._reader, 'extract_agent_type'):
                    atype = self._reader.extract_agent_type(pinfo.session_title)
                    if atype:
                        pinfo.agent_type = atype
                if not pinfo.agent_type and best_match.agent_name:
                    pinfo.agent_type = best_match.agent_name

                # 从 DB 消息表获取实时 provider 和累计成本
                self._fill_live_session_stats(pinfo)
        except Exception:
            pass  # 关联失败不影响进程监控

    def _fill_live_session_stats(self, pinfo: ProcessInfo):
        """从 DB 消息表获取运行中会话的 provider 和累计成本

        对于活跃的 opencode 会话，session_snapshots 可能还未更新，
        直接从 message 表查询最新数据。
        """
        if not pinfo.session_id or not self._reader:
            return
        db_path = self._reader.db_path
        if not db_path:
            return
        try:
            conn = sqlite3.connect(db_path, timeout=3)
            conn.row_factory = sqlite3.Row

            # 获取最新 assistant 消息的 model/provider + 通信时间
            cur = conn.execute("""
                SELECT json_extract(data, '$.modelID') as model,
                       json_extract(data, '$.providerID') as provider,
                       time_created
                FROM message
                WHERE session_id = ? AND json_extract(data, '$.role') = 'assistant'
                ORDER BY time_created DESC
                LIMIT 1
            """, (pinfo.session_id,))
            row = cur.fetchone()
            if row:
                if row["model"] and not pinfo.model_id:
                    pinfo.model_id = row["model"]
                if row["provider"]:
                    pinfo.provider_id = row["provider"]
                if row["time_created"]:
                    pinfo.last_provider_comm_time = row["time_created"] / 1000.0

            # 获取累计成本
            cur2 = conn.execute("""
                SELECT COALESCE(SUM(json_extract(data, '$.cost')), 0) as total_cost
                FROM message
                WHERE session_id = ? AND json_extract(data, '$.role') = 'assistant'
            """, (pinfo.session_id,))
            cost_row = cur2.fetchone()
            if cost_row and cost_row["total_cost"]:
                pinfo.cumulative_cost = float(cost_row["total_cost"])

            conn.close()
        except Exception:
            pass  # 实时统计失败不影响进程监控

    def _refresh_comm_time(self, pinfo: ProcessInfo):
        """每次扫描时刷新 last_provider_comm_time

        从 message 表查询该 session 最新 assistant 消息的 time_created，
        转换为 Unix 秒时间戳。单次索引查询，<5ms，不影响扫描性能。
        参考 opencode 源码: packages/opencode/src/session/session.sql.ts

        无论是否找到消息，都检查 session 的 time_updated 是否过期：
        若超过 5 分钟未更新，自动触发 _link_session 重新匹配。
        这覆盖了同 PID 跨会话复用场景（开放终端中开始新任务）。
        """
        if not pinfo.session_id or not self._reader:
            return
        db_path = self._reader.db_path
        if not db_path:
            return
        try:
            conn = sqlite3.connect(db_path, timeout=3)
            conn.row_factory = sqlite3.Row
            cur = conn.execute("""
                SELECT time_created FROM message
                WHERE session_id = ? AND json_extract(data, '$.role') = 'assistant'
                ORDER BY time_created DESC
                LIMIT 1
            """, (pinfo.session_id,))
            row = cur.fetchone()
            if row and row["time_created"]:
                pinfo.last_provider_comm_time = row["time_created"] / 1000.0

            # 无论 messages 是否存在，都检查 session 是否过期
            if pinfo.status != "zombie":
                cur2 = conn.execute(
                    "SELECT time_updated FROM session WHERE id = ?",
                    (pinfo.session_id,)
                )
                sess_row = cur2.fetchone()
                if sess_row and sess_row["time_updated"]:
                    session_age = time.time() - (sess_row["time_updated"] / 1000.0)
                    if session_age > 300:  # 5 分钟无更新 → 进程可能切换了会话
                        self._link_session(pinfo)
            conn.close()
        except Exception:
            pass  # 单次刷新失败不阻塞扫描

    @staticmethod
    def _map_status(psutil_status: str) -> str:
        """将 psutil 状态映射为简化状态"""
        status_map = {
            "running": "running",
            "sleeping": "running",
            "disk-sleep": "running",
            "stopped": "idle",
            "tracing-stop": "idle",
            "zombie": "zombie",
            "dead": "zombie",
            "wake-kill": "running",
            "waking": "running",
            "parked": "idle",
            "locked": "idle",
        }
        return status_map.get(psutil_status, psutil_status)

    # ─── 进程终止检测 ──────────────────────────

    def get_dead_processes(self) -> List[ProcessInfo]:
        """获取本轮扫描中已退出的进程列表"""
        dead = [p for p in self._known.values() if p.status == "zombie"]
        return dead

    def cleanup_dead(self):
        """清理已退出进程的缓存"""
        dead_pids = [pid for pid, p in self._known.items() if p.status == "zombie"]
        for pid in dead_pids:
            del self._known[pid]

    # ─── 持续监控 ──────────────────────────────

    def start(self, callback: Callable[[List[ProcessInfo]], None],
              interval: int = 10):
        """启动持续监控（在后台线程运行）

        Args:
            callback: 每次扫描完成后的回调（接收 ProcessInfo 列表）
            interval: 扫描间隔（秒），默认 10 秒
        """
        if self._running:
            return
        self._running = True
        self._interval = max(interval, 5)  # 最低 5 秒
        self._callback = callback

        import threading
        self._thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._thread.start()

    def stop(self):
        """停止持续监控"""
        self._running = False
        self._thread = None

    def _monitor_loop(self):
        """后台监控循环"""
        while self._running:
            try:
                processes = self.scan()
                if self._callback:
                    self._callback(processes)
            except Exception:
                pass  # 单次扫描失败不影响后续
            time.sleep(self._interval)

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def interval(self) -> int:
        return self._interval

    @interval.setter
    def interval(self, value: int):
        self._interval = max(value, 5)
