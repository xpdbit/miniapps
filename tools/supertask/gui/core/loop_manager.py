# -*- coding: utf-8 -*-
"""
loop_manager.py — 主循环调度 (PyQt6 QThread)
阶段: 执行批准任务 → 更新待审批 → 探索与提议 → 收尾
"""

import re
import threading
import time
import yaml
from dataclasses import dataclass, field
from typing import Optional

from PyQt6.QtCore import QThread, pyqtSignal

from .file_manager import FileManager
from .opencode_runner import OpencodeRunner


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
    通过正则匹配 opencode 的输出格式（task() 调用 / 后台任务完成通知）
    来检测 agent 的创建和完成事件。"""

    # 匹配 task(subagent_type="X", ...) 调用
    _TASK_RE = re.compile(r'task\(subagent_type\s*=\s*"(\w+)"')
    # 匹配 Task ID / task_id 提取
    _TASK_ID_RE = re.compile(r'(?:Task ID|task_id)[:\s]*`?(\S+)`?')
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
        每个事件 dict: {"type": "agent_started"|"agent_done"|"agent_error", ...}"""
        events: list[dict] = []

        # 先去除 ANSI 转义码（stdout 管道原始输出含颜色码）
        clean_line = self._strip_ansi(line)

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
        if m:
            agent_type = m.group(1)
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

    # 已知项目目录映射（用于指定项目探索）
    PROJECT_DIRS = {
        "ftg": "（主目录 apps/ftg-miniapp/，后端 servers/ftg-server/）",
        "game1": "（主目录 apps/game1-miniapp/，后端 servers/game1-server/）",
        "tavern": "（主目录 apps/tavern-miniapp/，后端 servers/tavern-server/）",
    }

    PROMPT_EXPLORE = """/ulw-loop
请探索{project_filter}（忽略 plan/ 和 .git），发现需要改进的领域，生成 **粗粒度** 的任务提议。

重点关注：
- 需要修复一批相关文件的问题（如：某个模块的类型错误、API 路由缺少校验）
- 可以增加的一项独立功能（如：添加数据导出功能、新增筛选条件）
- 需要重构的模块（如：将某个组件拆分为更小的子组件）

## 任务粒度指南（基于 AI Agent 工程最佳实践）
- 每项任务应可由一个 agent 会话在 20 分钟内完成（3-8 个 tool call）
- 采用垂直切片：按功能路径而非技术层次分解（例如 "添加用户创建流程" 而非 "建表+API+前端" 三个独立任务）
- 如果任务描述超过 150 字，很可能过大，应考虑拆分
- 不要将多个独立项目的工作合并为一个任务（如 "Dashboard 拆分 + Tavern 补齐" 应分开）

**不要** 生成过于细节的任务（如修改单行代码、修复单个变量名、添加单条注释）。
每项提议应涉及多个文件的修改或一项完整功能，但不应超过 3 个独立模块。

将任务列表以 YAML 格式写入 state/proposed_tasks.yaml，格式如下：
```yaml
- id: 1
  description: 任务描述（适中粒度，3-8 个 tool call 可完成）
  status: proposed
- id: 2
  description: 任务描述
  status: proposed
```

注意：仅写入 YAML 文件，不要执行任何任务，不要修改其他文件。

## 🚫 严禁事项（违反会导致 opencode 终止会话）
- ❌ 输出纯文本等待消息，例如 "waiting...", "<!-- 等待 -->", "正在等待...", "稍等..."
- ❌ 输出任何不含 tool call 的纯文本段落
- ✅ 如果无事可做，直接执行下一步或用 Read/Glob 探索代码库
- ✅ 每一条文本输出之后，必须立即跟随至少一个 tool call

完成后请输出 ===TASK_DONE===
"""

    # Ultraworker 完成信号 — agent 输出此信号后 runner 自动 kill 进程
    COMPLETION_SIGNAL = "===TASK_DONE==="

    PROMPT_EXECUTE = """/ulw-loop
请执行以下开发任务：

任务描述：{desc}

## ⏱ 时间管理（本次超时限制约 20 分钟）
1. 如果任务很大，优先完成核心部分，非关键细节可延后
2. 每 5 分钟检查剩余时间 — 如果只剩 3 分钟，立即收尾并标记部分完成
3. 不要把时间花在过度探索上：读取 3-5 个关键文件足够理解上下文即可

## 执行步骤
1. 快速理解任务要求（Read/Grep 关键文件，不超过 30 秒）
2. 制定简要执行计划（不超过 3 步），立即开始实施
3. 执行修改，完成后验证
4. 修改 state/approved_queue.yaml 中对应项的 status 为 done
5. 若遇到无法自动完成的错误，将 status 改为 error，并在 error 字段中附加原因
6. 若需追加新任务，写入 proposed_tasks.yaml（status: proposed，待人工审批）
7. 忽略 plan 文件夹

## 🔄 后台子任务等待策略（⚠ 违反会导致 opencode 终止会话）
如果你派出了后台子任务（task(run_in_background=true)），必须用 background_output 轮询，而不是输出等待文本：
- ✅ 正确：直接调用 background_output(task_id="xxx") 检查结果
- ✅ 如果结果尚未就绪，立即做其他有用的 tool call（Read/Glob/Grep）
- ❌ 错误：输出 "waiting...", "<!-- 等待 -->", "正在等待...", "稍等..."
- ❌ 错误：输出任何不含 tool call 的纯文本段落
- ❌ 错误：输出 "still running...", "plan agent 仍在运行中..."

## 🚫 严禁事项
- ❌ 输出纯文本等待消息
- ❌ 输出任何不含 tool call 的纯文本段落
- ✅ 每一条文本输出之后，必须立即跟随至少一个 tool call

完成后请输出 ===TASK_DONE===
"""

    PROMPT_UPDATE_PROPOSED = """/ulw-loop
以下是当前待审批任务列表：

{content}

请根据项目最新状态逐一检查每项：
- 已完成的任务标记 status: done
- 不再有效的任务标记 status: cancelled
- 需要调整描述的更新 description
- 可补充新任务（粗粒度：至少涉及多个文件或一项完整功能）

将更新后的完整列表写回 state/proposed_tasks.yaml（保持 YAML 格式）。
注意：仅更新 YAML 文件，不要执行任务。

## 🚫 严禁事项（违反会导致 opencode 终止会话）
- ❌ 输出纯文本等待消息，例如 "waiting...", "<!-- 等待 -->", "正在等待...", "稍等..."
- ❌ 输出任何不含 tool call 的纯文本段落
- ✅ 每一条文本输出之后，必须立即跟随至少一个 tool call

完成后请输出 ===TASK_DONE===
"""

    PROMPT_VERIFY_DELIVERABLES = """/ulw-loop
你是一个代码审查专家。请检查以下已完成任务的成果实现情况：

{tasks}

## 检查步骤
对每项已完成的任务：
1. 阅读任务的 description 字段，准确理解任务的原始要求
2. 在代码库中搜索任务描述涉及的模块、文件、功能或修复
3. 仔细验证该功能/修复是否已实际存在于代码库中
4. 判断实现是否完整、有无遗漏、是否存在缺陷或漏洞

## 判定标准
- ✅ **已验证通过**: 任务描述的功能已完整、正确地实现在代码库中
- ⚠️ **需要修补**: 实现不完整、有严重遗漏、存在缺陷或安全漏洞

## 修补任务要求
对于标记为"需要修补"的任务，请在 state/approved_queue.yaml 中新增修补任务项：
- description 格式: "【修补】{原任务描述摘要} — {发现的具体问题}"
- status: "pending"
- priority: "high"
- 为新任务分配递增的 id（从现有最大 id + 1 开始）

⚠️ 修补任务直接写入 state/approved_queue.yaml，直接进入工作队列，不要写入 proposed_tasks.yaml。

## 输出要求
完成后输出简短总结：检查数量 / 问题数量 / 修补任务数量

## 🚫 严禁事项（违反会导致 opencode 终止会话）
- ❌ 输出纯文本等待消息
- ❌ 输出任何不含 tool call 的纯文本段落
- ✅ 每一条文本输出之后，必须立即跟随至少一个 tool call

然后输出 ===TASK_DONE===
"""

    def __init__(self, working_dir: str, state_dir: str, logs_dir: str,
                 parent=None):
        super().__init__(parent)
        self.working_dir = working_dir
        self.fm = FileManager(state_dir, logs_dir)
        self.runner = OpencodeRunner(working_dir)
        self._terminal = None  # 可选：终端面板引用
        self._tracker = AgentTracker()  # Agent 状态追踪器
        self.signals = LoopSignals()

        self._paused = False
        self._cycle_count = 0       # 总轮次计数
        self._work_done_this_cycle = False  # 本周期是否有实际工作
        self._manual_running: set[str] = set()  # 手动触发防重入
        self._manual_lock = threading.Lock()    # _manual_running 的线程安全锁

    # ─── 控制 ──────────────────────────────────

    def start(self):
        """启动循环"""
        if self.isRunning():
            return
        self._paused = False
        super().start()
        self._log("info", "循环已启动")

    def stop(self):
        """停止循环"""
        self.requestInterruption()
        self.runner.kill()
        self._log("info", "循环已停止")

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
        """应用配置：更新 prompts、timeout 等运行时参数"""
        prompts = config.get("prompts", {})
        explore = prompts.get("explore", "").strip()
        update = prompts.get("update_proposed", "").strip()
        execute = prompts.get("execute", "").strip()
        if explore:
            self.PROMPT_EXPLORE = explore
        elif 'PROMPT_EXPLORE' in self.__dict__:
            del self.PROMPT_EXPLORE  # 恢复为类默认值
        if update:
            self._custom_update_template = update
        else:
            self._custom_update_template = None
        self._custom_execute_template = execute if execute else None

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
            elif phase == "update_proposed":
                self._phase_update_proposed()
            elif phase == "verify":
                self._phase_verify_deliverables()
        finally:
            with self._manual_lock:
                self._manual_running.discard(phase)

    def _run_prompt(self, prompt: str, phase_name: str = "unknown", timeout: int = None,
                    clear_agents: bool = True, completion_signal: str = None):
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

    def run(self):
        """主循环：永久运行，直到 stop"""
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
                self.signals.state_changed.emit()
                time.sleep(cycle_wait)

            except Exception as e:
                self._log("error", f"循环异常: {e}")
                time.sleep(5)

        self._log("info", "循环线程退出")

    # ─── 阶段 ──────────────────────────────────

    def _phase_execute(self):
        """执行批准队列中的任务"""
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
            self._log("approved", f"执行: {desc}")

            # ── 任务大小检测：超长描述给出警告 ──
            if len(desc) > 200:
                self._log(
                    "warning",
                    f"任务描述较长（{len(desc)} 字），建议拆分为多个小任务以提高成功率",
                )

            # 使用自定义执行模板（若已配置），否则使用类默认值
            template = getattr(self, '_custom_execute_template', None) or self.PROMPT_EXECUTE
            prompt = template.format(desc=desc)

            # 首个任务清空 agent 列表，后续任务累加（保留跨任务的 agent 追踪）
            success, output = self._run_prompt(
                prompt, phase_name=f"执行任务 [{idx + 1}/{len(pending)}]",
                clear_agents=(idx == 0),
                completion_signal=self.COMPLETION_SIGNAL,
            )
            self.signals.agent_output.emit(output)
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
        template = getattr(self, '_custom_update_template', None) or self.PROMPT_UPDATE_PROPOSED
        prompt = template.format(content=content)

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

    def _get_project_filter(self, project_name: str = None) -> str:
        """根据项目名生成 PROMPT_EXPLORE 的 {project_filter} 替换内容"""
        if not project_name or project_name == "全部":
            return "项目仓库结构"
        dirs = self.PROJECT_DIRS.get(project_name, "")
        return f"项目 {project_name}{dirs}"

    def _phase_explore(self, project_name: str = None):
        """探索项目并生成提议。project_name：指定项目名，None 表示全部。"""
        # 仅当存在 status=proposed 的待审批任务时才跳过探索
        # （done/cancelled 等已完成状态不应阻止新探索）
        proposed = self.fm.load_proposed()
        pending = [t for t in proposed if t.get("status") == "proposed"]
        if pending:
            self._log("info", f"已有 {len(pending)} 个待审批任务，跳过探索")
            return

        project_filter = self._get_project_filter(project_name)
        try:
            prompt = self.PROMPT_EXPLORE.format(project_filter=project_filter)
        except KeyError:
            # 自定义 prompt 缺少 {project_filter} 占位符时使用原文本
            prompt = self.PROMPT_EXPLORE
            self._log("warning", "自定义探索提示词缺少 {project_filter} 占位符，使用原始文本")

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
        prompt = self.PROMPT_VERIFY_DELIVERABLES.format(tasks=tasks_yaml)

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
        prompt = """请更新项目文档：
- 更新根目录 AGENTS.md（反映最新的项目结构和代码变更）
- 更新 docs/ 中相关文件
- 忽略 plan 文件夹"""
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

    # ─── 工具 ──────────────────────────────────

    def _log(self, level: str, message: str):
        self.fm.write_log(level, message)
        self.signals.log_received.emit(level, message)
