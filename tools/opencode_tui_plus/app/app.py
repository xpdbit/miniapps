"""OcpApp — Textual 主应用。"""

from __future__ import annotations

from typing import Optional

from rich.text import Text
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.screen import ModalScreen
from textual.widgets import Static

from app.data_store import DataStore
from app.theme import build_theme_css
from core.ocp_config import OcpConfig
from tabs.api_history_tab import ApiHistoryTab
from tabs.overview_tab import OverviewTab
from tabs.settings_tab import SettingsTab
from widgets.sidebar import Sidebar, TabChanged
from widgets.status_footer import StatusFooter


class QuitDialog(ModalScreen[bool]):
    """退出确认弹窗。"""

    DEFAULT_CSS = """
    QuitDialog {
        background: $surface;
        border: solid $accent-red;
        width: 30;
        height: 8;
        padding: 1 2;
    }
    QuitDialog > Vertical {
        align: center middle;
    }
    """

    def compose(self) -> ComposeResult:
        with Vertical():
            yield Static("确认退出 ocp？", classes="logo")
            yield Static("  [Y] 确认    [N] 取消  ", classes="muted")

    def on_key(self, event) -> None:
        if event.key in ("y", "Y"):
            self.dismiss(True)
        elif event.key in ("n", "N", "escape"):
            self.dismiss(False)


class HelpDialog(ModalScreen[None]):
    """帮助弹窗。"""

    DEFAULT_CSS = """
    HelpDialog {
        background: $surface;
        border: solid $surface-lighten-1;
        width: 50%;
        height: 60%;
        padding: 1 2;
    }
    """

    def compose(self) -> ComposeResult:
        yield Static("ocp — opencode TUI Plus", classes="logo")
        yield Static(
            "opencode 的终端管理工具。\n\n"
            "快捷键: 请参考设置 Tab 的快捷键参考表。\n\n"
            "概览: 实时查看活跃会话、KPI 指标。\n"
            "API历史: 查看 API 调用记录与趋势。\n"
            "设置: 编辑 project.ocp 配置，切换主题。\n\n"
            "Esc 关闭此窗口。",
            classes="muted",
        )

    def on_key(self, event) -> None:
        if event.key == "escape":
            self.dismiss(None)


class OcpApp(App):
    """ocp 主应用。"""

    CSS = build_theme_css("github-dark")

    BINDINGS = [
        Binding("ctrl+r", "refresh", "刷新"),
        Binding("ctrl+p", "project_switcher", "项目切换"),
        Binding("ctrl+f", "focus_search", "搜索"),
        Binding("ctrl+s", "save_settings", "保存设置", False),
        Binding("f1", "help", "帮助"),
        Binding("q", "quit_app", "退出"),
        Binding("ctrl+c", "quit_app", "退出", False),
        Binding("alt+a", "toggle_all_projects", "所有项目"),
    ]

    def __init__(self, config: Optional[OcpConfig] = None, **kwargs):
        super().__init__(**kwargs)
        self._config = config or OcpConfig()
        self._store = DataStore.get_instance()
        project_name_val = self._config.get("project", "name", default="")
        if not isinstance(project_name_val, str):
            project_name_val = ""
        self._sidebar = Sidebar(
            project_name=project_name_val,
            id="sidebar-widget",
        )
        self._overview_tab = OverviewTab(id="content-overview")
        self._api_history_tab = ApiHistoryTab(id="content-api")
        self._settings_tab = SettingsTab(config=self._config, id="content-settings")
        self._footer = StatusFooter(id="status-footer-widget")
        self._current_tab = "overview"
        self._refresh_timer = None  # set_interval 返回值

    def compose(self) -> ComposeResult:
        with Horizontal():
            yield self._sidebar
            with Vertical():
                yield self._overview_tab
                yield self._api_history_tab
                yield self._settings_tab
        yield self._footer

    def on_mount(self) -> None:
        # 初始仅显示概览 Tab
        self._show_tab("overview")
        self._sidebar.set_active_tab("overview")

        # 初始化 DataStore
        if self._config.available:
            pn = self._config.get("project", "name", default="")
            if not isinstance(pn, str):
                pn = ""
            self._footer.set_project_name(pn)
        self._footer.set_status(online=False, text="初始化中...")

        # 首次刷新
        self.refresh_data()
        self._start_refresh_loop()

    def _start_refresh_loop(self) -> None:
        """启动定时刷新。"""
        interval_val = self._config.get("ocp", "refresh_interval_s", default=10)
        if not isinstance(interval_val, (int, float)):
            interval_val = 10
        self._refresh_timer = self.set_interval(float(interval_val), self.refresh_data)

    def _show_tab(self, tab_id: str) -> None:
        """显示指定 Tab，隐藏其他。"""
        self._overview_tab.display = tab_id == "overview"
        self._api_history_tab.display = tab_id == "api_history"
        self._settings_tab.display = tab_id == "settings"
        self._current_tab = tab_id

    # ── 消息处理 ──

    def on_sidebar_tab_changed(self, message: TabChanged) -> None:
        self._show_tab(message.tab_id)

    # ── Actions ──

    def action_refresh(self) -> None:
        """Ctrl+R 强制刷新。"""
        self.refresh_data()
        self._footer.flash_message("已刷新", 2000)

    def refresh_data(self) -> None:
        """刷新当前 Tab 的数据。"""
        self._store.refresh_overview()
        is_online = self._store.available
        self._footer.set_status(online=is_online)
        if self._current_tab == "overview":
            self._overview_tab.refresh_now()
        elif self._current_tab == "api_history":
            self._api_history_tab.refresh_now()

    def action_focus_search(self) -> None:
        """Ctrl+F 聚焦 API 历史搜索框。"""
        if self._current_tab == "api_history":
            search = self._api_history_tab.query_one("#api-search")
            if search:
                search.focus()

    def action_save_settings(self) -> None:
        """Ctrl+S 保存设置。"""
        if self._current_tab == "settings":
            self._settings_tab.action_save()

    def action_help(self) -> None:
        """F1 帮助弹窗。"""
        self.push_screen(HelpDialog())

    def action_quit_app(self) -> None:
        """Q / Ctrl+C 退出确认。"""
        self.push_screen(QuitDialog(), self._on_quit_result)

    def _on_quit_result(self, confirmed: Optional[bool]) -> None:
        if confirmed:
            self.exit()

    def action_project_switcher(self) -> None:
        """Ctrl+P 项目切换。"""
        projects_val = self._config.get("projects", default=[])
        if not isinstance(projects_val, list):
            projects_val = []
        projects: list[dict] = projects_val
        if not projects:
            self._footer.flash_message("当前仅存在单个项目", 2000)
            return
        from widgets.project_switcher import ProjectSwitcher
        self.push_screen(ProjectSwitcher(projects), self._on_project_switch)

    def _on_project_switch(self, project_root: Optional[str]) -> None:
        if project_root:
            self._footer.flash_message(f"切换到: {project_root}", 2000)

    def action_toggle_all_projects(self) -> None:
        """Alt+A 多项目汇总视图。"""
        self._footer.flash_message("多项目汇总视图", 2000)
