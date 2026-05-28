# -*- coding: utf-8 -*-
"""overview_interface.py — OCE 概览仪表盘

OverviewInterface 提供概览仪表盘页面，包含：
- 筛选栏（周期 + 刷新间隔）
- KPI 卡片行（活跃会话数/时长/Token/成本）
- 错误横幅（DataStore 连续失败提示）
- 会话概览表格（标题/时长/输出时间/时距/服务商）
"""

from __future__ import annotations

import time
from typing import Any, Optional

from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtWidgets import (
    QFrame, QGridLayout, QHBoxLayout, QHeaderView, QLabel,
    QPushButton, QStackedWidget, QTableWidget, QTableWidgetItem,
    QVBoxLayout, QWidget,
)
from PyQt6.QtGui import QColor
from PyQt6.QtCore import pyqtSignal
from qfluentwidgets import (
    BodyLabel, CaptionLabel, ComboBox,
    StrongBodyLabel,
)

from ..core.data_store import DataStore
from ..core.window_focus import focus_terminal_window


__all__ = ["OverviewInterface"]

# ── 暗色主题色板 ──

DARK_BG = "#0d1117"
CARD_BG = "#161b22"
BORDER = "#30363d"
TEXT_PRIMARY = "#e6edf3"
TEXT_SECONDARY = "#8b949e"
ACCENT_GREEN = "#3fb950"
ACCENT_ORANGE = "#f0883e"
ACCENT_BLUE = "#58a6ff"
ACCENT_GOLD = "#d29922"
ACCENT_RED = "#f85149"
STATUS_GRAY = "#484f58"

# ── 会话状态定义 ──
# 根据距最后输出的时长判断状态
STATUS_ACTIVE = 0       # <30s
STATUS_IDLE = 1         # >=30s

_STATUS_DEFS: dict[int, tuple[str, str, str]] = {
    STATUS_ACTIVE: ("●", "活跃", ACCENT_GREEN),
    STATUS_IDLE: ("○", "空闲", STATUS_GRAY),
}


def _get_session_status(elapsed: float) -> tuple[str, str, str]:
    """返回 (dot_char, status_text, color_hex)"""
    if elapsed < 30:
        return _STATUS_DEFS[STATUS_ACTIVE]
    return _STATUS_DEFS[STATUS_IDLE]


# ── ComboBox 通用样式 ──

_COMBO_STYLE = f"""
    ComboBox {{ background: {CARD_BG}; color: {ACCENT_BLUE}; border: 1px solid {BORDER};
               border-radius: 4px; padding: 2px 8px; font-size: 12px; }}
    ComboBox:hover {{ border-color: {ACCENT_BLUE}; }}
    ComboBox::drop-down {{ border: none; width: 20px; }}
    ComboBox QAbstractItemView {{
        background-color: {CARD_BG}; color: {TEXT_PRIMARY};
        border: 1px solid {BORDER}; border-radius: 4px;
        selection-background-color: #1f6feb44;
        selection-color: {ACCENT_BLUE};
        padding: 2px;
        outline: none;
    }}
    ComboBox QAbstractItemView::item {{
        padding: 4px 8px; border-radius: 3px;
    }}
    ComboBox QAbstractItemView::item:hover {{
        background-color: #1f6feb33;
    }}
"""

# ── KPI 卡片 ──


class KpiCard(QFrame):
    """KPI 指标卡片，带彩色顶部边框（3px）。

    Args:
        title: 指标名称
        initial_value: 初始显示值
        color: 顶部边框颜色
    """

    def __init__(self, title: str, initial_value: str, color: str,
                 parent: QWidget | None = None):
        super().__init__(parent)
        self.setFixedHeight(100)
        self.setStyleSheet(f"""
            KpiCard {{
                background-color: {CARD_BG};
                border-top: 3px solid {color};
                border-top-left-radius: 8px;
                border-top-right-radius: 8px;
                border-left: 1px solid {BORDER};
                border-right: 1px solid {BORDER};
                border-bottom: 1px solid {BORDER};
                border-bottom-left-radius: 8px;
                border-bottom-right-radius: 8px;
            }}
        """)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 10, 16, 10)
        layout.setSpacing(4)

        self._title_label = CaptionLabel(title)
        self._title_label.setStyleSheet(
            f"color: {TEXT_SECONDARY}; font-size: 12px; border: none; "
            f"background: transparent;")
        layout.addWidget(self._title_label)

        self._value_label = StrongBodyLabel(initial_value)
        self._value_label.setStyleSheet(
            f"color: {TEXT_PRIMARY}; font-size: 24px; border: none; "
            f"background: transparent;")
        layout.addWidget(self._value_label)

        layout.addStretch()

    def set_value(self, value: str) -> None:
        """更新指标值"""
        self._value_label.setText(value)


