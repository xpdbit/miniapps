# -*- coding: utf-8 -*-
"""FileManager 单元测试"""

import os

import yaml
import pytest

from gui.core.file_manager import FileManager


class TestFileManagerLoadSave:
    """基础读写测试"""

    def test_load_proposed_empty(self, temp_state_dir, temp_logs_dir):
        """空目录返回空列表"""
        fm = FileManager(temp_state_dir, temp_logs_dir)
        result = fm.load_proposed()
        assert result == []

    def test_save_and_load_proposed(self, temp_state_dir, temp_logs_dir, sample_tasks):
        """保存后读取一致"""
        fm = FileManager(temp_state_dir, temp_logs_dir)
        fm.save_proposed(sample_tasks)
        result = fm.load_proposed()
        assert len(result) == 2
        assert result[0]["id"] == 1
        assert result[0]["description"] == "修复认证模块的类型错误"

    def test_load_corrupted_yaml(self, temp_state_dir, temp_logs_dir):
        """损坏的 YAML 文件返回空列表且不抛异常"""
        fm = FileManager(temp_state_dir, temp_logs_dir)
        path = os.path.join(temp_state_dir, "proposed_tasks.yaml")
        with open(path, "w", encoding="utf-8") as f:
            f.write("{{{invalid: yaml: [")
        result = fm.load_proposed()
        assert result == []

    def test_load_non_list_yaml(self, temp_state_dir, temp_logs_dir):
        """YAML 不是 list 格式时返回空列表"""
        fm = FileManager(temp_state_dir, temp_logs_dir)
        path = os.path.join(temp_state_dir, "proposed_tasks.yaml")
        with open(path, "w", encoding="utf-8") as f:
            yaml.dump({"key": "value"}, f)
        result = fm.load_proposed()
        assert result == []

    def test_save_and_load_approved(self, temp_state_dir, temp_logs_dir, sample_approved):
        fm = FileManager(temp_state_dir, temp_logs_dir)
        fm.save_approved(sample_approved)
        result = fm.load_approved()
        assert len(result) == 2
        assert result[1]["status"] == "done"

    def test_load_config_default(self, temp_state_dir, temp_logs_dir):
        """无配置文件时返回默认值"""
        fm = FileManager(temp_state_dir, temp_logs_dir)
        config = fm.load_config()
        assert "projects" in config
        assert "behavior" in config
        assert config["behavior"]["auto_push"] is False


class TestFileManagerApprove:
    """审批流程测试"""

    def test_approve_tasks(self, temp_state_dir, temp_logs_dir, sample_tasks):
        fm = FileManager(temp_state_dir, temp_logs_dir)
        fm.save_proposed(sample_tasks)
        fm.approve_tasks([1, 2])

        proposed = fm.load_proposed()
        approved = fm.load_approved()

        # 原提议列表应该空了
        assert len(proposed) == 0
        # 审批队列应有 2 个任务
        assert len(approved) == 2
        assert approved[0]["status"] == "pending"
        assert approved[1]["status"] == "pending"

    def test_approve_partial(self, temp_state_dir, temp_logs_dir, sample_tasks):
        fm = FileManager(temp_state_dir, temp_logs_dir)
        fm.save_proposed(sample_tasks)
        fm.approve_tasks([1])  # 仅批准第一个

        proposed = fm.load_proposed()
        approved = fm.load_approved()

        assert len(proposed) == 1
        assert proposed[0]["id"] == 2
        assert len(approved) == 1
        assert approved[0]["description"] == "修复认证模块的类型错误"


class TestFileManagerHistory:
    """历史记录测试"""

    def test_record_to_history(self, temp_state_dir, temp_logs_dir):
        fm = FileManager(temp_state_dir, temp_logs_dir)
        task = {"id": 1, "description": "已完成任务", "status": "done"}
        fm.record_to_history(task, "done")

        history = fm.load_history()
        assert len(history) == 1
        assert history[0]["resolution"] == "done"
        assert "resolved_at" in history[0]


