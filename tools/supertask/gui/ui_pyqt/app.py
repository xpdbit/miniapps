# -*- coding: utf-8 -*-
"""SuperTask PyQt6 主窗口 — FluentWindow + LoopManager 信号连接"""
import os
import sys
from datetime import datetime

from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QCursor, QIcon
from PyQt6.QtWidgets import QApplication
from qfluentwidgets import FluentIcon as FIF
from qfluentwidgets import FluentWindow, NavigationItemPosition, Theme, setTheme
from PyQt6.QtCore import QProcess

# FIF.ROBOT 是较新版本的图标，旧版本可能没有，fallback 到 FIF.PEOPLE
_FIF_AGENT_ICON = getattr(FIF, 'ROBOT', None) or getattr(FIF, 'PEOPLE', FIF.CHAT)
_FIF_PLAN = getattr(FIF, 'EDIT', None) or FIF.APPLICATION
_FIF_CANCEL = getattr(FIF, 'CANCEL', None) or getattr(FIF, 'CLOSE', FIF.SYNC)
_FIF_SEARCH = getattr(FIF, 'SEARCH', None) or FIF.SYNC

from gui.ui_pyqt.control_interface import ControlInterface
from gui.ui_pyqt.history_interface import HistoryInterface
from gui.ui_pyqt.log_terminal_interface import LogTerminalInterface
from gui.ui_pyqt.task_interface import TaskInterface
from gui.ui_pyqt.agent_status_interface import AgentStatusInterface
from gui.ui_pyqt.config_interface import ConfigInterface
from gui.ui_pyqt.task_plan_interface import TaskPlanInterface
from gui.ui_pyqt.monitor_interface import MonitorInterface
from gui.core.loop_manager import LoopManager
from gui.core.process_monitor import ProcessMonitor


