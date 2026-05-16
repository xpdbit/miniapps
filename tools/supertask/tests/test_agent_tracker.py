# -*- coding: utf-8 -*-
"""AgentTracker 单元测试 — 测试结构化标记和正则解析"""

import time
import pytest

from gui.core.loop_manager import AgentTracker


class TestAgentTrackerStructuredEvents:
    """结构化事件标记解析测试"""

    def test_agent_start_structured(self, agent_tracker):
        """结构化标记: agent_start"""
        agent_tracker._global_model = "deepseek-v4"
        line = '[SUPERTASK:agent_start id=explore_001 type=explore preview="搜索认证模式"]'
        events = agent_tracker.feed_line(line)

        assert len(events) == 1
        assert events[0]["type"] == "agent_started"
        assert events[0]["id"] == "explore_001"
        assert events[0]["agent_type"] == "explore"

        # 验证 agent 状态
        status = agent_tracker.get_status()
        agents = status["agents"]
        assert len(agents) == 1
        assert agents[0]["id"] == "explore_001"
        assert agents[0]["type"] == "explore"
        assert agents[0]["status"] == "running"
        assert agents[0]["preview"] == "搜索认证模式"

    def test_agent_done_structured(self, agent_tracker):
        """结构化标记: agent_done"""
        agent_tracker._global_model = "deepseek-v4"

        # 先启动
        agent_tracker.feed_line(
            '[SUPERTASK:agent_start id=task_42 type=ultrabrain preview="分析代码"]'
        )
        # 再完成
        events = agent_tracker.feed_line(
            '[SUPERTASK:agent_done id=task_42]'
        )

        assert len(events) == 1
        assert events[0]["type"] == "agent_done"

        status = agent_tracker.get_status()
        assert status["agents"][0]["status"] == "done"

    def test_agent_error_structured(self, agent_tracker):
        """结构化标记: agent_error"""
        agent_tracker._global_model = "deepseek-v4"
        agent_tracker.feed_line(
            '[SUPERTASK:agent_start id=bad_task type=quick preview="快速任务"]'
        )
        events = agent_tracker.feed_line(
            '[SUPERTASK:agent_error id=bad_task]'
        )

        assert events[0]["type"] == "agent_error"
        status = agent_tracker.get_status()
        assert status["agents"][0]["status"] == "error"

    def test_structured_skips_unknown_type(self, agent_tracker):
        """结构化标记中未知的 agent 类型应被忽略"""
        agent_tracker._global_model = "deepseek-v4"
        events = agent_tracker.feed_line(
            '[SUPERTASK:agent_start id=test type=unknown_type preview="测试"]'
        )
        assert len(events) == 0  # 未知类型被忽略

    def test_structured_prevents_regex_duplicate(self, agent_tracker):
        """结构化标记匹配成功后跳过正则解析（避免重复计数）"""
        agent_tracker._global_model = "deepseek-v4"
        # 这一行同时包含结构化标记和 task() 调用
        line = (
            '[SUPERTASK:agent_start id=abc123 type=explore preview="搜索"] '
            'task(subagent_type="explore", description="搜索", run_in_background=true)'
        )
        events = agent_tracker.feed_line(line)
        # 应该只有 1 个事件（结构化优先，正则跳过）
        assert len(events) == 1
        assert events[0]["type"] == "agent_started"


