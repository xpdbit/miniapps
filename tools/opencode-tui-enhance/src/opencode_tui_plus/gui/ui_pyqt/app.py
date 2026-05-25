# -*- coding: utf-8 -*-
"""OCE PyQt6 主窗口 — FluentWindow + 3 导航页面。

对齐 SuperTask 的 gui/ui_pyqt/app.py 模式。
"""
from __future__ import annotations

import os
import sys
from typing import Optional

from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QAction, QIcon, QKeySequence
from PyQt6.QtWidgets import (
    QApplication, QHBoxLayout, QLabel, QMessageBox, QVBoxLayout, QWidget,
)
from qfluentwidgets import (
    FluentIcon as FIF,
    FluentWindow, NavigationItemPosition, setTheme, Theme,
    InfoBar, InfoBarPosition,
)

from ..core.config import OceConfig
from ..core.data_store import DataStore
from ..core.logger import OceLogger
from .overview_interface import OverviewInterface
from .api_history_interface import ApiHistoryInterface
from .settings_interface import SettingsInterface
from .quick_launch_interface import QuickLaunchInterface
from .tabs.automation import AutomationInterface
from .tabs.agent_status.agent_status_interface import AgentStatusInterface
from .tabs.logs.log_interface import LogInterface
from opencode_tui_plus.core.state_manager import StateManager
from opencode_tui_plus.core.runner import AgentRunner
from opencode_tui_plus.core.loop_engine import LoopEngine
from opencode_tui_plus.core.supervisor import Supervisor


