# -*- coding: utf-8 -*-
"""
loop_manager.py — 主循环调度 (PyQt6 QThread)
阶段: 执行批准任务 → 更新待审批 → 探索与提议 → 收尾
"""

import os
import re
import subprocess
import sys
import threading
import time
import yaml
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from PyQt6.QtCore import QThread, pyqtSignal

from .file_manager import FileManager
from .opencode_runner import OpencodeRunner
from .prompt_manager import PromptManager
from .worktree_manager import WorktreeManager
from .session_manager import SessionManager, SessionState
from .prompt_orchestrator import PromptOrchestrator
from .event_driven import create_event_system, WebhookServer, CronScheduler


# ─── Agent 状态追踪数据结构 ──────────────────

@dataclass
class AgentState:
    """单个 agent/sub-agent 的运行时状态"""
    agent_id: str
    agent_type: str           # explore, librarian, oracle, hephaestus, etc.
    model: str = ""           # 模型名称（如 deepseek-v4-pro）
    parent_id: str = ""       # 父 agent ID（用于层级追踪）
    status: str = "running"   # running | done | error | paused
    start_time: float = 0.0
    end_time: float = 0.0
    preview: str = ""         # 输出的第一行预览


class AgentTracker:
    """解析 opencode 输出文本，实时追踪 agent/sub-agent 活动。
    
    支持两级解析：
    1. 结构化标记 [SUPERTASK:event ...] — 高精度，由 prompt 引导 agent 输出
    2. 正则匹配 opencode 原生格式 — 回退方案，兼容未启用结构化标记的旧 prompt
    """

    # ─── 结构化事件标记（优先级高于正则） ───
    # 格式: [SUPERTASK:agent_start id=xxx type=xxx preview="xxx"]
    _STRUCTURED_EVENT_RE = re.compile(
        r'\[SUPERTASK:(agent_start|agent_done|agent_error)\s+([^\]]+)\]'
    )
    # 解析 key=value 或 key="value" 对
    _KV_RE = re.compile(r'(\w+)=(?:"([^"]*)"|(\S+))')

    # task() 调用的已知类别（降低假阳性）
    _KNOWN_CATEGORIES = frozenset({
        # subagent_type (旧版)
        "explore", "librarian", "oracle", "hephaestus", "metis", "momus",
        # category (新版)
        "visual-engineering", "artistry", "ultrabrain", "deep", "quick",
        "unspecified-low", "unspecified-high", "writing",
    })

    # 匹配 task(subagent_type="X", ...) 调用（旧版语法）
    _TASK_RE = re.compile(r'task\(subagent_type\s*=\s*["\'](\w+)["\']')
    # 匹配 task(category="X", ...) 调用（新版语法）
    _CATEGORY_TASK_RE = re.compile(r'task\(category\s*=\s*["\']([^"\']+)["\']')
    # 匹配 Task ID / task_id 提取（仅匹配单词字符+连字符，避免包含尾随逗号）
    _TASK_ID_RE = re.compile(r'(?:Task ID|task_id)[:\s]*`?([\w-]+)`?')
    # 匹配后台任务完成通知（跨行缓冲：先捕获 [BACKGROUND TASK COMPLETED]，再在后续行中匹配 ID）
    _BG_DONE_RE = re.compile(r'\[BACKGROUND TASK COMPLETED\]')
    _BG_ID_RE = re.compile(r'\*\*ID:\*\*\s*`(\S+)`')
    # 匹配 agent 错误/失败
    _ERROR_RE = re.compile(r'\[BACKGROUND TASK (?:ERROR|FAILED)\]')
    # ANSI 转义序列（去除 stdout 中的颜色码）
    _ANSI_RE = re.compile(r'\x1b\[[0-9;]*[a-zA-Z]')
    # task() description 提取（用于 preview 列）
    _DESC_RE = re.compile(r'description\s*=\s*["\']([^"\']+)["\']')
    # 匹配 opencode banner 中的模型名称："> Sisyphus (Ultraworker) · model-name"
    _BANNER_MODEL_RE = re.compile(r'>\s+\w+\s+\([^)]+\)\s*·\s*(\S+)')
    # 回退：匹配模型名称（opencode 输出 "powered by the model named X"）
    _MODEL_RE = re.compile(r'powered by the model named\s+(\S+)')
    # 回退：匹配模型 ID（"The exact model ID is opencode-go/deepseek-v4-flash"）
    _MODEL_ID_RE = re.compile(r'model ID is\s+(\S+)')
    # 匹配 opencode banner 中的 agent 名称（用于识别主编排器类型）
    # 格式: "> Sisyphus (Ultraworker) · model-name" 或 "> Sisyphus Pro · model-name"
    _BANNER_AGENT_RE = re.compile(r'>\s+([\w][\w\s-]*?)(?:\s*\([^)]*\))?\s*·\s*\S+')
    # 更宽松的模型名匹配（模型名中可能包含 / 或 -）
    _MODEL_FLEX_RE = re.compile(r'(?:powered by|using)\s+(?:the\s+)?(?:model\s+)?(?:named\s+)?(\S[\S]*)')
    # 匹配 "The exact model ID is X" (无 "opencode-go/" 前缀变体)
    _EXACT_MODEL_ID_RE = re.compile(r'(?:exact|precise)\s+model\s+id(?:entifier)?\s+is\s+(\S+)', re.IGNORECASE)
    # 从 task() 调用的 model 参数提取显式模型
    _TASK_MODEL_RE = re.compile(r"""model\s*=\s*["']([^"']+)["']""")

    @staticmethod
    def _strip_ansi(text: str) -> str:
        """去除 ANSI 转义序列（颜色码、光标控制等）"""
        if not text:
            return text
        return AgentTracker._ANSI_RE.sub('', text)

    @staticmethod
    def _clean_model_name(name: str) -> str:
        """清理提取出的模型名称，去除包装引号/反引号、尾随标点和残余 ANSI"""
        if not name:
            return ""
        # 先去 ANSI 残余，再去包装字符和标点
        clean = AgentTracker._ANSI_RE.sub('', name)
        return clean.strip('`\'" \t.,;:!?')

    def _parse_structured_events(self, clean_line: str) -> list[dict]:
        """解析结构化事件标记 [SUPERTASK:event key=value ...]

        支持的标记格式:
          [SUPERTASK:agent_start id=xxx type=explore preview="任务描述"]
          [SUPERTASK:agent_done id=xxx]
          [SUPERTASK:agent_error id=xxx]

        Returns: 事件列表（与 feed_line 返回值格式兼容）
        """
        events = []
        for m in self._STRUCTURED_EVENT_RE.finditer(clean_line):
            event_type = m.group(1)  # agent_start / agent_done / agent_error
            payload = m.group(2)     # key=value 对

            # 解析 key=value 对
            props: dict[str, str] = {}
            for kv in self._KV_RE.finditer(payload):
                key = kv.group(1)
                value = kv.group(2) if kv.group(2) is not None else kv.group(3)
                props[key] = value

            agent_id = props.get("id", "")
            if not agent_id:
                continue

            if event_type == "agent_start":
                agent_type = props.get("type", "unknown")
                if agent_type not in self._KNOWN_CATEGORIES:
                    continue  # 未知类型，忽略
                if agent_id not in self.agents:
                    preview = props.get("preview", "")
                    self.agents[agent_id] = AgentState(
                        agent_id=agent_id,
                        agent_type=agent_type,
                        model=self._global_model,
                        status="running",
                        start_time=time.time(),
                        preview=preview,
                    )
                    events.append({"type": "agent_started", "id": agent_id, "agent_type": agent_type})

            elif event_type == "agent_done":
                if agent_id in self.agents:
                    self.agents[agent_id].status = "done"
                    self.agents[agent_id].end_time = time.time()
                    events.append({"type": "agent_done", "id": agent_id})

            elif event_type == "agent_error":
                if agent_id in self.agents:
                    self.agents[agent_id].status = "error"
                    self.agents[agent_id].end_time = time.time()
                    events.append({"type": "agent_error", "id": agent_id})

        return events

    def __init__(self):
        self.agents: dict[str, AgentState] = {}
        self.active_phase: str = ""
        self.phase_status: str = "idle"   # idle | running | paused | done | error
        self.phase_start: float = 0.0
        self._global_model: str = ""      # 从 opencode 输出解析的全局模型名
        self._main_agent_type: str = ""
        self._pending_bg_done: bool = False  # 跨行缓冲：上一行检测到 [BACKGROUND TASK COMPLETED]
        self._pending_bg_error: bool = False  # 跨行缓冲：上一行检测到 [BACKGROUND TASK ERROR/FAILED]
        self._paused_at: float = 0.0      # 暂停发生的时间戳

    def start_phase(self, phase_name: str, clear: bool = True):
        """标记新阶段开始。clear=False 时不清空 agent 列表（用于同一阶段的连续任务）"""
        self.active_phase = phase_name
        self.phase_status = "running"
        self.phase_start = time.time()
        if clear:
            self.agents.clear()
        self._pending_bg_done = False
        self._pending_bg_error = False

    def end_phase(self, success: bool):
        """标记阶段结束，自动将所有 running agent 标记为 done"""
        self.phase_status = "done" if success else "error"
        now = time.time()
        for a in self.agents.values():
            if a.status == "running":
                a.status = "done" if success else "error"
                a.end_time = now
        self._pending_bg_done = False
        self._pending_bg_error = False

    def pause_phase(self):
        """标记当前阶段已暂停（Agent 进程被挂起）。
        将所有 running 状态的 agent 标记为 paused。"""
        if self.phase_status == "running":
            self.phase_status = "paused"
            self._paused_at = time.time()
            for a in self.agents.values():
                if a.status == "running":
                    a.status = "paused"
                    a.end_time = time.time()  # 记录暂停时间点
        self._pending_bg_done = False
        self._pending_bg_error = False

    def resume_phase(self):
        """恢复已暂停的阶段（Agent 进程被恢复）。
        将所有 paused 状态的 agent 重新标记为 running。"""
        if self.phase_status == "paused":
            self.phase_status = "running"
            self._paused_at = 0.0
            for a in self.agents.values():
                if a.status == "paused":
                    a.status = "running"
                    a.start_time = time.time()  # 重置起始时间（继续计时）
                    a.end_time = 0            # 清除暂停时间点，避免负耗时

    def feed_line(self, line: str) -> list[dict]:
        """解析一行输出文本，返回检测到的事件列表。
        每个事件 dict: {"type": "agent_started"|"agent_done"|"agent_error", ...}

        优先级：结构化标记 [SUPERTASK:*] > 正则匹配 opencode 原生格式
        """
        events: list[dict] = []

        # 先去除 ANSI 转义码（stdout 管道原始输出含颜色码）
        clean_line = self._strip_ansi(line)

        # ── 结构化事件标记（优先级最高） ──
        structured_events = self._parse_structured_events(clean_line)
        if structured_events:
            events.extend(structured_events)
            # 结构化标记成功后，跳过正则解析（避免重复计数）
            return events

        # ── 主编排器类型检测 ──
        if not self._main_agent_type:
            m = self._BANNER_AGENT_RE.search(clean_line)
            if m:
                agent_name = m.group(1).strip()
                # 规范化名称 (移除多余空格，统一大小写)
                self._main_agent_type = ' '.join(agent_name.split())

        # ── 模型名称检测（三级回退） ──
        # 1. opencode banner 格式: "> Sisyphus (Ultraworker) · model-name"
        if not self._global_model:
            m = self._BANNER_MODEL_RE.search(clean_line)
            if m:
                new_model = self._clean_model_name(m.group(1))
                if new_model:
                    self._global_model = new_model
                    self._backfill_agent_models()

        # 2. "powered by the model named X"
        if not self._global_model:
            m = self._MODEL_RE.search(clean_line)
            if m:
                new_model = self._clean_model_name(m.group(1))
                if new_model:
                    self._global_model = new_model
                    self._backfill_agent_models()

        # 3. "model ID is X"
        if not self._global_model:
            m = self._MODEL_ID_RE.search(clean_line)
            if m:
                new_model = self._clean_model_name(m.group(1))
                if new_model:
                    self._global_model = new_model
                    self._backfill_agent_models()

        # 3.5. "exact model id is X" (case insensitive)
        if not self._global_model:
            m = self._EXACT_MODEL_ID_RE.search(clean_line)
            if m:
                new_model = self._clean_model_name(m.group(1))
                if new_model:
                    self._global_model = new_model
                    self._backfill_agent_models()

        # 3.6. 更柔性的模型匹配
        if not self._global_model:
            m = self._MODEL_FLEX_RE.search(clean_line)
            if m:
                candidate = self._clean_model_name(m.group(1))
                # 过滤掉太通用的匹配 (至少包含字母和数字/特殊字符)
                if candidate and len(candidate) > 3 and any(c.isalpha() for c in candidate):
                    self._global_model = candidate
                    self._backfill_agent_models()

        # 检测 task() 调用 — agent 启动
        m = self._TASK_RE.search(line)
        if not m:
            m = self._CATEGORY_TASK_RE.search(line)
        if m:
            agent_type = m.group(1)
            # 降低假阳性：仅对已知类别创建 agent 记录
            if agent_type in self._KNOWN_CATEGORIES:
                tid_match = self._TASK_ID_RE.search(line)
                agent_id = tid_match.group(1) if tid_match else f"agent_{len(self.agents) + 1}"
                if agent_id not in self.agents:
                    # 从 task() 调用行提取 description 作为 preview
                    desc_match = self._DESC_RE.search(line)
                    preview = desc_match.group(1) if desc_match else ""
                    # 提取 task() 调用中显式指定的 model 参数
                    model_match = self._TASK_MODEL_RE.search(line)
                    agent_model = model_match.group(1) if model_match else self._global_model
                    self.agents[agent_id] = AgentState(
                        agent_id=agent_id,
                        agent_type=agent_type,
                        model=agent_model,
                        status="running",
                        start_time=time.time(),
                        preview=preview,
                    )
                    events.append({"type": "agent_started", "id": agent_id, "agent_type": agent_type})

        # 检测后台任务完成通知（跨行缓冲）
        if self._BG_DONE_RE.search(line):
            self._pending_bg_done = True
            # 同一行也可能包含 ID
            tid_match = self._BG_ID_RE.search(line)
            if tid_match:
                matched = self._find_agent(tid_match.group(1))
                if matched:
                    self.agents[matched].status = "done"
                    self.agents[matched].end_time = time.time()
                    events.append({"type": "agent_done", "id": matched})
                    self._pending_bg_done = False
        elif self._pending_bg_done:
            # 上一行检测到完成通知，尝试在本行匹配 ID
            tid_match = self._BG_ID_RE.search(line)
            if tid_match:
                matched = self._find_agent(tid_match.group(1))
                if matched:
                    self.agents[matched].status = "done"
                    self.agents[matched].end_time = time.time()
                    events.append({"type": "agent_done", "id": matched})
            # 清除缓冲（最多等待一行）
            self._pending_bg_done = False

        # 检测后台任务错误（跨行缓冲，与完成检测逻辑一致）
        if self._ERROR_RE.search(line):
            self._pending_bg_error = True
            # 同一行也可能包含 ID
            tid_match = self._BG_ID_RE.search(line)
            if tid_match:
                matched = self._find_agent(tid_match.group(1))
                if matched:
                    self.agents[matched].status = "error"
                    self.agents[matched].end_time = time.time()
                    events.append({"type": "agent_error", "id": matched})
                    self._pending_bg_error = False
        elif self._pending_bg_error:
            # 上一行检测到错误通知，尝试在本行匹配 ID
            tid_match = self._BG_ID_RE.search(line)
            if tid_match:
                matched = self._find_agent(tid_match.group(1))
                if matched:
                    self.agents[matched].status = "error"
                    self.agents[matched].end_time = time.time()
                    events.append({"type": "agent_error", "id": matched})
            # 清除缓冲（最多等待一行）
            self._pending_bg_error = False

        return events

    def _backfill_agent_models(self):
        """将当前 _global_model 回填到所有 model 为空的已有 agent"""
        if not self._global_model:
            return
        for a in self.agents.values():
            if not a.model:
                a.model = self._global_model

    def _find_agent(self, partial_id: str) -> str:
        """通过部分 ID 匹配已追踪的 agent（open code 输出中 ID 可能有前缀变化）"""
        if partial_id in self.agents:
            return partial_id
        for aid in self.agents:
            if aid.endswith(partial_id) or partial_id.endswith(aid):
                return aid
        return ""

    def status_key(self) -> tuple:
        """Return hashable key for change detection (excludes elapsed time)"""
        agents_key = tuple(
            sorted(
                (a.agent_id, a.agent_type, a.status)
                for a in self.agents.values()
            )
        )
        return (self.active_phase, self.phase_status, self._global_model, self._main_agent_type, agents_key)

    def get_status(self) -> dict:
        """返回当前完整状态快照，供 UI 渲染"""
        now = time.time()
        return {
            "phase": self.active_phase,
            "phase_status": self.phase_status,
            "phase_elapsed": now - self.phase_start if self.phase_start > 0 else 0,
            "global_model": self._global_model,
            "main_agent_type": self._main_agent_type,
            "agents": [
                {
                    "id": a.agent_id,
                    "type": a.agent_type,
                    "model": a.model,
                    "status": a.status,
                    "elapsed": (a.end_time or now) - a.start_time,
                    "parent_id": a.parent_id,
                    "preview": a.preview,
                }
                for a in self.agents.values()
            ],
        }


