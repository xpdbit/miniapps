# -*- coding: utf-8 -*-
"""
file_manager.py — YAML 状态文件读写
管理 proposed_tasks.yaml / approved_queue.yaml / cycle_counter.txt / last_commit.txt
"""

import os
import yaml
from datetime import datetime
from typing import List, Dict, Any, Optional


class FileManager:
    """状态文件管理器"""

    def __init__(self, state_dir: str, logs_dir: str):
        self.state_dir = state_dir
        self.logs_dir = logs_dir
        os.makedirs(state_dir, exist_ok=True)
        os.makedirs(logs_dir, exist_ok=True)

    # ─── 提议任务 ──────────────────────────────

    def load_proposed(self) -> List[Dict[str, Any]]:
        """加载待审批提议列表"""
        path = os.path.join(self.state_dir, "proposed_tasks.yaml")
        if not os.path.isfile(path):
            return []
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or []
        except (yaml.YAMLError, OSError):
            return []
        return data if isinstance(data, list) else []

    def save_proposed(self, tasks: List[Dict[str, Any]]):
        """保存待审批提议列表"""
        path = os.path.join(self.state_dir, "proposed_tasks.yaml")
        with open(path, "w", encoding="utf-8") as f:
            yaml.dump(tasks, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

    # ─── 审批队列 ──────────────────────────────

    def load_approved(self) -> List[Dict[str, Any]]:
        """加载已批准工作队列"""
        path = os.path.join(self.state_dir, "approved_queue.yaml")
        if not os.path.isfile(path):
            return []
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or []
        except (yaml.YAMLError, OSError):
            return []
        return data if isinstance(data, list) else []

    def save_approved(self, tasks: List[Dict[str, Any]]):
        """保存已批准工作队列"""
        path = os.path.join(self.state_dir, "approved_queue.yaml")
        with open(path, "w", encoding="utf-8") as f:
            yaml.dump(tasks, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

    def approve_tasks(self, task_ids: List[int]):
        """将选定提议从 proposed 移至 approved（状态 pending）"""
        proposed = self.load_proposed()
        approved = self.load_approved()
        next_id = max([t.get("id", 0) for t in approved], default=0) + 1

        remaining = []
        for task in proposed:
            if task.get("id") in task_ids:
                task["status"] = "pending"
                task["id"] = next_id
                next_id += 1
                approved.append(task)
            else:
                remaining.append(task)

        self.save_proposed(remaining)
        self.save_approved(approved)

    # ─── 循环计数 ──────────────────────────────

    def load_cycle_count(self) -> int:
        path = os.path.join(self.state_dir, "cycle_counter.txt")
        if not os.path.isfile(path):
            return 0
        try:
            with open(path, "r") as f:
                return int(f.read().strip())
        except Exception:
            return 0

    def save_cycle_count(self, count: int):
        path = os.path.join(self.state_dir, "cycle_counter.txt")
        with open(path, "w") as f:
            f.write(str(count))

    def increment_cycle(self) -> int:
        count = self.load_cycle_count() + 1
        self.save_cycle_count(count)
        return count

    # ─── 上次提交 ──────────────────────────────

    def load_last_commit(self) -> str:
        path = os.path.join(self.state_dir, "last_commit.txt")
        if not os.path.isfile(path):
            return ""
        with open(path, "r") as f:
            return f.read().strip()

    def save_last_commit(self, commit_hash: str):
        path = os.path.join(self.state_dir, "last_commit.txt")
        with open(path, "w") as f:
            f.write(commit_hash)

    # ─── 历史记录 ──────────────────────────────

    def load_history(self) -> List[Dict[str, Any]]:
        """加载历史记录（已执行/已驳回的任务）"""
        path = os.path.join(self.state_dir, "history.yaml")
        if not os.path.isfile(path):
            return []
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or []
        except (yaml.YAMLError, OSError):
            return []
        return data if isinstance(data, list) else []

    def save_history(self, tasks: List[Dict[str, Any]]):
        """保存历史记录"""
        path = os.path.join(self.state_dir, "history.yaml")
        with open(path, "w", encoding="utf-8") as f:
            yaml.dump(tasks, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

    def record_to_history(self, task: Dict[str, Any], resolution: str):
        """将任务记录到历史（resolution: 'done'/'rejected'/'cancelled'/'failed'）"""
        history = self.load_history()
        record = dict(task)
        record["resolution"] = resolution
        record["resolved_at"] = datetime.now().isoformat()
        # 确保有唯一 id
        if "id" not in record:
            next_id = max([h.get("id", 0) for h in history], default=0) + 1
            record["id"] = next_id
        history.append(record)
        self.save_history(history)

    # ─── 日志 ──────────────────────────────────

    def write_log(self, level: str, message: str):
        """写入日志文件（按天汇总）"""
        date_str = datetime.now().strftime("%Y%m%d")
        time_str = datetime.now().strftime("%H:%M:%S")
        log_path = os.path.join(self.logs_dir, f"{date_str}.md")

        prefix = {"info": "-", "error": "!", "decision": ">", "approved": "[APPROVED]"}.get(level, "-")

        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"{prefix} {time_str} {message}\n")

    def read_logs(self, date_str: str = None) -> str:
        """读取指定日期日志"""
        if not date_str:
            date_str = datetime.now().strftime("%Y%m%d")
        log_path = os.path.join(self.logs_dir, f"{date_str}.md")
        if not os.path.isfile(log_path):
            return ""
        with open(log_path, "r", encoding="utf-8") as f:
            return f.read()
