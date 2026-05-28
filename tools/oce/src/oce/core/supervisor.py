# -*- coding: utf-8 -*-
"""
supervisor.py — 监管 Agent 心跳巡检

独立线程，分级巡检 OCE 工具自身的运行状态：
- 600s (10min): 进程僵死检测、进程存活、失败计数器、自检
- 3600s (1h): 磁盘空间、日志 rotate、state 可写、DB 连接
- 任务状态变更时即时触发关键事件日志

监管 Agent 使用独立的模型路由，不参与代码改进任务。
"""

from __future__ import annotations

import os
import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Optional

import psutil


# ─── 数据模型 ──────────────────────────────────

class AlertLevel(Enum):
    INFO = "info"
    WARN = "warn"
    ERROR = "error"


@dataclass
class SupervisorAlert:
    """监管告警"""
    level: AlertLevel
    category: str           # process / disk / state / db / self
    message: str
    timestamp: float = field(default_factory=time.time)
    auto_resolved: bool = False


# ─── 回调类型 ──────────────────────────────────

AlertCallback = Callable[[SupervisorAlert], None]


class Supervisor:
    """监管 Agent — 独立心跳线程

    用法:
        sv = Supervisor(
            state_dir="tools/oce/state",
            logs_dir="tools/oce/logs",
            db_path="path/to/opencode.db",
            on_alert=lambda a: print(a.message),
        )
        sv.start()
        # ...
        sv.stop()
    """

    # 巡检间隔（秒）
    FAST_INTERVAL = 600      # 10 分钟：进程检查
    SLOW_INTERVAL = 3600     # 1 小时：资源检查

    # 阈值
    DISK_WARN_GB = 5         # 磁盘 < 5GB 告警
    DISK_ERROR_GB = 1        # 磁盘 < 1GB 严重告警
    LOG_MAX_MB = 100         # 单日志文件 > 100MB 自动 rotate
    PROCESS_STALE_SEC = 300        # 进程最后输出 > 5min 视为僵死
    CONSECUTIVE_FAILURE_LIMIT = 3  # 连续失败次数上限
    SELF_STALE_SEC = 600           # 监管自身最后写入 > 10min 视为卡死
    MAX_LOG_FILES = 30             # 最多保留 30 个日志文件

    def __init__(
        self,
        state_dir: str,
        logs_dir: str,
        db_path: Optional[str] = None,
        runner_ref=None,         # 弱引用到 AgentRunner（用于进程检查）
        on_alert: Optional[AlertCallback] = None,
    ):
        self._state_dir = state_dir
        self._logs_dir = logs_dir
        self._db_path = db_path
        self._runner_ref = runner_ref
        self._on_alert = on_alert

        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._running = False
        self._last_self_check = time.time()

        # 告警历史（去重用）
        self._alert_history: dict[str, float] = {}

        # 进程追踪（僵死检测）
        self._last_process_comm_time = time.time()
        self._known_pid: Optional[int] = None
        self._kill_history: dict[int, float] = {}  # pid → 上次 kill 时间戳

    # ─── 生命周期 ──────────────────────────────

    def start(self):
        """启动监管线程"""
        if self._running:
            return
        self._running = True
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True, name="supervisor")
        self._thread.start()

    def stop(self):
        """停止监管线程"""
        self._running = False
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)

    @property
    def is_running(self) -> bool:
        return self._running

    # ─── 巡检循环 ──────────────────────────────

    def _loop(self):
        """后台巡检循环"""
        last_fast = 0.0
        last_slow = 0.0

        while not self._stop_event.is_set():
            now = time.time()

            # 快速巡检（10 分钟）
            if now - last_fast >= self.FAST_INTERVAL:
                self._check_process_alive()
                self._check_process_stale()
                self._check_failure_counter()
                self._check_self()
                last_fast = now

            # 慢速巡检（1 小时）
            if now - last_slow >= self.SLOW_INTERVAL:
                self._check_disk_space()
                self._check_log_rotate()
                self._check_state_writable()
                self._check_db_connection()
                last_slow = now

            # 每 30 秒检查一次 stop_event
            self._stop_event.wait(timeout=30)

    # ─── 快速巡检项 ─────────────────────────────

    def _check_process_alive(self):
        """检查 opencode 子进程是否存在"""
        runner = self._runner_ref
        if runner is None:
            return
        if not hasattr(runner, 'is_running'):
            return
        if not runner.is_running():
            return  # 没有运行中的进程，跳过

        # 检查进程是否真的存活
        if hasattr(runner, '_process') and runner._process:
            # 进程存活 → 更新通信时间，防止僵死检测误判
            self._last_process_comm_time = time.time()
            if runner._process.poll() is not None:
                self._alert(AlertLevel.ERROR, "process",
                            f"opencode 进程意外退出 (exit_code={runner._process.returncode})")

    def _check_process_stale(self):
        """检查 opcode 子进程是否僵死（长时间无输出）"""
        runner = self._runner_ref
        if runner is None:
            return
        if not hasattr(runner, 'is_running'):
            return
        if not runner.is_running():
            self._known_pid = None
            return

        process = getattr(runner, '_process', None)
        if not process:
            return

        pid = process.pid
        now = time.time()

        # 检测新进程启动 → 重置通信时间
        if pid != self._known_pid:
            self._known_pid = pid
            self._last_process_comm_time = now
            return

        # 避免重复 kill 同一 PID（1 小时内不再触发）
        if pid in self._kill_history:
            if now - self._kill_history[pid] < 3600:
                return

        # 通过 psutil 检查进程异常状态
        try:
            p = psutil.Process(pid)
            st = p.status()
            if st in (psutil.STATUS_ZOMBIE, psutil.STATUS_DEAD, psutil.STATUS_STOPPED):
                self._alert(AlertLevel.ERROR, "process",
                            f"opencode 进程状态异常 (status={st})")
                self._kill_zombie(pid)
                return
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            return

        # 尽力检测 stdout 是否有待读数据（Unix select / Windows PeekNamedPipe）
        got_output = False
        if hasattr(process, 'stdout') and process.stdout:
            try:
                import select
                r, _, _ = select.select([process.stdout], [], [], 0.05)
                if r:
                    got_output = True
            except (ImportError, OSError, ValueError):
                # select 在 Windows 上无法用于管道 → 用 PeekNamedPipe
                try:
                    import ctypes
                    import msvcrt
                    from ctypes import wintypes
                    handle = msvcrt.get_osfhandle(process.stdout.fileno())
                    total_avail = wintypes.DWORD(0)
                    if ctypes.windll.kernel32.PeekNamedPipe(
                        handle, None, 0, None,
                        ctypes.byref(total_avail), None
                    ) and total_avail.value > 0:
                        got_output = True
                except Exception:
                    pass

        if got_output:
            self._last_process_comm_time = now
            return

        # 时间基僵死判定
        elapsed = now - self._last_process_comm_time
        if elapsed > self.PROCESS_STALE_SEC:
            self._alert(AlertLevel.ERROR, "process",
                        f"opencode 进程僵死 ({elapsed:.0f}s 无输出)")
            self._kill_zombie(pid)

    def _check_failure_counter(self, consecutive_failures: int = 0):
        """检查连续失败计数器，超限时建议触发断路器

        Args:
            consecutive_failures: 当前连续失败次数，由调用方传入
        """
        if consecutive_failures <= 0:
            return
        limit = self.CONSECUTIVE_FAILURE_LIMIT
        if consecutive_failures >= limit:
            self._alert(AlertLevel.WARN, "agent",
                        f"连续失败 {consecutive_failures}/{limit} 次，"
                        f"建议触发断路器暂停任务")

    def _check_self(self):
        """监管自检：更新最后心跳时间"""
        self._last_self_check = time.time()

    # ─── 慢速巡检项 ─────────────────────────────

    def _check_disk_space(self):
        """检查磁盘剩余空间"""
        try:
            usage = psutil.disk_usage(self._state_dir)
            free_gb = usage.free / (1024 ** 3)

            if free_gb < self.DISK_ERROR_GB:
                self._alert(AlertLevel.ERROR, "disk",
                            f"磁盘空间严重不足: {free_gb:.1f}GB 剩余")
            elif free_gb < self.DISK_WARN_GB:
                self._alert(AlertLevel.WARN, "disk",
                            f"磁盘空间偏低: {free_gb:.1f}GB 剩余")
        except Exception as e:
            self._alert(AlertLevel.ERROR, "disk",
                        f"无法检查磁盘空间: {e}")

    def _check_log_rotate(self):
        """检查日志文件大小，超限自动 rotate"""
        if not os.path.isdir(self._logs_dir):
            return

        try:
            for fname in os.listdir(self._logs_dir):
                fpath = os.path.join(self._logs_dir, fname)
                if not os.path.isfile(fpath):
                    continue
                size_mb = os.path.getsize(fpath) / (1024 * 1024)
                if size_mb > self.LOG_MAX_MB:
                    # Rotate: 重命名为 .1, .2, ...
                    self._rotate_file(fpath)
                    self._alert(AlertLevel.INFO, "log",
                                f"日志文件已自动 rotate: {fname} ({size_mb:.0f}MB)")
        except Exception as e:
            self._alert(AlertLevel.WARN, "log", f"日志 rotate 检查失败: {e}")

    def _rotate_file(self, filepath: str):
        """轮转单个文件"""
        base = filepath
        # 清理最旧的轮转文件
        oldest = f"{base}.{self.MAX_LOG_FILES}"
        if os.path.exists(oldest):
            os.remove(oldest)
        # 递增轮转：将 .29 → .30, .28 → .29, ..., .1 → .2
        for i in range(self.MAX_LOG_FILES - 1, 0, -1):
            src = f"{base}.{i}"
            dst = f"{base}.{i + 1}"
            if os.path.exists(src):
                if os.path.exists(dst):
                    os.remove(dst)
                os.rename(src, dst)
        # 轮转当前文件 → .1
        dst = f"{base}.1"
        if os.path.exists(dst):
            os.remove(dst)
        os.rename(base, dst)

    def _check_state_writable(self):
        """检查 state/ 目录是否可写"""
        try:
            test_file = os.path.join(self._state_dir, ".supervisor_test")
            with open(test_file, 'w') as f:
                f.write('ok')
            os.remove(test_file)
        except Exception as e:
            self._alert(AlertLevel.ERROR, "state",
                        f"state/ 目录不可写: {e}")

    def _check_db_connection(self):
        """检查 opencode DB 连接"""
        if not self._db_path or not os.path.exists(self._db_path):
            self._alert(AlertLevel.WARN, "db",
                        f"opencode 数据库不可访问: {self._db_path}")
            return
        try:
            import sqlite3
            conn = sqlite3.connect(self._db_path, timeout=3)
            conn.execute("SELECT 1")
            conn.close()
        except Exception as e:
            self._alert(AlertLevel.ERROR, "db",
                        f"opencode 数据库连接失败: {e}")

    # ─── 僵死进程清理 ──────────────────────────

    def _kill_zombie(self, pid: int):
        """安全终止僵死进程树

        Args:
            pid: 要终止的进程 PID
        """
        if pid <= 0:
            return
        self._kill_history[pid] = time.time()

        try:
            if sys.platform == "win32":
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(pid)],
                    capture_output=True, timeout=10,
                )
            else:
                import signal
                try:
                    os.killpg(os.getpgid(pid), signal.SIGTERM)
                except (ProcessLookupError, PermissionError):
                    os.kill(pid, signal.SIGKILL)
        except Exception as e:
            self._alert(AlertLevel.WARN, "process",
                        f"终止僵死进程 {pid} 失败: {e}")

    # ─── 告警管理 ──────────────────────────────

    def _alert(self, level: AlertLevel, category: str, message: str):
        """发出告警（带去重）"""
        # 去重：同一 category + message 在 10 分钟内不重复
        dedup_key = f"{category}:{message}"
        now = time.time()
        last = self._alert_history.get(dedup_key, 0)
        if now - last < 600:  # 10 分钟
            return
        self._alert_history[dedup_key] = now

        alert = SupervisorAlert(level=level, category=category, message=message)
        if self._on_alert:
            try:
                self._on_alert(alert)
            except Exception:
                pass

    # ─── 配置管理 ──────────────────────────────

    def apply_config(self, config: dict):
        """从配置字典应用监管设置

        Args:
            config: 完整配置字典（含 supervisor 节）
        """
        sv_cfg = config.get("supervisor", {})
        if not sv_cfg:
            return

        if "fast_interval_seconds" in sv_cfg:
            self.FAST_INTERVAL = int(sv_cfg["fast_interval_seconds"])
        if "slow_interval_seconds" in sv_cfg:
            self.SLOW_INTERVAL = int(sv_cfg["slow_interval_seconds"])
        if "process_stale_seconds" in sv_cfg:
            self.PROCESS_STALE_SEC = int(sv_cfg["process_stale_seconds"])
        if "consecutive_failure_limit" in sv_cfg:
            self.CONSECUTIVE_FAILURE_LIMIT = int(sv_cfg["consecutive_failure_limit"])
        if "disk_warn_gb" in sv_cfg:
            self.DISK_WARN_GB = float(sv_cfg["disk_warn_gb"])
        if "disk_error_gb" in sv_cfg:
            self.DISK_ERROR_GB = float(sv_cfg["disk_error_gb"])
        if "log_max_mb" in sv_cfg:
            self.LOG_MAX_MB = float(sv_cfg["log_max_mb"])

    # ─── 即时触发 ──────────────────────────────

    def on_task_status_change(self, task_id: str, old_status: str, new_status: str):
        """任务状态变更时写入关键事件"""
        msg = f"任务 {task_id}: {old_status} → {new_status}"
        self._alert(AlertLevel.INFO, "task", msg)

    def on_agent_failure(self, task_id: str, round_num: int, error: str):
        """Agent 失败时的即时通知"""
        msg = f"任务 {task_id} 第 {round_num} 轮失败: {error}"
        self._alert(AlertLevel.WARN, "agent", msg)
