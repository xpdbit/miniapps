# -*- coding: utf-8 -*-
"""api_history_interface.py — API 调用历史页面

包含趋势图（matplotlib）和统计摘要。
"""

from __future__ import annotations

from typing import Any, Optional

from PyQt6.QtWidgets import (
    QHBoxLayout,
    QLabel,
    QPushButton,
    QVBoxLayout,
    QWidget,
)
from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QShowEvent, QHideEvent
from qfluentwidgets import BodyLabel, CaptionLabel, ComboBox

from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg
from matplotlib.figure import Figure

from ..core.data_store import DataStore

__all__ = [
    "ApiHistoryInterface",
]

# ── 暗色主题 ──────────────────────────────────
DARK_BG = "#0d1117"
CARD_BG = "#161b22"
BORDER = "#30363d"
TEXT_PRIMARY = "#e6edf3"
TEXT_SECONDARY = "#8b949e"
ACCENT_BLUE = "#58a6ff"
ACCENT_GREEN = "#3fb950"
ACCENT_ORANGE = "#d29922"

# 图表颜色
CHART_COLORS = {
    "face": DARK_BG,
    "axes": "#161b22",
    "grid": "#21262d",
    "text": TEXT_SECONDARY,
    "line_token": ACCENT_BLUE,
    "line_cost": ACCENT_GREEN,
    "fill_token": "#58a6ff33",
    "fill_cost": "#3fb95033",
}

DAYS_OPTIONS = [
    ("今天", 1),
    ("3天", 3),
    ("7天", 7),
    ("30天", 30),
    ("全部", 9999),
]


class ApiTrendChart(QWidget):
    """API 调用趋势图（matplotlib 嵌入），支持 Token / 成本模式切换。"""

    def __init__(self, parent: Optional[QWidget] = None):
        super().__init__(parent)
        self._chart_mode: str = "token"  # "token" | "cost"
        self._data: list[dict[str, Any]] = []

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(6)

        # 模式切换按钮行
        btn_row = QHBoxLayout()
        btn_row.setSpacing(8)
        self._token_btn = QPushButton("Token", self)
        self._cost_btn = QPushButton("成本", self)
        self._token_btn.setFixedHeight(28)
        self._cost_btn.setFixedHeight(28)
        self._token_btn.clicked.connect(lambda: self._set_mode("token"))
        self._cost_btn.clicked.connect(lambda: self._set_mode("cost"))
        self._apply_toggle_style()

        btn_row.addWidget(self._token_btn)
        btn_row.addWidget(self._cost_btn)
        btn_row.addStretch()
        layout.addLayout(btn_row)

        # matplotlib FigureCanvas
        self._fig = Figure(figsize=(8, 2.2), dpi=100)
        self._fig.patch.set_facecolor(CHART_COLORS["face"])
        self._ax = self._fig.add_subplot(111)
        self._style_axes()
        self._canvas = FigureCanvasQTAgg(self._fig)
        self._canvas.setStyleSheet(f"background-color: {DARK_BG};")
        layout.addWidget(self._canvas)

        # 默认模式高亮
        self._set_mode("token")

    # ── 模式切换 ──

    def _set_mode(self, mode: str) -> None:
        self._chart_mode = mode
        self._apply_toggle_style()
        self._redraw()

    def _apply_toggle_style(self) -> None:
        active_bg = ACCENT_BLUE
        inactive_bg = "#21262d"
        active_fg = "#ffffff"
        inactive_fg = TEXT_SECONDARY

        self._token_btn.setStyleSheet(
            f"background-color: {active_bg if self._chart_mode == 'token' else inactive_bg};"
            f"color: {active_fg if self._chart_mode == 'token' else inactive_fg};"
            f"border: 1px solid {BORDER}; border-radius: 4px; padding: 2px 12px;"
        )
        self._cost_btn.setStyleSheet(
            f"background-color: {active_bg if self._chart_mode == 'cost' else inactive_bg};"
            f"color: {active_fg if self._chart_mode == 'cost' else inactive_fg};"
            f"border: 1px solid {BORDER}; border-radius: 4px; padding: 2px 12px;"
        )

    # ── 数据 ──

    def set_data(self, data: list[dict[str, Any]]) -> None:
        self._data = data or []
        self._redraw()

    # ── 渲染 ──

    def _style_axes(self) -> None:
        self._ax.set_facecolor(CHART_COLORS["axes"])
        self._ax.spines["top"].set_color(BORDER)
        self._ax.spines["right"].set_color(BORDER)
        self._ax.spines["bottom"].set_color(BORDER)
        self._ax.spines["left"].set_color(BORDER)
        self._ax.tick_params(colors=TEXT_SECONDARY, labelsize=8)
        self._ax.xaxis.label.set_color(TEXT_SECONDARY)
        self._ax.yaxis.label.set_color(TEXT_SECONDARY)

    def _redraw(self) -> None:
        self._ax.clear()
        self._style_axes()

        if not self._data:
            self._ax.text(0.5, 0.5, "暂无数据", ha="center", va="center",
                          color=TEXT_SECONDARY, fontsize=10, transform=self._ax.transAxes)
            self._canvas.draw_idle()
            return

        # 按日期排序
        sorted_data = sorted(self._data, key=lambda d: d.get("date", ""))

        dates = [d.get("date", "")[-5:] for d in sorted_data]  # 仅 MM-DD

        if self._chart_mode == "token":
            values = [d.get("total_tokens_input", 0) / 1000.0 for d in sorted_data]
            ylabel = "每日Token消耗(K)"
            line_color = CHART_COLORS["line_token"]
            fill_color = CHART_COLORS["fill_token"]
        else:
            values = [d.get("total_cost", 0) for d in sorted_data]
            ylabel = "每日成本($)"
            line_color = CHART_COLORS["line_cost"]
            fill_color = CHART_COLORS["fill_cost"]

        self._ax.set_ylabel(ylabel, fontsize=9)
        self._ax.plot(dates, values, color=line_color, linewidth=1.5, marker="o", markersize=3)
        self._ax.fill_between(range(len(values)), values, alpha=0.12, color=fill_color)
        self._fig.tight_layout(pad=1.2)
        self._canvas.draw_idle()


