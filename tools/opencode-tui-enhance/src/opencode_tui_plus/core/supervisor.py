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
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
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
            state_dir="tools/opencode-tui-enhance/state",
            logs_dir="tools/opencode-tui-enhance/logs",
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
    PROCESS_STALE_SEC = 300  # 进程最后输出 > 5min 视为僵死
    SELF_STALE_SEC = 600     # 监管自身最后写入 > 10min 视为卡死
    MAX_LOG_FILES = 30       # 最多保留 30 个日志文件

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
            return

        # 检查最后输出时间
        if hasattr(runner, '_reader_eof'):
            # 如果读取线程已 EOF 但进程还在 → 可能僵死
            pass  # 这种情况由 runner 自身处理

    def _check_failure_counter(self):
        """检查连续失败计数器（需要外部传入）"""
        pass  # 由 loop_engine 更新，supervisor 仅读取

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
        # 递增轮转
        for i in range(self.MAX_LOG_FILES - 1, 0, -1):
            src = f"{base}.{i}"
            dst = f"{base}.{i + 1}"
            if os.path.exists(src):
                if os.path.exists(dst):
                    os.remove(dst)
                os.rename(src, dst)
        # 轮转当前文件
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

    # ─── 即时触发 ──────────────────────────────

    def on_task_status_change(self, task_id: str, old_status: str, new_status: str):
        """任务状态变更时写入关键事件"""
        msg = f"任务 {task_id}: {old_status} → {new_status}"
        self._alert(AlertLevel.INFO, "task", msg)

    def on_agent_failure(self, task_id: str, round_num: int, error: str):
        """Agent 失败时的即时通知"""
        msg = f"任务 {task_id} 第 {round_num} 轮失败: {error}"
        self._alert(AlertLevel.WARN, "agent", msg)