# ── 网格布局计算 ──


def _calc_grid(n: int) -> tuple[int, int]:
    """计算 n 个方块的最佳 (列数, 行数)，填满视图区域。"""
    if n <= 0:
        return (1, 1)
    if n <= 2:
        return (n, 1)       # 1→1×1, 2→2×1
    if n <= 3:
        return (3, 1)       # 3→3×1
    if n <= 4:
        return (2, 2)       # 4→2×2
    if n <= 6:
        return (3, 2)       # 5-6→3×2
    cols = 3
    rows = (n + cols - 1) // cols
    return (cols, rows)     # 7+→3×N


# ── 会话卡片 ──


class SessionCardWidget(QFrame):
    """会话状态方块卡片：背景色与状态一致，内部显示标题/时长等信息。"""

    clicked = pyqtSignal(str)  # session_id

    def __init__(self, session: dict, parent: QWidget | None = None):
        super().__init__(parent)
        self._session = session
        self._sid: str = session.get("session_id", "")

        now = time.time()
        last_ts = (session.get("time_updated_effective", 0) or
                   session.get("time_updated", 0) or
                   session.get("time_created", 0) or 0)
        self._last_ts = last_ts
        elapsed = now - last_ts / 1000 if last_ts else 9999
        _dot, status_text, self._status_color = _get_session_status(elapsed)

        dur_ms = session.get("duration_ms", 0) or 0
        title = session.get("title", "") or "-"
        title_short = title[:80] + "..." if len(title) > 80 else title

        provider = session.get("model_id", "") or "-"
        provider_short = provider.split("/")[-1][:20] if "/" in provider else provider[:20]

        # 将状态色转为半透明背景
        bg_color = self._hex_to_rgba(self._status_color, 0.18)
        border_color = self._hex_to_rgba(self._status_color, 0.5)

        self.setStyleSheet(f"""
            SessionCardWidget {{
                background-color: {bg_color};
                border: 2px solid {border_color};
                border-radius: 10px;
            }}
            SessionCardWidget:hover {{
                border-color: {self._status_color};
                background-color: {self._hex_to_rgba(self._status_color, 0.25)};
            }}
        """)
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setMinimumSize(160, 100)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 12, 16, 12)
        layout.setSpacing(4)

        # 状态行：圆点 + 状态文字 + 服务商
        top_row = QHBoxLayout()
        top_row.setSpacing(6)
        self._dot_label = QLabel(f"{_dot} {status_text}")
        self._dot_label.setStyleSheet(f"color: {self._status_color}; font-size: 13px; font-weight: bold; "
                                      f"background: transparent; border: none;")
        top_row.addWidget(self._dot_label)
        top_row.addStretch()
        prov_label = QLabel(provider_short)
        prov_label.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 11px; "
                                 f"background: transparent; border: none;")
        top_row.addWidget(prov_label)
        layout.addLayout(top_row)

        # 标题
        title_label = QLabel(title_short)
        title_label.setWordWrap(True)
        title_label.setStyleSheet(f"color: {TEXT_PRIMARY}; font-size: 15px; font-weight: 600; "
                                  f"background: transparent; border: none;")
        layout.addWidget(title_label)

        layout.addStretch()

        # 底部信息行：活跃时长 + 空闲时长
        info_row = QHBoxLayout()
        info_row.setSpacing(12)
        dur_text = DataStore.fmt_duration(dur_ms / 1000)
        self._dur_label = QLabel(f"\u23f1 {dur_text}")
        self._dur_label.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 11px; "
                                      f"background: transparent; border: none;")
        info_row.addWidget(self._dur_label)
        idle_text = DataStore.fmt_elapsed_since(last_ts)
        self._idle_label = QLabel(f"\u23f3 {idle_text}")
        self._idle_label.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 11px; "
                                       f"background: transparent; border: none;")
        info_row.addWidget(self._idle_label)
        info_row.addStretch()
        layout.addLayout(info_row)

    def update_elapsed(self, session: dict | None = None) -> None:
        """增量更新动态内容：状态圆点、空闲时长。避免全量重建卡片。

        Args:
            session: 可选的新 session 数据（仅在 DataStore 刷新后传入，
                     更新 duration_ms 等静态字段）。
        """
        if session is not None:
            self._session = session
            # 更新可能变化的静态字段
            dur_ms = session.get("duration_ms", 0) or 0
            new_last_ts = (session.get("time_updated_effective", 0) or
                           session.get("time_updated", 0) or
                           session.get("time_created", 0) or 0)
            if new_last_ts:
                self._last_ts = new_last_ts
            self._dur_label.setText(f"\u23f1 {DataStore.fmt_duration(dur_ms / 1000)}")

        # 动态字段：基于当前时间重新计算
        now = time.time()
        elapsed = now - self._last_ts / 1000 if self._last_ts else 9999
        _dot, status_text, new_color = _get_session_status(elapsed)

        # 仅在状态颜色变化时更新样式（避免频繁重绘）
        if new_color != self._status_color:
            self._status_color = new_color
            bg_color = self._hex_to_rgba(new_color, 0.18)
            border_color = self._hex_to_rgba(new_color, 0.5)
            self.setStyleSheet(f"""
                SessionCardWidget {{
                    background-color: {bg_color};
                    border: 2px solid {border_color};
                    border-radius: 10px;
                }}
                SessionCardWidget:hover {{
                    border-color: {new_color};
                    background-color: {self._hex_to_rgba(new_color, 0.25)};
                }}
            """)

        self._dot_label.setText(f"{_dot} {status_text}")
        self._dot_label.setStyleSheet(
            f"color: {new_color}; font-size: 13px; font-weight: bold; "
            f"background: transparent; border: none;")
        self._idle_label.setText(f"\u23f3 {DataStore.fmt_elapsed_since(self._last_ts)}")

    @staticmethod
    def _hex_to_rgba(hex_color: str, alpha: float) -> str:
        """将 #RRGGBB 转为 rgba(r,g,b,a)。"""
        h = hex_color.lstrip("#")
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        return f"rgba({r}, {g}, {b}, {alpha})"

    def mousePressEvent(self, a0):
        """点击卡片 → 聚焦终端窗口。"""
        if self._sid:
            self.clicked.emit(self._sid)
        super().mousePressEvent(a0)

    @property
    def session_id(self) -> str:
        return self._sid


