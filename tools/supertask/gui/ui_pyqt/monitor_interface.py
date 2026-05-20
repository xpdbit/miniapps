# -*- coding: utf-8 -*-
"""
monitor_interface.py — OpenCode 监控仪表盘

提供 OpenCode 会话、Agent、Token 用量、成本等监控数据的可视化界面。
仅保留概览标签页：
- 概览: 摘要统计卡片 + 指标趋势 + 实时活动时间线
"""

import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from PyQt6.QtCore import Qt, QPointF, QTimer, pyqtSignal
from PyQt6.QtWidgets import (
    QFrame, QHBoxLayout, QHeaderView, QLabel,
    QTabWidget, QTableWidget, QTableWidgetItem, QToolTip,
    QVBoxLayout, QWidget,
)
from PyQt6.QtGui import QColor, QFont, QPainter, QPainterPath, QPen
from qfluentwidgets import (
    BodyLabel, CaptionLabel, CardWidget, ComboBox,
    FluentIcon as FIF, PushButton, StrongBodyLabel,
    SubtitleLabel, TableWidget, TitleLabel,
)

# pyqtgraph 已禁用 — C 扩展与 PyQt6 版本不兼容会导致 segfault 闪退
# 趋势图改用纯 Qt QTableWidget 实现，零外部依赖，稳定可靠
_pg = None  # 永久禁用，不再尝试导入


# ─── 工具函数 ──────────────────────────────────


STATUS_STYLE = """
    SummaryCard {{
        background-color: {bg};
        border: 1px solid {border};
        border-radius: 8px;
        padding: 16px;
    }}
"""


def _fmt_duration(seconds: float) -> str:
    """格式化秒数为易读时长"""
    if seconds < 1:
        return "< 1s"
    elif seconds < 60:
        return f"{seconds:.0f}s"
    elif seconds < 3600:
        m, s = divmod(int(seconds), 60)
        return f"{m}m {s}s"
    else:
        h, r = divmod(int(seconds), 3600)
        m, s = divmod(r, 60)
        return f"{h}h {m}m {s}s"


def _fmt_tokens(n: int) -> str:
    """格式化 token 数为易读格式"""
    if n < 1000:
        return str(n)
    elif n < 1000000:
        return f"{n / 1000:.1f}K"
    else:
        return f"{n / 1000000:.1f}M"


def _fmt_cost(cost: float) -> str:
    """格式化成本为美元格式"""
    if cost < 0.01:
        return f"${cost:.4f}"
    elif cost < 1:
        return f"${cost:.3f}"
    else:
        return f"${cost:.2f}"


def _fmt_time(ts_ms: int) -> str:
    """格式化时间戳为日期时间字符串"""
    if not ts_ms:
        return "-"
    try:
        dt = datetime.fromtimestamp(ts_ms / 1000)
        return dt.strftime("%Y-%m-%d %H:%M")
    except (ValueError, OSError):
        return "-"


def _fmt_date(ts_ms: int) -> str:
    """格式化时间戳为日期字符串"""
    if not ts_ms:
        return "-"
    try:
        dt = datetime.fromtimestamp(ts_ms / 1000)
        return dt.strftime("%Y-%m-%d")
    except (ValueError, OSError):
        return "-"


def _now_str() -> str:
    """返回当前时间字符串 HH:MM:SS"""
    return datetime.now().strftime("%H:%M:%S")


# ─── 摘要卡片 ──────────────────────────────────


class SummaryCard(CardWidget):
    """带数字和标签的统计卡片"""

    def __init__(self, title: str, value: str, subtitle: str = "",
                 color: str = "#58a6ff", parent=None):
        super().__init__(parent)
        self.setFixedHeight(100)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 12, 16, 12)

        self._title_label = CaptionLabel(title)
        self._title_label.setStyleSheet(f"color: {color}; font-size: 12px;")
        layout.addWidget(self._title_label)

        self._value_label = TitleLabel(value)
        self._value_label.setStyleSheet("font-size: 28px; font-weight: bold;")
        layout.addWidget(self._value_label)

        if subtitle:
            self._sub_label = CaptionLabel(subtitle)
            self._sub_label.setStyleSheet("color: #8b949e; font-size: 12px;")
            layout.addWidget(self._sub_label)
        else:
            layout.addStretch()

    def update_value(self, value: str, subtitle: str = ""):
        self._value_label.setText(value)
        if subtitle and hasattr(self, '_sub_label'):
            self._sub_label.setText(subtitle)


# ─── 工作行（原 KPI 行）─────────────────────


class WorkRow(QFrame):
    """工作行：4 张指标卡片横排 + 时间单位切换下拉框

    支持时间单位：小时 / 日 / 周 / 月 / 年 / 总计
    每张卡片显示当前周期聚合值 + 与上一个等长周期的对比箭头。
    """

    UNITS = [
        ("小时", 1 / 24),
        ("日", 1),
        ("周", 7),
        ("月", 30),
        ("年", 365),
        ("总计", 9999),
    ]

    METRICS = [
        ("耗时", "total_duration_s", _fmt_duration, "#f0883e"),
        ("Token", "total_tokens", _fmt_tokens, "#58a6ff"),
        ("会话", "total_sessions", str, "#3fb950"),
        ("成本", "total_cost", _fmt_cost, "#d29922"),
    ]

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setStyleSheet("""
            WorkRow {
                background-color: #0d1117;
            }
        """)
        # 高度由 QTabWidget 统一管理（与 SparklineChart 一致）
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 6, 16, 6)
        layout.setSpacing(4)

        # 标题行：标签 + 时间单位下拉框
        header = QHBoxLayout()
        header.setSpacing(8)
        title = StrongBodyLabel("工作行")
        title.setStyleSheet("font-size: 12px; color: #e6edf3; border: none;")
        header.addWidget(title)
        header.addStretch()
        self._unit_combo = ComboBox()
        self._unit_combo.addItems([u[0] for u in self.UNITS])
        self._unit_combo.setCurrentIndex(1)  # 默认「日」
        self._unit_combo.setFixedWidth(68)
        self._unit_combo.setStyleSheet("""
            ComboBox { background: #161b22; color: #58a6ff; border: 1px solid #30363d;
                       border-radius: 4px; padding: 2px 8px; font-size: 12px; }
            ComboBox:hover { border-color: #58a6ff; }
        """)
        header.addWidget(self._unit_combo)
        layout.addLayout(header)

        # 4 张指标卡片（水平排列：header | value）
        cards_layout = QHBoxLayout()
        cards_layout.setSpacing(10)
        self._cards: List[dict] = []
        for name, key, fmt, color in self.METRICS:
            card = QFrame()
            card.setStyleSheet(f"""
                QFrame {{
                    background-color: #161b22;
                    border-radius: 8px;
                }}
            """)
            # 外层垂直布局：上半水平行 + 下半 delta
            card_outer = QVBoxLayout(card)
            card_outer.setContentsMargins(12, 6, 12, 4)
            card_outer.setSpacing(0)

            # 水平行：header (左) | value (右)
            header_row = QHBoxLayout()
            header_row.setContentsMargins(0, 0, 0, 0)
            header_row.setSpacing(6)

            label = CaptionLabel(name)
            label.setStyleSheet(f"color: {color}; font-size: 12px; border: none;")
            label.setFixedWidth(40)  # 固定 header 宽度保证对齐
            header_row.addWidget(label, alignment=Qt.AlignmentFlag.AlignLeft)

            value = TitleLabel("-")
            value.setStyleSheet(
                "font-size: 20px; font-weight: bold; color: #e6edf3; border: none;")
            value.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            header_row.addWidget(value, stretch=1)

            card_outer.addLayout(header_row)
            card_outer.addStretch()

            delta = CaptionLabel("")
            delta.setStyleSheet("font-size: 11px; border: none;")
            card_outer.addWidget(delta, alignment=Qt.AlignmentFlag.AlignRight)

            cards_layout.addWidget(card)
            self._cards.append({
                "key": key, "fmt": fmt, "color": color,
                "value": value, "delta": delta,
            })
        layout.addLayout(cards_layout)

    def set_on_unit_changed(self, callback):
        self._unit_combo.currentIndexChanged.connect(
            lambda: callback(self.get_selected_days()))

    def get_selected_days(self) -> float:
        return self.UNITS[self._unit_combo.currentIndex()][1]

    def update_data(self, summary: dict, prev_summary: dict):
        """更新 4 张卡片的数据

        Args:
            summary: 当前周期的聚合数据
            prev_summary: 上一等长周期的聚合数据（用于计算对比）
        """
        for card in self._cards:
            key = card["key"]
            fmt = card["fmt"]
            color = card["color"]

            if key == "total_tokens":
                v = ((summary.get("total_tokens_input", 0) or 0) +
                     (summary.get("total_tokens_output", 0) or 0) +
                     (summary.get("total_tokens_reasoning", 0) or 0))
                pv = ((prev_summary.get("total_tokens_input", 0) or 0) +
                      (prev_summary.get("total_tokens_output", 0) or 0) +
                      (prev_summary.get("total_tokens_reasoning", 0) or 0))
            else:
                v = summary.get(key, 0) or 0
                pv = prev_summary.get(key, 0) or 0

            card["value"].setText(fmt(v) if callable(fmt) else str(v))

            # 对比箭头
            if pv and pv > 0:
                pct = (v - pv) / pv * 100
                up = pct >= 0
                arrow = "↑" if up else "↓"
                if key == "total_duration_s":
                    card["delta"].setText(f"{arrow} {abs(pct):.0f}%")
                elif key == "total_sessions":
                    card["delta"].setText(f"{arrow} {abs(int(v - pv))}")
                else:
                    card["delta"].setText(f"{arrow} {abs(pct):.0f}%")
                d_color = "#3fb950" if up else "#f85149"
                card["delta"].setStyleSheet(
                    f"color: {d_color}; font-size: 12px; border: none;")
            else:
                card["delta"].setText("")