class LoopSignals(QThread):
    """循环信号容器 — 提供 log / agent_output / state_changed / terminal_output / agent_status 信号"""
    log_received = pyqtSignal(str, str)    # level, message
    agent_output = pyqtSignal(str)          # text
    state_changed = pyqtSignal()            # UI refresh
    terminal_output = pyqtSignal(str)        # terminal display text（线程安全）
    agent_status_changed = pyqtSignal(dict)  # AgentTracker.get_status() 状态快照


class LoopManager(QThread):
    """主循环调度器 — QThread 版本"""

    # Ultraworker 完成信号 — agent 输出此信号后 runner 自动 kill 进程
    COMPLETION_SIGNAL = "===TASK_DONE==="

    def __init__(self, working_dir: str, state_dir: str, logs_dir: str,
                 parent=None):
        super().__init__(parent)
        self.working_dir = working_dir
        self.fm = FileManager(state_dir, logs_dir)
        self.runner = OpencodeRunner(working_dir)
        self._terminal = None  # 可选：终端面板引用
        self._tracker = AgentTracker()  # Agent 状态追踪器
        self.signals = LoopSignals()

        # 提示词管理器（模板目录为 state/prompts/）
        prompts_dir = os.path.join(state_dir, "prompts")
        self._prompt_manager = PromptManager(prompts_dir)

        # Worktree 隔离管理器（惰性初始化，首次 use_worktree=true 时创建）
        self._worktree_manager: Optional[WorktreeManager] = None
        self._config_use_worktree: bool = False

        # 会话持久化管理器
        self._session_manager = SessionManager(state_dir)
        self._config_checkpoint_interval: int = 300  # 默认 5 分钟

        # 动态 Prompt 组装引擎
        self._prompt_orchestrator = PromptOrchestrator(working_dir)
        self._config_use_orchestrator: bool = False

        # 事件驱动系统（惰性初始化）
        self._webhook_server: Optional[WebhookServer] = None
        self._cron_scheduler = CronScheduler()

    # ─── 日志辅助 ──────────────────────────────────

    def _log_event(self, level: str, message: str):
        """事件系统专用日志回调"""
        self._log(level, message)

        self._paused = False
        self._cycle_count = 0       # 总轮次计数
        self._work_done_this_cycle = False  # 本周期是否有实际工作
        self._manual_running: set[str] = set()  # 手动触发防重入
        self._manual_lock = threading.Lock()    # _manual_running 的线程安全锁

    # ─── 控制 ──────────────────────────────────

    def start(self):
        """启动循环 + 事件驱动系统"""
        if self.isRunning():
            return
        self._paused = False
        super().start()
        self._start_event_system()
        self._log("info", "循环已启动")

    def stop(self):
        """停止循环 + 事件驱动系统"""
        self.requestInterruption()
        self.runner.kill()
        self._stop_event_system()
        self._log("info", "循环已停止")

    def _start_event_system(self):
        """启动 webhook + cron 调度器"""
        config = self.fm.load_config()
        behavior_cfg = config.get("behavior", {})
        webhook_cfg = behavior_cfg.get("webhook", {})

        if webhook_cfg.get("enabled", False):
            self._webhook_server, _ = create_event_system(
                webhook_config=webhook_cfg,
                log_callback=self._log_event,
                on_webhook_trigger=self._on_event_trigger,
            )
            if self._webhook_server:
                self._webhook_server.start()

        cron_cfg = behavior_cfg.get("cron", {})
        if cron_cfg.get("enabled", False):
            for job in cron_cfg.get("jobs", []):
                if isinstance(job, dict):
                    self._cron_scheduler.add_job(
                        cron_expr=job.get("schedule", "0 2 * * *"),
                        action=job.get("action", "auto_cycle"),
                        project=job.get("project", "all"),
                    )
            self._cron_scheduler.set_on_trigger(self._on_event_trigger)
            self._cron_scheduler.start()

    def _stop_event_system(self):
        """停止 webhook + cron 调度器"""
        if self._webhook_server:
            self._webhook_server.stop()
        self._cron_scheduler.stop()

    def _on_event_trigger(self, action: str, project: str = "all"):
        """事件触发回调：分发到对应的 LoopManager 方法"""
        self._log("decision", f"事件触发: action={action}, project={project}")
        if action == "explore":
            self.trigger_explore(project if project != "all" else None)  # type: ignore[arg-type]
        elif action == "execute":
            self.trigger_execute()
        elif action == "auto_cycle":
            self.trigger_explore(project if project != "all" else None)  # type: ignore[arg-type]
            time.sleep(2)
            self.trigger_execute()
        elif action == "verify":
            self.trigger_verify_deliverables()

    def pause(self):
        self._paused = True
        self._log("decision", "循环已暂停")

    def resume(self):
        self._paused = False
        self._log("decision", "循环已恢复")

    def suspend_agent(self) -> bool:
        """暂停（挂起）当前正在运行的 Agent 进程。
        使用 psutil 跨平台进程挂起（Windows: NtSuspendProcess, Unix: SIGSTOP）。
        返回 True 表示成功，False 表示没有运行中的进程或操作失败。"""
        if not self.runner.is_running():
            self._log("warning", "没有运行中的 Agent 可暂停")
            return False
        if self.runner.is_suspended():
            self._log("info", "Agent 已经处于暂停状态")
            return False
        if self.runner.suspend():
            self._tracker.pause_phase()
            self._emit_agent_status_if_changed()
            self._log("decision", "Agent 已暂停")
            self.signals.state_changed.emit()
            return True
        else:
            self._log("error", "暂停 Agent 失败（进程可能已退出或无权限）")
            return False

    def resume_agent(self) -> bool:
        """恢复（继续）当前已暂停的 Agent 进程。
        使用 psutil 跨平台进程恢复（Windows: NtResumeProcess, Unix: SIGCONT）。
        返回 True 表示成功，False 表示没有暂停中的进程或操作失败。"""
        if not self.runner.is_suspended():
            self._log("warning", "没有暂停中的 Agent 可恢复")
            return False
        if self.runner.resume():
            self._tracker.resume_phase()
            self._emit_agent_status_if_changed()
            self._log("decision", "Agent 已恢复")
            self.signals.state_changed.emit()
            return True
        else:
            self._log("error", "恢复 Agent 失败（进程可能已退出或无权限）")
            return False

    def is_agent_running(self) -> bool:
        """检查是否有 Agent 进程正在运行（非暂停状态）"""
        return self.runner.is_running() and not self.runner.is_suspended()

    def is_agent_suspended(self) -> bool:
        """检查 Agent 进程是否处于暂停状态"""
        return self.runner.is_suspended()

    def is_running(self) -> bool:
        return self.isRunning()

    def is_paused(self) -> bool:
        return self._paused

    def apply_config(self, config: dict):
        """应用配置：更新 prompts、timeout、projects 等运行时参数"""
        # 提示词配置：支持从 config.yaml 指定自定义模板路径
        prompts_cfg = config.get("prompts", {})
        custom_prompts_dir = prompts_cfg.get("dir", "").strip()
        if custom_prompts_dir:
            prompts_path = os.path.join(self.fm.state_dir, custom_prompts_dir)
            self._prompt_manager = PromptManager(prompts_path)
        # 重新加载缓存（支持配置热更新）
        self._prompt_manager.reload()

        # 项目配置
        self._config_projects = config.get("projects", [])

        agent_cfg = config.get("agent", {})
        self._config_timeout = agent_cfg.get("timeout", 1200)

        # 模型配置回退：如果 config.yaml 中指定了 model，用它作为默认值
        config_model = agent_cfg.get("model", "").strip()
        if config_model:
            self._tracker._global_model = config_model
            self._log("info", f"从配置读取模型: {config_model}")

        behavior_cfg = config.get("behavior", {})
        self._config_cycle_interval = behavior_cfg.get("cycle_interval", 5)
        self._config_max_retries = behavior_cfg.get("max_retries", 2)
        self._config_auto_push = behavior_cfg.get("auto_push", False)

        # Worktree 隔离配置
        self._config_use_worktree = behavior_cfg.get("use_worktree", False)
        self._config_worktrees_dir = behavior_cfg.get("worktrees_dir", ".worktrees")

        # 会话持久化配置
        self._config_checkpoint_interval = behavior_cfg.get("checkpoint_interval", 300)
        self._config_max_sessions = behavior_cfg.get("max_sessions", 10)
        self._config_auto_resume = behavior_cfg.get("auto_resume", False)
        self._session_manager.checkpoint_interval = self._config_checkpoint_interval

        # Prompt Orchestrator 配置
        orchestrator_cfg = config.get("prompt_orchestrator", {})
        self._config_use_orchestrator = orchestrator_cfg.get("enabled", False)
        self._config_tool_prefs = orchestrator_cfg.get("tool_preferences", {})
        self._config_tool_context_max = orchestrator_cfg.get("tool_context_max_chars", 800)
        self._config_project_context_max = orchestrator_cfg.get("project_context_max_chars", 1500)

        # 事件驱动配置
        webhook_cfg = behavior_cfg.get("webhook", {})
        self._config_webhook_enabled = webhook_cfg.get("enabled", False)
        self._config_webhook_port = webhook_cfg.get("port", 9090)
        self._config_webhook_secret = webhook_cfg.get("secret", "")
        self._config_cron_enabled = behavior_cfg.get("cron", {}).get("enabled", False)

    def _get_timeout(self) -> int:
        """获取当前配置的超时时间"""
        return getattr(self, '_config_timeout', 1200)

    def set_terminal(self, terminal):
        """设置终端面板引用（用于交互模式）"""
        self._terminal = terminal

    def trigger_explore(self, project_name: str = None):
        """手动触发探索与提议（在后台线程运行，避免阻塞主线程）。
        project_name：指定项目名（如 'ftg'），None 表示探索全部。"""
        if self.is_running():
            self._log("warning", "主循环运行中，请先停止后再手动触发")
            return
        with self._manual_lock:
            if self._manual_running:
                self._log("warning", f"已有操作 {self._manual_running} 运行中，忽略探索触发")
                return
            if "explore" in self._manual_running:
                self._log("info", "手动探索已在运行中，忽略重复触发")
                return
            self._manual_running.add("explore")
        threading.Thread(
            target=self._run_manual_phase, args=("explore", project_name), daemon=True,
        ).start()

    def trigger_execute(self):
        """手动触发执行阶段（在后台线程运行，避免阻塞主线程）。
        主循环运行时拒绝手动触发，避免并发访问 _tracker。"""
        if self.is_running():
            self._log("warning", "主循环运行中，请先停止后再手动触发")
            return
        with self._manual_lock:
            if self._manual_running:
                self._log("warning", f"已有操作 {self._manual_running} 运行中，忽略执行触发")
                return
            if "execute" in self._manual_running:
                self._log("info", "手动执行已在运行中，忽略重复触发")
                return
            self._manual_running.add("execute")
        threading.Thread(target=self._run_manual_phase, args=("execute",), daemon=True).start()

    def trigger_finish(self):
        """手动触发收尾阶段（在后台线程运行，避免阻塞主线程）。
        主循环运行时拒绝手动触发，避免并发访问 _tracker。"""
        if self.is_running():
            self._log("warning", "主循环运行中，请先停止后再手动触发")
            return
        with self._manual_lock:
            if self._manual_running:
                self._log("warning", f"已有操作 {self._manual_running} 运行中，忽略收尾触发")
                return
            if "finish" in self._manual_running:
                self._log("info", "手动收尾已在运行中，忽略重复触发")
                return
            self._manual_running.add("finish")
        threading.Thread(target=self._run_manual_phase, args=("finish",), daemon=True).start()

    def trigger_update_proposed(self):
        """手动触发更新待审批列表（在后台线程运行，避免阻塞主线程）。
        主循环运行时拒绝手动触发，避免并发访问 _tracker。"""
        if self.is_running():
            self._log("warning", "主循环运行中，请先停止后再手动触发")
            return
        with self._manual_lock:
            if self._manual_running:
                self._log("warning", f"已有操作 {self._manual_running} 运行中，忽略更新待审批触发")
                return
            if "update_proposed" in self._manual_running:
                self._log("info", "更新待审批已在运行中，忽略重复触发")
                return
            self._manual_running.add("update_proposed")
        threading.Thread(
            target=self._run_manual_phase, args=("update_proposed",), daemon=True,
        ).start()

    def trigger_deploy(self):
        """手动触发部署至服务端（在后台线程运行，避免阻塞主线程）。
        运行 deploy/scripts/deploy.sh 脚本将项目部署到远程 ECS 服务器。"""
        if self.is_running():
            self._log("warning", "主循环运行中，请先停止后再手动触发")
            return
        with self._manual_lock:
            if self._manual_running:
                self._log("warning", f"已有操作 {self._manual_running} 运行中，忽略部署触发")
                return
            if "deploy" in self._manual_running:
                self._log("info", "部署已在运行中，忽略重复触发")
                return
            self._manual_running.add("deploy")
        threading.Thread(
            target=self._run_manual_phase, args=("deploy",), daemon=True,
        ).start()

    def trigger_verify_deliverables(self):
        """手动触发检查已完成任务成果（在后台线程运行，避免阻塞主线程）。
        检查所有 status=done 的任务，验证代码实现率，
        对未完成/有遗漏/有缺陷的任务自动创建修补提议并直接进入工作队列。"""
        if self.is_running():
            self._log("warning", "主循环运行中，请先停止后再手动触发")
            return
        with self._manual_lock:
            if self._manual_running:
                self._log("warning", f"已有操作 {self._manual_running} 运行中，忽略检查成果触发")
                return
            if "verify" in self._manual_running:
                self._log("info", "检查成果已在运行中，忽略重复触发")
                return
            self._manual_running.add("verify")
        threading.Thread(
            target=self._run_manual_phase, args=("verify",), daemon=True,
        ).start()

    def trigger_plan(self, prompt: str, callback=None):
        """手动触发 AI 任务规划（在后台线程运行）。
        运行用户提供的 planning prompt，完成后通过 callback(output) 返回结果。
        callback 签名为 callback(output_str: str)，output 为 AI 返回的文本。
        主循环运行时拒绝手动触发。"""
        if self.is_running():
            self._log("warning", "主循环运行中，请先停止后再手动触发")
            return
        with self._manual_lock:
            if self._manual_running:
                self._log("warning", f"已有操作 {self._manual_running} 运行中，忽略规划触发")
                return
            if "plan" in self._manual_running:
                self._log("info", "任务规划已在运行中，忽略重复触发")
                return
            self._manual_running.add("plan")
        threading.Thread(
            target=self._run_plan_phase,
            args=(prompt, callback),
            daemon=True,
        ).start()

    def _run_plan_phase(self, prompt: str, callback=None):
        """后台线程：执行 AI 规划，完成后回调"""
        try:
            # 检查是否被中断
            if self.isInterruptionRequested():
                if callback:
                    callback("")
                return
            success, output = self._run_prompt(
                prompt,
                phase_name="任务规划",
                completion_signal=self.COMPLETION_SIGNAL,
            )
            if callback:
                callback(output if success else "")
        finally:
            with self._manual_lock:
                self._manual_running.discard("plan")

    def _run_manual_phase(self, phase: str, project_name: str = None):
        """后台线程包装：执行阶段方法，完成后清理运行标志"""
        try:
            if phase == "explore":
                self._phase_explore(project_name)
            elif phase == "execute":
                self._phase_execute()
            elif phase == "finish":
                self._phase_finish()
            elif phase == "deploy":
                self._phase_deploy()
            elif phase == "update_proposed":
                self._phase_update_proposed()
            elif phase == "verify":
                self._phase_verify_deliverables()
        finally:
            with self._manual_lock:
                self._manual_running.discard(phase)

    def _run_prompt(self, prompt: str, phase_name: str = "unknown", timeout: int = None,
                    clear_agents: bool = True, completion_signal: str = None,
                    current_session: Optional[SessionState] = None):
        """运行 prompt — terminal 模式使用异步 runner 实时流式输出到终端，
        非 terminal 模式使用同步 runner。
        自动记录 agent 输入/输出到 logs/{date}_terminal.md。
        实时追踪 agent/sub-agent 状态并写入 logs/{date}_agent_status.md 并发送到 UI。
        clear_agents=False 时保留上一阶段的 agent 列表（用于同一阶段的连续任务）。
        completion_signal 用于 ultraworker 模式：传入时使用异步
        run_with_completion_signal 执行（非 terminal 模式），检测到信号后 kill 进程返回。"""
        if timeout is None:
            timeout = self._get_timeout()

        # 启动阶段追踪
        self._tracker.start_phase(phase_name, clear=clear_agents)
        self._last_status_key: tuple | None = None
        self._emit_agent_status_if_changed()

        if self._terminal:
            # 等待终端空闲（最多 120 秒）
            waited = 0
            while self._terminal.is_running() and waited < 120:
                time.sleep(1)
                waited += 1
            if self._terminal.is_running():
                msg = "终端忙碌，命令未发送"
                self._log("error", msg)
                self.fm.write_agent_log(phase_name, prompt, msg, False)
                self._tracker.end_phase(False)
                self._emit_agent_status_if_changed()
                return False, msg

            # 使用异步 runner，实时流式输出到终端
            self._log("info", f"终端模式：发送 prompt（{prompt.split(chr(10))[0][:50]}...）")
            if not self.runner.run_async_start(prompt):
                msg = "启动 opencode 失败"
                self._log("error", msg)
                self.fm.write_agent_log(phase_name, prompt, msg, False)
                self._tracker.end_phase(False)
                self._emit_agent_status_if_changed()
                return False, msg

            # 轮询读取输出，每 0.5s 向终端推送新内容（避免 UI 空白）
            output_parts = []
            emitted_count = 0
            signal_found = False
            start_time = time.time()
            total_suspended = 0.0   # 累计暂停时长（不计入超时）
            _was_suspended = False  # 上一轮暂停状态
            _suspend_begin = 0.0    # 本轮暂停开始时间
            last_emit = start_time
            last_agent_emit = start_time  # 独立的 agent 状态刷新计时器
            last_checkpoint_time = start_time  # 独立的 checkpoint 计时器

            while self.runner.is_running():
                # 非阻塞检查是否有数据可读（Unix: select, Windows: 回退到阻塞读取）
                if self.runner.has_output(0.1):
                    line = self.runner.read_line()
                    if line:
                        output_parts.append(line)
                        # 实时解析 sub-agent 活动
                        self._tracker.feed_line(line)
                        # 检测完成信号
                        if completion_signal and completion_signal in line:
                            signal_found = True
                            self.runner.kill()
                            break
                else:
                    time.sleep(0.05)

                now = time.time()

                # 每 0.5 秒批量推送新输出到终端
                if now - last_emit >= 0.5 and len(output_parts) > emitted_count:
                    new_text = "".join(output_parts[emitted_count:])
                    self.signals.terminal_output.emit(new_text)
                    emitted_count = len(output_parts)
                    last_emit = now

                # 每 5 秒独立刷新 agent 状态（使用独立计时器，避免与终端输出冲突）
                if now - last_agent_emit >= 5.0:
                    self._emit_agent_status_if_changed()
                    last_agent_emit = now

                # 定期 checkpoint（基于配置的 checkpoint_interval）
                if (current_session and
                        now - last_checkpoint_time >= self._session_manager.checkpoint_interval):
                    new_since_last = output_parts[emitted_count:]
                    self._session_manager.checkpoint(
                        current_session,
                        new_output=new_since_last[-100:] if len(new_since_last) > 100 else new_since_last,
                    )
                    last_checkpoint_time = now

                if self.isInterruptionRequested():
                    self.runner.kill()
                    output = "".join(output_parts)
                    self.fm.write_agent_log(phase_name, prompt, output, False)
                    self._tracker.end_phase(False)
                    self._emit_agent_status_if_changed()
                    return False, "已中断"

                # 超时检查：Agent 暂停期间不计入超时
                # 跟踪暂停/恢复转换，排除暂停耗时
                _cur_suspended = self.runner.is_suspended()
                if _cur_suspended and not _was_suspended:
                    _suspend_begin = time.time()
                elif not _cur_suspended and _was_suspended:
                    total_suspended += time.time() - _suspend_begin
                _was_suspended = _cur_suspended

                if not _cur_suspended and time.time() - start_time - total_suspended > timeout:
                    self.runner.kill()
                    output = "".join(output_parts)
                    msg = f"超时 ({timeout}s)"
                    self._log("error", msg)
                    self.fm.write_agent_log(phase_name, prompt, output, False)
                    self._tracker.end_phase(False)
                    self._emit_agent_status_if_changed()
                    return False, msg

            # 进程可能已结束但 pipe 中还有数据未被轮询读取（信号丢失竞争条件）
            # Drain 所有剩余输出并重新扫描完成信号
            if not signal_found and completion_signal:
                wait_cycles = 0
                while True:
                    line = self.runner.read_line()
                    if line is not None:
                        wait_cycles = 0
                        output_parts.append(line)
                        if completion_signal in line:
                            signal_found = True
                            # 立即推送这批剩余数据到终端
                            if len(output_parts) > emitted_count:
                                new_text = "".join(output_parts[emitted_count:])
                                self.signals.terminal_output.emit(new_text)
                                emitted_count = len(output_parts)
                            break
                    elif self.runner.is_eof():
                        # 读取线程已遇到 EOF，队列已空
                        break
                    else:
                        # 队列暂时为空但读取线程仍在工作，等待 50ms
                        wait_cycles += 1
                        if wait_cycles > 200:  # 最多等待 10 秒
                            break
                        time.sleep(0.05)

            # 发送剩余输出
            if len(output_parts) > emitted_count:
                new_text = "".join(output_parts[emitted_count:])
                self.signals.terminal_output.emit(new_text)

            output = "".join(output_parts)

            # 日志：进程退出原因分析
            exit_code = self.runner._exit_code
            line_count = len([l for l in output_parts if l.strip()])
            if not signal_found:
                detail = f"进程退出 (exit_code={exit_code}, lines={line_count}, output_len={len(output)})"
                self._log("warning", f"{phase_name}: {detail}")

            # 自动重试：进程提前退出且未收到完成信号
            # 常见于 opencode run 在 AI 纯文本响应后（无 tool calls）视作会话结束退出
            # opencode PR#8134 修复: 纯 tool 调用之后 finishReason="stop" 会导致提前退出
            if not signal_found and completion_signal and not self.isInterruptionRequested():
                retry_count = getattr(self, '_prompt_retry_count', 0)
                if retry_count < 2:  # 最多重试 2 次（共 3 次尝试）
                    self._prompt_retry_count = retry_count + 1
                    self._log("warning", f"进程未完成即退出，自动重启 ({retry_count + 1}/3)...")
                    self.fm.write_agent_log(phase_name, prompt, output, False)
                    self.signals.state_changed.emit()
                    time.sleep(3)
                    # 重试时在 prompt 前添加失败上下文警告，避免重复相同错误
                    retry_notice = (
                        "⚠️ 上一轮执行因输出纯文本等待消息（无 tool call）被 opencode 终止。\n"
                        "本轮务必遵守：每个思考后立即跟随至少一个 tool call，\n"
                        "绝对不要输出 'waiting...'、'<!-- 等待 -->'、'正在等待...' 等文本。\n"
                        "如需等待后台任务，直接用 background_output() 轮询。\n\n"
                    )
                    retry_prompt = retry_notice + prompt
                    return self._run_prompt(
                        retry_prompt, phase_name, timeout,
                        clear_agents=True,
                        completion_signal=completion_signal,
                    )

            # 信号找到即为成功（兼容进程自然退出但无信号的情况）
            success = signal_found
            self.fm.write_agent_log(phase_name, prompt, output, success)
            self._tracker.end_phase(success)
            self._emit_agent_status_if_changed()
            return success, output
        else:
            # 非 terminal 模式
            if completion_signal:
                # ultraworker 模式：异步读取输出直到检测到完成信号
                success, output = self.runner.run_with_completion_signal(
                    prompt, timeout, completion_signal,
                )
            else:
                # 普通模式：同步运行，等待进程退出
                success, output = self.runner.run(prompt)
            self.fm.write_agent_log(phase_name, prompt, output, success)
            # 后解析全部输出行以追踪 sub-agent
            for line in output.split("\n"):
                self._tracker.feed_line(line)
            self._tracker.end_phase(success)
            self._emit_agent_status_if_changed()
            return success, output

    def _is_terminal_mode(self) -> bool:
        """终端模式下所有命令通过终端面板异步执行"""
        return self._terminal is not None

    def _emit_agent_status_if_changed(self):
        """Emits agent_status_changed and writes status file only when semantic state differs from last emitted state."""
        new_key = self._tracker.status_key()
        if new_key != getattr(self, '_last_status_key', None):
            self._last_status_key = new_key
            status = self._tracker.get_status()
            self.signals.agent_status_changed.emit(status)
            self.fm.write_agent_status(status)

    # ─── 主循环 ────────────────────────────────

    def _recover_interrupted_tasks(self):
        """崩溃恢复：扫描 approved_queue.yaml 中 status=running 的任务。
        这些是上次运行时标记为执行中但未完成的任务。
        策略：将它们重置回 pending 以便重新执行。
        """
        approved = self.fm.load_approved()
        interrupted = [t for t in approved if t.get("status") == "running"]

        if not interrupted:
            return

        self._log("decision", f"发现 {len(interrupted)} 个中断任务，正在恢复...")
        for task in interrupted:
            task_id = task.get("id", "?")
            desc = str(task.get("description", ""))[:80]
            fail_count = task.get("fail_count", 0)

            if fail_count >= 2:
                # 已经失败太多次，标记为放弃
                task["status"] = "failed_blocked"
                self.fm.record_to_history(task, "failed_blocked")
                self._log("error", f"任务 #{task_id} 已失败 {fail_count} 次，阻塞: {desc}")
            else:
                # 重置为 pending 等待重新执行
                task["status"] = "pending"
                task.pop("started_at", None)
                task["fail_count"] = fail_count + 1  # 计入一次失败
                self._log("info", f"任务 #{task_id} 已恢复为 pending: {desc}")

        self.fm.save_approved(approved)
        self.signals.state_changed.emit()

    def _detect_residual_sessions(self):
        """启动时扫描残留 session 文件，通知 UI。

        不自动恢复（需用户确认），仅记录并发出信号。
        如果 auto_resume=true，则自动恢复最近的残留会话。
        """
        residual = self._session_manager.detect_residual()
        if not residual:
            return

        self._log("decision", f"发现 {len(residual)} 个残留会话（上次异常退出）")
        for session in residual:
            summary = self._session_manager.get_summary(session)
            self._log(
                "info",
                f"残留会话: task-{session.task_id} | phase={session.phase} | "
                f"actions={summary['completed_actions']} | "
                f"checkpoints={summary['checkpoint_count']}",
            )

        # 自动恢复模式
        if self._config_auto_resume:
            for session in residual:
                task_id = session.task_id
                if self._session_manager.can_resume(task_id):
                    # 将对应任务重置为 pending 以便重新执行
                    # 实际恢复逻辑在 _phase_execute 中检查
                    self._log("info", f"自动恢复: task-{task_id} 将在下次执行时恢复进度")
            # 自动恢复模式：不清理 session，等待 _phase_execute 使用
        else:
            # 非自动恢复：仅通知，不处理（用户可在 UI 中操作）
            self._log("info", "残留会话已记录，可在 Agent 状态面板中查看")

        self.signals.state_changed.emit()

    def run(self):
        """主循环：永久运行，直到 stop"""
        # 启动时执行崩溃恢复
        self._recover_interrupted_tasks()
        # 检测残留 session
        self._detect_residual_sessions()

        while not self.isInterruptionRequested():
            if self._paused:
                time.sleep(1)
                continue

            try:
                self._work_done_this_cycle = False

                # 1. 执行批准任务
                self._phase_execute()

                if self.isInterruptionRequested():
                    break

                # 2. 更新待审批
                self._phase_update_proposed()

                if self.isInterruptionRequested():
                    break

                # 3. 探索与提议
                self._phase_explore()

                if self.isInterruptionRequested():
                    break

                # 4. 收尾（文档更新与 git 推送已改为手动触发，不自动执行）
                self._cycle_count += 1
                # _phase_finish() 可通过 trigger_finish() 手动调用

                self.fm.increment_cycle()
                cycle_wait = getattr(self, '_config_cycle_interval', 5)
                self._log("info", f"轮次 {self._cycle_count} 完成，等待 {cycle_wait} 秒...")

                # 自动进度存档（每轮次保存一次状态快照）
                if self._work_done_this_cycle:
                    try:
                        self.fm.save_snapshot(label=f"cycle-{self._cycle_count}")
                        self.fm.cleanup_snapshots(keep=20)
                    except Exception:
                        pass  # 快照失败不影响主循环

                self.signals.state_changed.emit()
                time.sleep(cycle_wait)

            except Exception as e:
                self._log("error", f"循环异常: {e}")
                time.sleep(5)

        self._log("info", "循环线程退出")

    # ─── 阶段 ──────────────────────────────────

    def _phase_execute(self):
        """执行批准队列中的任务（支持 worktree 隔离模式）"""
        approved = self.fm.load_approved()
        pending = [t for t in approved if t.get("status") == "pending"]

        if not pending:
            return

        self._work_done_this_cycle = True

        for idx, task in enumerate(pending):
            self._prompt_retry_count = 0  # 每任务重置自动重试计数器
            if self.isInterruptionRequested():
                return

            desc = task.get("description", "无描述")
            task_id = task.get("id", idx + 1)
            self._log("approved", f"执行: {desc}")

            # ── 任务大小检测：超长描述给出警告 ──
            if len(desc) > 200:
                self._log(
                    "warning",
                    f"任务描述较长（{len(desc)} 字），建议拆分为多个小任务以提高成功率",
                )

            # ── 生成执行 prompt ──
            if self._config_use_orchestrator:
                prompt = self._prompt_orchestrator.compose(
                    task,
                    tool_prefs=self._config_tool_prefs,
                    project_context_max_chars=self._config_project_context_max,
                    tool_context_max_chars=self._config_tool_context_max,
                )
                task_type = self._prompt_orchestrator.get_task_type(task)
                self._log("info", f"编排 prompt: 类型={task_type}, {desc[:50]}...")
            else:
                prompt = self._prompt_manager.render("execute", desc=desc)

            # ── Session 恢复检查 ──
            current_session: Optional[SessionState] = None
            if self._session_manager.can_resume(task_id):
                current_session = self._session_manager.load(task_id)
                if current_session:
                    resume_ctx = self._session_manager.build_resume_context(current_session)
                    # 将恢复上下文与原 prompt 合并
                    prompt = self._prompt_manager.render(
                        "resume",
                        resume_context=resume_ctx,
                        original_prompt=prompt,
                    )
                    self._log("info", f"恢复会话: task-{task_id}，已完成 {len(current_session.completed_actions)} 个步骤")

            # 创建新 session（如果不需要恢复或恢复 session 不存在）
            if current_session is None:
                current_session = self._session_manager.create(task_id, "execute", prompt)

            # 崩溃恢复：执行前将任务标记为 running，记录开始时间
            task["status"] = "running"
            task["started_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            self.fm.save_approved(approved)

            # ── Worktree 隔离模式 ──
            wt_name = f"task-{task_id}"
            if self._config_use_worktree:
                if self._worktree_manager is None:
                    worktrees_dir = getattr(self, '_config_worktrees_dir', '.worktrees')
                    self._worktree_manager = WorktreeManager(
                        self.working_dir, worktrees_dir,
                    )
                try:
                    wt_path = self._worktree_manager.create(wt_name)
                    self.runner.set_working_dir(wt_path)
                    self._log("info", f"Worktree 模式: {wt_path}")
                except Exception as e:
                    self._log("error", f"Worktree 创建失败，回退到主目录: {e}")
                    self.runner.reset_working_dir()

            # 首个任务清空 agent 列表，后续任务累加（保留跨任务的 agent 追踪）
            success, output = self._run_prompt(
                prompt, phase_name=f"执行任务 [{idx + 1}/{len(pending)}]",
                clear_agents=(idx == 0),
                completion_signal=self.COMPLETION_SIGNAL,
                current_session=current_session,
            )
            self.signals.agent_output.emit(output)

            # ── Session 完成/清理 ──
            if success:
                if current_session:
                    self._session_manager.complete(current_session)
            else:
                # 失败时保留 session 文件用于后续恢复
                if current_session:
                    self._session_manager.checkpoint(
                        current_session,
                        completed_actions=[f"失败: {output[:100]}"],
                    )
                # 清理旧 session（维持 max_sessions 限制）
                self._session_manager.purge_old(self._config_max_sessions)

            # ── Worktree 收尾：同步状态 + 清理 ──
            if self._config_use_worktree and self._worktree_manager:
                try:
                    if success:
                        self._worktree_manager.sync_state(wt_name)
                    self._worktree_manager.remove(wt_name)
                except Exception as e:
                    self._log("warning", f"Worktree 清理异常: {e}")
                finally:
                    self.runner.reset_working_dir()

            if self._is_terminal_mode():
                # 终端模式下：成功时依赖 agent 自己修改 YAML，失败时自动更新状态防止死锁
                if success:
                    self._log("info", f"终端模式：已发送任务「{desc[:50]}」，请人工确认结果")
                else:
                    # 终端模式超时/错误：自动更新状态，避免任务永远 pending
                    task["fail_count"] = task.get("fail_count", 0) + 1
                    if task["fail_count"] >= 2:
                        task["status"] = "failed_blocked"
                        self.fm.record_to_history(task, "failed_blocked")
                        self._log("error", f"阻塞: {desc[:80]}（连续失败 {task['fail_count']} 次）")
                    else:
                        task["status"] = "error"
                        task["error"] = output[:200] if output else "超时/无输出"
                        self.fm.record_to_history(task, "error")
                        self._log("error", f"失败: {desc[:80]} — 超时或无输出")
                approved = self.fm.load_approved()
            elif success:
                task["status"] = "done"
                task["completed_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                self.fm.record_to_history(task, "done")
                self._log("info", f"完成: {desc}")
            else:
                # 检查失败次数
                task["fail_count"] = task.get("fail_count", 0) + 1
                if task["fail_count"] >= 2:
                    task["status"] = "failed_blocked"
                    self.fm.record_to_history(task, "failed_blocked")
                    self._log("error", f"阻塞: {desc}（连续失败 {task['fail_count']} 次）")
                else:
                    task["status"] = "error"
                    task["error"] = output[:200]
                    self.fm.record_to_history(task, "error")
                    self._log("error", f"失败: {desc} — {output[:100]}")

            if not self._is_terminal_mode():
                self.fm.save_approved(approved)
            self.signals.state_changed.emit()
            time.sleep(2)

    def _phase_update_proposed(self):
        """更新待审批任务列表"""
        proposed = self.fm.load_proposed()
        if not proposed:
            return

        self._prompt_retry_count = 0  # 重置自动重试计数器
        self._log("decision", "更新待审批列表...")
        content = yaml.dump(proposed, allow_unicode=True, default_flow_style=False)
        template = getattr(self, '_custom_update_template', None)
        if template:
            prompt = template.format(content=content)
        else:
            prompt = self._prompt_manager.render("update_proposed", content=content)

        success, output = self._run_prompt(
            prompt, phase_name="更新待审批列表",
            completion_signal=self.COMPLETION_SIGNAL,
        )
        self.signals.agent_output.emit(output)
        if success:
            self._log("info", "待审批列表已更新")
        else:
            self._log("error", f"更新待审批失败: {output[:100]}")

        # 刷新 UI
        self.signals.state_changed.emit()

    def _get_project_info(self, project_name: str = None) -> dict:
        """根据项目名从配置中获取项目信息。

        Returns:
            dict with keys: label (显示名), source_dirs (源码目录列表), exclude_dirs (排除目录)
            如果 project_name 为 None 或 "全部"，返回全部项目的汇总信息。
        """
        projects = getattr(self, '_config_projects', [])
        if not project_name or project_name == "全部":
            if not projects:
                return {"label": "项目仓库", "source_dirs": "所有源码目录", "exclude_dirs": "plan/"}
            labels = [p.get("label", p.get("name", "?")) for p in projects]
            dirs = []
            for p in projects:
                dirs.extend(p.get("source_dirs", []))
            return {
                "label": "全部项目",
                "source_dirs": ", ".join(dirs) if dirs else "所有源码目录",
                "exclude_dirs": "plan/",
            }

        # 查找指定项目
        for p in projects:
            if p.get("name") == project_name:
                dirs = p.get("source_dirs", [])
                return {
                    "label": p.get("label", project_name),
                    "source_dirs": ", ".join(dirs) if dirs else project_name,
                    "exclude_dirs": "plan/",
                }
        # 项目未配置，回退到简单描述
        return {
            "label": project_name,
            "source_dirs": project_name,
            "exclude_dirs": "plan/",
        }

    def _phase_explore(self, project_name: str = None):
        """探索项目并生成提议。project_name：指定项目名，None 表示全部。"""
        # 仅当存在 status=proposed 的待审批任务时才跳过探索
        # （done/cancelled 等已完成状态不应阻止新探索）
        proposed = self.fm.load_proposed()
        pending = [t for t in proposed if t.get("status") == "proposed"]
        if pending:
            self._log("info", f"已有 {len(pending)} 个待审批任务，跳过探索")
            return

        project_info = self._get_project_info(project_name)
        prompt = self._prompt_manager.render(
            "explore",
            project_label=project_info["label"],
            source_dirs=project_info["source_dirs"],
            exclude_dirs=project_info["exclude_dirs"],
        )

        self._prompt_retry_count = 0  # 重置自动重试计数器
        self._work_done_this_cycle = True
        label = f"探索{f'[{project_name}]' if project_name else '[全部]'}"
        self._log("decision", f"开始{label}...")
        success, output = self._run_prompt(
            prompt, phase_name=label,
            completion_signal=self.COMPLETION_SIGNAL,
        )
        self.signals.agent_output.emit(output)
        if success:
            self._log("info", "探索完成，已生成提议")
        else:
            self._log("error", f"探索失败: {output[:100]}")
            # 记录空转（计数器由主循环统一递增，此处仅记录日志）
            count = self.fm.load_cycle_count() + 1
            self._log("info", f"空转轮次（预计）: {count}")

        # 刷新 UI，确保新提议显示
        self.signals.state_changed.emit()

    def _phase_verify_deliverables(self):
        """检查已完成任务的实现率，自动创建修补提议并直接入队。
        收集所有 status=done 的任务（从 approved_queue 和 history），
        构建验证 prompt 交由 opencode 审查代码库中的实际实现情况。"""
        approved = self.fm.load_approved()
        history = self.fm.load_history()

        # 收集所有已完成任务
        approved_done = [t for t in approved if t.get("status") == "done"]
        history_done = [t for t in history if t.get("resolution") == "done"]

        all_done = approved_done + history_done

        if not all_done:
            self._log("info", "没有已完成的任务需要检查")
            self.signals.state_changed.emit()
            return

        self._prompt_retry_count = 0
        self._log("decision", f"开始检查 {len(all_done)} 个已完成任务的成果实现率…")

        tasks_yaml = yaml.dump(all_done, allow_unicode=True, default_flow_style=False)
        prompt = self._prompt_manager.render("verify_deliverables", tasks=tasks_yaml)

        success, output = self._run_prompt(
            prompt, phase_name="检查已完成任务成果",
            completion_signal=self.COMPLETION_SIGNAL,
        )
        self.signals.agent_output.emit(output)
        if success:
            self._log("info", "任务成果检查完成，修补提议已进入工作队列")
        else:
            self._log("error", f"检查失败: {output[:100]}")

        self.signals.state_changed.emit()

    def _phase_finish(self):
        """收尾：文档更新 + git 推送"""
        self._log("decision", "执行收尾步骤...")

        # 文档更新
        prompt = self._prompt_manager.render("finish")
        self._run_prompt(prompt, phase_name="收尾-文档更新")

        # Git 推送（仅在 auto_push 启用时执行）
        if self._config_auto_push:
            commit_hash = self.runner.get_git_commit()
            success, msg = self.runner.git_push()
            if success:
                if commit_hash:
                    self.fm.save_last_commit(commit_hash)
                self._log("info", "Git 推送成功")
            else:
                self._log("error", f"Git 推送失败: {msg}")
        else:
            self._log("info", "auto_push 已禁用，跳过 Git 推送")

    def _phase_deploy(self):
        """部署至服务端：直接执行部署脚本（优先 Windows .bat，回退到 .sh）"""
        self._log("decision", "开始部署至服务端...")
        self.signals.state_changed.emit()

        # 平台检测选择脚本
        if sys.platform == "win32":
            # Windows: 优先 .bat 脚本，回退到 Git Bash / WSL
            bat_path = os.path.join(self.working_dir, "deploy_remote.bat")
            sh_path = os.path.join(self.working_dir, "deploy", "scripts", "deploy.sh")
            if os.path.isfile(bat_path):
                cmd = [bat_path]
                self._log("info", f"Windows 平台: 使用批处理部署 {bat_path}")
            elif os.path.isfile(sh_path):
                # 尝试通过 Git Bash 或 WSL 运行
                cmd = ["bash", sh_path]
                self._log("info", f"Windows 平台: 使用 Git Bash 运行 {sh_path}")
            else:
                self._log("error", f"未找到部署脚本 (尝试: {bat_path}, {sh_path})")
                self.signals.state_changed.emit()
                return
        else:
            # Unix/Mac: 直接执行 .sh
            sh_path = os.path.join(self.working_dir, "deploy", "scripts", "deploy.sh")
            if not os.path.isfile(sh_path):
                self._log("error", f"部署脚本不存在: {sh_path}")
                self.signals.state_changed.emit()
                return
            cmd = ["bash", sh_path]
            self._log("info", f"Unix 平台: 执行 {sh_path}")

        # 启动 tracker 用于显示阶段状态
        self._tracker.start_phase("部署至服务端", clear=True)
        self._emit_agent_status_if_changed()

        try:
            self._log("info", f"执行命令: {' '.join(cmd)}")
            # Windows .bat 文件需要用 shell=True 或直接执行
            use_shell = sys.platform == "win32" and cmd[0].endswith(".bat")
            process = subprocess.Popen(
                cmd,
                cwd=self.working_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                shell=use_shell,
            )

            output_lines = []
            for line in process.stdout:
                line = line.rstrip("\n")
                output_lines.append(line)
                # 流式输出到终端和日志
                self.signals.terminal_output.emit(line + "\n")
                self._log("info", line)

            process.wait()

            if process.returncode == 0:
                self._log("info", "部署至服务端完成 ✓")
                self._tracker.end_phase(True)
            else:
                self._log("error", f"部署失败 (exit code: {process.returncode})")
                # 输出最后几行作为错误摘要
                tail = output_lines[-5:] if len(output_lines) > 5 else output_lines
                for err_line in tail:
                    self._log("error", f"  {err_line}")
                self._tracker.end_phase(False)

        except FileNotFoundError as e:
            self._log("error", f"命令未找到: {e}")
            self._log("error", "提示: Windows 上请安装 Git Bash 或使用 WSL")
            self._tracker.end_phase(False)
        except Exception as e:
            self._log("error", f"部署异常: {e}")
            self._tracker.end_phase(False)

        self._emit_agent_status_if_changed()
        self.signals.state_changed.emit()

    # ─── 工具 ──────────────────────────────────

    def _log(self, level: str, message: str):
        self.fm.write_log(level, message)
        self.signals.log_received.emit(level, message)
