# -*- coding: utf-8 -*-
"""测试共享夹具和工具函数"""

import os
import sys
import tempfile
from pathlib import Path

import pytest
import yaml

# 确保源码目录在 Python 路径中
src_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)


@pytest.fixture
def temp_state_dir():
    """创建临时状态目录，测试结束后自动清理"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def temp_logs_dir():
    """创建临时日志目录"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def sample_tasks():
    """返回一组有效的任务 dict"""
    return [
        {
            "id": 1,
            "description": "修复认证模块的类型错误",
            "priority": "fix P3",
            "status": "proposed",
        },
        {
            "id": 2,
            "description": "添加数据导出功能",
            "priority": "idea",
            "status": "proposed",
        },
    ]


@pytest.fixture
def sample_approved():
    """返回一组已批准的任务 dict"""
    return [
        {
            "id": 1,
            "description": "修复认证模块的类型错误",
            "priority": "fix P3",
            "status": "pending",
            "queued_at": "2026-05-13 10:00:00",
        },
        {
            "id": 2,
            "description": "添加数据导出功能",
            "priority": "idea",
            "status": "done",
            "completed_at": "2026-05-13 11:00:00",
        },
    ]


@pytest.fixture
def agent_tracker():
    """返回一个干净的 AgentTracker 实例"""
    from gui.core.loop_manager import AgentTracker
    return AgentTracker()
