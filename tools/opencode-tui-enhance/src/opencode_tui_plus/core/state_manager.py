# -*- coding: utf-8 -*-
"""
state_manager.py — 状态持久化管理器

管理定向迭代任务和探索模式提议的 YAML 持久化。
支持任务的完整生命周期：创建、更新、查询、恢复。

目录结构：
  state/
  ├── config.yaml          ← 工具自身配置
  ├── proposals.yaml       ← 探索模式提议列表
  └── tasks/
      └── {task_id}/
          ├── task.yaml    ← 任务定义 + 状态
          └── round_N.diff ← 每轮 git diff
"""

from __future__ import annotations

import os
import shutil
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional

import yaml


# ─── 枚举 ──────────────────────────────────────

class TaskType(str, Enum):
    DIRECTED_ITERATION = "directed_iteration"
    EXPLORATION = "exploration"


class TaskStatus(str, Enum):
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    STOPPED = "stopped"
    FAILED = "failed"
    CORRUPTED = "corrupted"


class RoundStatus(str, Enum):
    COMPLETED = "completed"
    RUNNING = "running"
    INTERRUPTED = "interrupted"


# ─── 数据模型 ──────────────────────────────────

@dataclass
class RoundInfo:
    """单轮执行信息"""
    round: int
    status: str = "running"          # completed | running | interrupted
    started_at: str = ""
    ended_at: str = ""
    duration_seconds: float = 0.0
    diff_path: str = ""              # 相对于 task 目录的 diff 文件路径
    files_changed: int = 0
    insertions: int = 0
    deletions: int = 0
    error: str = ""


@dataclass
class TaskState:
    """任务完整状态"""
    task_id: str
    type: str = "directed_iteration"
    status: str = "running"
    project_root: str = ""
    prompt: str = ""
    time_limit_minutes: int = 120
    created_at: str = ""
    started_at: str = ""
    elapsed_seconds: float = 0.0
    consecutive_failures: int = 0
    current_round: int = 1
    rounds: list[RoundInfo] = field(default_factory=list)
    error: str = ""

    @property
    def is_active(self) -> bool:
        return self.status in (TaskStatus.RUNNING.value, TaskStatus.PAUSED.value)

    @property
    def is_terminal(self) -> bool:
        return self.status in (
            TaskStatus.COMPLETED.value,
            TaskStatus.STOPPED.value,
            TaskStatus.FAILED.value,
            TaskStatus.CORRUPTED.value,
        )

    @property
    def current_round_info(self) -> Optional[RoundInfo]:
        for r in self.rounds:
            if r.round == self.current_round:
                return r
        return None

    def to_dict(self) -> dict:
        """序列化为 YAML 兼容的字典"""
        return {
            "task_id": self.task_id,
            "type": self.type,
            "status": self.status,
            "project_root": self.project_root,
            "prompt": self.prompt,
            "time_limit_minutes": self.time_limit_minutes,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "elapsed_seconds": self.elapsed_seconds,
            "consecutive_failures": self.consecutive_failures,
            "current_round": self.current_round,
            "rounds": [
                {
                    "round": r.round,
                    "status": r.status,
                    "started_at": r.started_at,
                    "ended_at": r.ended_at,
                    "duration_seconds": r.duration_seconds,
                    "diff_path": r.diff_path,
                    "files_changed": r.files_changed,
                    "insertions": r.insertions,
                    "deletions": r.deletions,
                    "error": r.error,
                }
                for r in self.rounds
            ],
            "error": self.error,
        }

    @classmethod
    def from_dict(cls, data: dict) -> TaskState:
        """从 YAML 字典反序列化"""
        rounds = []
        for r in data.get("rounds", []):
            rounds.append(RoundInfo(
                round=r.get("round", 0),
                status=r.get("status", "running"),
                started_at=r.get("started_at", ""),
                ended_at=r.get("ended_at", ""),
                duration_seconds=r.get("duration_seconds", 0.0),
                diff_path=r.get("diff_path", ""),
                files_changed=r.get("files_changed", 0),
                insertions=r.get("insertions", 0),
                deletions=r.get("deletions", 0),
                error=r.get("error", ""),
            ))

        return cls(
            task_id=data.get("task_id", ""),
            type=data.get("type", "directed_iteration"),
            status=data.get("status", "running"),
            project_root=data.get("project_root", ""),
            prompt=data.get("prompt", ""),
            time_limit_minutes=data.get("time_limit_minutes", 120),
            created_at=data.get("created_at", ""),
            started_at=data.get("started_at", ""),
            elapsed_seconds=data.get("elapsed_seconds", 0.0),
            consecutive_failures=data.get("consecutive_failures", 0),
            current_round=data.get("current_round", 1),
            rounds=rounds,
            error=data.get("error", ""),
        )


