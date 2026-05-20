"""设置 Tab — 配置表单 + 快捷键参考。"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from textual.containers import Horizontal, Vertical
from textual.widgets import Button, Input, Select, Static

from app.data_store import DataStore
from core.ocp_config import OcpConfig
from widgets.model_selector import ModelSelector

THEME_OPTIONS = [
    ("GitHub Dark", "github-dark"),
    ("GitHub Light", "github-light"),
]

SHORTCUT_TABLE = [
    ("Tab / Shift+Tab", "全局", "切换 Tab"),
    ("↑ / ↓", "列表", "导航行"),
    ("Enter", "列表", "选中行 / 展开详情"),
    ("双击标题", "概览-会话列表", "跳转到终端窗口"),
    ("Ctrl+R", "全局", "强制刷新"),
    ("Ctrl+P", "全局", "项目切换器"),
    ("Ctrl+F", "API历史", "聚焦搜索框"),
    ("Ctrl+S", "设置", "保存配置"),
    ("Alt+A", "全局", "多项目汇总视图"),
    ("← / →", "API历史", "翻页"),
    ("Esc", "全局", "关闭详情 / 弹窗"),
    ("F1", "全局", "帮助"),
    ("Q / Ctrl+C", "全局", "退出确认"),
]


class SettingsTab(Vertical):
    """设置 Tab — 项目设置表单 + 快捷键参考。"""

    DEFAULT_CSS = """
    SettingsTab {
        background: $surface-darken-1;
    }
    #settings-container {
        padding: 1 2;
        height: auto;
        max-height: 20;
    }
    .setting-row {
        height: 3;
        padding: 0 1;
    }
    .setting-label {
        width: 16;
    }
    .setting-input {
        width: 1fr;
    }
    .dirty-indicator {
        color: $accent-blue;
        width: 2;
    }
    #shortcut-section {
        padding: 1 2;
        height: auto;
    }
    """

    def __init__(self, config: Optional[OcpConfig] = None, **kwargs):
        super().__init__(**kwargs)
        self._store = DataStore.get_instance()
        self._config = config or OcpConfig()
        self._save_btn = Button("保存 (Ctrl+S)", id="save-btn", variant="primary")
        self._dirty_labels: dict[str, Static] = {}

    def compose(self):
        with Vertical(id="settings-container"):
            yield Static("项目设置", classes="logo")
            # 只读项目路径
            with Horizontal(classes="setting-row"):
                yield Static("项目路径:", classes="setting-label muted")
                yield Input(
                    value=str(self._config.path.parent if self._config.path else ""),
                    id="setting-project-path", disabled=True,
                    classes="setting-input",
                )
            # 项目名称
            pn = self._config.get("project", "name", default="")
            if not isinstance(pn, str):
                pn = ""
            with Horizontal(classes="setting-row"):
                yield Static("项目名称:", classes="setting-label")
                yield Static("●", classes="dirty-indicator", id="dirty-name")
                yield Input(value=pn, id="setting-project-name", classes="setting-input")
            # 默认模型
            with Horizontal(classes="setting-row"):
                yield Static("默认模型:", classes="setting-label")
                yield Static("●", classes="dirty-indicator", id="dirty-model")
                yield ModelSelector(id="setting-model")
            # 刷新频率
            with Horizontal(classes="setting-row"):
                yield Static("刷新频率:", classes="setting-label")
                yield Static("●", classes="dirty-indicator", id="dirty-refresh")
                yield Select(
                    [
                        ("1s", "1"), ("3s", "3"), ("10s", "10"),
                        ("30s", "30"), ("60s", "60"), ("手动", "0"),
                    ],
                    value=str(self._config.get("ocp", "refresh_interval_s", default=10)),
                    id="setting-refresh",
                    classes="setting-input",
                )
            # 自动保存间隔
            with Horizontal(classes="setting-row"):
                yield Static("自动保存(s):", classes="setting-label")
                yield Static("●", classes="dirty-indicator", id="dirty-autosave")
                yield Input(
                    value=str(self._config.get("opencode", "auto_save_interval_s", default=300)),
                    id="setting-autosave",
                    classes="setting-input",
                )
            # 排除目录
            exclude_val = self._config.get("ocp", "exclude_dirs", default=[])
            if not isinstance(exclude_val, list):
                exclude_val = []
            with Horizontal(classes="setting-row"):
                yield Static("排除目录:", classes="setting-label")
                yield Static("●", classes="dirty-indicator", id="dirty-exclude")
                yield Input(
                    value=", ".join(str(s) for s in exclude_val),
                    id="setting-exclude", classes="setting-input",
                )
            # 主题
            theme_val = self._config.get("ocp", "theme", default="github-dark")
            if not isinstance(theme_val, str):
                theme_val = "github-dark"
            with Horizontal(classes="setting-row"):
                yield Static("主题:", classes="setting-label")
                yield Static("●", classes="dirty-indicator", id="dirty-theme")
                yield Select(
                    THEME_OPTIONS, value=theme_val,
                    id="setting-theme", classes="setting-input",
                )
            # 保存按钮
            yield self._save_btn
            yield Static("", id="save-status", classes="muted")

        # 快捷键参考
        with Vertical(id="shortcut-section"):
            yield Static("快捷键参考", classes="logo")
            for key, scope, desc in SHORTCUT_TABLE:
                with Horizontal(classes="setting-row"):
                    yield Static(f"{key:20}", classes="muted")
                    yield Static(f"{scope:12}")
                    yield Static(desc)

    def on_mount(self) -> None:
        self._dirty_labels = {
            "name": self.query_one("#dirty-name", Static),
            "model": self.query_one("#dirty-model", Static),
            "refresh": self.query_one("#dirty-refresh", Static),
            "autosave": self.query_one("#dirty-autosave", Static),
            "exclude": self.query_one("#dirty-exclude", Static),
            "theme": self.query_one("#dirty-theme", Static),
        }
        self._update_dirty_indicators()

    def _update_dirty_indicators(self) -> None:
        dirty = self._config.dirty_fields
        mapping = {
            "name": "project.name",
            "model": "opencode.default_model",
            "refresh": "ocp.refresh_interval_s",
            "autosave": "opencode.auto_save_interval_s",
            "exclude": "ocp.exclude_dirs",
            "theme": "ocp.theme",
        }
        for key, field in mapping.items():
            lbl = self._dirty_labels.get(key)
            if lbl:
                lbl.visible = field in dirty

    # ── 事件处理 ──

    def on_input_changed(self, event: Input.Changed) -> None:
        mapping = {
            "setting-project-name": ("project", "name"),
            "setting-autosave": ("opencode", "auto_save_interval_s"),
            "setting-exclude": ("ocp", "exclude_dirs"),
        }
        if event.input.id in mapping:
            keys = mapping[event.input.id]
            if keys[-1] == "exclude_dirs":
                self._config.set(*keys, [s.strip() for s in event.value.split(",") if s.strip()])
            elif keys[-1] == "auto_save_interval_s":
                try:
                    self._config.set(*keys, int(event.value))
                except ValueError:
                    pass
            else:
                self._config.set(*keys, event.value)
            self._update_dirty_indicators()

    def on_select_changed(self, event: Select.Changed) -> None:
        raw_value = event.value
        str_val = str(raw_value) if raw_value is not None else ""
        select_id = event.select.id
        mapping = {
            "setting-refresh": ("ocp", "refresh_interval_s"),
            "setting-theme": ("ocp", "theme"),
            "model-select": ("opencode", "default_model"),
        }
        if select_id in mapping:
            keys = mapping[select_id]
            if keys[-1] == "refresh_interval_s":
                try:
                    ival = int(str_val)
                except ValueError:
                    ival = 10
                self._config.set(*keys, ival)
                self._store.set_refresh_interval(ival)
            elif keys[-1] == "theme":
                self._config.set(*keys, str_val)
                self._store.theme = str_val
                from app.theme import switch_theme
                switch_theme(self.app, str_val)
            else:
                self._config.set(*keys, str_val)
            self._update_dirty_indicators()

    def on_button_clicked(self, event: Button.Clicked) -> None:
        if event.button.id == "save-btn":
            self._save_config()

    def action_save(self) -> None:
        """Ctrl+S 保存配置。"""
        self._save_config()

    def _save_config(self) -> None:
        ok = self._config.save()
        status = self.query_one("#save-status", Static)
        if ok:
            status.update("✓ 配置已保存")
            status.remove_class("delta-down")
            status.add_class("delta-up")
        else:
            status.update("✗ 保存失败，请检查文件权限")
            status.remove_class("delta-up")
            status.add_class("delta-down")
        self._update_dirty_indicators()