class TestAgentTrackerRegexParsing:
    """正则解析回退测试（open code 原生格式）"""

    def test_task_call_with_subagent_type(self, agent_tracker):
        """正则匹配 task(subagent_type="explore") 调用"""
        agent_tracker._global_model = "deepseek-v4"
        line = 'task(subagent_type="explore", description="搜索代码", run_in_background=true)'
        events = agent_tracker.feed_line(line)

        assert len(events) == 1
        assert events[0]["type"] == "agent_started"
        assert events[0]["agent_type"] == "explore"

    def test_task_call_with_category(self, agent_tracker):
        """正则匹配 task(category="ultrabrain") 调用"""
        agent_tracker._global_model = "deepseek-v4"
        line = 'task(category="ultrabrain", description="深度分析", run_in_background=true)'
        events = agent_tracker.feed_line(line)

        assert len(events) == 1
        assert events[0]["agent_type"] == "ultrabrain"

    def test_task_with_task_id(self, agent_tracker):
        """正则提取 Task ID"""
        agent_tracker._global_model = "deepseek-v4"
        line = 'task(subagent_type="oracle", Task ID: oracle_001, description="咨询")'
        events = agent_tracker.feed_line(line)

        assert len(events) == 1
        assert "oracle_001" in agent_tracker.agents

    def test_bg_done_notification(self, agent_tracker):
        """正则匹配 [BACKGROUND TASK COMPLETED] 通知"""
        agent_tracker._global_model = "deepseek-v4"
        # 先注册 agent
        agent_tracker.feed_line(
            'task(subagent_type="explore", Task ID: expl_55, description="探索")'
        )
        # 完成通知
        line = '[BACKGROUND TASK COMPLETED] **ID:** `expl_55`'
        events = agent_tracker.feed_line(line)

        assert len(events) == 1
        assert events[0]["type"] == "agent_done"

    def test_bg_done_cross_line(self, agent_tracker):
        """跨行缓冲: [BACKGROUND TASK COMPLETED] 和 ID 在不同行"""
        agent_tracker._global_model = "deepseek-v4"
        agent_tracker.feed_line(
            'task(subagent_type="librarian", Task ID: lib_01, description="搜索文档")'
        )
        # 第一行: 完成标记
        agent_tracker.feed_line('[BACKGROUND TASK COMPLETED]')
        # 第二行: ID
        events = agent_tracker.feed_line('**ID:** `lib_01`')

        assert len(events) == 1
        assert events[0]["type"] == "agent_done"


class TestAgentTrackerModelDetection:
    """模型名称检测测试"""

    def test_banner_model_detection(self, agent_tracker):
        """从 opencode banner 检测模型名"""
        agent_tracker.feed_line('> Sisyphus (Ultraworker) · deepseek-v4-pro')
        assert agent_tracker._global_model == "deepseek-v4-pro"

    def test_powered_by_detection(self, agent_tracker):
        """从 'powered by' 文本检测模型名"""
        agent_tracker.feed_line('You are powered by the model named deepseek-v4-pro')
        assert agent_tracker._global_model == "deepseek-v4-pro"

    def test_model_backfill(self, agent_tracker):
        """模型检测后回填已注册的 agent"""
        agent_tracker.feed_line(
            'task(subagent_type="explore", description="搜索")'
        )
        # agent 创建时无 model
        status = agent_tracker.get_status()
        assert status["agents"][0]["model"] == ""

        # 模型检测后应回填
        agent_tracker.feed_line('> Sisyphus (Ultraworker) · deepseek-v4-pro')
        status = agent_tracker.get_status()
        assert status["agents"][0]["model"] == "deepseek-v4-pro"


class TestAgentTrackerPhaseManagement:
    """阶段管理测试"""

    def test_start_end_phase(self, agent_tracker):
        agent_tracker._global_model = "test-model"
        agent_tracker.start_phase("执行任务")
        agent_tracker.feed_line(
            'task(subagent_type="explore", description="搜索")'
        )
        agent_tracker.end_phase(True)

        status = agent_tracker.get_status()
        assert status["phase"] == "执行任务"
        assert status["phase_status"] == "done"
        assert status["agents"][0]["status"] == "done"

    def test_pause_resume_phase(self, agent_tracker):
        agent_tracker._global_model = "test-model"
        agent_tracker.start_phase("探索")
        agent_tracker.feed_line(
            'task(subagent_type="librarian", description="搜索文档")'
        )
        agent_tracker.pause_phase()

        status = agent_tracker.get_status()
        assert status["phase_status"] == "paused"
        assert status["agents"][0]["status"] == "paused"

        agent_tracker.resume_phase()
        status = agent_tracker.get_status()
        assert status["phase_status"] == "running"
        assert status["agents"][0]["status"] == "running"