# ── 会话卡片视图 ──


class SessionCardView(QWidget):
    """会话卡片容器：QStackedWidget 分隔空状态与卡片网格。"""

    card_clicked = pyqtSignal(str)  # session_id

    def __init__(self, parent: QWidget | None = None):
        super().__init__(parent)
        self._cards: list[SessionCardWidget] = []

        # 主堆栈：第 0 页 = 空状态，第 1 页 = 卡片网格
        self._stack = QStackedWidget(self)

        # 第 0 页：空状态
        empty_page = QWidget()
        empty_layout = QVBoxLayout(empty_page)
        empty_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)
        empty_label = QLabel("暂无会话数据")
        empty_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        empty_label.setStyleSheet(
            "color: #484f58; font-size: 14px; background: transparent; border: none;")
        empty_layout.addWidget(empty_label)
        self._stack.addWidget(empty_page)

        # 第 1 页：卡片网格
        self._card_page = QWidget()
        self._grid = QGridLayout(self._card_page)
        self._grid.setContentsMargins(0, 0, 0, 0)
        self._grid.setSpacing(10)
        self._stack.addWidget(self._card_page)

        # 主布局
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.addWidget(self._stack)

        self._stack.setCurrentIndex(0)

    def set_sessions(self, sessions: list[dict]) -> None:
        """设置会话数据并重排方块（增量更新，复用已有卡片）。"""
        if not sessions:
            # 清理所有旧卡片
            for card in self._cards:
                self._grid.removeWidget(card)
                card.deleteLater()
            self._cards.clear()
            self._stack.setCurrentIndex(0)
            return

        # 建立现有卡片映射 (session_id → card)
        existing: dict[str, SessionCardWidget] = {}
        for card in self._cards:
            existing[card.session_id] = card

        new_sids = {s.get("session_id", "") for s in sessions}

        # 移除不再存在的卡片
        removed_sids = set(existing.keys()) - new_sids
        for sid in removed_sids:
            card = existing.pop(sid)
            self._grid.removeWidget(card)
            card.deleteLater()
            if card in self._cards:
                self._cards.remove(card)

        # 增量更新：复用已有卡片或创建新卡片
        new_cards: list[SessionCardWidget] = []
        for sess in sessions:
            sid = sess.get("session_id", "")
            if sid in existing:
                card = existing[sid]
                # 增量更新静态字段（duration 可能在 DataStore 刷新后变化）
                card.update_elapsed(sess)
                new_cards.append(card)
            else:
                card = SessionCardWidget(sess, self)
                card.clicked.connect(self.card_clicked.emit)
                new_cards.append(card)

        # 清理未使用的旧引用
        for sid in set(existing.keys()) - {c.session_id for c in new_cards}:
            card = existing[sid]
            self._grid.removeWidget(card)
            card.deleteLater()

        self._cards = new_cards

        # 重新排列网格
        cols, rows = _calc_grid(len(new_cards))

        # 重置拉伸
        for c in range(4):
            self._grid.setColumnStretch(c, 0)
        for r in range(12):
            self._grid.setRowStretch(r, 0)

        for i, card in enumerate(new_cards):
            self._grid.addWidget(card, i // cols, i % cols)

        for r in range(rows):
            self._grid.setRowStretch(r, 1)
        for c in range(cols):
            self._grid.setColumnStretch(c, 1)

        self._stack.setCurrentIndex(1)

    def update_elapsed_all(self) -> None:
        """每秒增量更新所有卡片的动态字段（状态、空闲时长）。"""
        for card in self._cards:
            card.update_elapsed()


# ── 概览仪表盘 ──


class OverviewInterface(QWidget):
    """概览仪表盘页面。

    周期性从 DataStore 拉取概览数据，展示 KPI 卡片和会话列表。
    """

    PERIOD_OPTIONS: list[tuple[str, str]] = [
        ("日", "1d"),
        ("3日", "3d"),
        ("周", "1w"),
        ("月", "1m"),
        ("年", "1y"),
        ("全部", "all"),
    ]

    REFRESH_OPTIONS: list[tuple[str, int]] = [
        ("1s", 1),
        ("3s", 3),
        ("10s", 10),
        ("30s", 30),
        ("60s", 60),
        ("手动", 0),
    ]

    TABLE_HEADERS: list[str] = [
        "状态", "标题", "活跃时长", "最后输出", "空闲时长", "服务商",
    ]

    VIEW_LIST = 0
    VIEW_CARD = 1

    def __init__(self, parent: QWidget | None = None):
        super().__init__(parent)
        self._store: DataStore = DataStore.get_instance()
        # 缓存会话数据供定时器刷新时距列，避免每次重查
        self._sessions: list[dict[str, Any]] = []

        # 视图模式：列表 / 卡片（默认卡片）
        self._view_mode: int = self.VIEW_CARD

        # 1s 定时器：实时更新「最后输出时距」列 + 卡片时距
        self._elapsed_timer = QTimer(self)
        self._elapsed_timer.setInterval(1000)
        self._elapsed_timer.timeout.connect(self._on_timer_tick)

        self._setup_ui()
        self._connect_signals()

        self._store.subscribe(self._on_data_updated)
        # 同时连接 Qt 信号（异步 worker 使用）
        self._store.data_updated.connect(self._on_data_updated)

    # ── UI 构建 ──

    def _setup_ui(self) -> None:
        self.setStyleSheet(f"background-color: {DARK_BG};")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        # 1. 筛选栏
        layout.addLayout(self._build_filter_bar())

        # 2. 错误横幅
        self._error_banner = self._build_error_banner()
        layout.addWidget(self._error_banner)

        # 3. KPI 卡片行
        self._kpi_cards: list[KpiCard] = []
        kpi_layout = self._build_kpi_cards()
        layout.addLayout(kpi_layout)

        # 4. 会话视图（表格 / 卡片，通过 QStackedWidget 切换）
        self._session_table = self._build_session_table()
        self._card_view = self._build_card_view()
        self._view_stack = QStackedWidget(self)
        self._view_stack.addWidget(self._session_table)   # index 0 = 列表
        self._view_stack.addWidget(self._card_view)        # index 1 = 卡片
        self._view_stack.setCurrentIndex(self.VIEW_CARD)   # 默认卡片
        layout.addWidget(self._view_stack, stretch=1)

    def _build_card_view(self) -> SessionCardView:
        """构建会话卡片视图。"""
        view = SessionCardView(self)
        view.card_clicked.connect(lambda sid: focus_terminal_window(sid))
        return view

    def _build_filter_bar(self) -> QHBoxLayout:
        """构建筛选栏：周期下拉 + 刷新间隔下拉 + 视图切换"""
        layout = QHBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(8)

        period_label = BodyLabel("周期:")
        period_label.setStyleSheet(f"color: {TEXT_PRIMARY}; border: none; background: transparent;")
        layout.addWidget(period_label)

        self._period_combo = ComboBox()
        self._period_combo.addItems([p[0] for p in self.PERIOD_OPTIONS])
        self._period_combo.setCurrentIndex(0)
        self._period_combo.setFixedWidth(72)
        self._period_combo.setStyleSheet(_COMBO_STYLE)
        layout.addWidget(self._period_combo)

        layout.addSpacing(16)

        refresh_label = BodyLabel("刷新:")
        refresh_label.setStyleSheet(f"color: {TEXT_PRIMARY}; border: none; background: transparent;")
        layout.addWidget(refresh_label)

        self._refresh_combo = ComboBox()
        self._refresh_combo.addItems([r[0] for r in self.REFRESH_OPTIONS])
        self._refresh_combo.setCurrentIndex(2)  # 默认 10s
        self._refresh_combo.setFixedWidth(64)
        self._refresh_combo.setStyleSheet(_COMBO_STYLE)
        layout.addWidget(self._refresh_combo)

        layout.addSpacing(16)

        # 视图切换按钮
        self._view_btn = QPushButton("切换至卡片", self)
        self._view_btn.setFixedHeight(34)
        self._view_btn.setFixedWidth(120)
        self._view_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: #21262d; color: {TEXT_PRIMARY};
                border: 1px solid {BORDER}; border-radius: 4px;
                padding: 4px 10px; font-size: 13px;
            }}
            QPushButton:hover {{
                background-color: #30363d;
                border-color: {ACCENT_BLUE};
            }}
        """)
        self._view_btn.clicked.connect(self._toggle_view)
        layout.addWidget(self._view_btn)

        layout.addStretch()
        return layout

    def _build_kpi_cards(self) -> QHBoxLayout:
        """构建 4 张 KPI 卡片（活跃会话数 / 活跃时长 / TOKEN / 成本）"""
        card_configs: list[tuple[str, str, str]] = [
            ("活跃会话数", "-", ACCENT_GREEN),
            ("活跃时长", "-", ACCENT_ORANGE),
            ("TOKEN", "-", ACCENT_BLUE),
            ("成本", "-", ACCENT_GOLD),
        ]
        layout = QHBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(10)

        for title, initial, color in card_configs:
            card = KpiCard(title, initial, color)
            self._kpi_cards.append(card)
            layout.addWidget(card)

        return layout

    def _build_session_table(self) -> QTableWidget:
        """构建会话概览表格"""
        table = QTableWidget()
        table.setColumnCount(len(self.TABLE_HEADERS))
        table.setHorizontalHeaderLabels(self.TABLE_HEADERS)

        header = table.horizontalHeader()
        if header is not None:
            header.setSectionResizeMode(0, QHeaderView.ResizeMode.Fixed)
            header.setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
            header.setSectionResizeMode(2, QHeaderView.ResizeMode.Fixed)
            header.setSectionResizeMode(3, QHeaderView.ResizeMode.Fixed)
            header.setSectionResizeMode(4, QHeaderView.ResizeMode.Fixed)
            header.setSectionResizeMode(5, QHeaderView.ResizeMode.Fixed)
            table.setColumnWidth(0, 70)
            table.setColumnWidth(2, 100)
            table.setColumnWidth(3, 140)
            table.setColumnWidth(4, 100)
            table.setColumnWidth(5, 120)

        table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        table.setSortingEnabled(True)
        table.setAlternatingRowColors(True)
        v_header = table.verticalHeader()
        if v_header is not None:
            v_header.setVisible(False)

        table.setStyleSheet(f"""
            QTableWidget {{
                background-color: {DARK_BG};
                alternate-background-color: {CARD_BG};
                border: 1px solid {BORDER};
                border-radius: 8px;
                gridline-color: #21262d;
                font-size: 12px;
            }}
            QTableWidget::item {{
                padding: 6px 12px;
            }}
            QTableWidget::item:selected {{
                background-color: #1f6feb44;
                color: {ACCENT_BLUE};
                border-left: 3px solid {ACCENT_BLUE};
                padding-left: 9px;
            }}
            QTableWidget::item:selected:!active {{
                background-color: #1f6feb33;
                color: {TEXT_PRIMARY};
            }}
            QHeaderView::section {{
                background-color: {CARD_BG};
                color: {TEXT_SECONDARY};
                border: none;
                border-bottom: 1px solid {BORDER};
                padding: 6px 8px;
                font-size: 12px;
                font-weight: bold;
            }}
        """)

        table.cellDoubleClicked.connect(self._on_session_double_clicked)
        return table

    def _build_error_banner(self) -> QFrame:
        """构建错误横幅，连续失败 3 次时显示"""
        banner = QFrame()
        banner.setStyleSheet(f"""
            QFrame {{
                background-color: {ACCENT_RED}22;
                border: 1px solid {ACCENT_RED};
                border-radius: 6px;
            }}
        """)
        banner_layout = QHBoxLayout(banner)
        banner_layout.setContentsMargins(12, 6, 12, 6)

        self._banner_label = CaptionLabel("")
        self._banner_label.setStyleSheet(
            f"color: {ACCENT_RED}; font-size: 12px; border: none; "
            f"background: transparent;")
        banner_layout.addWidget(self._banner_label)

        banner.setVisible(False)
        return banner

    # ── 视图切换 ──

    def _toggle_view(self) -> None:
        """切换列表/卡片视图。"""
        if self._view_mode == self.VIEW_LIST:
            self._view_mode = self.VIEW_CARD
            self._view_stack.setCurrentIndex(self.VIEW_CARD)
            self._view_btn.setText("切换至列表")
            # 切换到卡片时立即刷新
            self._update_card_view()
        else:
            self._view_mode = self.VIEW_LIST
            self._view_stack.setCurrentIndex(self.VIEW_LIST)
            self._view_btn.setText("切换至卡片")

    def _update_card_view(self) -> None:
        """刷新卡片视图数据。"""
        self._card_view.set_sessions(self._sessions)

    def _on_timer_tick(self) -> None:
        """1 秒定时器：刷新表格和卡片中的动态数据。"""
        if self._view_mode == self.VIEW_LIST:
            self._update_elapsed_column()
        else:
            self._card_view.set_sessions(self._sessions)

    # ── 信号连接 ──

    def _connect_signals(self) -> None:
        self._period_combo.currentIndexChanged.connect(self._on_period_changed)
        self._refresh_combo.currentIndexChanged.connect(
            self._on_refresh_interval_changed)

    # ── DataStore 数据更新 ──

    def _on_data_updated(self) -> None:
        """DataStore 通知数据已刷新"""
        self._update_kpi_cards()
        self._update_session_table()
        if self._view_mode == self.VIEW_CARD:
            self._update_card_view()
        self._update_error_banner()

    def _update_kpi_cards(self) -> None:
        """更新 4 张 KPI 卡片的值"""
        stats = self._store.summary_stats
        if not stats:
            return

        # 活跃会话数
        total_sessions = stats.get("total_sessions", 0) or 0
        self._kpi_cards[0].set_value(str(total_sessions))

        # 活跃时长
        total_duration = stats.get("total_duration_s", 0) or 0
        self._kpi_cards[1].set_value(
            DataStore.fmt_duration(total_duration))

        # TOKEN（输入 + 输出 + 推理）
        tokens_in = stats.get("total_tokens_input", 0) or 0
        tokens_out = stats.get("total_tokens_output", 0) or 0
        tokens_reasoning = stats.get("total_tokens_reasoning", 0) or 0
        total_tokens = tokens_in + tokens_out + tokens_reasoning
        self._kpi_cards[2].set_value(DataStore.fmt_tokens(total_tokens))

        # 成本
        total_cost = stats.get("total_cost", 0) or 0.0
        self._kpi_cards[3].set_value(DataStore.fmt_cost(total_cost))

    def _update_session_table(self) -> None:
        """刷新会话表格内容"""
        self._sessions = self._store.sessions_with_aggregated_duration
        table = self._session_table

        if not self._sessions:
            table.setSortingEnabled(False)
            table.setRowCount(1)
            empty_item = QTableWidgetItem("暂无会话数据")
            empty_item.setForeground(QColor("#484f58"))
            empty_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            table.setItem(0, 0, empty_item)
            table.setSpan(0, 0, 1, table.columnCount())
            self._elapsed_timer.stop()
            return

        # 填充数据时暂时关闭排序（避免每 setItem 一次就重排）
        table.setSortingEnabled(False)

        table.setRowCount(len(self._sessions))
        for i, sess in enumerate(self._sessions):
            now = time.time()
            # 使用聚合后的 time_updated_effective（含子 agent 输出）
            last_ts = (sess.get("time_updated_effective", 0) or
                       sess.get("time_updated", 0) or
                       sess.get("time_created", 0) or 0)
            elapsed = now - last_ts / 1000 if last_ts else 9999

            # ── 列 0：状态（彩色圆点 + 文字）──
            dot_char, status_text, status_color = _get_session_status(elapsed)
            status_item = QTableWidgetItem(f"{dot_char} {status_text}")
            status_item.setForeground(QColor(status_color))
            status_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            status_item.setData(Qt.ItemDataRole.UserRole, sess.get("session_id", ""))
            table.setItem(i, 0, status_item)

            # ── 列 1：标题 ──
            title = sess.get("title", "") or ""
            title_short = title[:60] + "..." if len(title) > 60 else title
            title_item = QTableWidgetItem(title_short)
            title_item.setForeground(QColor(TEXT_PRIMARY))
            table.setItem(i, 1, title_item)

            # ── 列 2：活跃时长 ──
            dur_ms = sess.get("duration_ms", 0) or 0
            dur_item = QTableWidgetItem(
                DataStore.fmt_duration(dur_ms / 1000))
            dur_item.setForeground(QColor(TEXT_PRIMARY))
            dur_item.setTextAlignment(
                Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            table.setItem(i, 2, dur_item)

            # ── 列 3：最后输出 ──
            time_item = QTableWidgetItem(DataStore.fmt_time(last_ts))
            time_item.setForeground(QColor(TEXT_SECONDARY))
            time_item.setTextAlignment(
                Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            table.setItem(i, 3, time_item)

            # ── 列 4：空闲时长（每秒刷新）──
            countdown_item = QTableWidgetItem(DataStore.fmt_elapsed_since(last_ts))
            countdown_item.setForeground(QColor(TEXT_SECONDARY))
            countdown_item.setTextAlignment(
                Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            table.setItem(i, 4, countdown_item)

            # ── 列 5：服务商 ──
            provider = sess.get("model_id", "") or "-"
            provider_short = (
                provider.split("/")[-1][:20]
                if "/" in provider
                else provider[:20]
            )
            prov_item = QTableWidgetItem(provider_short)
            prov_item.setForeground(QColor(TEXT_PRIMARY))
            table.setItem(i, 5, prov_item)

        # 数据填充完成后重新启用排序（保留用户当前排序列）
        table.setSortingEnabled(True)

        # 启动时距刷新定时器
        if not self._elapsed_timer.isActive():
            self._elapsed_timer.start()

    def _update_elapsed_column(self) -> None:
        """每秒刷新「状态」「最后输出」「空闲时长」。

        通过 item 中存储的 session_id 查找数据，支持排序后正确对应。
        """
        table = self._session_table
        if not self._sessions or table.rowCount() != len(self._sessions):
            return

        # 建立 session_id → session 的快速查找
        session_map = {s.get("session_id", ""): s for s in self._sessions if s.get("session_id")}

        now = time.time()

        for i in range(table.rowCount()):
            item0 = table.item(i, 0)
            if item0 is None:
                continue
            sid = item0.data(Qt.ItemDataRole.UserRole) or ""
            sess = session_map.get(sid)
            if sess is None:
                continue

            last_ts = (sess.get("time_updated_effective", 0) or
                       sess.get("time_updated", 0) or
                       sess.get("time_created", 0) or 0)
            elapsed = now - last_ts / 1000 if last_ts else 9999

            # 列 0：状态 — 每秒刷新（颜色和文字随 elapsed 变化）
            dot_char, status_text, status_color = _get_session_status(elapsed)
            status_item = table.item(i, 0)
            if status_item:
                status_item.setText(f"{dot_char} {status_text}")
                status_item.setForeground(QColor(status_color))

            # 列 3：最后输出 — 每秒刷新，与检测倒计时同步
            time_item = table.item(i, 3)
            if time_item:
                time_item.setText(DataStore.fmt_time(last_ts))

            # 列 4：空闲时长（每秒刷新）
            countdown_item = table.item(i, 4)
            if countdown_item:
                countdown_item.setText(DataStore.fmt_elapsed_since(last_ts))

    def _update_error_banner(self) -> None:
        """根据连续失败次数显示/隐藏错误横幅"""
        failures = self._store.consecutive_failures
        if failures >= 3:
            self._banner_label.setText(
                f"\u26a0 数据加载连续失败 {failures} 次，请检查数据库连接")
            self._error_banner.setVisible(True)
        else:
            self._error_banner.setVisible(False)

    # ── 事件处理 ──

    def _on_period_changed(self, index: int) -> None:
        """周期下拉变更 → 通知 DataStore 重新拉取"""
        if 0 <= index < len(self.PERIOD_OPTIONS):
            period = self.PERIOD_OPTIONS[index][1]
            self._store.set_period(period)

    def _on_refresh_interval_changed(self, index: int) -> None:
        """刷新间隔下拉变更 → 更新 DataStore 间隔"""
        if 0 <= index < len(self.REFRESH_OPTIONS):
            interval = self.REFRESH_OPTIONS[index][1]
            self._store.set_refresh_interval(interval)

    def _on_session_double_clicked(self, row: int, _col: int) -> None:
        """双击会话行 → 聚焦对应终端窗口（支持排序后的行索引）"""
        item = self._session_table.item(row, 0)
        if item is None:
            return
        session_id = item.data(Qt.ItemDataRole.UserRole) or ""
        if session_id:
            focus_terminal_window(session_id)

    # ── 生命周期 ──

    def cleanup(self) -> None:
        """清理资源：取消 DataStore 订阅并停止定时器。"""
        self._store.unsubscribe(self._on_data_updated)
        try:
            self._store.data_updated.disconnect(self._on_data_updated)
        except (TypeError, RuntimeError):
            pass
        self._elapsed_timer.stop()

    def deleteLater(self) -> None:
        """窗口销毁时清理资源。"""
        self.cleanup()
        super().deleteLater()


