# -*- coding: utf-8 -*-
"""supervisor.py 单元测试"""

import os
import tempfile
import time
from unittest.mock import MagicMock, patch

import psutil
import pytest
from oce.core.supervisor import Supervisor, AlertLevel, SupervisorAlert


class TestSupervisorAlerts:
    """监管告警系统测试"""

    def test_alert_deduplication(self, tmp_path):
        """10 分钟内重复告警去重"""
        state_dir = str(tmp_path / "state")
        logs_dir = str(tmp_path / "logs")
        os.makedirs(state_dir)
        os.makedirs(logs_dir)

        alerts = []
        sv = Supervisor(state_dir, logs_dir, on_alert=lambda a: alerts.append(a))

        # 第一次告警
        sv._alert(AlertLevel.WARN, "disk", "space low")
        assert len(alerts) == 1

        # 10 分钟内再次相同告警 → 去重
        sv._alert(AlertLevel.WARN, "disk", "space low")
        assert len(alerts) == 1  # 仍然只有 1 条

    def test_different_alerts_not_deduped(self, tmp_path):
        """不同告警不去重"""
        state_dir = str(tmp_path / "state")
        logs_dir = str(tmp_path / "logs")
        os.makedirs(state_dir)
        os.makedirs(logs_dir)

        alerts = []
        sv = Supervisor(state_dir, logs_dir, on_alert=lambda a: alerts.append(a))

        sv._alert(AlertLevel.WARN, "disk", "space low")
        sv._alert(AlertLevel.ERROR, "disk", "space critical")
        assert len(alerts) == 2

    def test_state_writable_check(self, tmp_path):
        """state 目录可写性检查"""
        state_dir = str(tmp_path / "state")
        logs_dir = str(tmp_path / "logs")
        os.makedirs(state_dir)
        os.makedirs(logs_dir)

        alerts = []
        sv = Supervisor(state_dir, logs_dir, on_alert=lambda a: alerts.append(a))

        # 目录可写 → 无告警
        sv._check_state_writable()
        assert len(alerts) == 0

    def test_state_not_writable_check(self, tmp_path):
        """state 目录不可写 → 告警"""
        state_dir = "/nonexistent/path/12345"
        logs_dir = str(tmp_path / "logs")
        os.makedirs(logs_dir)

        alerts = []
        sv = Supervisor(state_dir, logs_dir, on_alert=lambda a: alerts.append(a))

        sv._check_state_writable()
        assert len(alerts) == 1
        assert alerts[0].level == AlertLevel.ERROR
        assert alerts[0].category == "state"

    def test_lifecycle(self, tmp_path):
        """启动和停止"""
        state_dir = str(tmp_path / "state")
        logs_dir = str(tmp_path / "logs")
        os.makedirs(state_dir)
        os.makedirs(logs_dir)

        sv = Supervisor(state_dir, logs_dir)
        assert not sv.is_running

        sv.start()
        time.sleep(0.5)  # 等待线程启动
        assert sv.is_running

        sv.stop()
        time.sleep(0.5)
        assert not sv.is_running

    def test_task_status_change_event(self, tmp_path):
        """任务状态变更事件"""
        state_dir = str(tmp_path / "state")
        logs_dir = str(tmp_path / "logs")
        os.makedirs(state_dir)
        os.makedirs(logs_dir)

        alerts = []
        sv = Supervisor(state_dir, logs_dir, on_alert=lambda a: alerts.append(a))

        sv.on_task_status_change("task_001", "running", "completed")
        assert len(alerts) == 1
        assert "task_001" in alerts[0].message
        assert "running" in alerts[0].message
        assert "completed" in alerts[0].message


