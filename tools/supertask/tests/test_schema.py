# -*- coding: utf-8 -*-
"""Schema 校验模块单元测试"""

import pytest
from gui.core.schema import (
    Task, HistoryRecord, AppConfig, ProjectConfig,
    validate_task_list, validate_history_list, validate_config,
)


class TestTaskValidation:
    """Task 模型校验测试"""

    def test_valid_task_minimal(self):
        """最小有效任务：仅 id + description"""
        task = Task(id=1, description="修复类型错误")
        assert task.id == 1
        assert task.status == "proposed"
        assert task.priority == "fix P3"

    def test_valid_task_full(self):
        """完整任务字段"""
        task = Task(
            id=5,
            description="添加数据导出功能",
            priority="idea",
            status="pending",
            proposed_at="2026-05-13 10:00:00",
            queued_at="2026-05-13 11:00:00",
        )
        assert task.id == 5
        assert task.status == "pending"

    def test_invalid_id_zero(self):
        """id 必须为正整数"""
        with pytest.raises(Exception):
            Task(id=0, description="无效任务")

    def test_invalid_id_negative(self):
        with pytest.raises(Exception):
            Task(id=-1, description="无效任务")

    def test_empty_description(self):
        """description 不能为空"""
        with pytest.raises(Exception):
            Task(id=1, description="")

    def test_invalid_status(self):
        """status 不在允许的集合中"""
        with pytest.raises(Exception):
            Task(id=1, description="测试", status="invalid_status")

    def test_invalid_priority(self):
        """priority 不在允许的集合中"""
        with pytest.raises(Exception):
            Task(id=1, description="测试", priority="urgent")

    def test_extra_fields_allowed(self):
        """model_config extra='allow' 允许未定义字段"""
        task = Task.model_validate({
            "id": 1,
            "description": "测试",
            "custom_field": "hello",
            "tags": ["bug"],
        })
        assert task.id == 1

    def test_negative_fail_count(self):
        """fail_count 不能为负数"""
        with pytest.raises(Exception):
            Task(id=1, description="测试", fail_count=-1)

    def test_all_valid_statuses(self):
        """所有有效 status 都应通过"""
        valid_statuses = ["proposed", "pending", "running", "done", "error", "failed_blocked", "cancelled"]
        for s in valid_statuses:
            task = Task(id=1, description="测试", status=s)
            assert task.status == s

    def test_all_valid_priorities(self):
        """所有有效 priority 都应通过"""
        valid_priorities = ["fix P0", "fix P1", "fix P2", "fix P3", "idea", "high"]
        for p in valid_priorities:
            task = Task(id=1, description="测试", priority=p)
            assert task.priority == p


class TestHistoryRecordValidation:
    """HistoryRecord 校验测试"""

    def test_valid_history(self):
        record = HistoryRecord(
            id=1,
            description="已完成的任务",
            resolution="done",
            resolved_at="2026-05-13 12:00:00",
        )
        assert record.resolution == "done"

    def test_invalid_resolution(self):
        with pytest.raises(Exception):
            HistoryRecord(id=1, description="测试", resolution="unknown")


class TestValidateTaskList:
    """批量校验函数测试"""

    def test_valid_list(self):
        data = [
            {"id": 1, "description": "任务1", "status": "proposed"},
            {"id": 2, "description": "任务2", "priority": "idea"},
        ]
        valid, errors = validate_task_list(data)
        assert len(valid) == 2
        assert len(errors) == 0

    def test_mixed_valid_invalid(self):
        """混合有效和无效条目 — 不丢失数据"""
        data = [
            {"id": 1, "description": "有效任务"},
            {"id": 0, "description": "无效 id"},  # id=0 无效
            "not_a_dict",
            {"id": 3, "description": "另一个有效任务"},
        ]
        valid, errors = validate_task_list(data)
        assert len(valid) == 2
        assert len(errors) == 2  # id=0 + not_a_dict


class TestConfigValidation:
    """配置文件校验测试"""

    def test_valid_config_minimal(self):
        config, errors = validate_config({})
        assert config is not None
        assert len(errors) == 0

    def test_valid_config_with_projects(self):
        data = {
            "projects": [
                {"name": "ftg", "label": "FTG", "source_dirs": ["apps/ftg/src"]},
            ]
        }
        config, errors = validate_config(data)
        assert config is not None
        assert len(config.projects) == 1
        assert config.projects[0].name == "ftg"

    def test_project_auto_label(self):
        """label 为空时自动使用 name"""
        data = {
            "projects": [
                {"name": "myapp"},
            ]
        }
        config, errors = validate_config(data)
        assert config is not None
        assert config.projects[0].label == "myapp"