class SuperTaskWindow(FluentWindow):
    """SuperTask 主窗口 — 连接 LoopManager 与所有 UI 组件"""

    def __init__(self, working_dir: str, state_dir: str, logs_dir: str):
        super().__init__()
        self.working_dir = working_dir
        self.state_dir = state_dir
        self.logs_dir = logs_dir

        # 当前选定的任务（全局指向性目标）
        self._selected_task: dict | None = None

        # 创建页面实例
        self.control_interface = ControlInterface()
        self.control_interface.setObjectName("controlInterface")
        self.control_interface.set_working_dir(working_dir)
        self.task_interface = TaskInterface()
        self.task_interface.setObjectName("taskInterface")
        # 日志+终端合并面板（子 tab 切换）
        self.log_terminal_interface = LogTerminalInterface(working_dir=working_dir)
        self.log_terminal_interface.setObjectName("logTerminalInterface")
        self.log_interface = self.log_terminal_interface.log
        self.terminal_interface = self.log_terminal_interface.terminal
        self.history_interface = HistoryInterface()
        self.history_interface.setObjectName("historyInterface")
        self.agent_status_interface = AgentStatusInterface()
        self.agent_status_interface.setObjectName("agentStatusInterface")
        self.config_interface = ConfigInterface()
        self.config_interface.setObjectName("configInterface")

        # 监控仪表盘（在 LoopManager 创建前初始化，在创建后连接数据源）
        self.monitor_interface = MonitorInterface()
        self.monitor_interface.setObjectName("monitorInterface")

        self.task_plan_interface = TaskPlanInterface()
        self.task_plan_interface.setObjectName("taskPlanInterface")
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
        self.task_plan_interface.set_loop_manager(self._loop)

        # 连接 LoopManager 信号 → UI
        self._loop.signals.log_received.connect(self._on_log)
        self._loop.signals.agent_output.connect(self._on_agent_output)
        self._loop.signals.state_changed.connect(self._refresh_all)
        self._loop.signals.state_changed.connect(self._refresh_explore_btn)
        self._loop.signals.terminal_output.connect(self.terminal_interface.append_output)
        self._loop.signals.terminal_output.connect(self.control_interface.append_terminal_output)
        self._loop.signals.agent_status_changed.connect(self._on_agent_status)

        # 创建实时进程监控器并连接监控仪表盘
        self._process_monitor = ProcessMonitor(
            opencode_reader=self._loop._opencode_reader,
        )
        self.monitor_interface.set_data_sources(
            monitor_store=self._loop._monitor_store,
            opencode_reader=self._loop._opencode_reader,
            process_monitor=self._process_monitor,
        )
        self.monitor_interface.start_auto_refresh()

        # 加载配置并应用
        config = self._loop.fm.load_config()
        self._loop.apply_config(config)
        self.config_interface.set_config(config)
        self.config_interface.set_on_save(self._on_config_save)
        self.config_interface.set_on_restart(self._on_restart_app)

        # 同步项目列表到控制面板
        projects = config.get("projects", [])
        self.control_interface.set_projects(projects)

        # 项目选择变化 → 自动筛选提议与工作面板
        self.control_interface._project_combo.currentIndexChanged.connect(
            self._on_project_filter_changed
        )

        # 连接控制面板按钮 → LoopManager（手动模式）
        # 持续探索：切换启动/停止
        self.control_interface._explore_btn.clicked.connect(self._on_explore_toggle)
        # 执行队列
        self.control_interface._execute_btn.clicked.connect(self._loop.trigger_execute)
        # 更新任务（替代原来的更新待审批）
        self.control_interface._update_btn.clicked.connect(self._on_update_task_clicked)
        # 检查已完成任务成果
        self.control_interface._verify_btn.clicked.connect(self._on_verify_clicked)
        # 检查并修复当前项目
        self.control_interface._check_fix_btn.clicked.connect(self._on_check_fix_clicked)
        # 部署至服务端
        self.control_interface._deploy_btn.clicked.connect(self._on_deploy_clicked)
        # 更新文档并推送 Github
        self.control_interface._github_btn.clicked.connect(self._on_github_clicked)

        # Agent 控制切换（位于 Agent 状态面板）
        agent_ctrl_btn = self.agent_status_interface.get_agent_ctrl_btn()
        agent_ctrl_btn.clicked.connect(self._on_agent_ctrl_toggle)

        # 连接任务面板回调 → FileManager
        self.task_interface.set_on_approve(self._approve_tasks)
        self.task_interface.set_on_reject(self._reject_tasks)
        self.task_interface.set_on_remove(self._remove_tasks)
        self.task_interface.set_on_selection_change(self._on_task_selected)
        self.task_interface.set_on_evaluate(self._on_evaluate_clicked)

        # 连接「选定任务」信号 → 全局任务指向
        self.task_interface._detail.task_selected.connect(self._on_task_pinned)
        self.task_interface._detail.task_deselected.connect(self._on_task_unpinned)

        # 从配置恢复选定的任务
        QTimer.singleShot(300, self._restore_selected_task)

        # 历史页面按钮
        self.history_interface._refresh_btn.clicked.connect(self._refresh_all)
        self.history_interface.set_on_clear(self._clear_history)
        self.history_interface.set_on_delete(self._delete_history_entries)
        self.history_interface.set_on_revert(self._revert_history_to_proposed)

        # 初始刷新
        QTimer.singleShot(500, self._refresh_all)

    def _init_navigation(self):
        self.addSubInterface(self.control_interface, FIF.HOME, "控制面板")
        self.addSubInterface(self.task_interface, FIF.APPLICATION, "提议与工作")
        self.addSubInterface(self.task_plan_interface, _FIF_PLAN, "任务规划")
        self.addSubInterface(self.agent_status_interface, _FIF_AGENT_ICON, "Agent 状态")
        self.addSubInterface(self.log_terminal_interface, FIF.COMMAND_PROMPT, "日志与终端")
        self.addSubInterface(self.config_interface, FIF.SETTING, "配置")
        _FIF_MONITOR = getattr(FIF, 'STATISTICS', None) or getattr(FIF, 'CHART', FIF.DATE_TIME)
        self.addSubInterface(self.monitor_interface, _FIF_MONITOR, "监控与统计",
                             position=NavigationItemPosition.BOTTOM)
        self.addSubInterface(self.history_interface, FIF.HISTORY, "历史",
                             position=NavigationItemPosition.BOTTOM)

    def _init_window(self):
        setTheme(Theme.DARK)

        # 设置窗口图标 — 使用 supertask 根目录的 icon.png
        _icon_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "supertask.ico")
        if os.path.isfile(_icon_path):
            self.setWindowIcon(QIcon(_icon_path))

        # 窗口默认尺寸和最小尺寸（确保在恢复屏幕最大化之前有合理的初始大小）
        self.setMinimumSize(800, 600)
        # 设置一个合理的默认还原尺寸（当没有保存的配置时使用）
        # 在 create_app 中会被 _restore_window_geometry 或 showMaximized 覆盖
        self.resize(1280, 800)

    # ─── 手动操作 ────────────────────────────────

    def _on_explore_toggle(self):
        """持续探索按钮切换：启动或停止持续探索"""
        if self._loop._continuous_explore_active:
            # 正在持续探索中 → 停止
            self._loop.stop_continuous_explore()
            self.control_interface._explore_btn.setText("持续探索")
            self.control_interface._explore_btn.setIcon(_FIF_SEARCH)
            self._log("decision", "请求停止持续探索...")
        else:
            # 启动持续探索
            project = self.control_interface.get_selected_project()
            label = project or "全部"
            self._log("info", f"启动持续探索 [{label}]...")
            self._loop.trigger_continuous_explore(project)
            self.control_interface._explore_btn.setText("停止探索")
            self.control_interface._explore_btn.setIcon(_FIF_CANCEL)

    def _refresh_explore_btn(self):
        """刷新探索按钮状态（当持续探索结束时恢复按钮文字）"""
        if not self._loop._continuous_explore_active:
            btn_text = self.control_interface._explore_btn.text()
            if btn_text == "停止探索":
                self.control_interface._explore_btn.setText("持续探索")
                self.control_interface._explore_btn.setIcon(_FIF_SEARCH)

    def _on_update_task_clicked(self):
        """更新任务按钮点击：重新检查项目，更新任务项内容"""
        project = self.control_interface.get_selected_project()
        label = project or "全部"
        self._log("decision", f"开始更新任务 [{label}]...")
        self._loop.trigger_update_task(project)

    def _on_verify_clicked(self):
        """检查成果按钮点击：触发已完成任务的实现率检查"""
        self._log("decision", "开始检查已完成任务成果的实现率…")
        self._loop.trigger_verify_deliverables()

    def _on_check_fix_clicked(self):
        """检查并修复按钮点击：触发当前项目的代码检查和自动修复"""
        project = self.control_interface.get_selected_project()
        label = project or "全部"
        self._log("decision", f"开始检查并修复 [{label}]...")
        self._loop.trigger_check_fix(project)

    def _on_github_clicked(self):
        """更新文档并推送按钮点击：触发收尾阶段（文档更新 + Git 推送）"""
        self._log("decision", "开始更新文档并推送 Github...")
        self._loop.trigger_finish()

    def _on_evaluate_clicked(self):
        """二次评估按钮点击：触发 AI 重新评估提议列表"""
        self._log("decision", "开始二次评估待审批提议...")
        self._loop.trigger_evaluate()

    def _on_project_filter_changed(self):
        """控制面板项目选择变化 → 筛选提议与工作面板"""
        selected = self.control_interface._project_combo.currentText()
        self.task_interface.filter_by_project(selected)

    def _on_deploy_clicked(self):
        """部署至服务端按钮点击：触发部署脚本执行"""
        self._log("decision", "开始部署至服务端...")
        self._loop.trigger_deploy()

    def _on_agent_ctrl_toggle(self):
        """Agent 控制切换开关：根据当前状态暂停或继续"""
        if self._loop.is_agent_suspended():
            self._log("decision", "请求继续 Agent...")
            if self._loop.resume_agent():
                self.agent_status_interface.set_agent_running(True, suspended=False)
        elif self._loop.is_agent_running():
            self._log("decision", "请求暂停 Agent...")
            if self._loop.suspend_agent():
                self.agent_status_interface.set_agent_running(True, suspended=True)
        else:
            self._log("warning", "没有运行中的 Agent 可操作")

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
        # 同步 Agent 控制按钮状态
        running = self._loop.is_agent_running()
        suspended = self._loop.is_agent_suspended()
        self.agent_status_interface.set_agent_running(running, suspended)

    def _on_agent_output(self, text: str):
        self.terminal_interface.append_output(text)
        self.control_interface.append_terminal_output(text)

    def _on_config_save(self, config: dict):
        """保存配置到文件并应用到 LoopManager"""
        self._loop.fm.save_config(config)
        self._loop.apply_config(config)
        self.config_interface.set_config(config)
        # 同步项目列表
        projects = config.get("projects", ["ftg", "game1", "tavern"])
        self.control_interface.set_projects(projects)

    def _clear_history(self):
        """清空历史文件（使用强制保存绕过数据丢失防护）"""
        self._loop.fm.save_history_force([])
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

    def get_selected_task(self) -> dict | None:
        """返回当前全局选定的任务（供 LoopManager 等下游组件查询）"""
        return self._selected_task

    def _restore_selected_task(self):
        """启动时从 config 恢复选定的任务"""
        config = self._loop.fm.load_config()
        selected_id = config.get("selected_task_id")
        if selected_id is None:
            return

        # 在所有任务列表中查找该 ID
        proposed = self._loop.fm.load_proposed()
        approved = self._loop.fm.load_approved()
        all_tasks = proposed + approved
        for task in all_tasks:
            if task.get("id") == selected_id:
                self._on_task_pinned(task, silent=True)
                return

    def _on_task_pinned(self, task: dict, silent: bool = False):
        """「选定任务」操作 — 更新全局指向性目标"""
        task_id = task.get("id", 0)
        if not task_id:
            self._log("warning", "无法选定任务：任务 ID 无效")
            return

        # ── 验证任务确实存在于当前数据中 ──
        proposed = self._loop.fm.load_proposed()
        approved = self._loop.fm.load_approved()
        all_tasks = proposed + approved
        found = next((t for t in all_tasks if t.get("id") == task_id), None)
        if not found:
            self._log("warning", f"无法选定任务 #{task_id}：该任务不存在于当前提议或工作队列中")
            # 清除过期的选定状态
            self._on_task_unpinned()
            return

        self._selected_task = task
        # 取第一行作为 title，去掉多余空白
        raw_desc = str(task.get("desc", task.get("description", "")))
        task_title = raw_desc.split("\n")[0].strip()
        # 再按常见分隔符裁剪至短名称（避免名称后跟大段描述）
        for sep in (" - ", " — ", "：", ": ", "–"):
            if sep in task_title:
                task_title = task_title.split(sep, 1)[0].strip()
                break
        task_title = task_title[:50]

        # 1. 更新窗口标题
        self.setWindowTitle(f"SuperTask — {task_title}")

        # 2. 更新任务规划页面的 header
        self.task_plan_interface.set_active_task(task)

        # 3. 注入选定任务上下文到 LoopManager（所有操作 prompt 将自动包含此信息）
        context_parts = [
            f"- 任务 ID: #{task_id}",
            f"- 标题: {task_title}",
            f"- 优先级: {task.get('priority', '未指定')}",
            f"- 来源: {task.get('source', task.get('project', '未指定'))}",
        ]
        self._loop.set_selected_task_context("\n".join(context_parts))

        # 3. 传播选定任务 ID 到下游组件
        self.control_interface.set_selected_task_id(task_id)
        self.task_interface.set_selected_task_id(task_id)
        self.task_interface._detail.set_selected_task_id(task_id)

        # 4. 持久化到 config（仅在值变化时写入，避免不必要的 I/O）
        config = self._loop.fm.load_config()
        prev_id = config.get("selected_task_id")
        if prev_id != task_id:
            config["selected_task_id"] = task_id
            self._loop.fm.save_config(config)

        if not silent:
            # 5. 日志记录 + 弹窗
            self._log("decision", f"★ 已选定任务 #{task_id}: {task_title}")
            from qfluentwidgets import InfoBar, InfoBarPosition
            InfoBar.success(
                title="任务已选定",
                content=f"当前操作目标：{task_title}\n点击「已选定」按钮可取消",
                orient=Qt.Orientation.Horizontal,
                isClosable=True,
                position=InfoBarPosition.TOP,
                duration=3000,
                parent=self,
            )

        # 6. 刷新队列视图以应用高亮
        self._refresh_all()

    def _on_task_unpinned(self):
        """「取消选定」操作 — 清除全局指向性目标"""
        self._selected_task = None

        # 1. 恢复窗口标题
        self.setWindowTitle("SuperTask")

        # 2. 清除任务规划页面的选定
        self.task_plan_interface.set_active_task(None)

        # 3. 清除下游组件
        self.control_interface.set_selected_task_id(None)
        self.task_interface.set_selected_task_id(None)
        self.task_interface._detail.set_selected_task_id(None)

        # 4. 清除 LoopManager 选定任务上下文
        self._loop.set_selected_task_context("")

        # 5. 持久化移除
        config = self._loop.fm.load_config()
        config.pop("selected_task_id", None)
        self._loop.fm.save_config(config)

        self._log("decision", "已取消选定任务")

        # 5. 刷新队列视图以移除高亮
        self._refresh_all()

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
        """移除选中的工作队列任务（原子操作）。
        未开始(pending)的任务 → 移回提议列表
        已完成(done/error/failed)的任务 → 移入历史
        """
        result = self._loop.fm.remove_from_approved_and_revert_pending(task_ids)
        parts = []
        if result["moved_back"]:
            parts.append(f"{result['moved_back']} 条移回提议列表")
        if result["moved_history"]:
            parts.append(f"{result['moved_history']} 条移入历史")
        self._log("decision", f"已移除 {len(task_ids)} 个任务：{'，'.join(parts)}")
        self._refresh_all()

    # ─── UI 刷新 ────────────────────────────────

    def _refresh_all(self):
        """刷新所有面板数据"""
        try:
            proposed = self._loop.fm.load_proposed()
            approved = self._loop.fm.load_approved()

            # 同步选定任务 ID 到下游组件（确保高亮一致）
            sel_id = self._selected_task.get("id") if self._selected_task else None
            self.control_interface.set_selected_task_id(sel_id)
            self.task_interface.set_selected_task_id(sel_id)

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

    # ─── 重启 ────────────────────────────────────

    def _save_window_geometry(self):
        """保存窗口位置、尺寸、最大化状态到 config

        注意：当窗口最大化时，self.x()/y()/width()/height() 返回的是
        最大化帧几何信息，而非用户期望的还原态坐标。因此最大化时使用
        normalGeometry() 保存还原后的位置和尺寸。
        """
        try:
            config = self._loop.fm.load_config()
            screen = self.screen()
            if self.isMaximized():
                ng = self.normalGeometry()
                config["window"] = {
                    "x": ng.x(), "y": ng.y(),
                    "width": ng.width(), "height": ng.height(),
                    "maximized": True,
                    "screen_name": screen.name() if screen else "",
                }
            else:
                config["window"] = {
                    "x": self.x(), "y": self.y(),
                    "width": self.width(), "height": self.height(),
                    "maximized": False,
                    "screen_name": screen.name() if screen else "",
                }
            # 通过 FileManager 原子写入（保持配置一致性）
            self._loop.fm.save_config(config)
        except Exception as e:
            print(f"[SuperTask] 保存窗口几何信息失败: {e}")

    def _on_restart_app(self):
        """重启应用，保存几何信息后启动新进程"""
        self._save_window_geometry()
        # 标记：restart 已保存几何，closeEvent 无需重复保存
        self._restarting = True
        # 用 Python 重新启动当前脚本
        script = os.path.join(os.path.dirname(os.path.dirname(__file__)), "main.py")
        python = sys.executable
        QProcess.startDetached(python, [script])
        QApplication.quit()

    # ─── 关闭处理 ────────────────────────────────

    def closeEvent(self, event):
        if not getattr(self, '_restarting', False):
            self._save_window_geometry()
        if self._loop.isRunning():
            self._loop.requestInterruption()
            self._loop.wait(3000)
            self._loop.runner.kill()
        event.accept()