# ── 主页面 ──────────────────────────────────────

class ApiHistoryInterface(QWidget):
    """API 调用历史页面 — 趋势图 + 统计摘要（已移除会话列表）。"""

    def __init__(self, parent: Optional[QWidget] = None):
        super().__init__(parent)
        self._store = DataStore.get_instance()

        # 数据缓存
        self._last_chart_hash: str = ""

        # 定时刷新
        self._refresh_timer = QTimer(self)
        self._refresh_timer.timeout.connect(self._fetch_and_render)
        self._refresh_timer.setInterval(30_000)  # 30s（无列表，可降低频率）

        self._build_ui()
        self._fetch_and_render()

    # ── UI 构建 ──────────────────────────────

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(12)

        # ── 过滤栏 ──
        filter_row = QHBoxLayout()
        filter_row.setSpacing(12)

        # 时间范围（仅对趋势图有效）
        self._days_combo = ComboBox(self)
        for label, _ in DAYS_OPTIONS:
            self._days_combo.addItem(label)
        self._days_combo.setCurrentIndex(2)  # 7天
        self._days_combo.setMinimumWidth(100)
        self._days_combo.setPlaceholderText("时间范围")
        self._days_combo.currentIndexChanged.connect(self._on_days_changed)

        time_label = BodyLabel("时间范围:")
        time_label.setStyleSheet("background: transparent; border: none;")
        filter_row.addWidget(time_label)
        filter_row.addWidget(self._days_combo)
        filter_row.addStretch()
        layout.addLayout(filter_row)

        # ── 摘要栏 ──
        self._summary_label = CaptionLabel("")
        self._summary_label.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 12px; background: transparent; border: none;")
        layout.addWidget(self._summary_label)

        # ── 趋势图 ──
        self._trend_chart = ApiTrendChart(self)
        layout.addWidget(self._trend_chart, 1)

    # ── 事件 ──────────────────────────────────

    def _on_days_changed(self, index: int) -> None:
        if 0 <= index < len(DAYS_OPTIONS):
            days = DAYS_OPTIONS[index][1]
            self._store.set_api_days(days)
            self._fetch_and_render()

    # ── 数据刷新 ──────────────────────────────

    def refresh(self) -> None:
        """公开刷新接口（供 OceWindow Ctrl+R 调用）。"""
        self._fetch_and_render()

    def _fetch_and_render(self) -> None:
        """更新趋势图 + 摘要。"""
        # 更新摘要
        self._render_summary()

        # 更新图表（带 hash 检测避免无变化重绘）
        chart_data = self._store.get_daily_stats_for_chart()
        chart_hash = str(len(chart_data))
        if chart_hash != self._last_chart_hash:
            self._trend_chart.set_data(chart_data)
            self._last_chart_hash = chart_hash

    def _render_summary(self) -> None:
        """更新摘要文字。"""
        store = self._store
        summary = store.summary_stats

        days_label = self._days_combo.currentText()
        total_tokens = summary.get("total_tokens_input", 0) + summary.get("total_tokens_output", 0)
        total_cost = summary.get("total_cost", 0)

        # 从 daily_stats 取调用次数（可跨所有 filter）
        daily = store.daily_stats
        total_calls = sum(d.get("sessions_total", 0) for d in daily)

        self._summary_label.setText(
            f"{days_label}内共 {total_calls} 次调用"
            f"  |  总Token: {store.fmt_tokens(total_tokens)}"
            f"  |  总成本: {store.fmt_cost(total_cost)}"
        )

    # ── 生命周期 ──────────────────────────────

    def showEvent(self, a0: QShowEvent | None) -> None:  # type: ignore[override]
        """首次显示 / 重新显示时刷新数据 + 启动定时器。"""
        super().showEvent(a0)
        self._fetch_and_render()
        self._refresh_timer.start()

    def hideEvent(self, a0: QHideEvent | None) -> None:  # type: ignore[override]
        """页面隐藏时停止定时器。"""
        super().hideEvent(a0)
        if self._refresh_timer.isActive():
            self._refresh_timer.stop()
