# -*- coding: utf-8 -*-
"""
loop_manager.py — 主循环调度 (PyQt6 QThread)
阶段: 执行批准任务 → 更新待审批 → 探索与提议 → 收尾
"""

import time
import yaml
from typing import Optional

from PyQt6.QtCore import QThread, pyqtSignal, QTimer

from .file_manager import FileManager
from .opencode_runner import OpencodeRunner


class LoopSignals(QThread):
    """循环信号容器 — 提供 log / agent_output / state_changed 信号"""
    log_received = pyqtSignal(str, str)   # level, message
    agent_output = pyqtSignal(str)         # text
    state_changed = pyqtSignal()           # UI refresh


class LoopManager(QThread):
    """主循环调度器 — QThread 版本"""

    PROMPT_EXPLORE = """请快速浏览项目仓库结构（忽略 plan/ 和 .git），发现需要改进的领域，生成 **粗粒度** 的任务提议。

重点关注：
- 需要修复一批相关文件的问题（如：某个模块的类型错误、API 路由缺少校验）
- 可以增加的一项独立功能（如：添加数据导出功能、新增筛选条件）
- 需要重构的模块（如：将某个组件拆分为更小的子组件）

**不要** 生成过于细节的任务（如修改单行代码、修复单个变量名、添加单条注释）。
每项提议应该至少涉及多个文件的修改或一项完整的功能。

将任务列表以 YAML 格式写入 state/proposed_tasks.yaml，格式如下：
```yaml
- id: 1
  description: 任务描述（粗粒度，涉及多个文件或完整功能）
  status: proposed
- id: 2
  description: 任务描述
  status: proposed
```

注意：仅写入 YAML 文件，不要执行任何任务，不要修改其他文件。"""

    PROMPT_UPDATE_PROPOSED = """以下是当前待审批任务列表：

{content}

请根据项目最新状态逐一检查每项：
- 已完成的任务标记 status: done
- 不再有效的任务标记 status: cancelled
- 需要调整描述的更新 description
- 可补充新任务（粗粒度：至少涉及多个文件或一项完整功能）

将更新后的完整列表写回 state/proposed_tasks.yaml（保持 YAML 格式）。
注意：仅更新 YAML 文件，不要执行任务。"""

    def __init__(self, working_dir: str, state_dir: str, logs_dir: str,
                 parent=None):
        super().__init__(parent)
        self.working_dir = working_dir
        self.fm = FileManager(state_dir, logs_dir)
        self.runner = OpencodeRunner(working_dir)
        self._terminal = None  # 可选：终端面板引用
        self.signals = LoopSignals()

        self._paused = False
        self._cycle_count = 0       # 总轮次计数
        self._work_done_this_cycle = False  # 本周期是否有实际工作

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

    def is_running(self) -> bool:
        return self.isRunning()

    def is_paused(self) -> bool:
        return self._paused

    def set_terminal(self, terminal):
        """设置终端面板引用（用于交互模式）"""
        self._terminal = terminal

    def trigger_explore(self):
        """手动触发探索与提议"""
        QTimer.singleShot(0, self._phase_explore)

    def trigger_execute(self):
        """手动触发执行阶段"""
        QTimer.singleShot(0, self._phase_execute)

    def trigger_finish(self):
        """手动触发收尾阶段（文档更新 + git 推送）"""
        QTimer.singleShot(0, self._phase_finish)

    def _run_prompt(self, prompt: str, timeout: int = 600):
        """运行 prompt — 优先使用终端（同步执行 + 显示输出），否则使用 runner。"""
        if self._terminal:
            # 等待终端空闲（最多 120 秒）
            waited = 0
            while self._terminal.is_running() and waited < 120:
                time.sleep(1)
                waited += 1
            if self._terminal.is_running():
                return False, "终端忙碌，命令未发送"

            # 使用同步 runner 执行，输出实时显示在终端
            self._log("info", f"终端模式：发送 prompt（{prompt.split(chr(10))[0][:50]}...）")
            success, output = self.runner.run(prompt)
            if output:
                self._terminal.append_output(output + "\n")
            return success, output
        else:
            return self.runner.run(prompt)

    def _is_terminal_mode(self) -> bool:
        """终端模式下所有命令通过终端面板异步执行"""
        return self._terminal is not None

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
                self._log("info", f"轮次 {self._cycle_count} 完成，等待 5 秒...")
                self.signals.state_changed.emit()
                time.sleep(5)

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

        for task in pending:
            if self.isInterruptionRequested():
                return

            desc = task.get("description", "无描述")
            self._log("approved", f"执行: {desc}")

            prompt = f"""请执行以下开发任务：

任务描述：{desc}

要求：
- 完成后，修改 state/approved_queue.yaml 中对应项的 status 为 done。
- 若遇到无法自动完成的错误，将 status 改为 error，并在 error 字段中附加原因。
- 若需追加新任务，写入 proposed_tasks.yaml（status: proposed，待人工审批）。
- 忽略 plan 文件夹。"""

            success, output = self._run_prompt(prompt)
            self.signals.agent_output.emit(output)
            if self._is_terminal_mode():
                # 终端模式下不自动标记，由人工确认
                self._log("info", f"终端模式：已发送任务「{desc[:50]}」，请人工确认结果")
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

            self.fm.save_approved(approved)
            self.signals.state_changed.emit()
            time.sleep(2)

    def _phase_update_proposed(self):
        """更新待审批任务列表"""
        proposed = self.fm.load_proposed()
        if not proposed:
            return

        self._log("decision", "更新待审批列表...")
        content = yaml.dump(proposed, allow_unicode=True, default_flow_style=False)
        prompt = self.PROMPT_UPDATE_PROPOSED.format(content=content)

        success, output = self._run_prompt(prompt)
        self.signals.agent_output.emit(output)
        if success:
            self._log("info", "待审批列表已更新")
        else:
            self._log("error", f"更新待审批失败: {output[:100]}")

        # 刷新 UI
        self.signals.state_changed.emit()

    def _phase_explore(self):
        """探索项目并生成提议"""
        # 仅当存在 status=proposed 的待审批任务时才跳过探索
        # （done/cancelled 等已完成状态不应阻止新探索）
        proposed = self.fm.load_proposed()
        pending = [t for t in proposed if t.get("status") == "proposed"]
        if pending:
            self._log("info", f"已有 {len(pending)} 个待审批任务，跳过探索")
            return

        self._work_done_this_cycle = True
        self._log("decision", "开始探索项目...")
        success, output = self._run_prompt(self.PROMPT_EXPLORE)
        self.signals.agent_output.emit(output)
        if success:
            self._log("info", "探索完成，已生成提议")
        else:
            self._log("error", f"探索失败: {output[:100]}")
            # 增加空转计数
            count = self.fm.increment_cycle()
            self._log("info", f"空转轮次: {count}")

        # 刷新 UI，确保新提议显示
        self.signals.state_changed.emit()

    def _phase_finish(self):
        """收尾：文档更新 + git 推送"""
        self._log("decision", "执行收尾步骤...")

        # 文档更新
        prompt = """请更新项目文档：
- 更新根目录 AGENTS.md（反映最新的项目结构和代码变更）
- 更新 docs/ 中相关文件
- 忽略 plan 文件夹"""
        self._run_prompt(prompt)

        # Git 推送
        commit_hash = self.runner.get_git_commit()
        success, msg = self.runner.git_push()
        if success:
            if commit_hash:
                self.fm.save_last_commit(commit_hash)
            self._log("info", "Git 推送成功")
        else:
            self._log("error", f"Git 推送失败: {msg}")

    # ─── 工具 ──────────────────────────────────

    def _log(self, level: str, message: str):
        self.fm.write_log(level, message)
        self.signals.log_received.emit(level, message)
