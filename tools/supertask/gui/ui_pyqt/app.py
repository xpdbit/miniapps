# -*- coding: utf-8 -*-
"""SuperTask PyQt6 主窗口 — FluentWindow + LoopManager 信号连接"""
import sys
from datetime import datetime

from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtWidgets import QApplication, QMessageBox
from qfluentwidgets import FluentIcon as FIF
from qfluentwidgets import FluentWindow, NavigationItemPosition, Theme, setTheme

# FIF.ROBOT 是较新版本的图标，旧版本可能没有，fallback 到 FIF.PEOPLE
_FIF_AGENT_ICON = getattr(FIF, 'ROBOT', None) or getattr(FIF, 'PEOPLE', FIF.CHAT)

from gui.ui_pyqt.control_interface import ControlInterface
from gui.ui_pyqt.history_interface import HistoryInterface
from gui.ui_pyqt.log_interface import LogInterface
from gui.ui_pyqt.task_interface import TaskInterface
from gui.ui_pyqt.terminal_interface import TerminalInterface
from gui.ui_pyqt.agent_status_interface import AgentStatusInterface
from gui.ui_pyqt.config_interface import ConfigInterface
from gui.core.loop_manager import LoopManager


class SuperTaskWindow(FluentWindow):
    """SuperTask 主窗口 — 连接 LoopManager 与所有 UI 组件"""

    def __init__(self, working_dir: str, state_dir: str, logs_dir: str):
        super().__init__()
        self.working_dir = working_dir
        self.state_dir = state_dir
        self.logs_dir = logs_dir

        # 创建页面实例
        self.control_interface = ControlInterface()
        self.control_interface.setObjectName("controlInterface")
        self.task_interface = TaskInterface()
        self.task_interface.setObjectName("taskInterface")
        self.log_interface = LogInterface()
        self.log_interface.setObjectName("logInterface")
        self.terminal_interface = TerminalInterface(working_dir=working_dir)
        self.terminal_interface.setObjectName("terminalInterface")
        self.history_interface = HistoryInterface()
        self.history_interface.setObjectName("historyInterface")
        self.agent_status_interface = AgentStatusInterface()
        self.agent_status_interface.setObjectName("agentStatusInterface")
        self.config_interface = ConfigInterface()
        self.config_interface.setObjectName("configInterface")

        # 注册导航
        self._init_navigation()
        self._init_window()

        # 创建并连接 LoopManager
        self._loop = LoopManager(
            working_dir=working_dir,
            state_dir=state_dir,
            logs_dir=logs_dir,
        )
        self._loop.set_terminal(self.terminal_interface)

        # 连接 LoopManager 信号 → UI
        self._loop.signals.log_received.connect(self._on_log)
        self._loop.signals.agent_output.connect(self._on_agent_output)
        self._loop.signals.state_changed.connect(self._refresh_all)
        self._loop.signals.terminal_output.connect(self.terminal_interface.append_output)
        self._loop.signals.agent_status_changed.connect(self._on_agent_status)

        # 加载配置并应用
        config = self._loop.fm.load_config()
        self._loop.apply_config(config)
        self.config_interface.set_config(config)
        self.config_interface.set_on_save(self._on_config_save)

        # 连接控制面板按钮 → LoopManager
        self.control_interface._start_btn.clicked.connect(self._start_loop)
        self.control_interface._stop_btn.clicked.connect(self._stop_loop)
        self.control_interface._pause_btn.clicked.connect(self._toggle_pause)
        # 手动探索：读取项目选择 ComboBox 后传递 project_name
        self.control_interface._explore_btn.clicked.connect(self._on_explore_clicked)
        self.control_interface._execute_btn.clicked.connect(self._loop.trigger_execute)
        # 更新待审批
        self.control_interface._update_btn.clicked.connect(self._loop.trigger_update_proposed)

        # 连接任务面板回调 → FileManager
        self.task_interface.set_on_approve(self._approve_tasks)
        self.task_interface.set_on_reject(self._reject_tasks)
        self.task_interface.set_on_remove(self._remove_tasks)
        self.task_interface.set_on_selection_change(self._on_task_selected)

        # 历史页面按钮
        self.history_interface._refresh_btn.clicked.connect(self._refresh_all)
        self.history_interface.set_on_clear(self._clear_history)
        self.history_interface.set_on_delete(self._delete_history_entries)
        self.history_interface.set_on_revert(self._revert_history_to_proposed)

        # 初始刷新
        QTimer.singleShot(500, self._refresh_all)
        # 定期刷新按钮状态
        QTimer.singleShot(1000, self._update_control_state)

    def _init_navigation(self):
        self.addSubInterface(self.control_interface, FIF.HOME, "控制面板")
        self.addSubInterface(self.task_interface, FIF.APPLICATION, "提议与工作")
        self.addSubInterface(self.agent_status_interface, _FIF_AGENT_ICON, "Agent 状态")
        self.addSubInterface(self.log_interface, FIF.DOCUMENT, "日志")
        self.addSubInterface(self.terminal_interface, FIF.COMMAND_PROMPT, "终端")
        self.addSubInterface(self.config_interface, FIF.SETTING, "配置")
        self.addSubInterface(self.history_interface, FIF.HISTORY, "历史",
                             position=NavigationItemPosition.BOTTOM)

    def _init_window(self):
        setTheme(Theme.DARK)
        self.resize(1400, 900)

    # ─── 循环控制 ────────────────────────────────

    def _on_explore_clicked(self):
        """手动探索按钮点击：读取项目选择，传递 project_name 到 trigger_explore"""
        project = self.control_interface.get_selected_project()
        label = project or "全部"
        self._log("info", f"触发探索 [{label}]...")
        self._loop.trigger_explore(project)

    def _start_loop(self):
        """启动主循环"""
        if not self._loop.isRunning():
            self._loop.start()
            self.control_interface.set_running(True, False)
            self._log("info", "循环已启动")

    def _stop_loop(self):
        """停止主循环"""
        if self._loop.isRunning():
            self._loop.requestInterruption()
            self._loop.wait(3000)
            self._loop.runner.kill()
            self.control_interface.set_running(False)
            self._log("info", "循环已停止")

    def _toggle_pause(self):
        """切换暂停/恢复"""
        if not self._loop.isRunning():
            return
        if self._loop.is_paused():
            self._loop.resume()
            self.control_interface.set_running(True, False)
        else:
            self._loop.pause()
            self.control_interface.set_running(True, True)

    # ─── 信号处理 ────────────────────────────────

    def _log(self, level: str, message: str):
        """统一写日志到日志标签页 + 控制面板日志区"""
        self.log_interface.append(level, message)
        self.control_interface.append_log(level, message)

    def _on_log(self, level: str, message: str):
        self._log(level, message)

    def _on_agent_status(self, status: dict):
        self.agent_status_interface.update_status(status)
        self.control_interface.update_agent_status(status)

    def _on_agent_output(self, text: str):
        self.terminal_interface.append_output(text)

    def _on_config_save(self, config: dict):
        """保存配置到文件并应用到 LoopManager"""
        self._loop.fm.save_config(config)
        self._loop.apply_config(config)
        self.config_interface.set_config(config)

    def _clear_history(self):
        """清空历史文件"""
        self._loop.fm.save_history([])
        self._log("decision", "已清空历史记录")
        self._refresh_all()

    def _delete_history_entries(self, task_ids: list[int]):
        """删除指定 ID 的历史记录"""
        self._loop.fm.delete_history_entries(task_ids)
        self._log("decision", f"已删除 {len(task_ids)} 条历史记录")
        self._refresh_all()

    def _revert_history_to_proposed(self, task_ids: list[int]):
        """将指定 ID 的历史记录回归至待审批提议列表"""
        self._loop.fm.revert_to_proposed(task_ids)
        self._log("decision", f"已回归 {len(task_ids)} 条历史记录至提议")
        self._refresh_all()

    def _on_task_selected(self, task: dict | None):
        """选中任务变化 → 更新详情面板"""
        self.task_interface._detail.show_task(task)

    # ─── 任务操作 ────────────────────────────────

    def _approve_tasks(self, task_ids: list[int]):
        self._loop.fm.approve_tasks(task_ids)
        self._log("decision", f"已批准 {len(task_ids)} 个任务")
        self._refresh_all()

    def _reject_tasks(self, task_ids: list[int]):
        proposed = self._loop.fm.load_proposed()
        rejected = [t for t in proposed if t.get("id") in task_ids]
        proposed = [t for t in proposed if t.get("id") not in task_ids]
        self._loop.fm.save_proposed(proposed)
        # 记录到历史
        for t in rejected:
            self._loop.fm.record_to_history(t, "rejected")
        self._log("decision", f"已驳回 {len(task_ids)} 个提议")
        self._refresh_all()

    def _remove_tasks(self, task_ids: list[int]):
        approved = self._loop.fm.load_approved()
        removed = [t for t in approved if t.get("id") in task_ids]
        approved = [t for t in approved if t.get("id") not in task_ids]
        self._loop.fm.save_approved(approved)
        # 已完成的移除记录到历史
        for t in removed:
            status = t.get("status", "pending")
            if status in ("done", "error", "failed_blocked"):
                self._loop.fm.record_to_history(t, status)
            else:
                self._loop.fm.record_to_history(t, "cancelled")
        self._log("decision", f"已移除 {len(task_ids)} 个任务")
        self._refresh_all()

    # ─── UI 刷新 ────────────────────────────────

    def _refresh_all(self):
        """刷新所有面板数据"""
        try:
            proposed = self._loop.fm.load_proposed()
            approved = self._loop.fm.load_approved()
            self.task_interface.set_proposed(proposed)
            self.task_interface.set_approved(approved)
            self.control_interface.set_approved(approved)

            proposed_count = len(proposed)
            approved_count = len([t for t in approved if t.get("status") == "pending"])
            done_count = len([t for t in approved if t.get("status") == "done"])
            failed_count = len([t for t in approved
                                if t.get("status") in ("error", "failed_blocked")])

            self.control_interface.update_stats(
                proposed=proposed_count,
                approved=approved_count,
                done=done_count,
                failed=failed_count,
            )

            # 历史（从 history.yaml 加载）
            history_tasks = self._loop.fm.load_history()
            self.history_interface.set_tasks(history_tasks)
        except Exception as e:
            self._log("error", f"刷新失败: {e}")

    def _update_control_state(self):
        """定期更新按钮状态"""
        running = self._loop.isRunning()
        paused = self._loop.is_paused() if running else False
        self.control_interface.set_running(running, paused)
        QTimer.singleShot(500, self._update_control_state)

    # ─── 关闭处理 ────────────────────────────────

    def closeEvent(self, event):
        if self._loop.isRunning():
            reply = QMessageBox.question(
                self, "确认退出", "循环正在运行，确定退出吗？",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No,
            )
            if reply == QMessageBox.StandardButton.No:
                event.ignore()
                return
        self._loop.requestInterruption()
        self._loop.wait(3000)
        self._loop.runner.kill()
        event.accept()


def create_app(working_dir: str, state_dir: str, logs_dir: str) -> int:
    QApplication.setHighDpiScaleFactorRoundingPolicy(
        Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
    )
    app = QApplication(sys.argv)
    window = SuperTaskWindow(working_dir, state_dir, logs_dir)
    window.show()
    return app.exec()
