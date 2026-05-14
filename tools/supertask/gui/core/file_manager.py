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

from .schema import (
    Task, HistoryRecord, AppConfig,
    validate_task_list, validate_history_list, validate_config,
)


def _now_iso() -> str:
    """返回当前时间的 ISO 格式字符串"""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _is_valid_time(value: str) -> bool:
    """检查时间字符串是否有效（排除 0000-00-00 等无效值）"""
    if not value or not isinstance(value, str):
        return False
    if value.startswith("0000-") or value.startswith("0001-"):
        return False
    return True


class FileManager:
    """状态文件管理器（线程安全：内部使用 RLock）"""

    def __init__(self, state_dir: str, logs_dir: str):
        self.state_dir = state_dir
        self.logs_dir = logs_dir
        self._lock = threading.RLock()
        # 写操作计数器：用于追踪数据丢失事件
        self._write_safety_enabled: bool = True
        self._last_snapshot_ts: str = ""
        os.makedirs(state_dir, exist_ok=True)
        os.makedirs(logs_dir, exist_ok=True)

    def _log_schema_error(self, message: str):
        """将 schema 校验错误写入系统日志"""
        import sys
        print(f"[SuperTask Schema] {message}", file=sys.stderr)
        self.write_log("error", f"Schema 校验: {message}")

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
        """保存待审批提议列表，为缺少 proposed_at 的项补充时间戳。

        注意：此方法不阻止空列表写入，因为批准全部任务后 proposed 列表合法变空。
        数据丢失防护由 ProposalMerger（探索阶段）和 _phase_update_proposed（更新阶段）负责。
        """
        with self._lock:
            for t in tasks:
                if not t.get("proposed_at"):
                    t["proposed_at"] = _now_iso()
            path = os.path.join(self.state_dir, "proposed_tasks.yaml")
            self._atomic_write_yaml(path, tasks)

    def _load_proposed_raw(self) -> list:
        """加载 proposed_tasks.yaml 的原始内容（不做任何处理），用于写前对比"""
        path = os.path.join(self.state_dir, "proposed_tasks.yaml")
        if not os.path.isfile(path):
            return []
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
        except (yaml.YAMLError, OSError):
            return []
        return data if isinstance(data, list) else []

    def _atomic_write_yaml(self, path: str, data):
        """原子写入 YAML 文件：先写临时文件，再原子替换，防止写入中断导致文件损坏"""
        tmp_path = path + ".tmp"
        try:
            with open(tmp_path, "w", encoding="utf-8") as f:
                yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
            os.replace(tmp_path, path)
        except OSError as e:
            self._log_schema_error(f"写入 {os.path.basename(path)} 失败: {e}")
            raise

    # ─── 审批队列 ──────────────────────────────

    def load_approved(self) -> List[Dict[str, Any]]:
        """加载已批准工作队列（带 schema 校验）"""
        with self._lock:
            path = os.path.join(self.state_dir, "approved_queue.yaml")
            if not os.path.isfile(path):
                return []
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f) or []
            except (yaml.YAMLError, OSError):
                return []
            if not isinstance(data, list):
                return []
            valid_tasks, errors = validate_task_list(data, "approved_queue.yaml")
            for err in errors:
                self._log_schema_error(err)
            result: List[Dict[str, Any]] = [t.model_dump(mode="json") for t in valid_tasks]
            valid_ids = {t.id for t in valid_tasks}
            for item in data:
                if isinstance(item, dict) and item.get("id") not in valid_ids:
                    result.append(item)
            return result

    def save_approved(self, tasks: List[Dict[str, Any]]):
        """保存已批准工作队列。

        安全保护：如果之前数据非空而新数据为空，自动创建快照后保存（不拒绝，
        因为 approved_queue 清空可能是合法操作——所有任务执行完毕后自然变空）。
        但会记录警告日志，便于追踪数据丢失事件。
        """
        with self._lock:
            # ── 数据丢失告警：非空 → 空的转换记录到日志 ──
            if self._write_safety_enabled:
                prev = self._load_list_raw("approved_queue.yaml")
                if prev and len(prev) > 0 and len(tasks) == 0:
                    # 自动创建快照，防止意外丢失
                    try:
                        snap_ts = self.save_snapshot(label=f"auto-before-clear-approved-{len(prev)}items")
                        self._last_snapshot_ts = snap_ts
                    except Exception:
                        pass
                    msg = (
                        f"【数据丢失告警】approved_queue.yaml 从 {len(prev)} 条任务变为空。"
                        f"如果这不是预期行为，可从快照恢复。"
                    )
                    self._log_schema_error(msg)
                    self.write_log("warning", msg)

            path = os.path.join(self.state_dir, "approved_queue.yaml")
            self._atomic_write_yaml(path, tasks)

    def _load_list_raw(self, filename: str) -> list:
        """加载任意 YAML 列表文件的原始内容"""
        path = os.path.join(self.state_dir, filename)
        if not os.path.isfile(path):
            return []
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
        except (yaml.YAMLError, OSError):
            return []
        return data if isinstance(data, list) else []

    def approve_tasks(self, task_ids: List[int]):
        """将选定提议从 proposed 移至 approved（状态 pending），并记录 queued_at"""
        with self._lock:
            proposed = self.load_proposed()
            approved = self.load_approved()
            next_id = max([t.get("id", 0) for t in approved], default=0) + 1

            now = _now_iso()
            remaining = []
            for task in proposed:
                if task.get("id") in task_ids:
                    task["status"] = "pending"
                    task["id"] = next_id
                    task["queued_at"] = now
                    # 保留原始 proposed_at
                    if not task.get("proposed_at"):
                        task["proposed_at"] = now
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
        """加载历史记录（带 schema 校验）"""
        with self._lock:
            path = os.path.join(self.state_dir, "history.yaml")
            if not os.path.isfile(path):
                return []
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f) or []
            except (yaml.YAMLError, OSError):
                return []
            if not isinstance(data, list):
                return []
            valid_records, errors = validate_history_list(data, "history.yaml")
            for err in errors:
                self._log_schema_error(err)
            result: List[Dict[str, Any]] = [r.model_dump(mode="json") for r in valid_records]
            valid_ids = {r.id for r in valid_records}
            for item in data:
                if isinstance(item, dict) and item.get("id") not in valid_ids:
                    result.append(item)
            return result

    def save_history(self, tasks: List[Dict[str, Any]]):
        """保存历史记录。

        安全保护：如果之前数据非空而新数据为空，拒绝保存并记录错误。
        历史记录只增不减（除非用户主动清空历史）。
        """
        with self._lock:
            # ── 数据丢失防护：拒绝用空列表覆盖非空历史 ──
            if self._write_safety_enabled:
                prev = self._load_list_raw("history.yaml")
                if prev and len(prev) > 0 and len(tasks) == 0:
                    msg = (
                        f"【数据丢失防护】拒绝将 history.yaml 从 {len(prev)} 条记录覆盖为空列表。"
                        f"如果确实需要清空历史，请通过 UI 的「清空历史」按钮操作。"
                    )
                    self._log_schema_error(msg)
                    self.write_log("error", msg)
                    return  # 拒绝保存，保留原有数据

            path = os.path.join(self.state_dir, "history.yaml")
            self._atomic_write_yaml(path, tasks)

    def record_to_history(self, task: Dict[str, Any], resolution: str):
        """将任务记录到历史（resolution: 'done'/'rejected'/'cancelled'/'failed'），自动设置时间戳"""
        with self._lock:
            history = self.load_history()
            record = dict(task)
            record["resolution"] = resolution
            now = _now_iso()
            record["resolved_at"] = now

            # 根据 resolution 类型设置具体时间字段
            if resolution in ("done", "error", "failed_blocked"):
                record["completed_at"] = now
                # 保留原始 proposed_at 和 queued_at
            elif resolution in ("cancelled", "rejected"):
                record["deleted_at"] = now

            # 确保有唯一 id
            if "id" not in record:
                next_id = max([h.get("id", 0) for h in history], default=0) + 1
                record["id"] = next_id
            history.append(record)
            self.save_history(history)

    def delete_history_entries(self, task_ids: List[int]):
        """删除指定 ID 的历史记录。

        使用 save_history_force 绕过空列表保护：用户主动通过 UI 操作删除历史，
        全删是合法行为，不应被安全守卫拦截。
        """
        with self._lock:
            history = self.load_history()
            history = [t for t in history if t.get("id") not in task_ids]
            # 用户主动删除历史，使用 force 版本允许清空
            self.save_history_force(history)

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
            # 全回归时可能产生空列表 — 用户主动操作，使用 force 版本
            self.save_history_force(remaining)

    def remove_from_approved_and_revert_pending(self, task_ids: List[int]) -> dict:
        """从工作队列移除选中任务（原子操作）。
        未开始/中途(pending/running) → 移回提议，已完成(done/error/failed) → 移入历史。

        在整个操作期间持有 RLock，确保 approved_queue 与 proposed_tasks 的一致性。
        避免在 app.py 中分别 load/save 带来的竞态条件。

        Returns:
            {"moved_back": int, "moved_history": int}
        """
        with self._lock:
            approved = self.load_approved()
            removed = [t for t in approved if t.get("id") in task_ids]
            approved = [t for t in approved if t.get("id") not in task_ids]
            self.save_approved(approved)

            proposed = self.load_proposed()
            moved_back = 0
            moved_history = 0

            for t in removed:
                status = t.get("status", "pending")
                if status in ("pending", "running"):
                    # 未开始/中途的任务 → 移回提议列表
                    revert_task = dict(t)
                    revert_task["status"] = "proposed"
                    revert_task.pop("queued_at", None)
                    revert_task.pop("started_at", None)
                    revert_task.pop("fail_count", None)
                    proposed.append(revert_task)
                    moved_back += 1
                elif status in ("done", "error", "failed_blocked"):
                    # 已完成/失败的任务 → 移入历史（record_to_history 内部使用 RLock，可重入）
                    self.record_to_history(t, status)
                    moved_history += 1
                else:
                    # 其他状态（如 cancelled） → 移入历史
                    self.record_to_history(t, "cancelled")
                    moved_history += 1

            self.save_proposed(proposed)
            return {"moved_back": moved_back, "moved_history": moved_history}

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
            # 提示词模板目录（相对于 state_dir），留空使用内置默认值
            "dir": "prompts",
        },
        "ui": {
            "theme": "dark",
        },
        "agent": {
            "timeout": 1200,
            # 可选：指定默认 AI 模型（未指定分阶段模型时的回退值）
            "model": "",
            # 分阶段模型：探索 / 执行 / 检查 / 推送 各自指定独立模型
            "model_explore": "",
            "model_execute": "",
            "model_verify": "",
            "model_push": "",
            "model_evaluate": "",
        },
        "behavior": {
            "auto_push": False,
            "cycle_interval": 5,
            "max_retries": 2,
            # Token 预算上限（0 表示不限制）
            "max_tokens_per_cycle": 0,
            # 持续探索目标：当待审批任务达到此数量时停止自动探索
            "proposed_target_count": 200,
        },
        # 项目列表 — 每个项目包含 name, label, source_dirs
        "projects": [
            {
                "name": "ftg",
                "label": "FTG 食物主题生成器",
                "source_dirs": [
                    "apps/ftg-miniapp/src/",
                    "servers/ftg-server/src/",
                ],
            },
            {
                "name": "game1",
                "label": "Game1 挂机放置游戏",
                "source_dirs": [
                    "apps/game1-miniapp/src/",
                    "servers/game1-server/src/",
                ],
            },
            {
                "name": "tavern",
                "label": "AI-Tavern 角色聊天",
                "source_dirs": [
                    "apps/tavern-miniapp/src/",
                    "servers/tavern-server/src/",
                ],
            },
        ],
    }

    def load_config(self) -> dict:
        """加载配置文件（state/config.yaml），不存在时返回默认值。带 schema 校验。"""
        with self._lock:
            path = os.path.join(self.state_dir, "config.yaml")
            if not os.path.isfile(path):
                return dict(self.DEFAULT_CONFIG)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f) or {}
            except (yaml.YAMLError, OSError):
                return dict(self.DEFAULT_CONFIG)
            if not isinstance(data, dict):
                self._log_schema_error("config.yaml 不是字典格式，使用默认配置")
                return dict(self.DEFAULT_CONFIG)
            # Schema 校验
            merged = self._deep_merge(dict(self.DEFAULT_CONFIG), data)
            _, errors = validate_config(merged, "config.yaml")
            for err in errors:
                self._log_schema_error(err)
            return merged

    def save_config(self, config: dict):
        """保存配置文件（原子写入）"""
        with self._lock:
            path = os.path.join(self.state_dir, "config.yaml")
            tmp_path = path + ".tmp"
            try:
                with open(tmp_path, "w", encoding="utf-8") as f:
                    yaml.dump(config, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
                os.replace(tmp_path, path)
            except OSError as e:
                self._log_schema_error(f"写入 config.yaml 失败: {e}")
                raise

    def save_history_force(self, tasks: List[Dict[str, Any]]):
        """强制保存历史记录（绕过数据丢失防护）。

        仅在用户主动通过 UI 操作（如「清空历史」按钮）时使用。
        """
        with self._lock:
            path = os.path.join(self.state_dir, "history.yaml")
            self._atomic_write_yaml(path, tasks)

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

    # ─── 进度快照 ──────────────────────────────

    def save_snapshot(self, label: str = "") -> str:
        """保存当前状态快照到 state/snapshots/<timestamp>/ 目录。

        Args:
            label: 可选标签（如 'auto' 或 'pre-task-5'）

        Returns:
            快照目录名（时间戳格式）
        """
        with self._lock:
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            snap_dir = os.path.join(self.state_dir, "snapshots", ts)
            os.makedirs(snap_dir, exist_ok=True)

            # 复制所有状态文件
            manifest: dict = {
                "timestamp": ts,
                "label": label,
                "files": [],
            }

            state_files = [
                "proposed_tasks.yaml",
                "approved_queue.yaml",
                "history.yaml",
                "config.yaml",
                "cycle_counter.txt",
                "last_commit.txt",
            ]

            import shutil
            for fname in state_files:
                src = os.path.join(self.state_dir, fname)
                dst = os.path.join(snap_dir, fname)
                if os.path.isfile(src):
                    shutil.copy2(src, dst)
                    manifest["files"].append(fname)

            # 写入 manifest
            manifest_path = os.path.join(snap_dir, "manifest.yaml")
            with open(manifest_path, "w", encoding="utf-8") as f:
                yaml.dump(manifest, f, allow_unicode=True)

            return ts

    def list_snapshots(self) -> list[dict]:
        """列出所有可用快照，按时间倒序。

        Returns:
            [{"timestamp": "20260513_221500", "label": "auto", "files": [...]}, ...]
        """
        snap_base = os.path.join(self.state_dir, "snapshots")
        if not os.path.isdir(snap_base):
            return []

        results = []
        for entry in sorted(os.listdir(snap_base), reverse=True):
            snap_dir = os.path.join(snap_base, entry)
            manifest_path = os.path.join(snap_dir, "manifest.yaml")
            if os.path.isfile(manifest_path):
                try:
                    with open(manifest_path, "r", encoding="utf-8") as f:
                        manifest = yaml.safe_load(f) or {}
                    if isinstance(manifest, dict):
                        manifest["timestamp"] = entry
                        results.append(manifest)
                except Exception:
                    pass  # 损坏的 manifest 跳过

        return results

    def restore_snapshot(self, timestamp: str) -> bool:
        """从指定快照恢复所有状态文件。覆盖当前状态！

        Args:
            timestamp: 快照目录名（如 '20260513_221500'）

        Returns:
            是否成功
        """
        with self._lock:
            snap_dir = os.path.join(self.state_dir, "snapshots", timestamp)
            if not os.path.isdir(snap_dir):
                return False

            manifest_path = os.path.join(snap_dir, "manifest.yaml")
            if not os.path.isfile(manifest_path):
                return False

            try:
                import shutil
                with open(manifest_path, "r", encoding="utf-8") as f:
                    manifest = yaml.safe_load(f) or {}

                files = manifest.get("files", []) if isinstance(manifest, dict) else []
                for fname in files:
                    src = os.path.join(snap_dir, fname)
                    dst = os.path.join(self.state_dir, fname)
                    if os.path.isfile(src):
                        shutil.copy2(src, dst)

                return True
            except Exception:
                return False

    def cleanup_snapshots(self, keep: int = 20):
        """清理旧快照，仅保留最近 keep 个。

        Args:
            keep: 保留的快照数量
        """
        snapshots = self.list_snapshots()
        to_delete = snapshots[keep:]
        for snap in to_delete:
            ts = snap.get("timestamp", "")
            if ts:
                snap_dir = os.path.join(self.state_dir, "snapshots", ts)
                try:
                    import shutil
                    shutil.rmtree(snap_dir)
                except Exception:
                    pass