class TestRemoveFromApproved:
    """remove_from_approved_and_revert_pending 原子移除测试"""

    def _setup_queues(self, fm):
        """准备工作队列：pending + running + done + error + 保留的 pending"""
        proposed = [
            {"id": 101, "description": "原有的提议任务A", "status": "proposed", "priority": "idea"},
            {"id": 102, "description": "原有的提议任务B", "status": "proposed", "priority": "fix P3"},
        ]
        fm.save_proposed(proposed)

        approved = [
            {"id": 1, "description": "pending任务", "status": "pending", "priority": "fix P3",
             "queued_at": "2026-05-14 10:00:00"},
            {"id": 2, "description": "running任务", "status": "running", "priority": "high",
             "queued_at": "2026-05-14 10:00:00", "started_at": "2026-05-14 10:05:00"},
            {"id": 3, "description": "done任务", "status": "done", "priority": "idea",
             "queued_at": "2026-05-14 10:00:00", "completed_at": "2026-05-14 11:00:00"},
            {"id": 4, "description": "error任务", "status": "error", "priority": "fix P2",
             "queued_at": "2026-05-14 10:00:00", "fail_count": 1},
            {"id": 5, "description": "保留的pending任务", "status": "pending", "priority": "fix P1",
             "queued_at": "2026-05-14 10:00:00"},
        ]
        fm.save_approved(approved)

    def test_remove_pending_and_running_to_proposed(self, temp_state_dir, temp_logs_dir):
        """pending 和 running 任务应移回提议列表"""
        fm = FileManager(temp_state_dir, temp_logs_dir)
        self._setup_queues(fm)

        result = fm.remove_from_approved_and_revert_pending([1, 2, 3, 4])
        assert result["moved_back"] == 2
        assert result["moved_history"] == 2

        proposed = fm.load_proposed()
        assert len(proposed) == 4  # 原有2 + pending移回 + running移回

        # 移回的 pending 任务
        reverted = [t for t in proposed if t["id"] == 1]
        assert len(reverted) == 1
        assert reverted[0]["status"] == "proposed"
        assert "queued_at" not in reverted[0]  # 执行状态字段应被清除
        assert "fail_count" not in reverted[0]

        # 移回的 running 任务
        reverted = [t for t in proposed if t["id"] == 2]
        assert len(reverted) == 1
        assert reverted[0]["status"] == "proposed"
        assert "started_at" not in reverted[0]  # 执行状态字段应被清除

    def test_remove_done_and_error_to_history(self, temp_state_dir, temp_logs_dir):
        """done 和 error 任务应移入历史记录"""
        fm = FileManager(temp_state_dir, temp_logs_dir)
        self._setup_queues(fm)

        fm.remove_from_approved_and_revert_pending([1, 2, 3, 4])

        history = fm.load_history()
        assert len(history) == 2

        done_records = [h for h in history if h["resolution"] == "done"]
        assert len(done_records) == 1
        assert done_records[0]["id"] == 3

        error_records = [h for h in history if h["resolution"] == "error"]
        assert len(error_records) == 1
        assert error_records[0]["id"] == 4

    def test_unselected_tasks_preserved(self, temp_state_dir, temp_logs_dir):
        """未选中的任务应保留在工作队列中"""
        fm = FileManager(temp_state_dir, temp_logs_dir)
        self._setup_queues(fm)

        fm.remove_from_approved_and_revert_pending([1, 2, 3, 4])

        approved = fm.load_approved()
        assert len(approved) == 1
        assert approved[0]["id"] == 5
        assert approved[0]["status"] == "pending"

    def test_round_trip_no_data_loss(self, temp_state_dir, temp_logs_dir):
        """save + reload 后数据应完整无丢失（验证 YAML 序列化安全）"""
        fm = FileManager(temp_state_dir, temp_logs_dir)
        self._setup_queues(fm)

        fm.remove_from_approved_and_revert_pending([1, 2, 3, 4])

        # 重新 load：验证所有数据完整
        proposed = fm.load_proposed()
        approved = fm.load_approved()
        history = fm.load_history()

        assert len(proposed) == 4
        assert len(approved) == 1
        assert len(history) == 2

        # 验证 priority 是纯字符串（不是枚举对象）
        for t in proposed:
            assert isinstance(t.get("priority"), str), \
                f"priority should be str, got {type(t.get('priority')).__name__}"
        for t in approved:
            assert isinstance(t.get("priority"), str), \
                f"priority should be str, got {type(t.get('priority')).__name__}"

        # save + reload 后数据不变
        fm.save_proposed(proposed)
        fm.save_approved(approved)
        fm.save_history(history)

        p2 = fm.load_proposed()
        a2 = fm.load_approved()
        h2 = fm.load_history()

        assert len(p2) == len(proposed)
        assert len(a2) == len(approved)
        assert len(h2) == len(history)

    def test_remove_empty_selection_noop(self, temp_state_dir, temp_logs_dir):
        """空选择列表不应修改任何数据"""
        fm = FileManager(temp_state_dir, temp_logs_dir)
        self._setup_queues(fm)

        result = fm.remove_from_approved_and_revert_pending([])
        assert result == {"moved_back": 0, "moved_history": 0}

        # 数据应完全不变
        assert len(fm.load_proposed()) == 2
        assert len(fm.load_approved()) == 5
        assert len(fm.load_history()) == 0

    def test_remove_nonexistent_ids_noop(self, temp_state_dir, temp_logs_dir):
        """不存在的 ID 不应影响任何数据"""
        fm = FileManager(temp_state_dir, temp_logs_dir)
        self._setup_queues(fm)

        result = fm.remove_from_approved_and_revert_pending([999, 888])
        assert result == {"moved_back": 0, "moved_history": 0}

        assert len(fm.load_proposed()) == 2
        assert len(fm.load_approved()) == 5
        assert len(fm.load_history()) == 0


class TestFileManagerSnapshot:
    """进度快照测试"""

    def test_save_and_list_snapshots(self, temp_state_dir, temp_logs_dir, sample_tasks):
        fm = FileManager(temp_state_dir, temp_logs_dir)
        fm.save_proposed(sample_tasks)

        ts = fm.save_snapshot(label="test")
        assert ts

        snapshots = fm.list_snapshots()
        assert len(snapshots) >= 1
        assert snapshots[0]["timestamp"] == ts
        assert snapshots[0]["label"] == "test"
        assert "proposed_tasks.yaml" in snapshots[0].get("files", [])

    def test_restore_snapshot(self, temp_state_dir, temp_logs_dir, sample_tasks):
        fm = FileManager(temp_state_dir, temp_logs_dir)
        fm.save_proposed(sample_tasks)

        ts = fm.save_snapshot(label="pre-change")

        # 修改数据
        fm.save_proposed([{"id": 99, "description": "修改后的数据", "status": "proposed"}])

        # 恢复
        success = fm.restore_snapshot(ts)
        assert success

        restored = fm.load_proposed()
        assert len(restored) == 2
        assert restored[0]["id"] == 1


class TestFileManagerDeepMerge:
    """深度合并测试"""

    def test_deep_merge_nested(self):
        base = {"a": {"b": 1, "c": 2}, "d": 3}
        override = {"a": {"b": 10}, "e": 4}
        result = FileManager._deep_merge(base, override)
        assert result["a"]["b"] == 10  # override
        assert result["a"]["c"] == 2   # preserved
        assert result["d"] == 3        # preserved
        assert result["e"] == 4        # new key