# ─── 实时活动时间线 ──────────────────────────


class ActivityTimeline(QFrame):
    """实时活动面板：当前运行的 opencode 进程 + 历史会话活动

    分为两个区域：
    - 当前活动：运行中的 opencode 进程（来自 ProcessMonitor），
      展示状态、Agent类型、模型、标题、运行时长、Token、成本
    - 历史活动：已完成的会话（来自 DB），
      展示时间、类型、标题、模型、Token、时长、成本
    """

    _COMMON_TABLE_STYLE = """
        QTableWidget {
            background-color: #0d1117;
            alternate-background-color: #161b22;
            border: none;
            gridline-color: #21262d;
            font-size: 12px;
        }
        QTableWidget::item { padding: 4px 8px; }
        QHeaderView::section {
            background-color: #161b22; color: #8b949e;
            border: none; border-bottom: 1px solid #30363d;
            padding: 4px 8px; font-size: 12px; font-weight: bold;
        }
    """

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setStyleSheet("""
            ActivityTimeline {
                background-color: #0d1117;
                border: 1px solid #30363d;
                border-radius: 10px;
            }
        """)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 10, 16, 10)
        layout.setSpacing(6)

        # 标题行 + 数量切换
        header = QHBoxLayout()
        header.setSpacing(8)
        title = StrongBodyLabel("实时活动")
        title.setStyleSheet("font-size: 13px; color: #e6edf3; border: none;")
        header.addWidget(title)
        header.addStretch()

        self._count_combo = ComboBox()
        self._count_combo.addItems(["20 条", "50 条"])
        self._count_combo.setCurrentIndex(0)
        self._count_combo.setFixedWidth(68)
        self._count_combo.setStyleSheet("""
            ComboBox { background: #161b22; color: #58a6ff; border: 1px solid #30363d;
                       border-radius: 4px; padding: 2px 8px; font-size: 12px; }
            ComboBox:hover { border-color: #58a6ff; }
        """)
        header.addWidget(self._count_combo)
        layout.addLayout(header)

        # 子 Tab: 当前活动 | 历史活动
        self._sub_tabs = QTabWidget()
        self._sub_tabs.setStyleSheet("""
            QTabWidget::pane {
                border: 1px solid #21262d; border-radius: 8px;
                background: #0d1117; padding: 6px 4px 4px 4px;
                top: -1px;
            }
            QTabBar::tab {
                color: #8b949e; background: transparent;
                border: 1px solid transparent; border-radius: 16px;
                padding: 6px 18px; margin: 0px 2px;
                font-size: 12px; font-weight: 500;
            }
            QTabBar::tab:hover {
                color: #c9d1d9; background: #21262d;
                border-color: #30363d;
            }
            QTabBar::tab:selected {
                color: #e6edf3; background: #30363d;
                border-color: #484f58;
            }
        """)

        # Tab 1: 当前活动（运行的 opencode 进程）
        self._live_table = self._make_table(
            ["状态", "Agent", "模型", "标题", "运行时长", "最后通信", "Token", "成本"])
        self._sub_tabs.addTab(self._live_table, "当前活动")

        # Tab 2: 历史活动（已完成的会话）
        self._history_table = self._make_table(
            ["时间", "类型", "标题", "模型", "Token", "时长", "成本"])
        self._sub_tabs.addTab(self._history_table, "历史活动")

        layout.addWidget(self._sub_tabs, stretch=1)

        # 存储 process 数据和 session 数据
        self._processes: List[dict] = []
        self._sessions: List[dict] = []

    def _make_table(self, headers: list) -> QTableWidget:
        t = QTableWidget()
        t.setColumnCount(len(headers))
        t.setHorizontalHeaderLabels(headers)
        t.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        t.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        t.setAlternatingRowColors(True)
        t.verticalHeader().setVisible(False)
        t.setStyleSheet(self._COMMON_TABLE_STYLE)
        return t

    def get_limit(self) -> int:
        return [20, 50][self._count_combo.currentIndex()]

    def set_on_count_changed(self, callback):
        self._count_combo.currentIndexChanged.connect(callback)

    def update_processes(self, processes: List[dict]):
        """更新当前活动（来自 ProcessMonitor 的实时进程数据）

        Args:
            processes: ProcessInfo dict 列表，含 pid, agent_type, model_id,
                       session_title, elapsed, cumulative_cost,
                       session_tokens_used, status
        """
        self._processes = processes
        self._populate_live()

    def update_sessions(self, sessions: List[dict]):
        """更新历史活动（来自 DB 的已完结会话数据）

        Args:
            sessions: session dict 列表，含 time_created, agent_type, title,
                      total_tokens, model_id, duration_ms, total_cost, parent_id
        """
        self._sessions = sessions
        self._populate_history()

    def update_activities(self, activities: List[dict]):
        """兼容旧接口：直接使用 sessions 数据更新历史活动"""
        self.update_sessions(activities)

    def _populate_live(self):
        """渲染「当前活动」Tab — 运行中的 opencode 进程"""
        t = self._live_table
        processes = self._processes

        if not processes:
            t.setRowCount(1)
            empty_item = QTableWidgetItem("暂无运行中的 opencode 进程")
            empty_item.setForeground(QColor("#484f58"))
            t.setItem(0, 0, empty_item)
            t.setSpan(0, 0, 1, t.columnCount())
            return

        t.setRowCount(len(processes))
        for i, p in enumerate(processes):
            # 状态 — 3 态: running(工作中) / idle(待机中) / zombie(已退出)
            raw_status = p.get("status", "running") or "running"
            if raw_status == "running":
                status_text = "● 工作中"
                status_color = "#3fb950"
                is_running = True
            elif raw_status == "idle":
                status_text = "⏸ 待机中"
                status_color = "#d29922"
                is_running = False
            else:
                status_text = "✗ 已退出"
                status_color = "#8b949e"
                is_running = False
            status_item = QTableWidgetItem(status_text)
            status_item.setForeground(QColor(status_color))
            t.setItem(i, 0, status_item)

            # Agent 类型 — 优先使用 session 匹配到的 agent_type
            atype = p.get("agent_type", "") or ""
            if not atype:
                # 兜底：从 cmdline 或 session_title 推断
                title = p.get("session_title", "") or ""
                if title:
                    title_lower = title.lower()
                    for kw in ["sisyphus", "sisyphus-pro", "prometheus",
                               "explore", "oracle", "librarian", "metis", "momus"]:
                        if kw in title_lower:
                            atype = kw
                            break
                if not atype:
                    atype = "opencode"
            agent_item = QTableWidgetItem(atype[:20])
            if is_running:
                agent_item.setForeground(QColor("#58a6ff"))
            t.setItem(i, 1, agent_item)

            # 模型
            model = p.get("model_id", "") or "-"
            model_short = model.split("/")[-1][:18] if "/" in model else model[:18]
            t.setItem(i, 2, QTableWidgetItem(model_short))

            # 标题
            title = p.get("session_title", "") or ""
            title_short = title[:50] + "..." if len(title) > 50 else title
            t.setItem(i, 3, QTableWidgetItem(title_short if title_short else "-"))

            # 运行时长（实时计算）
            elapsed = p.get("elapsed", 0) or 0
            dur_text = _fmt_duration(elapsed)
            dur_item = self._num_item(dur_text)
            if is_running:
                dur_item.setForeground(QColor("#f0883e"))
            t.setItem(i, 4, dur_item)

            # 最后通信（距上次 LLM 服务商通信的时间）— 颜色编码：绿(≤20s活跃) 黄(≤60s临界) 红(>60s空闲)
            comm_elapsed = p.get("comm_elapsed", -1) or -1
            if comm_elapsed < 0:
                comm_text = "—"
                comm_color = "#484f58"
            elif comm_elapsed <= 20:
                comm_text = _fmt_duration(comm_elapsed)
                comm_color = "#3fb950"
            elif comm_elapsed <= 60:
                comm_text = _fmt_duration(comm_elapsed)
                comm_color = "#d29922"
            else:
                comm_text = _fmt_duration(comm_elapsed)
                comm_color = "#f85149"
            comm_item = QTableWidgetItem(comm_text)
            comm_item.setForeground(QColor(comm_color))
            t.setItem(i, 5, comm_item)

            # Token
            tokens = p.get("session_tokens_used", 0) or 0
            tok_item = self._num_item(_fmt_tokens(tokens))
            t.setItem(i, 6, tok_item)

            # 成本
            cost = p.get("cumulative_cost", 0) or 0
            cost_item = self._num_item(_fmt_cost(cost))
            t.setItem(i, 7, cost_item)

    def _populate_history(self):
        """渲染「历史活动」Tab — 已完成的会话"""
        t = self._history_table
        limit = self.get_limit()
        recent = self._sessions[:limit] if len(self._sessions) > limit else self._sessions

        if not recent:
            t.setRowCount(1)
            empty_item = QTableWidgetItem("暂无历史会话数据")
            empty_item.setForeground(QColor("#484f58"))
            t.setItem(0, 0, empty_item)
            t.setSpan(0, 0, 1, t.columnCount())
            return

        t.setRowCount(len(recent))
        for i, sess in enumerate(recent):
            # 时间
            ts = sess.get("time_created", 0) or 0
            time_item = QTableWidgetItem(_fmt_time(ts))
            time_item.setForeground(QColor("#8b949e"))
            t.setItem(i, 0, time_item)

            # 类型
            atype = sess.get("agent_type", "") or ""
            if not atype:
                pid = sess.get("parent_id", "")
                atype = "子会话" if (pid and str(pid).strip()) else "主会话"
            t.setItem(i, 1, QTableWidgetItem(atype[:16]))

            # 标题
            title = sess.get("title", "") or ""
            title_short = title[:50] + "..." if len(title) > 50 else title
            t.setItem(i, 2, QTableWidgetItem(title_short))

            # 模型
            model = sess.get("model_id", "") or "-"
            model_short = model.split("/")[-1][:18] if "/" in model else model[:18]
            t.setItem(i, 3, QTableWidgetItem(model_short))

            # Token
            tokens = sess.get("total_tokens", 0) or 0
            t.setItem(i, 4, self._num_item(_fmt_tokens(tokens)))

            # 时长
            dur_ms = sess.get("duration_ms", 0) or 0
            t.setItem(i, 5, self._num_item(_fmt_duration(dur_ms / 1000)))

            # 成本
            cost = sess.get("total_cost", 0) or 0
            t.setItem(i, 6, self._num_item(_fmt_cost(cost)))

    @staticmethod
    def _num_item(text: str) -> QTableWidgetItem:
        item = QTableWidgetItem(text)
        item.setTextAlignment(
            Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        return item


# ─── 底部状态栏 ──────────────────────────────


class BottomStatusBar(QFrame):
    """底部状态栏：DB 状态 + 最后刷新时间 + 刷新间隔 + 全部刷新按钮"""

    REFRESH_INTERVALS = [
        ("1s", 1000),
        ("3s", 3000),
        ("10s", 10000),
        ("30s", 30000),
        ("120s", 120000),
    ]

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setFixedHeight(32)
        self.setStyleSheet("""
            BottomStatusBar {
                background-color: #0d1117;
                border-top: 1px solid #21262d;
            }
        """)
        layout = QHBoxLayout(self)
        layout.setContentsMargins(16, 4, 16, 4)
        layout.setSpacing(12)

        # DB 状态
        self._db_label = CaptionLabel("○ DB: --")
        self._db_label.setStyleSheet("color: #8b949e; font-size: 12px; border: none;")
        layout.addWidget(self._db_label)

        layout.addStretch()

        # 最后刷新
        self._last_refresh = CaptionLabel("最后刷新: --")
        self._last_refresh.setStyleSheet("color: #484f58; font-size: 12px; border: none;")
        layout.addWidget(self._last_refresh)

        # 刷新间隔
        interval_label = CaptionLabel("刷新:")
        interval_label.setStyleSheet("color: #8b949e; font-size: 12px; border: none;")
        layout.addWidget(interval_label)
        self._interval_combo = ComboBox()
        self._interval_combo.addItems([i[0] for i in self.REFRESH_INTERVALS])
        self._interval_combo.setCurrentIndex(1)  # 默认 3s
        self._interval_combo.setFixedWidth(56)
        self._interval_combo.setStyleSheet("""
            ComboBox { background: #161b22; color: #58a6ff; border: 1px solid #30363d;
                       border-radius: 4px; padding: 1px 6px; font-size: 12px; }
            ComboBox:hover { border-color: #58a6ff; }
        """)
        layout.addWidget(self._interval_combo)

        # 全部刷新按钮
        self._refresh_btn = PushButton("全部刷新")
        self._refresh_btn.setFixedHeight(24)
        layout.addWidget(self._refresh_btn)

    def set_db_status(self, path: str = "", available: bool = False):
        if available and path:
            short = path if len(path) < 50 else "..." + path[-47:]
            self._db_label.setText(f"● DB: {short}")
            self._db_label.setStyleSheet("color: #3fb950; font-size: 12px; border: none;")
        else:
            self._db_label.setText("○ OpenCode DB 未找到")
            self._db_label.setStyleSheet("color: #f85149; font-size: 12px; border: none;")

    def set_last_refresh(self, ts: str = ""):
        self._last_refresh.setText(
            f"最后刷新: {ts}" if ts else "最后刷新: --")

    def get_interval_ms(self) -> int:
        return self.REFRESH_INTERVALS[self._interval_combo.currentIndex()][1]

    def set_on_interval_changed(self, callback):
        self._interval_combo.currentIndexChanged.connect(
            lambda: callback(self.get_interval_ms()))

    def set_on_refresh(self, callback):
        self._refresh_btn.clicked.connect(callback)


# ─── 统计行组件 ──────────────────────────────


# ─── 增强状态头部 ─────────────────────────────


class EnhancedStatusHeader(QFrame):
    """增强状态头部：96px，状态+进程+今日会话与成本"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setFixedHeight(96)
        self.setStyleSheet("""
            EnhancedStatusHeader {
                background-color: #0d1117;
                border: 1px solid #30363d;
                border-radius: 10px;
            }
        """)
        layout = QHBoxLayout(self)
        layout.setContentsMargins(20, 12, 20, 12)
        layout.setSpacing(16)

        # 状态指示灯
        self._dot = QLabel("●")
        self._dot.setStyleSheet("font-size: 28px; color: #8b949e; border: none;")
        layout.addWidget(self._dot)

        status_text = QVBoxLayout()
        status_text.setSpacing(0)
        self._status_label = StrongBodyLabel("待机中")
        self._status_label.setStyleSheet("font-size: 18px; color: #8b949e; border: none;")
        status_text.addWidget(self._status_label)
        self._sub_status = CaptionLabel("没有运行中的 OpenCode 进程")
        self._sub_status.setStyleSheet("color: #484f58; font-size: 12px; border: none;")
        status_text.addWidget(self._sub_status)
        layout.addLayout(status_text)

        layout.addSpacing(12)
        layout.addWidget(self._mk_vsep())
        layout.addSpacing(12)

        # 进程数
        proc_layout = QVBoxLayout()
        proc_layout.setSpacing(0)
        self._proc_count = TitleLabel("0")
        self._proc_count.setStyleSheet("font-size: 26px; font-weight: bold; color: #e6edf3; border: none;")
        proc_layout.addWidget(self._proc_count, alignment=Qt.AlignmentFlag.AlignCenter)
        proc_hint = CaptionLabel("运行中进程")
        proc_hint.setStyleSheet("color: #8b949e; font-size: 12px; border: none;")
        proc_layout.addWidget(proc_hint, alignment=Qt.AlignmentFlag.AlignCenter)
        self._proc_sub = CaptionLabel("")
        self._proc_sub.setStyleSheet("color: #484f58; font-size: 12px; border: none;")
        proc_layout.addWidget(self._proc_sub, alignment=Qt.AlignmentFlag.AlignCenter)
        layout.addLayout(proc_layout)

        layout.addSpacing(12)
        layout.addWidget(self._mk_vsep())
        layout.addSpacing(12)

        # 今日会话 + 成本
        sess_layout = QVBoxLayout()
        sess_layout.setSpacing(0)
        self._today_sessions = TitleLabel("-")
        self._today_sessions.setStyleSheet("font-size: 26px; font-weight: bold; color: #e6edf3; border: none;")
        sess_layout.addWidget(self._today_sessions, alignment=Qt.AlignmentFlag.AlignCenter)
        sess_hint = CaptionLabel("今日会话")
        sess_hint.setStyleSheet("color: #8b949e; font-size: 12px; border: none;")
        sess_layout.addWidget(sess_hint, alignment=Qt.AlignmentFlag.AlignCenter)
        self._today_cost = CaptionLabel("")
        self._today_cost.setStyleSheet("color: #d29922; font-size: 12px; border: none;")
        sess_layout.addWidget(self._today_cost, alignment=Qt.AlignmentFlag.AlignCenter)
        layout.addLayout(sess_layout)

        layout.addStretch()

    @staticmethod
    def _mk_vsep():
        s = QFrame()
        s.setFrameShape(QFrame.Shape.VLine)
        s.setStyleSheet("color: #21262d;")
        s.setFixedWidth(1)
        return s

    def update_status(self, running_count: int, total_processes: int,
                       idle_count: int = 0,
                       today_sessions: int = 0, today_cost: float = 0.0):
        if running_count > 0:
            self._dot.setStyleSheet("font-size: 28px; color: #3fb950; border: none;")
            self._status_label.setText("工作中")
            self._status_label.setStyleSheet("font-size: 18px; color: #3fb950; border: none;")
            agent_str = "个子 Agent" if running_count > 1 else "个 Agent"
            self._sub_status.setText(f"{running_count} {agent_str} 正在运行中")
        elif idle_count > 0:
            self._dot.setStyleSheet("font-size: 28px; color: #d29922; border: none;")
            self._status_label.setText("待机中")
            self._status_label.setStyleSheet("font-size: 18px; color: #d29922; border: none;")
            agent_str = "个子 Agent" if idle_count > 1 else "个 Agent"
            self._sub_status.setText(f"{idle_count} {agent_str} 待机中")
        else:
            self._dot.setStyleSheet("font-size: 28px; color: #8b949e; border: none;")
            self._status_label.setText("待机中")
            self._status_label.setStyleSheet("font-size: 18px; color: #8b949e; border: none;")
            if total_processes > 0:
                self._sub_status.setText(f"{total_processes} 个进程已退出")
            else:
                self._sub_status.setText("没有运行中的 OpenCode 进程")

        self._proc_count.setText(str(running_count))
        self._proc_sub.setText(f"总计 {total_processes} 个进程")
        self._today_sessions.setText(str(today_sessions))
        self._today_cost.setText(f"成本 {_fmt_cost(today_cost)}")


# ─── 纯 QPainter 折线图（零外部依赖）──────────


class SparklineChart(QWidget):
    """纯 QPainter 自绘折线图 — 零外部依赖，支持多指标切换+时间范围选择

    替代原 pyqtgraph 实现。pyqtgraph C 扩展与 PyQt6 存在版本兼容问题，
    在特定环境下会导致 segfault 闪退。
    """

    METRICS = [
        ("会话", "sessions_total", QColor("#3fb950")),
        ("Token", "total_tokens", QColor("#58a6ff")),
        ("成本", "total_cost", QColor("#d29922")),
        ("耗时", "total_duration_s", QColor("#f0883e")),
    ]

    RANGES = [
        ("7日", 7),
        ("30日", 30),
        ("365日", 365),
        ("全部", 9999),
    ]

    _FORMATTERS = {
        "sessions_total": str,
        "total_tokens": _fmt_tokens,
        "total_cost": _fmt_cost,
        "total_duration_s": _fmt_duration,
    }

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setMinimumHeight(220)
        self.setMouseTracking(True)
        self._daily_data: List[dict] = []
        self._active_metric = 0
        self._active_range = 0  # 默认 7日
        self._point_positions: List[tuple] = []  # (x, y, date_str, value) for tooltip

        # ── 顶部控制栏（标题 + 指标按钮 + 时间范围下拉框）──
        self._setup_control_bar()

    def _setup_control_bar(self):
        """创建顶部控制栏（内嵌到 paintEvent 上方绘制）"""
        self._metric_btns: List[PushButton] = []

        # 控制栏容器
        ctrl = QFrame(self)
        ctrl.setStyleSheet("background: transparent; border: none;")
        ctrl.setFixedHeight(36)
        ctrl_layout = QHBoxLayout(ctrl)
        ctrl_layout.setContentsMargins(16, 4, 16, 4)
        ctrl_layout.setSpacing(4)

        # 标题
        title = StrongBodyLabel("趋势")
        title.setStyleSheet("font-size: 14px; color: #e6edf3; border: none;")
        ctrl_layout.addWidget(title)
        ctrl_layout.addSpacing(8)

        # 指标按钮（保留）
        for i, (name, _, _) in enumerate(self.METRICS):
            btn = PushButton(name)
            btn.setFixedHeight(24)
            btn.setFixedWidth(44)
            btn.clicked.connect(lambda checked, idx=i: self._switch_metric(idx))
            self._metric_btns.append(btn)
            ctrl_layout.addWidget(btn)

        ctrl_layout.addStretch()

        # 时间范围下拉框（替代原按钮组）
        self._range_combo = ComboBox()
        self._range_combo.addItems([r[0] for r in self.RANGES])
        self._range_combo.setCurrentIndex(0)
        self._range_combo.setFixedWidth(68)
        self._range_combo.setStyleSheet("""
            ComboBox { background: #161b22; color: #58a6ff; border: 1px solid #30363d;
                       border-radius: 4px; padding: 2px 8px; font-size: 12px; }
            ComboBox:hover { border-color: #58a6ff; }
        """)
        self._range_combo.currentIndexChanged.connect(self._switch_range)
        ctrl_layout.addWidget(self._range_combo)

        self._update_btn_styles()

        # 用 resizeEvent 定位控制栏
        self._ctrl_bar = ctrl
        self._ctrl_bar.setParent(self)

    def resizeEvent(self, a0):
        super().resizeEvent(a0)
        if hasattr(self, '_ctrl_bar'):
            self._ctrl_bar.setGeometry(0, 0, self.width(), 36)

    def mouseMoveEvent(self, a0):
        super().mouseMoveEvent(a0)
        if not self._point_positions:
            return
        # 检测鼠标是否悬停在数据点附近（阈值 10px）
        mx, my = a0.position().x(), a0.position().y()
        for px, py, ds, v in self._point_positions:
            if abs(mx - px) < 10 and abs(my - py) < 10:
                _, metric_key, _ = self.METRICS[self._active_metric]
                fmt = self._FORMATTERS.get(metric_key, str)
                label = f"{ds}\n{fmt(v)}"
                QToolTip.showText(a0.globalPosition().toPoint(), label, self)
                return
        QToolTip.hideText()

    def set_data(self, daily_aggregates: List[dict]):
        """更新趋势数据并重绘"""
        self._daily_data = daily_aggregates
        self.update()

    def _switch_range(self, idx: int):
        self._active_range = idx
        self._update_btn_styles()
        self.update()

    def _switch_metric(self, idx: int):
        self._active_metric = idx
        self._update_btn_styles()
        self.update()

    def _update_btn_styles(self):
        """更新指标按钮的选中态样式"""
        for i, btn in enumerate(self._metric_btns):
            _, _, color = self.METRICS[i]
            if i == self._active_metric:
                btn.setStyleSheet(f"""
                    PushButton {{ background: {color.name()}33; color: {color.name()};
                    border: 1px solid {color.name()}66; border-radius: 12px;
                    font-size: 12px; font-weight: bold; }}
                """)
            else:
                btn.setStyleSheet("""
                    PushButton { background: transparent; color: #8b949e;
                    border: 1px solid #30363d; border-radius: 12px;
                    font-size: 12px; }
                    PushButton:hover { color: #c9d1d9; border-color: #58a6ff; }
                """)

    # ─── QPainter 绘制 ──────────────────────────

    def paintEvent(self, a0):
        super().paintEvent(a0)
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        self._draw_chart(painter)

    def _draw_chart(self, painter: 'QPainter'):
        """主绘制逻辑"""
        w = self.width()
        h = self.height()
        if w < 100 or h < 80:
            return

        # 图表区域（控制栏下方 36px）
        margin = {"left": 52, "right": 16, "top": 40, "bottom": 28}
        chart_x = margin["left"]
        chart_y = margin["top"]
        chart_w = max(w - margin["left"] - margin["right"], 10)
        chart_h = max(h - margin["top"] - margin["bottom"], 10)

        # 背景
        bg = QColor("#0d1117")
        painter.fillRect(0, 0, w, h, bg)

        # ── 数据准备 ──
        _, metric_key, line_color = self.METRICS[self._active_metric]
        _, range_days = self.RANGES[self._active_range]
        fmt = self._FORMATTERS.get(metric_key, str)

        sorted_data = sorted(self._daily_data, key=lambda d: d.get("date", ""))
        if range_days < 9999 and len(sorted_data) > range_days:
            sorted_data = sorted_data[-range_days:]

        if len(sorted_data) < 1:
            # 无数据提示
            painter.setPen(QColor("#484f58"))
            painter.setFont(QFont("Microsoft YaHei", 11))
            painter.drawText(
                chart_x, chart_y, chart_w, chart_h,
                Qt.AlignmentFlag.AlignCenter, "暂无趋势数据"
            )
            return

        points: List[tuple] = []  # (date_str, value)
        for d in sorted_data:
            ds = d.get("date", "")
            if metric_key == "total_tokens":
                v = ((d.get("total_tokens_input", 0) or 0) +
                     (d.get("total_tokens_output", 0) or 0) +
                     (d.get("total_tokens_reasoning", 0) or 0))
            else:
                v = d.get(metric_key, 0) or 0
            points.append((ds, v))

        if not points:
            return

        values = [p[1] for p in points]
        v_min = min(values)
        v_max = max(values)
        if v_max == v_min:
            v_max = v_min + 1

        # ── 网格线 ──
        grid_pen = QPen(QColor("#21262d"), 1)
        painter.setPen(grid_pen)
        n_ticks = 4
        for i in range(n_ticks + 1):
            y = chart_y + chart_h - (chart_h * i / n_ticks)
            painter.drawLine(int(chart_x), int(y),
                             int(chart_x + chart_w), int(y))

        # ── 折线 + 填充 ──
        def _to_x(i: int) -> float:
            if len(points) == 1:
                return chart_x + chart_w / 2
            return chart_x + (chart_w * i / (len(points) - 1))

        def _to_y(v: float) -> float:
            ratio = (v - v_min) / (v_max - v_min)
            return chart_y + chart_h - (chart_h * ratio)

        # 填充区域路径
        fill_path = QPainterPath()
        fill_path.moveTo(_to_x(0), chart_y + chart_h)
        for i, (_, v) in enumerate(points):
            fill_path.lineTo(_to_x(i), _to_y(v))
        fill_path.lineTo(_to_x(len(points) - 1), chart_y + chart_h)
        fill_path.closeSubpath()
        fill_color = QColor(line_color)
        fill_color.setAlpha(30)
        painter.fillPath(fill_path, fill_color)

        # 折线
        line_pen = QPen(line_color, 2)
        painter.setPen(line_pen)
        line_path = QPainterPath()
        line_path.moveTo(_to_x(0), _to_y(points[0][1]))
        for i in range(1, len(points)):
            line_path.lineTo(_to_x(i), _to_y(points[i][1]))
        painter.drawPath(line_path)

        # 数据点 + 存储位置（用于 tooltip）
        self._point_positions.clear()
        dot_pen = QPen(line_color, 1)
        dot_brush = line_color
        for i, (ds, v) in enumerate(points):
            px, py = _to_x(i), _to_y(v)
            self._point_positions.append((px, py, ds, v))
            painter.setPen(dot_pen)
            painter.setBrush(dot_brush)
            painter.drawEllipse(QPointF(px, py), 3.5, 3.5)

        # ── Y 轴标签 ──
        painter.setPen(QColor("#8b949e"))
        font = QFont("Consolas", 9)
        painter.setFont(font)
        for i in range(n_ticks + 1):
            val = v_min + (v_max - v_min) * (n_ticks - i) / n_ticks
            label = fmt(val)
            y = chart_y + chart_h * i / n_ticks
            painter.drawText(
                2, int(y) - 7, int(chart_x) - 6, 14,
                Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter,
                label
            )

        # ── X 轴标签 ──
        max_labels = min(len(points), 10)
        step = max(1, len(points) // max_labels)
        painter.setFont(QFont("Microsoft YaHei", 8))
        for i in range(0, len(points), step):
            ds = points[i][0]
            if len(ds) >= 10:
                ds = ds[5:]  # MM-DD
            px = _to_x(i)
            painter.drawText(
                int(px) - 25, int(chart_y + chart_h + 2),
                50, 18,
                Qt.AlignmentFlag.AlignCenter, ds
            )


# ─── Agent 卡片列表 ──────────────────────────


# ─── 概览页面（信息流布局）────────────────────


class OverviewTab(QWidget):
    """概览面板：纵向信息流布局

    布局（从上到下）：
    1. 状态头部 (EnhancedStatusHeader) — Agent 运行状态
    2. 指标/趋势 Tab (WorkRow | SparklineChart) — 合并节约空间
    3. 实时活动时间线 (ActivityTimeline) — 当前进程 + 近期会话活动
    4. 底部状态栏 (BottomStatusBar) — DB 状态 + 刷新控制
    """

    def __init__(self, parent=None):
        super().__init__(parent)
        self._monitor_store = None
        self._last_running_count = 0
        self._last_total_count = 0

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(10)

        try:
            # 1. 状态头部
            self._status_header = EnhancedStatusHeader()
            layout.addWidget(self._status_header)

            # 2. 指标/趋势 Tab 合并（节约空间）
            self._metric_trend_tabs = QTabWidget()
            self._metric_trend_tabs.setStyleSheet("""
                QTabWidget::pane {
                    border: 1px solid #21262d; border-radius: 8px;
                    background: #0d1117; padding: 6px 4px 4px 4px;
                    top: -1px;
                }
                QTabBar::tab {
                    color: #8b949e; background: transparent;
                    border: 1px solid transparent; border-radius: 16px;
                    padding: 6px 18px; margin: 0px 2px;
                    font-size: 12px; font-weight: 500;
                }
                QTabBar::tab:hover {
                    color: #c9d1d9; background: #21262d;
                    border-color: #30363d;
                }
                QTabBar::tab:selected {
                    color: #e6edf3; background: #30363d;
                    border-color: #484f58;
                }
            """)
            self._work_row = WorkRow()
            self._sparkline = SparklineChart()
            self._metric_trend_tabs.addTab(self._work_row, "工作行")
            self._metric_trend_tabs.addTab(self._sparkline, "趋势")
            layout.addWidget(self._metric_trend_tabs)

            # 3. 实时活动时间线
            self._activity = ActivityTimeline()
            layout.addWidget(self._activity, stretch=1)

            # 4. 底部状态栏
            self._status_bar = BottomStatusBar()
            layout.addWidget(self._status_bar)
        except Exception as e:
            print(f"[Monitor] 概览Tab初始化失败: {e}")
            import traceback
            traceback.print_exc()
            err_label = CaptionLabel(f"概览面板加载失败: {e}")
            err_label.setStyleSheet("color: #f85149; padding: 20px;")
            layout.addWidget(err_label)

    def set_data_sources(self, monitor_store):
        self._monitor_store = monitor_store

    def set_on_refresh(self, callback):
        self._status_bar.set_on_refresh(callback)

    def update_work_row(self, summary: dict, prev_summary: dict):
        """更新工作行数据"""
        self._work_row.update_data(summary, prev_summary)

    def update_sparkline(self, daily_data: List[dict]):
        """更新折线图数据"""
        self._sparkline.set_data(daily_data)

    def update_activity(self, activities: List[dict]):
        """更新时间线数据（历史会话）"""
        if hasattr(self._activity, 'update_sessions'):
            self._activity.update_sessions(activities)

    def update_live_agents(self, processes: List[dict]):
        """更新状态头部的实时 agent 计数，同时推送进程数据到活动时间线"""
        running = sum(1 for p in processes if p.get("status") == "running")
        idle = sum(1 for p in processes if p.get("status") == "idle")
        total = len(processes)
        self._last_running_count = running
        self._last_total_count = total
        # 从 monitor_store 获取今日真实数据
        today_sessions = 0
        today_cost = 0.0
        if self._monitor_store:
            try:
                today = self._monitor_store.get_summary(days=1)
                today_sessions = today.get("total_sessions", 0) or 0
                today_cost = today.get("total_cost", 0) or 0.0
            except Exception:
                pass
        # 更新状态头部：有 active running 进程才显示「工作中」
        self._status_header.update_status(
            running_count=running,
            total_processes=total,
            idle_count=idle,
            today_sessions=today_sessions,
            today_cost=today_cost,
        )
        # 推送实时进程数据到活动时间线
        if hasattr(self._activity, 'update_processes'):
            self._activity.update_processes(processes)

    def update_db_status(self, path: str = "", available: bool = False):
        self._status_bar.set_db_status(path, available)

    def refresh_status_header_today(self):
        """刷新状态头部的今日会话/成本数据（不改变进程计数）"""
        if not self._monitor_store:
            return
        try:
            today = self._monitor_store.get_summary(days=1)
            today_sessions = today.get("total_sessions", 0) or 0
            today_cost = today.get("total_cost", 0) or 0.0
            # 使用已知的 last_* 计数，区分 running 和 idle
            running = getattr(self, '_last_running_count', 0)
            total = getattr(self, '_last_total_count', 0)
            idle = max(0, total - running)
            self._status_header.update_status(
                running_count=running,
                total_processes=total,
                idle_count=idle,
                today_sessions=today_sessions,
                today_cost=today_cost,
            )
        except Exception:
            pass

    def get_work_row(self) -> 'WorkRow':
        return self._work_row

    def get_activity_timeline(self) -> 'ActivityTimeline':
        return self._activity

    def get_status_bar(self) -> 'BottomStatusBar':
        return self._status_bar


# ─── 会话分析页面 ──────────────────────────────


class SessionsTab(QWidget):
    """会话分析面板：历史会话浏览和过滤"""

    def __init__(self, parent=None):
        super().__init__(parent)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(10)

        # 过滤行
        filter_layout = QHBoxLayout()
        filter_layout.addWidget(BodyLabel("时间范围:"))

        self._days_combo = ComboBox()
        self._days_combo.addItems(["7 天", "14 天", "30 天", "90 天", "全部"])
        self._days_combo.setCurrentIndex(0)
        filter_layout.addWidget(self._days_combo)

        filter_layout.addSpacing(20)
        filter_layout.addWidget(BodyLabel("Agent 类型:"))

        self._type_combo = ComboBox()
        self._type_combo.addItems(["全部", "主会话", "子 Agent"])
        filter_layout.addWidget(self._type_combo)

        filter_layout.addStretch()

        self._refresh_btn = PushButton("刷新")
        filter_layout.addWidget(self._refresh_btn)
        layout.addLayout(filter_layout)

        # 会话表格
        self._table = TableWidget(self)
        self._table.setBorderVisible(True)
        self._table.setBorderRadius(4)
        self._table.setColumnCount(8)
        self._table.setHorizontalHeaderLabels([
            "时间", "标题", "类型", "模型", "Token 入", "Token 出", "成本", "耗时"
        ])
        self._table.horizontalHeader().setSectionResizeMode(
            QHeaderView.ResizeMode.Stretch)
        self._table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self._table.setAlternatingRowColors(True)
        layout.addWidget(self._table, stretch=1)

        # 底部统计
        self._footer_label = CaptionLabel("")
        self._footer_label.setStyleSheet("color: #8b949e;")
        layout.addWidget(self._footer_label)

        # 回调
        self._on_refresh = None

    def set_on_refresh(self, callback):
        self._on_refresh = callback
        self._refresh_btn.clicked.connect(callback)

    def update_sessions(self, sessions: List[dict]):
        """更新会话列表"""
        self._table.setRowCount(len(sessions))
        total_tokens_in = 0
        total_tokens_out = 0
        total_cost = 0.0

        for i, sess in enumerate(sessions):
            time_item = QTableWidgetItem(
                _fmt_time(sess.get("time_created", 0)))
            time_item.setForeground(QColor("#8b949e"))
            self._table.setItem(i, 0, time_item)

            title = sess.get("title", "") or ""
            title_short = title[:60] + "..." if len(title) > 60 else title
            self._table.setItem(i, 1, QTableWidgetItem(title_short))

            atype = sess.get("agent_type", "") or ""
            is_sub = sess.get("parent_id") and sess["parent_id"].strip()
            type_label = f"@{atype}" if atype else ("子 Agent" if is_sub else "主会话")
            self._table.setItem(i, 2, QTableWidgetItem(type_label))

            model = sess.get("model_id", "") or ""
            model_short = model.split("/")[-1][:20] if "/" in model else model[:20]
            self._table.setItem(i, 3, QTableWidgetItem(model_short))

            tin = sess.get("total_tokens_input", 0) or 0
            tin_item = QTableWidgetItem(_fmt_tokens(tin))
            tin_item.setTextAlignment(Qt.AlignmentFlag.AlignRight |
                                      Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 4, tin_item)

            tout = sess.get("total_tokens_output", 0) or 0
            tout_item = QTableWidgetItem(_fmt_tokens(tout))
            tout_item.setTextAlignment(Qt.AlignmentFlag.AlignRight |
                                       Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 5, tout_item)

            cost = sess.get("total_cost", 0) or 0
            cost_item = QTableWidgetItem(_fmt_cost(cost))
            cost_item.setTextAlignment(Qt.AlignmentFlag.AlignRight |
                                       Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 6, cost_item)

            dur = sess.get("duration_ms", 0) or 0
            dur_item = QTableWidgetItem(_fmt_duration(dur / 1000))
            dur_item.setTextAlignment(Qt.AlignmentFlag.AlignRight |
                                      Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 7, dur_item)

            total_tokens_in += tin
            total_tokens_out += tout
            total_cost += cost

        self._table.resizeColumnsToContents()
        self._footer_label.setText(
            f"{len(sessions)} 条会话 | "
            f"Token 入: {_fmt_tokens(total_tokens_in)} | "
            f"Token 出: {_fmt_tokens(total_tokens_out)} | "
            f"总成本: {_fmt_cost(total_cost)}"
        )

    def get_days(self) -> int:
        idx = self._days_combo.currentIndex()
        return [7, 14, 30, 90, 365][idx]

    def get_type_filter(self) -> str:
        idx = self._type_combo.currentIndex()
        return ["all", "main", "sub"][idx]


# ─── Agent 分析页面 ──────────────────────────


class AgentsTab(QWidget):
    """Agent 类型分析面板"""

    def __init__(self, parent=None):
        super().__init__(parent)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(10)

        header = QHBoxLayout()
        header.addWidget(BodyLabel("时间范围:"))
        self._days_combo = ComboBox()
        self._days_combo.addItems(["7 天", "14 天", "30 天", "90 天"])
        header.addWidget(self._days_combo)
        header.addStretch()
        self._refresh_btn = PushButton("刷新")
        header.addWidget(self._refresh_btn)
        layout.addLayout(header)

        self._table = TableWidget(self)
        self._table.setBorderVisible(True)
        self._table.setBorderRadius(4)
        self._table.setColumnCount(6)
        self._table.setHorizontalHeaderLabels([
            "Agent 类型", "调用次数", "总 Token", "总成本", "总耗时", "均耗时"
        ])
        self._table.horizontalHeader().setSectionResizeMode(
            QHeaderView.ResizeMode.Stretch)
        self._table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self._table.setAlternatingRowColors(True)
        layout.addWidget(self._table, stretch=1)

        self._on_refresh = None

    def set_on_refresh(self, callback):
        self._on_refresh = callback
        self._refresh_btn.clicked.connect(callback)

    def update_agents(self, agents: List[dict]):
        """更新 Agent 类型统计"""
        self._table.setRowCount(len(agents))
        for i, a in enumerate(agents):
            self._table.setItem(i, 0, QTableWidgetItem(
                a.get("agent_type", "?")))

            cnt = a.get("total_sessions", 0) or 0
            cnt_item = QTableWidgetItem(str(cnt))
            cnt_item.setTextAlignment(Qt.AlignmentFlag.AlignRight |
                                      Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 1, cnt_item)

            tok = a.get("total_tokens", 0) or 0
            tok_item = QTableWidgetItem(_fmt_tokens(tok))
            tok_item.setTextAlignment(Qt.AlignmentFlag.AlignRight |
                                      Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 2, tok_item)

            cost = a.get("total_cost", 0) or 0
            cost_item = QTableWidgetItem(_fmt_cost(cost))
            cost_item.setTextAlignment(Qt.AlignmentFlag.AlignRight |
                                       Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 3, cost_item)

            dur = a.get("total_duration_ms", 0) or 0
            dur_item = QTableWidgetItem(_fmt_duration(dur / 1000))
            dur_item.setTextAlignment(Qt.AlignmentFlag.AlignRight |
                                      Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 4, dur_item)

            avg_dur = (dur / max(cnt, 1)) / 1000
            avg_item = QTableWidgetItem(_fmt_duration(avg_dur))
            avg_item.setTextAlignment(Qt.AlignmentFlag.AlignRight |
                                      Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 5, avg_item)

        self._table.resizeColumnsToContents()

    def get_days(self) -> int:
        idx = self._days_combo.currentIndex()
        return [7, 14, 30, 90][idx]


# ─── 模型统计页面 ─────────────────────────────


class ModelsTab(QWidget):
    """模型使用统计面板"""

    def __init__(self, parent=None):
        super().__init__(parent)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(10)

        header = QHBoxLayout()
        header.addWidget(BodyLabel("时间范围:"))
        self._days_combo = ComboBox()
        self._days_combo.addItems(["7 天", "14 天", "30 天", "90 天"])
        header.addWidget(self._days_combo)
        header.addStretch()
        self._refresh_btn = PushButton("刷新")
        header.addWidget(self._refresh_btn)
        layout.addLayout(header)

        self._table = TableWidget(self)
        self._table.setBorderVisible(True)
        self._table.setBorderRadius(4)
        self._table.setColumnCount(7)
        self._table.setHorizontalHeaderLabels([
            "模型", "提供商", "会话数", "Token 入", "Token 出",
            "总成本", "均成本"
        ])
        self._table.horizontalHeader().setSectionResizeMode(
            QHeaderView.ResizeMode.Stretch)
        self._table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self._table.setAlternatingRowColors(True)
        layout.addWidget(self._table, stretch=1)

        self._on_refresh = None

    def set_on_refresh(self, callback):
        self._on_refresh = callback
        self._refresh_btn.clicked.connect(callback)

    def update_models(self, models: List[dict]):
        """更新模型统计"""
        self._table.setRowCount(len(models))
        for i, m in enumerate(models):
            self._table.setItem(i, 0, QTableWidgetItem(
                m.get("model_id", "?")))
            self._table.setItem(i, 1, QTableWidgetItem(
                m.get("provider_id", "-")))

            cnt = m.get("total_sessions", 0) or 0
            cnt_item = QTableWidgetItem(str(cnt))
            cnt_item.setTextAlignment(Qt.AlignmentFlag.AlignRight |
                                      Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 2, cnt_item)

            tin = m.get("total_tokens_input", 0) or 0
            tin_item = QTableWidgetItem(_fmt_tokens(tin))
            tin_item.setTextAlignment(Qt.AlignmentFlag.AlignRight |
                                      Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 3, tin_item)

            tout = m.get("total_tokens_output", 0) or 0
            tout_item = QTableWidgetItem(_fmt_tokens(tout))
            tout_item.setTextAlignment(Qt.AlignmentFlag.AlignRight |
                                       Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 4, tout_item)

            cost = m.get("total_cost", 0) or 0
            cost_item = QTableWidgetItem(_fmt_cost(cost))
            cost_item.setTextAlignment(Qt.AlignmentFlag.AlignRight |
                                       Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 5, cost_item)

            avg_cost = cost / max(cnt, 1)
            avg_item = QTableWidgetItem(_fmt_cost(avg_cost))
            avg_item.setTextAlignment(Qt.AlignmentFlag.AlignRight |
                                      Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 6, avg_item)

        self._table.resizeColumnsToContents()

    def get_days(self) -> int:
        idx = self._days_combo.currentIndex()
        return [7, 14, 30, 90][idx]


# ─── 日报表页面 ────────────────────────────────


class DailyTab(QWidget):
    """每日汇总趋势面板"""

    def __init__(self, parent=None):
        super().__init__(parent)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(10)

        header = QHBoxLayout()
        header.addWidget(BodyLabel("时间范围:"))
        self._days_combo = ComboBox()
        self._days_combo.addItems(["7 天", "14 天", "30 天", "90 天"])
        header.addWidget(self._days_combo)
        header.addStretch()
        self._refresh_btn = PushButton("刷新")
        header.addWidget(self._refresh_btn)
        layout.addLayout(header)

        self._table = TableWidget(self)
        self._table.setBorderVisible(True)
        self._table.setBorderRadius(4)
        self._table.setColumnCount(8)
        self._table.setHorizontalHeaderLabels([
            "日期", "会话数", "主/子", "Token 入", "Token 出",
            "总成本", "总耗时", "文件变更"
        ])
        self._table.horizontalHeader().setSectionResizeMode(
            QHeaderView.ResizeMode.Stretch)
        self._table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self._table.setAlternatingRowColors(True)
        layout.addWidget(self._table, stretch=1)

        self._on_refresh = None

    def set_on_refresh(self, callback):
        self._on_refresh = callback
        self._refresh_btn.clicked.connect(callback)

    def update_daily(self, daily: List[dict]):
        """更新每日统计"""
        self._table.setRowCount(len(daily))
        total_sessions = 0
        total_cost = 0.0

        for i, d in enumerate(daily):
            self._table.setItem(i, 0, QTableWidgetItem(
                d.get("date", "?")))

            total = d.get("sessions_total", 0) or 0
            total_sessions += total
            total_item = QTableWidgetItem(str(total))
            total_item.setTextAlignment(Qt.AlignmentFlag.AlignRight |
                                        Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 1, total_item)

            main = d.get("sessions_main", 0) or 0
            sub = d.get("sessions_sub", 0) or 0
            ms_item = QTableWidgetItem(f"{main}/{sub}")
            ms_item.setTextAlignment(Qt.AlignmentFlag.AlignRight |
                                     Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 2, ms_item)

            tin = d.get("total_tokens_input", 0) or 0
            tin_item = QTableWidgetItem(_fmt_tokens(tin))
            tin_item.setTextAlignment(Qt.AlignmentFlag.AlignRight |
                                      Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 3, tin_item)

            tout = d.get("total_tokens_output", 0) or 0
            tout_item = QTableWidgetItem(_fmt_tokens(tout))
            tout_item.setTextAlignment(Qt.AlignmentFlag.AlignRight |
                                       Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 4, tout_item)

            cost = d.get("total_cost", 0) or 0
            total_cost += cost
            cost_item = QTableWidgetItem(_fmt_cost(cost))
            cost_item.setTextAlignment(Qt.AlignmentFlag.AlignRight |
                                       Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 5, cost_item)

            dur = d.get("total_duration_s", 0) or 0
            dur_item = QTableWidgetItem(_fmt_duration(dur))
            dur_item.setTextAlignment(Qt.AlignmentFlag.AlignRight |
                                      Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 6, dur_item)

            files = d.get("files_changed", 0) or 0
            files_item = QTableWidgetItem(str(files))
            files_item.setTextAlignment(Qt.AlignmentFlag.AlignRight |
                                        Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 7, files_item)

        self._table.resizeColumnsToContents()

    def get_days(self) -> int:
        idx = self._days_combo.currentIndex()
        return [7, 14, 30, 90][idx]


# ─── 实时进程页面 ─────────────────────────────


STATUS_STYLE_SHEET = """
    color: {color};
    font-weight: bold;
"""


class ProcessesTab(QWidget):
    """实时 OpenCode 进程监控面板"""

    def __init__(self, parent=None):
        super().__init__(parent)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(10)

        # 顶部信息栏
        info_layout = QHBoxLayout()
        info_layout.addWidget(BodyLabel("检测间隔: 10 秒"))
        info_layout.addSpacing(20)

        self._count_label = StrongBodyLabel("0 个进程")
        self._count_label.setStyleSheet("color: #58a6ff;")
        info_layout.addWidget(self._count_label)
        info_layout.addStretch()

        self._refresh_btn = PushButton("立即扫描")
        info_layout.addWidget(self._refresh_btn)
        layout.addLayout(info_layout)

        # 进程表格
        self._table = TableWidget(self)
        self._table.setBorderVisible(True)
        self._table.setBorderRadius(4)
        self._table.setColumnCount(9)
        self._table.setHorizontalHeaderLabels([
            "PID", "工作目录", "会话标题", "Agent", "模型",
            "运行时长", "CPU", "内存", "状态"
        ])
        self._table.horizontalHeader().setSectionResizeMode(
            QHeaderView.ResizeMode.Stretch)
        self._table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self._table.setAlternatingRowColors(True)
        layout.addWidget(self._table, stretch=1)

        # 底部提示
        self._footer = CaptionLabel("仅显示 opencode 进程（opencode.exe / node）")
        self._footer.setStyleSheet("color: #8b949e;")
        layout.addWidget(self._footer)

        # 进程监控器引用
        self._process_monitor = None
        self._on_refresh = None

        self._refresh_btn.clicked.connect(self._request_scan)

    def set_process_monitor(self, monitor):
        """设置 ProcessMonitor 引用"""
        self._process_monitor = monitor

    def set_on_refresh(self, callback):
        self._on_refresh = callback
        self._refresh_btn.clicked.connect(callback)

    def _request_scan(self):
        """手动触发扫描"""
        if self._on_refresh:
            self._on_refresh()

    def update_processes(self, processes: list):
        """更新进程列表"""
        self._table.setRowCount(len(processes))
        running_count = 0
        zombie_count = 0

        for i, p in enumerate(processes):
            pid = p.get("pid", 0) or 0
            pid_item = QTableWidgetItem(str(pid))
            pid_item.setTextAlignment(Qt.AlignmentFlag.AlignRight |
                                      Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 0, pid_item)

            # 工作目录（截断）
            wd = p.get("working_dir", "") or ""
            if len(wd) > 40:
                wd = "..." + wd[-37:]
            self._table.setItem(i, 1, QTableWidgetItem(wd))

            # 会话标题
            title = p.get("session_title", "") or ""
            if len(title) > 50:
                title = title[:47] + "..."
            self._table.setItem(i, 2, QTableWidgetItem(title))

            # Agent 类型
            agent = p.get("agent_type", "") or ""
            self._table.setItem(i, 3, QTableWidgetItem(agent))

            # 模型
            model = p.get("model_id", "") or ""
            model_short = model.split("/")[-1][:15] if "/" in model else model[:15]
            self._table.setItem(i, 4, QTableWidgetItem(model_short))

            # 运行时长
            elapsed = p.get("elapsed", 0) or 0
            elapsed_str = _fmt_duration(elapsed)
            elapsed_item = QTableWidgetItem(elapsed_str)
            elapsed_item.setTextAlignment(Qt.AlignmentFlag.AlignRight |
                                          Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 5, elapsed_item)

            # CPU
            cpu = p.get("cpu_percent", 0) or 0
            cpu_str = f"{cpu:.1f}%"
            cpu_item = QTableWidgetItem(cpu_str)
            cpu_item.setTextAlignment(Qt.AlignmentFlag.AlignRight |
                                      Qt.AlignmentFlag.AlignVCenter)
            if cpu > 50:
                cpu_item.setForeground(QColor("#f85149"))
            elif cpu > 10:
                cpu_item.setForeground(QColor("#d29922"))
            self._table.setItem(i, 6, cpu_item)

            # 内存
            mem = p.get("memory_mb", 0) or 0
            mem_str = f"{mem:.0f} MB"
            mem_item = QTableWidgetItem(mem_str)
            mem_item.setTextAlignment(Qt.AlignmentFlag.AlignRight |
                                      Qt.AlignmentFlag.AlignVCenter)
            if mem > 500:
                mem_item.setForeground(QColor("#d29922"))
            elif mem > 1000:
                mem_item.setForeground(QColor("#f85149"))
            self._table.setItem(i, 7, mem_item)

            # 状态
            status = p.get("status", "") or ""
            status_display = {"running": "● 运行中", "zombie": "✗ 已退出"}.get(status, status)
            status_item = QTableWidgetItem(status_display)
            if status == "running":
                status_item.setForeground(QColor("#3fb950"))
                running_count += 1
            elif status == "zombie":
                status_item.setForeground(QColor("#8b949e"))
                zombie_count += 1
            self._table.setItem(i, 8, status_item)

        self._table.resizeColumnsToContents()
        status_parts = []
        if running_count:
            status_parts.append(f"{running_count} 运行中")
        if zombie_count:
            status_parts.append(f"{zombie_count} 已退出")
        self._count_label.setText(f"{' / '.join(status_parts) if status_parts else '0 个进程'}")


# ─── 近期会话活动页面 ──────────────────────────


class ActivityTab(QWidget):
    """近期会话活动面板（从概览 Tab 剥离）"""

    def __init__(self, parent=None):
        super().__init__(parent)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(10)

        # 过滤行
        filter_layout = QHBoxLayout()
        filter_layout.addWidget(BodyLabel("时间范围:"))
        self._days_combo = ComboBox()
        self._days_combo.addItems(["7 天", "14 天", "30 天", "90 天"])
        self._days_combo.setCurrentIndex(0)
        filter_layout.addWidget(self._days_combo)
        filter_layout.addStretch()
        self._refresh_btn = PushButton("刷新")
        filter_layout.addWidget(self._refresh_btn)
        layout.addLayout(filter_layout)

        # 活动表格
        self._table = TableWidget(self)
        self._table.setBorderVisible(True)
        self._table.setBorderRadius(4)
        self._table.setColumnCount(7)
        self._table.setHorizontalHeaderLabels([
            "时间", "标题", "项目", "Agent", "模型", "Token", "成本"
        ])
        self._table.horizontalHeader().setSectionResizeMode(
            QHeaderView.ResizeMode.Stretch)
        self._table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self._table.setAlternatingRowColors(True)
        layout.addWidget(self._table, stretch=1)

        self._on_refresh = None
        self._refresh_btn.clicked.connect(self._on_refresh_clicked)

    def _on_refresh_clicked(self):
        if self._on_refresh:
            self._on_refresh()

    def set_on_refresh(self, callback):
        self._on_refresh = callback

    def update_activity(self, activities: List[dict]):
        """更新活动列表"""
        self._table.setRowCount(len(activities))
        for i, act in enumerate(activities):
            self._table.setItem(i, 0, QTableWidgetItem(
                _fmt_time(act.get("time_created", 0))))

            title = act.get("title", "") or ""
            title_short = title[:60] + "..." if len(title) > 60 else title
            self._table.setItem(i, 1, QTableWidgetItem(title_short))

            proj = act.get("project_id", "") or ""
            self._table.setItem(i, 2, QTableWidgetItem(proj))
            agent = act.get("agent_type", "") or act.get("agent_name", "") or ""
            self._table.setItem(i, 3, QTableWidgetItem(agent[:20]))

            model = act.get("model_id", "") or ""
            model_short = model.split("/")[-1][:15] if "/" in model else model[:15]
            self._table.setItem(i, 4, QTableWidgetItem(model_short))

            tokens = act.get("total_tokens", 0) or 0
            tok_item = QTableWidgetItem(_fmt_tokens(tokens))
            tok_item.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 5, tok_item)

            cost = act.get("total_cost", 0) or 0
            cost_item = QTableWidgetItem(_fmt_cost(cost))
            cost_item.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 6, cost_item)

        self._table.resizeColumnsToContents()

    def get_days(self) -> int:
        return [7, 14, 30, 90][self._days_combo.currentIndex()]


# ─── 主接口 ──────────────────────────────────


class MonitorInterface(QWidget):
    """监控仪表盘主面板"""

    NAV_KEY = "监控与统计"

    # 线程安全的进程数据更新信号（从 ProcessMonitor 后台线程发射）
    process_data_ready = pyqtSignal(object)

    def __init__(self, parent=None):
        super().__init__(parent)
        try:
            self._init_ui()
        except Exception as e:
            print(f"[Monitor] MonitorInterface 初始化失败: {e}")
            import traceback
            traceback.print_exc()
            # 紧急降级：显示错误文本
            layout = QVBoxLayout(self)
            err_label = QLabel(f"⚠ 监控面板加载失败: {e}")
            err_label.setStyleSheet("color: #f85149; font-size: 16px; padding: 30px;")
            err_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            layout.addWidget(err_label)

    def _init_ui(self):
        """构建 UI（被 __init__ 的 try-except 保护）"""
        self._layout = QVBoxLayout(self)
        self._layout.setContentsMargins(0, 0, 0, 0)
        self._layout.setSpacing(0)

        # Tab 页 — 用 try-except 保护每个 tab 的创建
        self._tabs = QTabWidget()
        self._tabs.setTabPosition(QTabWidget.TabPosition.North)
        self._tabs.setStyleSheet("""
            QTabWidget::pane {
                border: 1px solid #30363d; border-radius: 10px;
                background: #0d1117; padding: 8px 4px 4px 4px;
                top: -1px;
            }
            QTabBar::tab {
                color: #8b949e; background: transparent;
                border: 1px solid transparent; border-radius: 20px;
                padding: 8px 18px; margin: 0px 3px;
                font-size: 12px; font-weight: 500;
            }
            QTabBar::tab:hover {
                color: #c9d1d9; background: #21262d;
                border-color: #30363d;
            }
            QTabBar::tab:selected {
                color: #ffffff; background: #1f6feb;
                border-color: #1f6feb;
            }
            QTabBar::tab:selected:hover {
                background: #388bfd;
                border-color: #388bfd;
            }
        """)

        try:
            self._overview_tab = OverviewTab()
        except Exception as e:
            print(f"[Monitor] 概览Tab创建失败: {e}")
            import traceback; traceback.print_exc()
            self._overview_tab = self._make_fallback_widget("概览Tab加载失败")

        self._tabs.addTab(self._overview_tab, "概览")

        self._layout.addWidget(self._tabs, stretch=1)

        # 刷新计时器（默认 3 秒，由底部状态栏控制）
        self._auto_timer = QTimer(self)
        self._auto_timer.timeout.connect(self._auto_refresh_overview)
        self._auto_timer.setInterval(3000)

        # 数据引用
        self._monitor_store = None
        self._opencode_reader = None
        self._last_summary: dict = {}
        self._listeners: list = []
        self._refresh_counter = 0  # 自动刷新计数器，用于周期性触发 DB 同步

        # 连接概览页底部状态栏按钮
        self._overview_tab.set_on_refresh(self._do_refresh_all)

        # 连接工作行时间单位变化 → 刷新概览
        work_row = self._overview_tab.get_work_row() if hasattr(
            self._overview_tab, 'get_work_row') else None
        if work_row:
            work_row.set_on_unit_changed(lambda _: self._auto_refresh_overview())

        # 连接活动时间线数量变化 → 刷新活动
        activity = self._overview_tab.get_activity_timeline() if hasattr(
            self._overview_tab, 'get_activity_timeline') else None
        if activity:
            activity.set_on_count_changed(
                lambda: self._refresh_activity_timeline())

        # 连接底部状态栏刷新间隔变化 → 更新定时器 + 进程扫描间隔
        status_bar = self._overview_tab.get_status_bar() if hasattr(
            self._overview_tab, 'get_status_bar') else None
        if status_bar:
            status_bar.set_on_interval_changed(
                lambda ms: self._on_interval_changed(ms))

        # 连接线程安全信号
        self.process_data_ready.connect(self._apply_process_data)

    def set_data_sources(self, monitor_store, opencode_reader,
                          process_monitor=None):
        """设置数据源引用"""
        self._monitor_store = monitor_store
        self._opencode_reader = opencode_reader
        self._process_monitor = process_monitor

        # 传递 store 给概览页
        if hasattr(self._overview_tab, 'set_data_sources'):
            self._overview_tab.set_data_sources(monitor_store)

        # 更新底部状态栏 DB 状态
        db_avail = opencode_reader is not None and opencode_reader.is_available()
        db_path = opencode_reader.db_path if db_avail else ""
        if hasattr(self._overview_tab, 'update_db_status'):
            self._overview_tab.update_db_status(db_path, db_avail)

    def start_auto_refresh(self):
        """启动自动刷新 + 进程监控 + 立即初始化数据"""
        # 立即执行首次数据同步（避免启动后前几十秒数据为 0）
        self._sync_data_from_opencode()
        # 启动后立刻刷新一次 UI
        QTimer.singleShot(100, self._auto_refresh_overview)
        # 启动定时器（使用当前底部状态栏的设置）
        self._auto_timer.start()
        # 启动实时进程监控（后台线程），间隔与底部状态栏设置一致
        if self._process_monitor and not self._process_monitor.is_running:
            # 从底部状态栏读取当前刷新间隔（ms → s）
            interval_s = 10
            try:
                if hasattr(self._overview_tab, 'get_status_bar'):
                    bar = self._overview_tab.get_status_bar()
                    interval_s = max(5, bar.get_interval_ms() // 1000)
            except Exception:
                pass
            self._process_monitor.start(
                callback=self._on_process_data,
                interval=interval_s,
            )

    def stop_auto_refresh(self):
        """停止自动刷新 + 进程监控"""
        self._auto_timer.stop()
        if self._process_monitor and self._process_monitor.is_running:
            self._process_monitor.stop()

    def _on_interval_changed(self, ms: int):
        """底部刷新间隔变更时，同步更新 UI 定时器和进程监控扫描间隔"""
        self._auto_timer.setInterval(ms)
        if self._process_monitor:
            seconds = max(5, ms // 1000)
            self._process_monitor.interval = seconds

    def _sync_data_from_opencode(self):
        """从 OpenCode DB 同步最新数据到本地存储"""
        if not self._monitor_store or not self._opencode_reader:
            print("[Monitor] 跳过同步: 数据源未就绪")
            return False
        try:
            # 始终刷新 DB 路径（opencode 可能重启并切换到不同 DB 文件）
            self._opencode_reader.refresh_db_path()
            db_avail = self._opencode_reader.is_available()
            if not db_avail:
                print("[Monitor] 跳过同步: OpenCode DB 不可用")
                return False
            self._monitor_store.sync_from_opencode_db(
                self._opencode_reader, days=7)
            # 更新底部状态栏 DB 状态
            if hasattr(self._overview_tab, 'update_db_status'):
                self._overview_tab.update_db_status(
                    self._opencode_reader.db_path, True)
            return True
        except Exception as e:
            print(f"[Monitor] 数据同步异常: {e}")
            return False

    def _on_process_data(self, processes: list):
        """ProcessMonitor 后台线程回调 — 通过线程安全信号切回主线程更新 UI"""
        # 转换为 dict 列表
        data = [
            {
                "pid": p.pid,
                "working_dir": p.working_dir,
                "session_title": p.session_title,
                "agent_type": p.agent_type,
                "agent_name": p.agent_type,
                "model_id": p.model_id,
                "provider_id": p.provider_id,
                "cumulative_cost": p.cumulative_cost,
                "session_tokens_used": p.session_tokens_used,
                "last_active_time": getattr(p, '_last_active_time', 0.0),
                "elapsed": p.elapsed,
                "cpu_percent": p.cpu_percent,
                "memory_mb": p.memory_mb,
                "status": p.status,
                "comm_elapsed": getattr(p, 'comm_elapsed', -1.0),
            }
            for p in processes
        ]
        # 通过 pyqtSignal 安全切回主线程（PyQt6 确保信号在主线程中派发）
        self.process_data_ready.emit(data)

    def _apply_process_data(self, data=None):
        """主线程：应用进程数据到 UI（概览实时Agent）"""
        try:
            if data is None:
                return
            if hasattr(self._overview_tab, 'update_live_agents'):
                self._overview_tab.update_live_agents(data)
        except Exception as e:
            print(f"[Monitor] 应用进程数据到 UI 失败: {e}")

    def add_listener(self, callback):
        """添加数据更新监听器"""
        self._listeners.append(callback)

    def _auto_refresh_overview(self):
        """自动刷新概览页 — 工作行 + 折线图 + 活动时间线 + 状态头部"""
        if not self._monitor_store:
            return
        try:
            # 每 5 个刷新周期（默认 15 秒）从 OpenCode DB 同步一次最新数据
            self._refresh_counter += 1
            if self._refresh_counter >= 5:
                self._refresh_counter = 0
                self._sync_data_from_opencode()

            # 工作行：根据当前选中的时间单位刷新
            if hasattr(self._overview_tab, 'get_work_row'):
                work_row = self._overview_tab.get_work_row()
                days = work_row.get_selected_days()
                days_int = max(1, int(days))
                summary = self._monitor_store.get_summary(days=days_int)
                prev_summary = self._monitor_store.get_summary(
                    days=days_int * 2) if days_int < 9999 else {}
                if hasattr(self._overview_tab, 'update_work_row'):
                    self._overview_tab.update_work_row(summary, prev_summary)

            # 折线图：获取日聚合数据
            if hasattr(self._overview_tab, 'update_sparkline'):
                daily_data = self._monitor_store.get_daily_aggregates(days=365)
                self._overview_tab.update_sparkline(daily_data)

            # 活动时间线
            self._refresh_activity_timeline()

            # 刷新状态头部的今日数据（即使没有运行中的进程也要更新）
            if hasattr(self._overview_tab, 'refresh_status_header_today'):
                self._overview_tab.refresh_status_header_today()

            # 更新最后刷新时间
            if hasattr(self._overview_tab, 'get_status_bar'):
                bar = self._overview_tab.get_status_bar()
                bar.set_last_refresh(_now_str())
        except Exception as e:
            print(f"[Monitor] 自动刷新异常: {e}")

    def _refresh_activity_timeline(self):
        """刷新活动时间线数据"""
        if not self._monitor_store:
            return
        try:
            activities = self._monitor_store.get_recent_activity(limit=100)
            if hasattr(self._overview_tab, 'update_activity'):
                self._overview_tab.update_activity(activities)
        except Exception as e:
            print(f"[Monitor] 活动时间线刷新异常: {e}")

    def _do_refresh_all(self):
        """全量刷新所有标签页（每个 tab 独立保护）"""
        if not self._monitor_store or not self._opencode_reader:
            return

        # 刷新 DB 路径
        try:
            if self._opencode_reader:
                changed = self._opencode_reader.refresh_db_path()
                db_avail = self._opencode_reader.is_available()
                if hasattr(self._overview_tab, 'update_db_status'):
                    self._overview_tab.update_db_status(
                        self._opencode_reader.db_path if db_avail else "",
                        db_avail)

            if self._opencode_reader and self._opencode_reader.is_available():
                self._monitor_store.sync_from_opencode_db(
                    self._opencode_reader, days=14)
        except Exception as e:
            print(f"[Monitor] DB 同步异常: {e}")

        # --- 概览：工作行 + 折线图 + 时间线 ---
        self._auto_refresh_overview()

        # 通知监听器
        for cb in self._listeners:
            try:
                cb()
            except Exception as e:
                print(f"[Monitor] 监听器异常: {e}")

    @staticmethod
    def _make_fallback_widget(message: str) -> QWidget:
        """创建降级显示 widget（当 tab 创建失败时）"""
        w = QWidget()
        layout = QVBoxLayout(w)
        label = QLabel(f"⚠ {message}")
        label.setStyleSheet("color: #f85149; font-size: 14px; padding: 20px;")
        label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(label)
        return w
