# -*- coding: utf-8 -*-
"""supervisor.py 单元测试"""

import os
import tempfile
import time
import pytest
from opencode_tui_plus.core.supervisor import Supervisor, AlertLevel, SupervisorAlert


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
