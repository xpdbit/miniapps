# -*- coding: utf-8 -*-
"""state_manager.py 单元测试"""

import os
import pytest
from oce.core.state_manager import (
    TaskStatus, RoundStatus,
)


class TestStateManager:
    """状态管理器测试"""

    def test_create_task(self, state_manager):
        """创建任务后可以加载"""
        sm = state_manager
        task = sm.create_task("测试 prompt", "/fake/project", time_limit_minutes=60)
        assert task.task_id.startswith("dire_")
        assert task.prompt == "测试 prompt"
        assert task.status == TaskStatus.RUNNING.value
        assert task.time_limit_minutes == 60

        # 从磁盘重新加载
        loaded = sm.load_task(task.task_id)
        assert loaded is not None
        assert loaded.prompt == "测试 prompt"

    def test_task_lifecycle(self, state_manager):
        """完整生命周期：创建 → 执行两轮 → 完成"""
        sm = state_manager
        task = sm.create_task("优化代码", "/project", 120)

        # 第 1 轮
        task = sm.start_round(task.task_id, 1)
        assert task is not None
        assert task.current_round == 1

        task = sm.complete_round(
            task.task_id, 1,
            diff_raw="fake diff",
            files_changed=5, insertions=100, deletions=30
        )
        assert task is not None
        assert task.rounds[0].status == RoundStatus.COMPLETED.value
        assert task.rounds[0].files_changed == 5

        # 第 2 轮
        task = sm.start_round(task.task_id, 2)
        assert task.current_round == 2

        task = sm.complete_round(task.task_id, 2, files_changed=3)
        assert len(task.rounds) == 2

    def test_pause_resume(self, state_manager):
        """暂停和恢复"""
        sm = state_manager
        task = sm.create_task("test", "/p", 60)
        task = sm.complete_round(task.task_id, 1)

        # 暂停
        task = sm.pause_task(task.task_id)
        assert task.status == TaskStatus.PAUSED.value

        # 恢复 → 进入下一轮
        task = sm.resume_task(task.task_id)
        assert task.status == TaskStatus.RUNNING.value
        assert task.current_round == 2

    def test_stop_task(self, state_manager):
        """停止任务保留已完成轮次"""
        sm = state_manager
        task = sm.create_task("test", "/p", 60)
        task = sm.complete_round(task.task_id, 1, files_changed=10)
        task = sm.stop_task(task.task_id)
        assert task.status == TaskStatus.STOPPED.value
        assert len(task.rounds) == 1  # 已完成的轮次保留

    def test_fail_round(self, state_manager):
        """失败轮次增加计数器"""
        sm = state_manager
        task = sm.create_task("test", "/p", 60)
        task = sm.fail_round(task.task_id, 1, "timeout")
        assert task.consecutive_failures == 1

        task = sm.fail_round(task.task_id, 1, "network error")
        assert task.consecutive_failures == 2

    def test_auto_complete_on_timeout(self, state_manager):
        """耗时超过时间上限 → 自动完成"""
        sm = state_manager
        task = sm.create_task("test", "/p", 1)  # 1 分钟上限
        # 模拟已用 65 秒（超过 60 秒限制）
        task.elapsed_seconds = 65
        sm.save_task(task)

        task = sm.complete_round(task.task_id, 1)
        assert task.status == TaskStatus.COMPLETED.value

    def test_delete_task(self, state_manager):
        """删除任务后无法加载"""
        sm = state_manager
        task = sm.create_task("test", "/p", 60)
        sm.delete_task(task.task_id)
        assert sm.load_task(task.task_id) is None

    def test_list_tasks(self, state_manager):
        """列出所有任务"""
        sm = state_manager
        sm.create_task("task1", "/p1", 60)
        sm.create_task("task2", "/p2", 120)
        tasks = sm.list_tasks()
        assert len(tasks) == 2

    def test_recoverable_tasks(self, state_manager):
        """可恢复任务包含 running 和 paused"""
        sm = state_manager
        t1 = sm.create_task("running task", "/p1", 60)
        t2 = sm.create_task("paused task", "/p2", 60)
        sm.pause_task(t2.task_id)
        t3 = sm.create_task("stopped task", "/p3", 60)
        sm.stop_task(t3.task_id)

        recoverable = sm.get_recoverable_tasks()
        assert len(recoverable) == 2
        ids = [t.task_id for t in recoverable]
        assert t1.task_id in ids
        assert t2.task_id in ids
        assert t3.task_id not in ids

    def test_diff_file_saved(self, state_manager):
        """complete_round 保存 diff 文件"""
        sm = state_manager
        task = sm.create_task("test", "/p", 60)
        task = sm.complete_round(task.task_id, 1, diff_raw="test diff content\nline2")

        # 检查 diff 文件存在
        diff_path = os.path.join(
            sm.tasks_dir, task.task_id, "round_01.diff"
        )
        assert os.path.exists(diff_path)
        with open(diff_path) as f:
            assert f.read() == "test diff content\nline2"

    def test_backup_recovery(self, state_manager):
        """备份恢复：task.yaml 损坏时从 .bak 恢复"""
        sm = state_manager
        task = sm.create_task("original", "/p", 60)

        # 破坏主文件
        task_yaml = sm.tasks_dir / task.task_id / "task.yaml"
        bak_yaml = sm.tasks_dir / task.task_id / "task.yaml.bak"

        # 确保备份存在
        sm.save_task(task)
        assert bak_yaml.exists()

        # 写入损坏的主文件
        with open(task_yaml, 'w') as f:
            f.write("corrupted: :::: invalid yaml!!!")

        # 加载应通过备份恢复
        loaded = sm.load_task(task.task_id)
        assert loaded is not None
        assert loaded.prompt == "original"
