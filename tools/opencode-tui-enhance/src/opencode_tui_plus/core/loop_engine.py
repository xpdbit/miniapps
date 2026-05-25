# -*- coding: utf-8 -*-
"""
loop_engine.py — 循环调度引擎

管理定向迭代和探索模式的执行循环：
- 定向迭代：给定 prompt + 时间上限 → 反复执行直到超时
- 探索模式：扫描项目 → 生成提议 → 审批 → 逐项执行

基于 QThread，与 UI 通过 Signal 通信。
"""

from __future__ import annotations

import time
from datetime import datetime
from typing import Optional

from PyQt6.QtCore import QObject, pyqtSignal

from .runner import AgentRunner, RunResult, Stage
from .state_manager import StateManager, TaskState, TaskStatus, RoundStatus
from .diff_analyzer import DiffAnalyzer, DiffStat
from .supervisor import Supervisor


class LoopSignals(QObject):
    """循环信号容器"""
    log_received = pyqtSignal(str, str)           # level, message
    state_changed = pyqtSignal()                   # UI 刷新
    round_completed = pyqtSignal(str, int, object)  # task_id, round_num, DiffStat
    task_completed = pyqtSignal(str)               # task_id
    task_failed = pyqtSignal(str, str)             # task_id, error
    terminal_output = pyqtSignal(str)              # 终端流式文本