# ─── 状态管理器 ──────────────────────────────

class StateManager:
    """状态持久化管理器

    用法:
        sm = StateManager("tools/opencode-tui-enhance/state")
        task = sm.create_task("优化代码", "E:/project", 120)
        sm.start_round(task.task_id, 1)
        sm.complete_round(task.task_id, 1, diff_raw="...")
        sm.save_task(task)
    """

    def __init__(self, state_dir: str):
        self._state_dir = Path(state_dir)
        self._tasks_dir = self._state_dir / "tasks"
        self._ensure_dirs()

    def _ensure_dirs(self):
        """确保必要的目录存在"""
        self._state_dir.mkdir(parents=True, exist_ok=True)
        self._tasks_dir.mkdir(parents=True, exist_ok=True)

    @property
    def tasks_dir(self) -> Path:
        return self._tasks_dir

    # ─── 任务 CRUD ──────────────────────────────

    def create_task(
        self,
        prompt: str,
        project_root: str,
        time_limit_minutes: int = 120,
        task_type: str = "directed_iteration",
    ) -> TaskState:
        """创建新任务

        Args:
            prompt: 任务提示词
            project_root: 项目根目录
            time_limit_minutes: 时间上限（分钟）
            task_type: 任务类型 (directed_iteration / exploration)

        Returns:
            新创建的 TaskState
        """
        now = datetime.now().isoformat()
        task_id = f"{task_type[:4]}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"

        task = TaskState(
            task_id=task_id,
            type=task_type,
            status=TaskStatus.RUNNING.value,
            project_root=str(project_root),
            prompt=prompt,
            time_limit_minutes=time_limit_minutes,
            created_at=now,
            started_at=now,
            elapsed_seconds=0.0,
            current_round=1,
        )

        self.save_task(task)
        return task

    def load_task(self, task_id: str) -> Optional[TaskState]:
        """加载单个任务"""
        task_yaml = self._tasks_dir / task_id / "task.yaml"
        return self._load_yaml(task_yaml)

    def save_task(self, task: TaskState):
        """保存任务状态到 YAML 文件"""
        task_dir = self._tasks_dir / task.task_id
        task_dir.mkdir(parents=True, exist_ok=True)
        task_yaml = task_dir / "task.yaml"

        # 写入前备份
        if task_yaml.exists():
            bak = task_dir / "task.yaml.bak"
            shutil.copy2(task_yaml, bak)

        data = task.to_dict()
        with open(task_yaml, 'w', encoding='utf-8') as f:
            yaml.safe_dump(data, f, allow_unicode=True, sort_keys=False, default_flow_style=False)

    def delete_task(self, task_id: str):
        """删除任务及其所有数据"""
        task_dir = self._tasks_dir / task_id
        if task_dir.exists():
            shutil.rmtree(task_dir)

    # ─── 任务查询 ──────────────────────────────

    def list_tasks(self, status_filter: Optional[str] = None) -> list[TaskState]:
        """列出所有任务，可按状态过滤

        Args:
            status_filter: 可选状态过滤 (running/paused/completed/stopped/failed)

        Returns:
            TaskState 列表
        """
        tasks: list[TaskState] = []
        if not self._tasks_dir.exists():
            return tasks

        for task_dir in self._tasks_dir.iterdir():
            if not task_dir.is_dir():
                continue
            task_yaml = task_dir / "task.yaml"
            task = self._load_yaml(task_yaml)
            if task is None:
                continue
            if status_filter and task.status != status_filter:
                continue
            tasks.append(task)

        # 按创建时间倒序
        tasks.sort(key=lambda t: t.created_at, reverse=True)
        return tasks

    def get_active_tasks(self) -> list[TaskState]:
        """获取所有活跃（运行中或暂停）的任务"""
        return self.list_tasks()  # 返回所有，调用方自己过滤 is_active

    def get_recoverable_tasks(self) -> list[TaskState]:
        """获取需要恢复的任务（running 或 paused 状态）"""
        tasks = self.list_tasks()
        return [t for t in tasks if t.is_active]

    # ─── 轮次操作 ──────────────────────────────

    def start_round(self, task_id: str, round_num: int) -> Optional[TaskState]:
        """标记新一轮开始

        Args:
            task_id: 任务 ID
            round_num: 轮次号

        Returns:
            更新后的 TaskState，若任务不存在则返回 None
        """
        task = self.load_task(task_id)
        if task is None:
            return None

        now = datetime.now().isoformat()
        task.current_round = round_num
        task.status = TaskStatus.RUNNING.value

        # 查找或创建本轮 RoundInfo
        existing = None
        for r in task.rounds:
            if r.round == round_num:
                existing = r
                break

        if existing:
            existing.status = RoundStatus.RUNNING.value
            existing.started_at = now
            existing.ended_at = ""
            existing.duration_seconds = 0.0
            existing.error = ""
        else:
            task.rounds.append(RoundInfo(
                round=round_num,
                status=RoundStatus.RUNNING.value,
                started_at=now,
            ))

        self.save_task(task)
        return task

    def complete_round(
        self,
        task_id: str,
        round_num: int,
        diff_raw: str = "",
        files_changed: int = 0,
        insertions: int = 0,
        deletions: int = 0,
    ) -> Optional[TaskState]:
        """标记一轮完成，保存 diff

        Args:
            task_id: 任务 ID
            round_num: 轮次号
            diff_raw: 原始 git diff 内容
            files_changed: 修改文件数
            insertions: 新增行数
            deletions: 删除行数

        Returns:
            更新后的 TaskState
        """
        task = self.load_task(task_id)
        if task is None:
            return None

        now = datetime.now().isoformat()

        # 更新轮次信息
        round_info = None
        for r in task.rounds:
            if r.round == round_num:
                round_info = r
                break

        if round_info is None:
            round_info = RoundInfo(round=round_num)
            task.rounds.append(round_info)

        # 计算耗时
        if round_info.started_at:
            try:
                start = datetime.fromisoformat(round_info.started_at)
                round_info.duration_seconds = (datetime.now() - start).total_seconds()
            except (ValueError, TypeError):
                pass

        round_info.status = RoundStatus.COMPLETED.value
        round_info.ended_at = now
        round_info.files_changed = files_changed
        round_info.insertions = insertions
        round_info.deletions = deletions

        # 保存 diff 到文件
        if diff_raw:
            diff_filename = f"round_{round_num:02d}.diff"
            round_info.diff_path = diff_filename
            task_dir = self._tasks_dir / task_id
            task_dir.mkdir(parents=True, exist_ok=True)
            diff_path = task_dir / diff_filename
            with open(diff_path, 'w', encoding='utf-8') as f:
                f.write(diff_raw)

        # 更新累计耗时
        self._recalc_elapsed(task)

        # 检查是否超时
        if task.elapsed_seconds >= task.time_limit_minutes * 60:
            task.status = TaskStatus.COMPLETED.value

        # 重置连续失败计数
        task.consecutive_failures = 0

        self.save_task(task)
        return task

    def fail_round(self, task_id: str, round_num: int, error: str) -> Optional[TaskState]:
        """标记一轮失败

        Args:
            task_id: 任务 ID
            round_num: 轮次号
            error: 错误信息

        Returns:
            更新后的 TaskState
        """
        task = self.load_task(task_id)
        if task is None:
            return None

        task.consecutive_failures += 1

        # 更新轮次
        round_info = None
        for r in task.rounds:
            if r.round == round_num:
                round_info = r
                break
        if round_info:
            round_info.status = RoundStatus.INTERRUPTED.value
            round_info.error = error
            round_info.ended_at = datetime.now().isoformat()

        self._recalc_elapsed(task)
        self.save_task(task)
        return task

    def pause_task(self, task_id: str) -> Optional[TaskState]:
        """暂停任务"""
        task = self.load_task(task_id)
        if task is None:
            return None
        task.status = TaskStatus.PAUSED.value
        self._recalc_elapsed(task)
        self.save_task(task)
        return task

    def resume_task(self, task_id: str) -> Optional[TaskState]:
        """恢复暂停的任务"""
        task = self.load_task(task_id)
        if task is None:
            return None
        task.status = TaskStatus.RUNNING.value
        # 从上次中断的轮次继续
        current = task.current_round_info
        if current and current.status == RoundStatus.INTERRUPTED.value:
            # 重新开始当前轮
            current.status = RoundStatus.RUNNING.value
            current.started_at = datetime.now().isoformat()
            current.error = ""
        elif current and current.status == RoundStatus.COMPLETED.value:
            # 进入下一轮
            task.current_round += 1
        self.save_task(task)
        return task

    def stop_task(self, task_id: str) -> Optional[TaskState]:
        """停止任务（保留已完成轮次）"""
        task = self.load_task(task_id)
        if task is None:
            return None
        task.status = TaskStatus.STOPPED.value
        self._recalc_elapsed(task)
        self.save_task(task)
        return task

    # ─── 辅助方法 ──────────────────────────────

    def _recalc_elapsed(self, task: TaskState):
        """重新计算累计耗时（基于已完成轮次）"""
        total = 0.0
        for r in task.rounds:
            if r.status == RoundStatus.COMPLETED.value and r.duration_seconds > 0:
                total += r.duration_seconds
        task.elapsed_seconds = total

    def _load_yaml(self, path: Path) -> Optional[TaskState]:
        """从 YAML 文件加载任务状态（含损坏恢复）"""
        if not path.exists():
            return None

        # 尝试加载主文件
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
            if data and isinstance(data, dict):
                return TaskState.from_dict(data)
        except (yaml.YAMLError, OSError):
            pass

        # 尝试备份恢复
        bak_path = path.with_suffix(".yaml.bak") if path.suffix == ".yaml" else path.with_name(path.stem + ".yaml.bak")
        if bak_path.exists():
            try:
                with open(bak_path, 'r', encoding='utf-8') as f:
                    data = yaml.safe_load(f)
                if data and isinstance(data, dict):
                    task = TaskState.from_dict(data)
                    self.save_task(task)  # 写回主文件
                    return task
            except (yaml.YAMLError, OSError):
                pass

        # 都失败 → 标记为损坏
        task_id = path.parent.name
        return TaskState(
            task_id=task_id,
            status=TaskStatus.CORRUPTED.value,
            error=f"无法恢复: {path}",
        )

    # ─── 提议管理（探索模式） ──────────────────

    def load_proposals(self) -> list[dict]:
        """加载探索模式提议列表"""
        proposals_yaml = self._state_dir / "proposals.yaml"
        if not proposals_yaml.exists():
            return []
        try:
            with open(proposals_yaml, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
            if isinstance(data, list):
                return data
        except (yaml.YAMLError, OSError):
            pass
        return []

    def save_proposals(self, proposals: list[dict]):
        """保存提议列表"""
        proposals_yaml = self._state_dir / "proposals.yaml"
        with open(proposals_yaml, 'w', encoding='utf-8') as f:
            yaml.safe_dump(proposals, f, allow_unicode=True, sort_keys=False)

    # ─── 配置管理 ──────────────────────────────

    def load_config(self) -> dict:
        """加载工具配置"""
        config_yaml = self._state_dir / "config.yaml"
        if not config_yaml.exists():
            return self._default_config()
        try:
            with open(config_yaml, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
            if isinstance(data, dict):
                return data
        except (yaml.YAMLError, OSError):
            pass
        return self._default_config()

    def save_config(self, config: dict):
        """保存工具配置"""
        config_yaml = self._state_dir / "config.yaml"
        with open(config_yaml, 'w', encoding='utf-8') as f:
            yaml.safe_dump(config, f, allow_unicode=True, sort_keys=False)

    @staticmethod
    def _default_config() -> dict:
        """默认配置"""
        return {
            "models": {
                "default_model": "deepseek/deepseek-v4-pro",
                "stage_model": {
                    "exploration": "deepseek/deepseek-chat",
                    "proposal_generation": "deepseek/deepseek-chat",
                    "proposal_evaluation": "deepseek/deepseek-v4-pro",
                    "code_execution": "deepseek/deepseek-v4-pro",
                    "diff_summary": "deepseek/deepseek-chat",
                    "documentation": "deepseek/deepseek-v3-0324",
                    "supervisor": "deepseek/deepseek-chat",
                },
            },
            "agent": {
                "timeout": 1800,
                "max_concurrent": 1,
                "consecutive_failure_limit": 2,
            },
            "automation": {
                "default_time_limit_minutes": 120,
                "cycle_interval_seconds": 5,
                "use_worktree": False,
                "auto_commit": False,
            },
            "logs": {
                "level": "INFO",
                "retention_days": 30,
            },
        }
