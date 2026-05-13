# -*- coding: utf-8 -*-
"""
session_manager.py — 会话持久化与 Checkpoint 管理
支持断点续跑：定期保存 agent 进度，崩溃后可恢复继续执行。

用法:
    sm = SessionManager("E:\\.Code\\.miniapps\\state")
    session = sm.create(task_id=5, phase="execute", prompt="...")
    # ... agent 运行中 ...
    sm.checkpoint(session, output_lines, completed_actions=["ST1 文件已创建"])
    # 崩溃后恢复:
    residual = sm.detect_residual()
    for s in residual:
        if user_confirm(s):
            sm.resume(s)
    sm.cleanup(session.session_id)
"""

import json
import os
import threading
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional


# ─── 数据结构 ──────────────────────────────────

@dataclass
class SessionState:
    """单个 agent 执行会话的持久化状态"""
    session_id: str          # 唯一标识符
    task_id: int             # 关联的任务 ID
    phase: str               # "explore" | "execute" | "verify" | "finish"
    prompt: str              # 发送给 agent 的 prompt（截断存储，最大 5000 字）
    output_buffer: list[str] = field(default_factory=list)  # 已收集的输出行
    completed_actions: list[str] = field(default_factory=list)  # 已完成的子操作
    progress: float = 0.0    # 0.0 ~ 1.0 估计完成比例
    checkpoint_count: int = 0
    last_checkpoint: float = 0.0  # timestamp
    created_at: str = ""
    status: str = "running"  # "running" | "crashed" | "completed"

    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")


# ─── SessionManager ────────────────────────────