def _restore_window_geometry(window: 'SuperTaskWindow', state_dir: str) -> bool:
    """从 config 恢复窗口位置、尺寸和最大化状态

    Returns:
        True 表示成功应用了保存的配置，False 表示没有可恢复的配置
    """
    import yaml
    config_path = os.path.join(state_dir, "config.yaml")
    try:
        if not os.path.isfile(config_path):
            return False
        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f) or {}
        win_cfg = config.get("window", {})
        if not win_cfg:
            return False

        # 尝试在保存的屏幕上定位
        screen_name = win_cfg.get("screen_name", "")
        target_screen = None
        if screen_name:
            app = QApplication.instance()
            for screen in app.screens():
                if screen.name() == screen_name:
                    target_screen = screen
                    break
            # 外接显示器已断连 → 回退到主屏幕
            if target_screen is None:
                target_screen = app.primaryScreen()

        if target_screen:
            window.setScreen(target_screen)

        # 验证尺寸有效性（防止 normalGeometry() 返回 (0,0,0,0) 的情况）
        saved_w = win_cfg.get("width", 0) or 0
        saved_h = win_cfg.get("height", 0) or 0
        saved_x = win_cfg.get("x")
        saved_y = win_cfg.get("y")

        if saved_w > 300 and saved_h > 200:
            if saved_x is not None and saved_y is not None:
                window.move(int(saved_x), int(saved_y))
            window.resize(int(saved_w), int(saved_h))
        # 否则保持 _init_window 设置的默认尺寸 (1280x800)

        if win_cfg.get("maximized"):
            window.showMaximized()
        else:
            # 非最大化配置：必须显式 showNormal()，否则窗口不可见
            window.showNormal()
        return True
    except Exception as e:
        print(f"[SuperTask] 恢复窗口几何信息失败: {e}")
        return False


def create_app(working_dir: str, state_dir: str, logs_dir: str) -> int:
    QApplication.setHighDpiScaleFactorRoundingPolicy(
        Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
    )
    app = QApplication(sys.argv)

    # 设置应用图标（影响所有窗口和对话框）
    _icon_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "supertask.ico")
    if os.path.isfile(_icon_path):
        app.setWindowIcon(QIcon(_icon_path))

    window = SuperTaskWindow(working_dir, state_dir, logs_dir)

    # 尝试从 config 恢复窗口位置（包括保存的显示器、尺寸、最大化状态）
    restored = _restore_window_geometry(window, state_dir)

    if not restored:
        # 首次启动：在鼠标所在屏幕最大化（避免覆盖任务栏）
        cursor_pos = QCursor.pos()
        screen = app.screenAt(cursor_pos)
        if screen:
            window.setScreen(screen)
        window.showMaximized()
    else:
        # 已有保存的配置 → 已精确恢复（含最大化状态），无需额外操作
        pass

    return app.exec()
