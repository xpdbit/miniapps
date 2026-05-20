"""左侧侧边栏 — Logo + Tab 切换。"""

from __future__ import annotations

from textual.binding import Binding
from textual.containers import Vertical
from textual.message import Message
from textual.widgets import Static

TABS = [
    ("overview", "●  概览"),
    ("api_history", "⏱  API历史"),
    ("settings", "⚙  设置"),
]


class TabChanged(Message):
    """侧边栏 Tab 切换消息。"""

    def __init__(self, tab_id: str) -> None:
        super().__init__()
        self.tab_id = tab_id


class Sidebar(Vertical):
    """左侧侧边栏组件。"""

    DEFAULT_CSS = """
    Sidebar {
        background: $surface;
        border-right: solid $surface-lighten-1;
        width: 20%;
        min-width: 18;
    }
    """

    BINDINGS = [
        Binding("tab", "next_tab", "下一 Tab"),
        Binding("shift+tab", "prev_tab", "上一 Tab"),
    ]

    def __init__(self, project_name: str = "", **kwargs):
        super().__init__(id="sidebar", **kwargs)
        self._project_name = project_name
        self._active_tab = "overview"
        self._tab_widgets: dict[str, Static] = {}
        self._tab_index = 0

    def compose(self):
        # Header
        with Vertical(id="sidebar-header"):
            yield Static("⚡ ocp", classes="logo")
            yield Static(self._project_name or "无项目", classes="project-name")
        # Tab buttons
        for tab_id, label in TABS:
            tab = Static(label, classes="sidebar-tab")
            if tab_id == self._active_tab:
                tab.add_class("-active")
            self._tab_widgets[tab_id] = tab
            yield tab

    def on_static_clicked(self, event: Static.Clicked) -> None:
        tab = event.static
        for tab_id, widget in self._tab_widgets.items():
            if widget is tab:
                self._activate_tab(tab_id)
                break

    def _activate_tab(self, tab_id: str) -> None:
        """切换激活 Tab。"""
        for tid, widget in self._tab_widgets.items():
            widget.remove_class("-active")
            if tid == tab_id:
                widget.add_class("-active")
                self._active_tab = tid
        for i, (tid, _) in enumerate(TABS):
            if tid == tab_id:
                self._tab_index = i
                break
        self.post_message(TabChanged(tab_id))

    def action_next_tab(self) -> None:
        self._tab_index = (self._tab_index + 1) % len(TABS)
        self._activate_tab(TABS[self._tab_index][0])

    def action_prev_tab(self) -> None:
        self._tab_index = (self._tab_index - 1) % len(TABS)
        self._activate_tab(TABS[self._tab_index][0])

    def set_active_tab(self, tab_id: str) -> None:
        if tab_id in self._tab_widgets:
            self._activate_tab(tab_id)

    def update_project_name(self, name: str) -> None:
        self._project_name = name
        header = self.query_one("#sidebar-header")
        if header:
            header.remove_children()
            header.mount(Static("⚡ ocp", classes="logo"))
            header.mount(Static(name or "无项目", classes="project-name"))