class OceWindow(FluentWindow):
    """OCE 主窗口 — 4 导航页面：概览 / API 历史 / 快捷启动 / 设置。"""

    def __init__(self, config: Optional[OceConfig] = None):
        super().__init__()
        self._config = config or OceConfig()
        self._store = DataStore.get_instance()
        self._logger = OceLogger.get_instance()

        self._logger.info("正在初始化 OceWindow…")

        # ── 初始化核心模块 ──
        root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        state_dir = os.path.join(root_dir, "state")
        self._state_manager = StateManager(state_dir)
        self._runner = AgentRunner(root_dir)
        self._supervisor = Supervisor(state_dir, os.path.join(root_dir, "logs"))
        self._loop_engine = LoopEngine(self._state_manager, self._runner, self._supervisor)

        # 应用配置
        config_data = self._state_manager.load_config()
        self._loop_engine.apply_config(config_data)

        # ── 创建页面实例 ──
        self.overview_interface = OverviewInterface()
        self.overview_interface.setObjectName("overviewInterface")
        self.api_history_interface = ApiHistoryInterface()
        self.api_history_interface.setObjectName("apiHistoryInterface")
        self.quick_launch_interface = QuickLaunchInterface()
        self.quick_launch_interface.setObjectName("quickLaunchInterface")
        self.automation_interface = AutomationInterface(
            self._state_manager, self._runner, self._loop_engine
        )
        self.automation_interface.setObjectName("automationInterface")
        self.agent_status_interface = AgentStatusInterface(self._runner)
        self.agent_status_interface.setObjectName("agentStatusInterface")
        self.log_interface = LogInterface()
        self.log_interface.setObjectName("logInterface")
        self.settings_interface = SettingsInterface()
        self.settings_interface.setObjectName("settingsInterface")

        # 注册导航
        self._init_navigation()
        self._init_window()
        self._init_shortcuts()
        self._init_status_bar()

        # 定时刷新
        self._refresh_timer = QTimer(self)
        self._refresh_timer.timeout.connect(self._on_timer_refresh)
        self._start_refresh_loop()

        # 首次刷新
        QTimer.singleShot(300, self._on_force_refresh)

        # 连接 DataStore 更新 → UI
        self._store.subscribe(self._on_data_updated)

        # 连接设置页保存回调 → 动态更新
        self.settings_interface.set_on_config_saved(self._on_config_saved_handler)

        # 启动监管 Agent
        self._supervisor.start()
        self._logger.info("监管 Agent 已启动")

        # 恢复窗口几何
        QTimer.singleShot(0, self._restore_window_geometry)

    def _init_navigation(self):
        """注册导航页面。"""
        self.addSubInterface(self.overview_interface, FIF.HOME, "概览")
        self.addSubInterface(self.api_history_interface, FIF.HISTORY, "会话")
        self.addSubInterface(self.automation_interface, FIF.ROBOT, "自动化")
        self.addSubInterface(self.agent_status_interface, FIF.INFO, "状态")
        self.addSubInterface(self.log_interface, FIF.DOCUMENT, "日志")
        self.addSubInterface(self.settings_interface, FIF.SETTING, "设置")

    def _init_window(self):
        """初始化窗口属性。"""
        setTheme(Theme.DARK)

        # 设置窗口图标（优先 .ico，回退 .png）
        root_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        for name in ("oce.ico", "icon.png"):
            icon_path = os.path.join(root_dir, name)
            if os.path.isfile(icon_path):
                self.setWindowIcon(QIcon(icon_path))
                break

        self.setMinimumSize(900, 600)
        self.resize(1200, 800)
        self.setWindowTitle("oce — opencode-tui-enhance")

    def _init_shortcuts(self):
        """初始化全局快捷键。"""
        # Ctrl+R 强制刷新
        refresh_action = QAction("刷新", self)
        refresh_action.setShortcut(QKeySequence("Ctrl+R"))
        refresh_action.triggered.connect(self._on_force_refresh)
        self.addAction(refresh_action)

        # F1 帮助
        help_action = QAction("帮助", self)
        help_action.setShortcut(QKeySequence("F1"))
        help_action.triggered.connect(self._show_help)
        self.addAction(help_action)

        # Ctrl+Q 退出
        quit_action = QAction("退出", self)
        quit_action.setShortcut(QKeySequence("Ctrl+Q"))
        quit_action.triggered.connect(self.close)
        self.addAction(quit_action)

    def _init_status_bar(self):
        """初始化底部状态栏。"""
        self._status_label = QLabel("●  待机中")
        self._project_label = QLabel("")
        self._hint_label = QLabel("[F1 帮助]  [Ctrl+Q 退出]")

        # 创建自定义状态栏（FluentWindow 不继承 QMainWindow，无 statusBar）
        self._status_bar = QWidget()
        self._status_bar.setObjectName("statusBar")
        self._status_bar.setFixedHeight(28)
        self._status_bar.setStyleSheet("""
            #statusBar {
                background: #0d1117;
                border-top: 1px solid #30363d;
            }
            #statusBar QLabel {
                color: #8b949e;
                font-size: 12px;
                padding: 2px 4px;
            }
        """)
        sb_layout = QHBoxLayout(self._status_bar)
        sb_layout.setContentsMargins(8, 0, 8, 0)
        sb_layout.setSpacing(8)
        sb_layout.addWidget(self._status_label)
        sb_layout.addWidget(self._project_label, 1)
        sb_layout.addWidget(self._hint_label)

        # 将 stackedWidget + statusBar 放入垂直布局
        self._content_layout = QVBoxLayout()
        self._content_layout.setContentsMargins(0, 0, 0, 0)
        self._content_layout.setSpacing(0)
        self.widgetLayout.removeWidget(self.stackedWidget)
        self._content_layout.addWidget(self.stackedWidget, 1)
        self._content_layout.addWidget(self._status_bar)
        self.widgetLayout.addLayout(self._content_layout)

        # 设置项目名
        project_name = self._config.get("project", "name", default="")
        if project_name:
            self._project_label.setText(f"  {project_name}  ")

        # 初始状态
        self.set_status(online=False, text="初始化中...")

    def set_status(self, online: bool, text: str = ""):
        """更新状态栏。"""
        status_text = text or ("工作中" if online else "待机中")
        dot = "●" if online else "●"
        color = "#3fb950" if online else "#8b949e"
        self._status_label.setText(
            f'<span style="color:{color}">{dot}</span>  {status_text}'
        )
        self._status_label.setStyleSheet("font-size: 12px;")

    def flash_message(self, msg: str, duration_ms: int = 3000):
        """短暂显示提示消息。

        使用计数器避免连续调用导致状态残留。
        """
        self._flash_counter = getattr(self, "_flash_counter", 0) + 1
        counter = self._flash_counter
        if counter == 1:
            self._flash_restore_text = self._hint_label.text()
        self._hint_label.setText(msg)
        QTimer.singleShot(duration_ms, lambda c=counter: self._do_flash_restore(c))

    def _do_flash_restore(self, counter: int) -> None:
        """仅当 counter 仍匹配最新计数时才恢复文本。"""
        if counter != getattr(self, "_flash_counter", 0):
            return
        restore = getattr(self, "_flash_restore_text", "[F1 帮助]  [Ctrl+Q 退出]")
        self._hint_label.setText(restore)

    # ── 刷新 ──

    def _start_refresh_loop(self):
        """启动定时刷新。"""
        interval = self._config.get("oce", "refresh_interval_s", default=10)
        if not isinstance(interval, (int, float)):
            interval = 10
        self._refresh_timer.setInterval(int(interval) * 1000)
        self._refresh_timer.start()
        self._logger.info(f"定时刷新已启动 (间隔={int(interval)}s)")

    def _on_timer_refresh(self):
        """定时器触发刷新。"""
        self._store.refresh_overview()

    def _on_force_refresh(self):
        """Ctrl+R 强制刷新所有数据。"""
        self._store.refresh_overview()
        self._store.refresh_api_history()
        self._store.get_daily_stats_for_chart()
        # 通知 API 历史页重新渲染（它不订阅 DataStore）
        self.api_history_interface.refresh()
        # 刷新快捷启动状态
        self.quick_launch_interface.force_refresh()
        self._refresh_ui()
        self.flash_message("已刷新", 2000)

    def _on_data_updated(self):
        """DataStore 数据更新 → 刷新 UI。"""
        try:
            self._refresh_ui()
        except Exception as e:
            self._logger.error(f"UI 刷新失败: {e}")

    def _on_config_saved_handler(self):
        """设置页保存配置后回调：重新加载配置并更新刷新定时器。"""
        self._config.load()
        self._start_refresh_loop()
        self._logger.config("配置已通过设置页更新")

    def _refresh_ui(self):
        """刷新当前页面。

        各 Interface 通过 DataStore 订阅自动刷新 UI，
        此处仅更新状态栏。
        """
        is_online = self._store.available
        self.set_status(online=is_online)

    def _show_help(self):
        """F1 帮助弹窗。"""
        QMessageBox.information(
            self,
            "oce 帮助",
            "oce — opencode-tui-enhance\n\n"
            "opencode 的桌面管理工具。\n\n"
            "概览: 实时查看活跃会话、KPI 指标。\n"
            "API历史: 查看 API 调用记录与趋势。\n"
            "快捷启动: 一键启停本地开发服务 (MySQL/Redis/项目服务)。\n"
            "设置: 编辑 program.ocp 配置。\n\n"
            "快捷键:\n"
            "  Ctrl+R  强制刷新\n"
            "  Ctrl+F  搜索 (API历史页)\n"
            "  F1      帮助\n"
            "  Ctrl+Q  退出",
        )

    def _save_window_geometry(self):
        """保存窗口位置和尺寸到配置。"""
        try:
            cfg = self._config
            ng = self.normalGeometry()
            cfg.set("oce", "window_x", ng.x())
            cfg.set("oce", "window_y", ng.y())
            cfg.set("oce", "window_w", ng.width())
            cfg.set("oce", "window_h", ng.height())
            cfg.set("oce", "window_maximized", self.isMaximized())
            cfg.save()
        except Exception:
            pass

    def _restore_window_geometry(self):
        """从配置恢复窗口位置和尺寸。"""
        try:
            cfg = self._config
            wx = cfg.get("oce", "window_x")
            wy = cfg.get("oce", "window_y")
            ww = cfg.get("oce", "window_w")
            wh = cfg.get("oce", "window_h")
            maximized = cfg.get("oce", "window_maximized", default=False)
            if ww and wh and isinstance(ww, int) and isinstance(wh, int) and ww > 300 and wh > 200:
                if isinstance(wx, int) and isinstance(wy, int):
                    self.move(wx, wy)
                self.resize(ww, wh)
                if maximized:
                    self.showMaximized()
            else:
                self.showNormal()
        except Exception:
            self.showNormal()

    def closeEvent(self, e):
        """关闭窗口前保存状态并清理。"""
        self._logger.info("OceWindow 正在关闭…")
        self._save_window_geometry()
        self._refresh_timer.stop()
        self._supervisor.stop()
        # 取消 DataStore 订阅（窗口级 + 子组件级）
        self._store.unsubscribe(self._on_data_updated)
        self.overview_interface.cleanup()
        self.quick_launch_interface.cleanup()
        self.agent_status_interface.cleanup()
        self.log_interface.cleanup()
        super().closeEvent(e)


def create_app(config: Optional[OceConfig] = None) -> int:
    """创建并运行 OCE GUI 应用。"""
    logger = OceLogger.get_instance()

    QApplication.setHighDpiScaleFactorRoundingPolicy(
        Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
    )
    app = QApplication(sys.argv)

    # 设置应用图标（优先 .ico，回退 .png）
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    for name in ("oce.ico", "icon.png"):
        icon_path = os.path.join(root_dir, name)
        if os.path.isfile(icon_path):
            app.setWindowIcon(QIcon(icon_path))
            break

    window = OceWindow(config=config)
    window.show()

    # 覆写 qfluentwidgets 暗色主题中不必要的组件背景色，
    # 确保正文标签背景统一透明，消除文本背景色块问题
    app.setStyleSheet(app.styleSheet() + """
        QLabel, BodyLabel, CaptionLabel, StrongBodyLabel,
        SubtitleLabel, TitleLabel, DisplayLabel {
            background-color: transparent;
        }
    """)

    try:
        return app.exec()
    except SystemExit:
        return 0
