"""模型选择下拉组件。异步获取可用模型列表，提供手动刷新按钮。"""

from __future__ import annotations

from textual.containers import Horizontal
from textual.widgets import Button, Select


class ModelSelector(Horizontal):
    """模型选择下拉 + 刷新按钮。

    启动时异步获取模型列表，失败时降级为预设常用列表。
    提供 [刷新] 按钮手动重新拉取。
    """

    DEFAULT_CSS = """
    ModelSelector {
        height: 3;
    }
    ModelSelector > Select {
        width: 1fr;
    }
    ModelSelector > Button {
        width: 8;
    }
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._select = Select(
            [("加载中...", "")],
            prompt="选择模型",
            id="model-select",
        )
        self._refresh_btn = Button("刷新", id="model-refresh-btn")
        self._models_loaded = False
        self._fetch_error = False

    def compose(self):
        yield self._select
        yield self._refresh_btn

    def on_mount(self) -> None:
        self.run_worker(self._fetch_models(), name="fetch-models")

    def on_button_clicked(self, event: Button.Clicked) -> None:
        if event.button.id == "model-refresh-btn":
            self._select.set_options([("刷新中...", "")])
            self.run_worker(self._fetch_models(), name="fetch-models")

    async def _fetch_models(self) -> None:
        """异步获取模型列表。"""
        try:
            import asyncio
            proc = await asyncio.create_subprocess_exec(
                "opencode", "models",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=10.0)
            except asyncio.TimeoutError:
                proc.kill()
                self._set_fallback()
                return

            lines = stdout.decode("utf-8", errors="replace").strip().split("\n")
            models = [l.strip() for l in lines if l.strip() and "/" in l]
            if not models:
                self._set_fallback()
                return

            options = [(m, m) for m in models]
            default = "deepseek/deepseek-v4-pro"
            try:
                idx = next(i for i, (_, v) in enumerate(options) if default in v)
                self._select.set_options(options)
                self._select.value = options[idx][1]
            except StopIteration:
                self._select.set_options(options)

            self._models_loaded = True
        except (FileNotFoundError, OSError):
            self._set_fallback()

    def _set_fallback(self) -> None:
        """降级为预设常用列表。"""
        self._fetch_error = True
        self._select.set_options([
            ("无法获取模型列表", ""),
            ("deepseek/deepseek-v4-pro", "deepseek/deepseek-v4-pro"),
            ("deepseek/deepseek-v3", "deepseek/deepseek-v3"),
            ("opencode-go/deepseek-v4-flash", "opencode-go/deepseek-v4-flash"),
        ])

    @property
    def value(self):
        return self._select.value

    @value.setter
    def value(self, val):
        self._select.value = val