class SessionManager:
    """会话持久化管理器 — 线程安全"""

    _MAX_PROMPT_LENGTH: int = 5000
    _MAX_OUTPUT_BUFFER: int = 500   # 最多保留 500 行输出

    def __init__(self, state_dir: str, checkpoint_interval: int = 300):
        """
        Args:
            state_dir: 状态文件目录（SuperTask state/ 目录）
            checkpoint_interval: 自动 checkpoint 间隔（秒），默认 5 分钟
        """
        self.sessions_dir = os.path.join(state_dir, "sessions")
        self.checkpoint_interval = checkpoint_interval
        self._lock = threading.RLock()
        os.makedirs(self.sessions_dir, exist_ok=True)

    # ─── 公开 API ──────────────────────────────

    def create(self, task_id: int, phase: str, prompt: str) -> SessionState:
        """创建新会话记录"""
        session_id = f"task-{task_id}-{int(time.time())}"
        truncated_prompt = prompt[:self._MAX_PROMPT_LENGTH]
        session = SessionState(
            session_id=session_id,
            task_id=task_id,
            phase=phase,
            prompt=truncated_prompt,
        )
        self._save(session)
        return session

    def checkpoint(self, session: SessionState,
                   new_output: Optional[list[str]] = None,
                   completed_actions: Optional[list[str]] = None):
        """保存 checkpoint：更新输出缓冲和已完成操作列表。

        调用方在 agent 输出新行时传入 new_output，定期调用此方法持久化。
        """
        with self._lock:
            if new_output:
                session.output_buffer.extend(new_output)
                # 限制缓冲区大小
                if len(session.output_buffer) > self._MAX_OUTPUT_BUFFER:
                    session.output_buffer = session.output_buffer[-self._MAX_OUTPUT_BUFFER:]

            if completed_actions:
                for action in completed_actions:
                    if action not in session.completed_actions:
                        session.completed_actions.append(action)

            session.checkpoint_count += 1
            session.last_checkpoint = time.time()
            self._save(session)

    def load(self, task_id: int) -> Optional[SessionState]:
        """加载指定 task_id 的最新会话（用于恢复）"""
        with self._lock:
            sessions = self._list_sessions()
            # 找 task_id 匹配且 status=running 的最新会话
            candidates = [
                s for s in sessions
                if s.task_id == task_id and s.status in ("running", "crashed")
            ]
            if not candidates:
                return None
            # 返回最新的
            return max(candidates, key=lambda s: s.last_checkpoint)

    def can_resume(self, task_id: int) -> bool:
        """检查指定 task_id 是否有可恢复的会话"""
        return self.load(task_id) is not None

    def build_resume_context(self, session: SessionState) -> str:
        """构建恢复上下文 — 放在新 prompt 前面的前缀文本。

        告知 agent 上次执行到哪里了，避免重复已完成的工作。
        """
        actions_summary = "\n".join(
            f"  - {a}" for a in session.completed_actions
        ) if session.completed_actions else "  (无)"

        return (
            "⚠️ 任务恢复模式 — 从上次中断位置继续执行。\n\n"
            f"原始任务 ID: {session.task_id}\n"
            f"已完成步骤 ({len(session.completed_actions)} 项):\n"
            f"{actions_summary}\n\n"
            f"当前进度估计: ~{int(session.progress * 100)}%\n"
            f"上次 checkpoint: {session.checkpoint_count} 次（最近 {int(time.time() - session.last_checkpoint)}s 前）\n\n"
            "请从上次中断位置继续，不要重复已完成的工作。\n"
            "如果已完成的步骤覆盖了任务需求，直接标记为完成即可。\n"
        )

    def detect_residual(self) -> list[SessionState]:
        """扫描 state/sessions/ 目录，返回所有 status=running 的残留会话。

        这些是上次 SuperTask 崩溃或异常退出时留下的未完成会话。
        调用方应在 GUI 中展示这些会话供用户选择恢复/丢弃。
        """
        with self._lock:
            sessions = self._list_sessions()
            residual = [s for s in sessions if s.status in ("running", "crashed")]
            # 所有残留会话标记为 crashed（直到被恢复）
            for s in residual:
                if s.status != "crashed":
                    s.status = "crashed"
                    self._save(s)
            return residual

    def complete(self, session: SessionState):
        """标记会话为已完成"""
        with self._lock:
            session.status = "completed"
            self._save(session)

    def discard(self, session: SessionState):
        """丢弃会话 — 删除对应的 JSON 文件"""
        with self._lock:
            filepath = self._session_path(session.session_id)
            if os.path.isfile(filepath):
                os.remove(filepath)

    def cleanup(self, session_id: str):
        """清理指定会话的文件（快捷方法）"""
        with self._lock:
            filepath = self._session_path(session_id)
            if os.path.isfile(filepath):
                os.remove(filepath)

    def cleanup_all_completed(self):
        """清理所有已完成的会话文件"""
        with self._lock:
            sessions = self._list_sessions()
            for s in sessions:
                if s.status == "completed":
                    self.discard(s)

    def purge_old(self, max_sessions: int = 10):
        """删除超过 max_sessions 个的最旧会话（按 last_checkpoint）"""
        with self._lock:
            sessions = self._list_sessions()
            if len(sessions) <= max_sessions:
                return
            # 按 last_checkpoint 排序，删除最旧的
            sessions.sort(key=lambda s: s.last_checkpoint)
            to_remove = sessions[:len(sessions) - max_sessions]
            for s in to_remove:
                self.discard(s)

    def get_summary(self, session: SessionState) -> dict:
        """返回会话的可读摘要"""
        return {
            "session_id": session.session_id,
            "task_id": session.task_id,
            "phase": session.phase,
            "status": session.status,
            "completed_actions": len(session.completed_actions),
            "checkpoint_count": session.checkpoint_count,
            "progress": f"{int(session.progress * 100)}%",
            "last_checkpoint": datetime.fromtimestamp(
                session.last_checkpoint
            ).strftime("%H:%M:%S") if session.last_checkpoint > 0 else "N/A",
            "output_lines": len(session.output_buffer),
        }

    # ─── 内部方法 ──────────────────────────────

    def _session_path(self, session_id: str) -> str:
        """获取会话文件的完整路径"""
        return os.path.join(self.sessions_dir, f"{session_id}.json")

    def _save(self, session: SessionState):
        """将会话状态序列化到 JSON 文件"""
        filepath = self._session_path(session.session_id)
        data = asdict(session)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _load_one(self, filepath: str) -> Optional[SessionState]:
        """从 JSON 文件加载单个会话"""
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            return SessionState(**data)
        except (json.JSONDecodeError, TypeError, OSError):
            return None

    def _list_sessions(self) -> list[SessionState]:
        """列出所有会话（从 sessions 目录扫描 JSON 文件）"""
        sessions = []
        if not os.path.isdir(self.sessions_dir):
            return sessions
        for fname in os.listdir(self.sessions_dir):
            if not fname.endswith(".json"):
                continue
            filepath = os.path.join(self.sessions_dir, fname)
            session = self._load_one(filepath)
            if session:
                sessions.append(session)
        return sessions
