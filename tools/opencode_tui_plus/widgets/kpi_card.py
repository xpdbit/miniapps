"""KPI 指标卡片。"""

from __future__ import annotations

from textual.reactive import reactive
from textual.widgets import Static


class KPICard(Static):
    """KPI 指标卡片。

    显示：标签（accent color）、数值（bold）、变化指示。
    顶部边框颜色由 CSS class 驱动（accent-green/accent-blue/accent-orange/accent-gold）。
    高度 4 行。
    """

    DEFAULT_CSS = """
    KPICard {
        background: $surface;
        border: solid $surface-lighten-1;
        border-top: tall;
        height: 4;
        padding: 1 2;
        margin: 0 1;
    }
    KPICard.accent-green { border-top: tall $accent-green; }
    KPICard.accent-blue { border-top: tall $accent-blue; }
    KPICard.accent-orange { border-top: tall $accent-orange; }
    KPICard.accent-gold { border-top: tall $accent-gold; }
    """

    label = reactive("")
    value = reactive("--")
    delta = reactive("")
    delta_up = reactive(True)

    _ACCENT_LABEL_STYLE = {
        "green": "accent-green",
        "blue": "accent-blue",
        "orange": "accent-orange",
        "gold": "accent-gold",
    }

    def __init__(self, label: str = "", value: str = "--", delta: str = "",
                 delta_up: bool = True, accent: str = "blue", **kwargs):
        super().__init__(**kwargs)
        self.label = label
        self.value = value
        self.delta = delta
        self.delta_up = delta_up
        self._accent = accent
        self.add_class(f"accent-{accent}")

    def watch_label(self, val: str) -> None:
        self.refresh()

    def watch_value(self, val: str) -> None:
        self.refresh()

    def watch_delta(self, val: str) -> None:
        self.refresh()

    def render(self) -> str:
        lbl_style = self._ACCENT_LABEL_STYLE.get(self._accent, "accent-blue")
        lines = [f"[bold ${lbl_style}]{self.label}[/]"]
        lines.append(f"[bold]{self.value}[/]")
        if self.delta:
            style = "delta-up" if self.delta_up else "delta-down"
            lines.append(f"[{style}]{self.delta}[/]")
        return "\n".join(lines)