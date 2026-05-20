"""plotext 趋势图 — Token / 成本日趋势切换。"""

from __future__ import annotations

from typing import Optional

from textual.containers import Horizontal
from textual.widgets import Button, Static
from textual_plotext import PlotextPlot

from app.data_store import DataStore


class TrendChart(Horizontal):
    """Token / 成本日趋势折线图。"""

    DEFAULT_CSS = """
    TrendChart {
        height: 12;
    }
    #chart-toggle {
        height: 3;
    }
    #chart-plot {
        height: 9;
    }
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._store = DataStore.get_instance()
        self._show_tokens = True
        self._plot: Optional[PlotextPlot] = None

    def compose(self):
        with Horizontal(id="chart-toggle"):
            yield Button("Token", id="btn-tokens", variant="primary")
            yield Button("成本", id="btn-cost")
        self._plot = PlotextPlot(id="chart-plot")
        yield self._plot

    def on_mount(self) -> None:
        self._render_chart()

    def on_button_clicked(self, event: Button.Clicked) -> None:
        if event.button.id == "btn-tokens":
            self._show_tokens = True
            self.query_one("#btn-tokens", Button).variant = "primary"
            self.query_one("#btn-cost", Button).variant = "default"
        else:
            self._show_tokens = False
            self.query_one("#btn-tokens", Button).variant = "default"
            self.query_one("#btn-cost", Button).variant = "primary"
        self._render_chart()

    def refresh_chart(self) -> None:
        self._render_chart()

    def _render_chart(self) -> None:
        if not self._plot:
            return
        data = self._store.get_daily_stats_for_chart()
        if not data:
            self._plot.plt.clf()
            self._plot.plt.title("暂无数据")
            self._plot.refresh()
            return

        # plotext API
        plt = self._plot.plt
        plt.clf()
        dates = [d.get("date", "")[-5:] for d in data]  # MM-DD
        dates.reverse()
        n = len(dates)

        if self._show_tokens:
            vals = [d.get("total_tokens_input", 0) / 1000 for d in data]
            vals.reverse()
            plt.title("每日 Token 消耗 (K)")
            plt.plot(dates, vals, label="Token", color="blue")
        else:
            vals = [d.get("total_cost", 0) for d in data]
            vals.reverse()
            plt.title("每日成本 ($)")
            plt.plot(dates, vals, label="Cost", color="gold")

        plt.xlabel("日期")
        if n > 20:
            plt.xticks(dates[::max(1, n // 10)])
        plt.theme("dark")
        self._plot.refresh()