class TestSupervisorProcessStale:
    """进程僵死检测与清理测试"""

    def test_check_process_stale_no_process(self, tmp_path):
        """runner_ref 为 None 或进程未运行时静默返回"""
        state_dir = str(tmp_path / "state")
        logs_dir = str(tmp_path / "logs")
        os.makedirs(state_dir)
        os.makedirs(logs_dir)
        alerts = []
        sv = Supervisor(state_dir, logs_dir, on_alert=lambda a: alerts.append(a))

        # Case 1: runner_ref is None
        sv._runner_ref = None
        sv._check_process_stale()
        assert len(alerts) == 0

        # Case 2: runner.is_running() returns False
        runner = MagicMock()
        runner.is_running.return_value = False
        sv._runner_ref = runner
        sv._known_pid = 999
        sv._check_process_stale()
        assert len(alerts) == 0
        assert sv._known_pid is None  # 未运行时重置

    @patch("oce.core.supervisor.psutil.Process")
    @patch("oce.core.supervisor.subprocess.run")
    def test_check_process_stale_with_zombie(
        self, mock_run, mock_psutil_process, tmp_path
    ):
        """僵尸进程触发 ERROR 告警并调用 _kill_zombie"""
        state_dir = str(tmp_path / "state")
        logs_dir = str(tmp_path / "logs")
        os.makedirs(state_dir)
        os.makedirs(logs_dir)
        alerts = []
        sv = Supervisor(state_dir, logs_dir, on_alert=lambda a: alerts.append(a))

        # 模拟 runner 持有进程
        runner = MagicMock()
        runner.is_running.return_value = True
        proc = MagicMock()
        proc.pid = 12345
        runner._process = proc
        sv._runner_ref = runner
        sv._known_pid = 12345  # 已记录 PID

        # 模拟 psutil 返回僵尸状态
        mock_psutil_process.return_value.status.return_value = psutil.STATUS_ZOMBIE

        sv._check_process_stale()

        assert len(alerts) == 1
        assert alerts[0].level == AlertLevel.ERROR
        assert alerts[0].category == "process"
        assert 12345 in sv._kill_history

    @patch("oce.core.supervisor.subprocess.run")
    def test_kill_zombie_track_history(self, mock_run, tmp_path):
        """_kill_zombie 调用后将 PID 记录到 _kill_history"""
        state_dir = str(tmp_path / "state")
        logs_dir = str(tmp_path / "logs")
        os.makedirs(state_dir)
        os.makedirs(logs_dir)
        sv = Supervisor(state_dir, logs_dir)

        sv._kill_zombie(12345)
        assert 12345 in sv._kill_history
        # 时间戳应为当前时间附近
        assert abs(time.time() - sv._kill_history[12345]) < 5


class TestSupervisorFailureCounter:
    """连续失败计数器测试"""

    def test_check_failure_counter_below_threshold(self, tmp_path):
        """连续失败次数低于阈值时不告警"""
        state_dir = str(tmp_path / "state")
        logs_dir = str(tmp_path / "logs")
        os.makedirs(state_dir)
        os.makedirs(logs_dir)
        alerts = []
        sv = Supervisor(state_dir, logs_dir, on_alert=lambda a: alerts.append(a))

        # 默认 limit=3，传入 1 或 2 不应告警
        sv._check_failure_counter(consecutive_failures=1)
        assert len(alerts) == 0
        sv._check_failure_counter(consecutive_failures=2)
        assert len(alerts) == 0

    def test_check_failure_counter_above_threshold(self, tmp_path):
        """连续失败次数达到阈值时触发 WARN 告警"""
        state_dir = str(tmp_path / "state")
        logs_dir = str(tmp_path / "logs")
        os.makedirs(state_dir)
        os.makedirs(logs_dir)
        alerts = []
        sv = Supervisor(state_dir, logs_dir, on_alert=lambda a: alerts.append(a))

        sv._check_failure_counter(consecutive_failures=3)
        assert len(alerts) == 1
        assert alerts[0].level == AlertLevel.WARN
        assert "连续失败" in alerts[0].message
        assert "断路器" in alerts[0].message


class TestSupervisorConfig:
    """配置管理测试"""

    def test_apply_config_updates_thresholds(self, tmp_path):
        """apply_config 更新所有监管阈值"""
        state_dir = str(tmp_path / "state")
        logs_dir = str(tmp_path / "logs")
        os.makedirs(state_dir)
        os.makedirs(logs_dir)
        sv = Supervisor(state_dir, logs_dir)

        config = {
            "supervisor": {
                "fast_interval_seconds": 300,
                "slow_interval_seconds": 1800,
                "process_stale_seconds": 120,
                "consecutive_failure_limit": 5,
                "disk_warn_gb": 10,
                "disk_error_gb": 2,
                "log_max_mb": 200,
            }
        }
        sv.apply_config(config)

        assert sv.FAST_INTERVAL == 300
        assert sv.SLOW_INTERVAL == 1800
        assert sv.PROCESS_STALE_SEC == 120
        assert sv.CONSECUTIVE_FAILURE_LIMIT == 5
        assert sv.DISK_WARN_GB == 10.0
        assert sv.DISK_ERROR_GB == 2.0
        assert sv.LOG_MAX_MB == 200.0


class TestSupervisorSelfCheck:
    """监管自检测试"""

    def test_self_stale_detection(self, tmp_path):
        """_check_self 更新 _last_self_check 时间戳"""
        state_dir = str(tmp_path / "state")
        logs_dir = str(tmp_path / "logs")
        os.makedirs(state_dir)
        os.makedirs(logs_dir)
        sv = Supervisor(state_dir, logs_dir)

        old = sv._last_self_check
        time.sleep(0.01)
        sv._check_self()
        assert sv._last_self_check > old