class LoopEngine:
    """循环调度引擎（非线程，由调用方管理线程）"""

    def __init__(
        self,
        state_manager: StateManager,
        runner: AgentRunner,
        supervisor: Optional[Supervisor] = None,
    ):
        self._sm = state_manager
        self._runner = runner
        self._supervisor = supervisor
        self.signals = LoopSignals()

        # 运行状态
        self._active_task_id: Optional[str] = None
        self._stop_requested = False
        self._paused = False
        self._consecutive_failures = 0
        self._failure_limit = 2

    # ─── 配置 ──────────────────────────────

    def apply_config(self, config: dict):
        """应用配置"""
        agent_cfg = config.get("agent", {})
        self._runner.set_timeout(agent_cfg.get("timeout", 30))
        self._failure_limit = agent_cfg.get("consecutive_failure_limit", 2)

        # 模型路由
        models_cfg = config.get("models", {})
        default_model = models_cfg.get("default_model", "deepseek/deepseek-v4-pro")
        stage_models = models_cfg.get("stage_model", {})
        self._runner.apply_model_routing(default_model, stage_models)

    # ─── 控制 ──────────────────────────────

    def request_stop(self):
        """请求停止当前任务"""
        self._stop_requested = True
        self._log("info", "已请求停止任务")

    def request_pause(self):
        """请求暂停"""
        self._paused = True
        self._runner.suspend()
        if self._active_task_id:
            self._sm.pause_task(self._active_task_id)
        self._log("info", "任务已暂停")
        self.signals.state_changed.emit()

    def request_resume(self):
        """请求恢复"""
        self._paused = False
        self._runner.resume()
        if self._active_task_id:
            self._sm.resume_task(self._active_task_id)
        self._log("info", "任务已恢复")
        self.signals.state_changed.emit()

    @property
    def is_running(self) -> bool:
        return self._active_task_id is not None and not self._stop_requested

    @property
    def active_task_id(self) -> Optional[str]:
        return self._active_task_id

    # ─── 定向迭代 ──────────────────────────

    def run_directed_iteration(self, task_id: str) -> bool:
        """执行定向迭代任务（阻塞，在后台线程中调用）

        Args:
            task_id: 要执行的任务 ID

        Returns:
            True 表示正常完成，False 表示失败或停止
        """
        task = self._sm.load_task(task_id)
        if task is None:
            self._log("error", f"任务不存在: {task_id}")
            return False

        if not task.is_active:
            # 恢复任务：确定从哪一轮开始
            task = self._sm.resume_task(task_id)
            if task is None:
                return False

        self._active_task_id = task_id
        self._stop_requested = False
        self._paused = False
        self._consecutive_failures = 0

        self._log("info", f"定向迭代开始: {task_id} (prompt={task.prompt[:50]}...)")
        self._supervisor_notify("task", f"任务 {task_id} 开始执行")

        try:
            while not self._stop_requested:
                # 等待暂停恢复
                while self._paused and not self._stop_requested:
                    time.sleep(1)

                if self._stop_requested:
                    break

                # 执行一轮
                round_num = task.current_round if task else 1
                self._log("info", f"第 {round_num} 轮 开始")

                # 启动本轮
                task = self._sm.start_round(task_id, round_num)
                if task is None:
                    break

                self.signals.state_changed.emit()

                # 收集前几轮的 diff stat 用于摘要
                prev_stats = [
                    DiffStat(
                        files_changed=r.files_changed,
                        insertions=r.insertions,
                        deletions=r.deletions,
                    )
                    for r in task.rounds
                    if r.status == RoundStatus.COMPLETED.value and r.round < round_num
                ]

                # 执行 Agent
                result = self._runner.run(
                    task.prompt,
                    stage=Stage.CODE_EXECUTION,
                    previous_diff_stats=prev_stats if prev_stats else None,
                )

                if result.success:
                    # 完成本轮
                    task = self._sm.complete_round(
                        task_id, round_num,
                        diff_raw=result.diff_raw,
                        files_changed=result.diff_stat.files_changed if result.diff_stat else 0,
                        insertions=result.diff_stat.insertions if result.diff_stat else 0,
                        deletions=result.diff_stat.deletions if result.diff_stat else 0,
                    )
                    self._consecutive_failures = 0

                    self.signals.round_completed.emit(
                        task_id, round_num, result.diff_stat
                    )
                    self._log("info",
                              f"第 {round_num} 轮 完成 "
                              f"({result.diff_stat.files_changed if result.diff_stat else 0} files, "
                              f"+{result.diff_stat.insertions if result.diff_stat else 0}/"
                              f"-{result.diff_stat.deletions if result.diff_stat else 0}, "
                              f"{result.duration_seconds:.0f}s)")

                    # 检查是否超时
                    if task and task.status == TaskStatus.COMPLETED.value:
                        self._log("info", f"任务 {task_id} 达到时间上限，自动完成")
                        self.signals.task_completed.emit(task_id)
                        return True

                    # 检查是否收敛
                    if task and len(task.rounds) >= 2 and result.diff_stat:
                        recent_stats = prev_stats + [result.diff_stat]
                        if DiffAnalyzer.is_converging(recent_stats):
                            self._log("info", f"第 {round_num} 轮 改动量显著下降，可能已收敛")

                else:
                    # 本轮失败
                    task = self._sm.fail_round(task_id, round_num, result.error_message)
                    self._consecutive_failures += 1

                    self._log("error",
                              f"第 {round_num} 轮 失败 ({self._consecutive_failures}/{self._failure_limit}): "
                              f"{result.error_message[:100]}")

                    if self._consecutive_failures >= self._failure_limit:
                        self._log("error", f"连续失败 {self._failure_limit} 次，自动停止")
                        self._supervisor_notify(
                            "agent",
                            f"任务 {task_id} 连续失败 {self._failure_limit} 次，已自动停止"
                        )
                        self.signals.task_failed.emit(
                            task_id,
                            f"连续 {self._failure_limit} 次失败: {result.error_message}",
                        )
                        return False

                # 下一轮
                if task:
                    task.current_round = round_num + 1
                    self._sm.save_task(task)

                self.signals.state_changed.emit()

            # 被停止
            if self._stop_requested:
                self._sm.stop_task(task_id)
                self._log("info", f"任务 {task_id} 已手动停止")
                self.signals.task_completed.emit(task_id)
                return True

        except Exception as e:
            self._log("error", f"循环引擎异常: {e}")
            if task_id:
                self._sm.stop_task(task_id)
            self.signals.task_failed.emit(task_id, str(e))
            return False

        finally:
            self._active_task_id = None
            self._supervisor_notify("task", f"任务 {task_id} 执行结束")
            self.signals.state_changed.emit()

        return True

    # ─── 探索模式 ──────────────────────────

    def run_exploration(self, project_name: str = "") -> list[dict]:
        """执行项目探索，返回提议列表

        Args:
            project_name: 可选项目名过滤

        Returns:
            提议列表 [{id, description, priority, ...}, ...]
        """
        self._log("info", f"开始探索项目: {project_name or '全部'}")

        prompt = self._build_exploration_prompt(project_name)

        result = self._runner.run(
            prompt,
            stage=Stage.EXPLORATION,
        )

        if not result.success:
            self._log("error", f"探索失败: {result.error_message}")
            return []

        # 解析 agent 输出提取提议
        proposals = self._parse_proposals(result.agent_output)
        self._sm.save_proposals(proposals)

        self._log("info", f"探索完成，发现 {len(proposals)} 条提议")
        self.signals.state_changed.emit()
        return proposals

    def run_proposal_evaluation(self, proposals: list[dict]) -> list[dict]:
        """用高级模型二次评估提议列表

        Args:
            proposals: 待评估的提议列表

        Returns:
            评估后的提议列表（含优先级/难度/合并）
        """
        self._log("info", f"开始二次评估 {len(proposals)} 条提议")

        prompt = self._build_evaluation_prompt(proposals)

        result = self._runner.run(
            prompt,
            stage=Stage.PROPOSAL_EVALUATION,
        )

        if not result.success:
            self._log("error", f"二次评估失败: {result.error_message}")
            return proposals  # 返回原列表

        # 解析评估结果
        evaluated = self._parse_proposals(result.agent_output)
        if evaluated:
            self._sm.save_proposals(evaluated)
        self._log("info", f"二次评估完成，{len(evaluated or proposals)} 条提议")
        return evaluated or proposals

    def run_execution_queue(self, proposals: list[dict]) -> int:
        """逐项执行审批通过的提议

        Args:
            proposals: 审批通过的提议列表（status=pending）

        Returns:
            成功执行的数量
        """
        executed = 0
        for prop in proposals:
            if self._stop_requested:
                break

            if prop.get("status") != "pending":
                continue

            self._log("info", f"执行提议: {prop.get('description', '')[:50]}...")

            result = self._runner.run(
                prop.get("description", ""),
                stage=Stage.CODE_EXECUTION,
            )

            if result.success:
                prop["status"] = "done"
                executed += 1
                self._log("info", f"提议 {prop.get('id', '?')} 执行完成")
            else:
                prop["status"] = "error"
                prop["error"] = result.error_message
                self._log("error", f"提议 {prop.get('id', '?')} 执行失败: {result.error_message[:100]}")

        self._sm.save_proposals(proposals)
        return executed

    # ─── 内部方法 ──────────────────────────

    def _log(self, level: str, message: str):
        """发送日志信号"""
        self.signals.log_received.emit(level, message)

    def _supervisor_notify(self, category: str, message: str):
        """通知监管 Agent"""
        if self._supervisor:
            self._supervisor._alert(None, category, message)  # type: ignore

    def _build_exploration_prompt(self, project_name: str) -> str:
        """构建探索模式 prompt"""
        scope = f"项目 '{project_name}'" if project_name else "所有子项目"
        return (
            f"请扫描 {scope} 的代码库，发现以下类型的改进机会：\n"
            f"1. 类型安全问题 (as any, @ts-ignore, 未使用的类型)\n"
            f"2. 重复代码\n"
            f"3. 错误处理缺失 (空 catch, 无日志的异常吞没)\n"
            f"4. 命名不一致\n"
            f"5. 架构异味 (过大的文件, 循环依赖)\n\n"
            f"请以 YAML 格式输出提议列表，每项包含:\n"
            f"- id: 序号\n"
            f"- description: 问题描述\n"
            f"- priority: P0/P1/P2/P3\n"
            f"- status: proposed\n"
            f"- file_paths: 涉及的文件列表"
        )

    def _build_evaluation_prompt(self, proposals: list[dict]) -> str:
        """构建二次评估 prompt"""
        import yaml
        proposals_yaml = yaml.safe_dump(proposals, allow_unicode=True)
        return (
            f"请评估以下代码改进提议列表。你的任务是:\n"
            f"1. 验证每项提议描述的问题是否真实存在\n"
            f"2. 将相同问题的重复提议合并为一项\n"
            f"3. 重新评估每项优先级 (P0=紧急, P1=高, P2=中, P3=低)\n"
            f"4. 为每项标注修复难度 (quick/normal/heavy)\n\n"
            f"原始提议:\n{proposals_yaml}\n\n"
            f"请以同样的 YAML 格式输出评估后的列表。"
        )

    def _parse_proposals(self, output: str) -> list[dict]:
        """从 agent 输出中解析 YAML 提议列表"""
        import yaml
        # 尝试提取 YAML 块
        lines = output.split('\n')
        yaml_lines = []
        in_yaml = False
        for line in lines:
            if line.strip().startswith('- id:') or line.strip().startswith('id:'):
                in_yaml = True
            if in_yaml:
                yaml_lines.append(line)

        yaml_str = '\n'.join(yaml_lines)
        if not yaml_str.strip():
            # 回退：尝试解析整个输出
            yaml_str = output

        try:
            data = yaml.safe_load(yaml_str)
            if isinstance(data, list):
                return data
        except yaml.YAMLError:
            pass

        return []
