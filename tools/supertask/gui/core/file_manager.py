# -*- coding: utf-8 -*-
"""
file_manager.py — YAML 状态文件读写
管理 proposed_tasks.yaml / approved_queue.yaml / cycle_counter.txt / last_commit.txt
"""

import os
import threading
import yaml
from datetime import datetime
from typing import List, Dict, Any, Optional


class FileManager:
    """状态文件管理器（线程安全：内部使用 RLock）"""

    def __init__(self, state_dir: str, logs_dir: str):
        self.state_dir = state_dir
        self.logs_dir = logs_dir
        self._lock = threading.RLock()
        os.makedirs(state_dir, exist_ok=True)
        os.makedirs(logs_dir, exist_ok=True)

    # ─── 提议任务 ──────────────────────────────

    def load_proposed(self) -> List[Dict[str, Any]]:
        """加载待审批提议列表"""
        with self._lock:
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
        with self._lock:
            path = os.path.join(self.state_dir, "proposed_tasks.yaml")
            with open(path, "w", encoding="utf-8") as f:
                yaml.dump(tasks, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

    # ─── 审批队列 ──────────────────────────────

    def load_approved(self) -> List[Dict[str, Any]]:
        """加载已批准工作队列"""
        with self._lock:
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
        with self._lock:
            path = os.path.join(self.state_dir, "approved_queue.yaml")
            with open(path, "w", encoding="utf-8") as f:
                yaml.dump(tasks, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

    def approve_tasks(self, task_ids: List[int]):
        """将选定提议从 proposed 移至 approved（状态 pending）"""
        with self._lock:
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
        with self._lock:
            path = os.path.join(self.state_dir, "cycle_counter.txt")
            if not os.path.isfile(path):
                return 0
            try:
                with open(path, "r") as f:
                    return int(f.read().strip())
            except Exception:
                return 0

    def save_cycle_count(self, count: int):
        with self._lock:
            path = os.path.join(self.state_dir, "cycle_counter.txt")
            with open(path, "w") as f:
                f.write(str(count))

    def increment_cycle(self) -> int:
        with self._lock:
            count = self.load_cycle_count() + 1
            self.save_cycle_count(count)
            return count

    # ─── 上次提交 ──────────────────────────────

    def load_last_commit(self) -> str:
        with self._lock:
            path = os.path.join(self.state_dir, "last_commit.txt")
            if not os.path.isfile(path):
                return ""
            with open(path, "r") as f:
                return f.read().strip()

    def save_last_commit(self, commit_hash: str):
        with self._lock:
            path = os.path.join(self.state_dir, "last_commit.txt")
            with open(path, "w") as f:
                f.write(commit_hash)

    # ─── 历史记录 ──────────────────────────────

    def load_history(self) -> List[Dict[str, Any]]:
        """加载历史记录（已执行/已驳回的任务）"""
        with self._lock:
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
        with self._lock:
            path = os.path.join(self.state_dir, "history.yaml")
            with open(path, "w", encoding="utf-8") as f:
                yaml.dump(tasks, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

    def record_to_history(self, task: Dict[str, Any], resolution: str):
        """将任务记录到历史（resolution: 'done'/'rejected'/'cancelled'/'failed'）"""
        with self._lock:
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

    def delete_history_entries(self, task_ids: List[int]):
        """删除指定 ID 的历史记录"""
        with self._lock:
            history = self.load_history()
            history = [t for t in history if t.get("id") not in task_ids]
            self.save_history(history)

    def revert_to_proposed(self, task_ids: List[int]):
        """将指定 ID 的历史记录回归至待审批提议列表（移回 proposed_tasks.yaml）"""
        with self._lock:
            history = self.load_history()
            proposed = self.load_proposed()
            to_revert = []
            remaining = []
            for t in history:
                if t.get("id") in task_ids:
                    record = dict(t)
                    # 清除历史专用字段
                    record.pop("resolution", None)
                    record.pop("resolved_at", None)
                    record["status"] = "proposed"
                    to_revert.append(record)
                else:
                    remaining.append(t)

            if not to_revert:
                return

            # 为回归的提议分配新 ID（追加到现有提议之后）
            max_id = max([p.get("id", 0) for p in proposed], default=0)
            for t in to_revert:
                max_id += 1
                t["id"] = max_id

            proposed.extend(to_revert)
            self.save_proposed(proposed)
            self.save_history(remaining)

    # ─── 日志 ──────────────────────────────────

    def write_log(self, level: str, message: str):
        """写入日志文件（按天汇总）"""
        date_str = datetime.now().strftime("%Y%m%d")
        time_str = datetime.now().strftime("%H:%M:%S")
        log_path = os.path.join(self.logs_dir, f"{date_str}.md")

        entry = ""

        # Section separators for major events
        if level == "error":
            entry += "\n---\n\n"
        elif level == "approved":
            entry += "\n"

        prefix = {"info": "-", "error": "!", "decision": ">", "approved": "[APPROVED]"}.get(level, "-")

        # Truncate long messages to 150 chars
        max_len = 150
        if len(message) > max_len:
            truncated = message[:max_len] + "…"
            entry += f"{prefix} {time_str} {truncated}\n"
            entry += f"  {message}\n"  # full text on next line indented
        else:
            entry += f"{prefix} {time_str} {message}\n"

        with open(log_path, "a", encoding="utf-8") as f:
            f.write(entry)

    def read_logs(self, date_str: str = None) -> str:
        """读取指定日期日志"""
        if not date_str:
            date_str = datetime.now().strftime("%Y%m%d")
        log_path = os.path.join(self.logs_dir, f"{date_str}.md")
        if not os.path.isfile(log_path):
            return ""
        with open(log_path, "r", encoding="utf-8") as f:
            return f.read()

    # ─── Agent 日志 ──────────────────────────────

    def write_agent_log(self, phase_name: str, prompt: str, output: str, success: bool):
        """写入 terminal 日志文件（文件名格式 {date}_terminal.md，记录 agent 终端输入与输出）"""
        with self._lock:
            date_str = datetime.now().strftime("%Y%m%d")
            time_str = datetime.now().strftime("%H:%M:%S")
            log_path = os.path.join(self.logs_dir, f"{date_str}_terminal.md")

            status = "✓ 成功" if success else "✗ 失败"
            prompt_len = len(prompt)
            output_len = len(output) if output else 0
            line = (
                f"\n## {time_str} - {phase_name} [{status}]"
                f" (prompt: {prompt_len} chars, output: {output_len} chars)\n\n"
            )
            line += f"**Prompt:**\n```\n{prompt}\n```\n\n"
            if output:
                line += f"**Output:**\n```\n{output}\n```\n"
            else:
                line += "**Output:**\n*(无输出)*\n"
            line += "\n---\n"

            with open(log_path, "a", encoding="utf-8") as f:
                f.write(line)

    def read_agent_logs(self, date_str: str = None) -> str:
        """读取指定日期 terminal 日志"""
        with self._lock:
            if not date_str:
                date_str = datetime.now().strftime("%Y%m%d")
            log_path = os.path.join(self.logs_dir, f"{date_str}_terminal.md")
            if not os.path.isfile(log_path):
                return ""
            with open(log_path, "r", encoding="utf-8") as f:
                return f.read()

    def write_agent_status(self, status: dict):
        """写入 agent 状态快照（文件名格式 {date}_agent_status.md）"""
        with self._lock:
            date_str = datetime.now().strftime("%Y%m%d")
            time_str = datetime.now().strftime("%H:%M:%S")
            log_path = os.path.join(self.logs_dir, f"{date_str}_agent_status.md")

            phase = status.get("phase", "?")
            phase_status = status.get("phase_status", "idle")
            global_model = status.get("global_model", "")
            agents = status.get("agents", [])

            if not agents:
                model_part = f" [{global_model}]" if global_model else ""
                line = (
                    f"## {time_str} - 阶段: {phase} [{phase_status}]{model_part} (0 agents)\n"
                    f"\n---\n"
                )
            else:
                model_part = f" [{global_model}]" if global_model else ""
                line = (
                    f"## {time_str} - 阶段: {phase} [{phase_status}]{model_part}"
                    f" — {len(agents)} agents\n"
                    f"| ID | 类型 | 模型 | 状态 | 耗时 |\n"
                    f"|----|------|------|------|------|\n"
                )
                for a in agents:
                    aid = a.get("id", "?")
                    atype = a.get("type", "?")
                    amodel = a.get("model", "") or "-"
                    a_status = a.get("status", "?")
                    elapsed = a.get("elapsed", 0)
                    line += (
                        f"| {aid} | {atype} | {amodel} | {a_status} | {elapsed:.0f}s |\n"
                    )
                line += "\n---\n"

            with open(log_path, "a", encoding="utf-8") as f:
                f.write(line)

    # ─── 配置 ──────────────────────────────────

    DEFAULT_CONFIG = {
        "prompts": {
            "explore": "",
            "update_proposed": "",
            "execute": "",
        },
        "ui": {
            "theme": "dark",
        },
        "agent": {
            "timeout": 600,
        },
        "behavior": {
            "auto_push": False,
            "cycle_interval": 5,
            "max_retries": 2,
        },
    }

    def load_config(self) -> dict:
        """加载配置文件（state/config.yaml），不存在时返回默认值"""
        with self._lock:
            path = os.path.join(self.state_dir, "config.yaml")
            if not os.path.isfile(path):
                return dict(self.DEFAULT_CONFIG)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f) or {}
            except (yaml.YAMLError, OSError):
                return dict(self.DEFAULT_CONFIG)
            # 深度合并默认值，确保新增字段有默认值
            return self._deep_merge(dict(self.DEFAULT_CONFIG), data)

    def save_config(self, config: dict):
        """保存配置文件"""
        with self._lock:
            path = os.path.join(self.state_dir, "config.yaml")
            with open(path, "w", encoding="utf-8") as f:
                yaml.dump(config, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

    @staticmethod
    def _deep_merge(base: dict, override: dict) -> dict:
        """深度合并两个字典，override 的值覆盖 base"""
        result = dict(base)
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = FileManager._deep_merge(result[key], value)
            else:
                result[key] = value
        return result
