"""项目切换弹窗。"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from textual.containers import Vertical
from textual.screen import ModalScreen
from textual.widgets import Input, ListItem, ListView, Static


class ProjectSwitcher(ModalScreen[Optional[str]]):
    """项目切换弹窗。显示项目列表，选中后返回项目路径。"""

    DEFAULT_CSS = """
    ProjectSwitcher {
        background: $surface;
        border: solid $surface-lighten-1;
        width: 40%;
        height: 50%;
    }
    ProjectSwitcher > Vertical {
        padding: 1 1;
    }
    #project-search {
        height: 3;
    }
    #project-list {
        height: 1fr;
    }
    """

    def __init__(self, projects: Optional[list[dict]] = None, **kwargs):
        super().__init__(**kwargs)
        self._projects = projects or []
        self._filtered: list[dict] = list(self._projects)

    def compose(self):
        with Vertical():
            yield Static("项目切换器", classes="logo")
            yield Input(placeholder="搜索项目...", id="project-search")
            yield ListView(id="project-list")

    def on_mount(self) -> None:
        self._render_list()

    def _render_list(self, query: str = "") -> None:
        list_view = self.query_one("#project-list", ListView)
        list_view.clear()
        if query:
            self._filtered = [
                p for p in self._projects
                if query.lower() in p.get("name", "").lower()
                or query.lower() in p.get("root", "").lower()
            ]
        else:
            self._filtered = list(self._projects)

        for p in self._filtered:
            name = p.get("name", "未命名")
            root = p.get("root", "")
            list_view.append(ListItem(Static(f"{name}  ({root})")))

    def on_input_changed(self, event: Input.Changed) -> None:
        self._render_list(event.value)

    def on_list_view_selected(self, event: ListView.Selected) -> None:
        idx = event.list_view.index
        if idx is not None and 0 <= idx < len(self._filtered):
            self.dismiss(self._filtered[idx].get("root"))
        else:
            self.dismiss(None)

    def on_key(self, event) -> None:
        if event.key == "escape":
            self.dismiss(None)
