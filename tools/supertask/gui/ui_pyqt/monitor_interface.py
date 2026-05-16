# -*- coding: utf-8 -*-
"""
monitor_interface.py — OpenCode 监控仪表盘

提供 OpenCode 会话、Agent、Token 用量、成本等监控数据的可视化界面。
包含多个子标签页：
- 概览: 摘要统计卡片 + 近期活动
- 会话分析: 历史会话列表，按时间/项目/模型过滤
- Agent 分析: Agent 类型使用统计
- 模型统计: 模型/提供商使用统计
- 日报表: 每日汇总趋势
"""

import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from PyQt6.QtCore import Qt, QTimer, pyqtSignal
from PyQt6.QtWidgets import (
    QFrame, QHBoxLayout, QHeaderView, QLabel, QPushButton,
    QSizePolicy, QTabWidget, QTableWidget, QTableWidgetItem,
    QVBoxLayout, QWidget, QComboBox, QGridLayout,
)
from PyQt6.QtGui import QColor, QBrush, QFont
from qfluentwidgets import (
    BodyLabel, CaptionLabel, CardWidget, ComboBox,
    FluentIcon as FIF, PushButton, StrongBodyLabel,
    SubtitleLabel, TableWidget, TitleLabel,
)


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
        self._title_label.setStyleSheet(f"color: {color}; font-size: 11px;")
        layout.addWidget(self._title_label)

        self._value_label = TitleLabel(value)
        self._value_label.setStyleSheet("font-size: 28px; font-weight: bold;")
        layout.addWidget(self._value_label)

        if subtitle:
            self._sub_label = CaptionLabel(subtitle)
            self._sub_label.setStyleSheet("color: #8b949e; font-size: 11px;")
            layout.addWidget(self._sub_label)
        else:
            layout.addStretch()

    def update_value(self, value: str, subtitle: str = ""):
        self._value_label.setText(value)
        if subtitle and hasattr(self, '_sub_label'):
            self._sub_label.setText(subtitle)


# ─── 统计行组件 ──────────────────────────────


class StatRow(QWidget):
    """一行四维统计：当日/本周/本月/总计"""

    def __init__(self, label: str, formatter, color: str = "#58a6ff", parent=None):
        super().__init__(parent)
        self._formatter = formatter
        layout = QHBoxLayout(self)
        layout.setContentsMargins(8, 4, 8, 4)

        # 标签（固定宽度）
        lbl = StrongBodyLabel(label)
        lbl.setFixedWidth(60)
        lbl.setStyleSheet(f"color: {color}; font-size: 13px;")
        layout.addWidget(lbl)

        # 四个数值
        self._labels = []
        periods = ["当日", "本周", "本月", "总计"]
        for i, period in enumerate(periods):
            if i > 0:
                layout.addSpacing(12)
            val = CaptionLabel("--")
            val.setStyleSheet("color: #e6edf3; font-size: 12px; font-weight: bold;")
            hint = CaptionLabel(period)
            hint.setStyleSheet("color: #484f58; font-size: 10px;")
            col = QVBoxLayout()
            col.setSpacing(0)
            col.addWidget(val, alignment=Qt.AlignmentFlag.AlignCenter)
            col.addWidget(hint, alignment=Qt.AlignmentFlag.AlignCenter)
            layout.addLayout(col)
            self._labels.append(val)

        layout.addStretch()

    def update_values(self, values: list):
        """更新四个数值"""
        for i, val in enumerate(self._labels):
            if i < len(values):
                val.setText(self._formatter(values[i]))
            else:
                val.setText("--")


# ─── 四维统计卡片（4行 x 4列）────────────────


class PeriodStatsGrid(QFrame):
    """四维统计网格：显示当日/本周/本月/总计的耗时/Token/会话/成本"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setStyleSheet("background-color: #0d1117; border: 1px solid #30363d; border-radius: 10px;")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 14, 16, 14)
        layout.setSpacing(8)

        self._duration_row = StatRow("耗时", _fmt_duration, color="#f0883e")
        self._tokens_row = StatRow("Token", _fmt_tokens, color="#58a6ff")
        self._sessions_row = StatRow("会话", str, color="#3fb950")
        self._cost_row = StatRow("成本", _fmt_cost, color="#d29922")

        layout.addWidget(self._duration_row)
        layout.addWidget(self._mk_sep())
        layout.addWidget(self._tokens_row)
        layout.addWidget(self._mk_sep())
        layout.addWidget(self._sessions_row)
        layout.addWidget(self._mk_sep())
        layout.addWidget(self._cost_row)
        layout.addStretch()

    @staticmethod
    def _mk_sep():
        s = QFrame()
        s.setFrameShape(QFrame.Shape.HLine)
        s.setStyleSheet("color: #21262d;")
        return s

    def update_data(self, day: dict, week: dict, month: dict, total: dict):
        """用四个时间段的 summary 更新所有行"""
        def _v(d, k):
            return d.get(k, 0) or 0 if d else 0

        # 耗时行
        self._duration_row.update_values([
            _v(day, "total_duration_s"),
            _v(week, "total_duration_s"),
            _v(month, "total_duration_s"),
            _v(total, "total_duration_s"),
        ])
        # Token 行
        def _tokens(d):
            return (_v(d, "total_tokens_input") + _v(d, "total_tokens_output") +
                    _v(d, "total_tokens_reasoning"))
        self._tokens_row.update_values([
            _tokens(day), _tokens(week), _tokens(month), _tokens(total),
        ])
        # 会话行
        self._sessions_row.update_values([
            _v(day, "total_sessions"),
            _v(week, "total_sessions"),
            _v(month, "total_sessions"),
            _v(total, "total_sessions"),
        ])
        # 成本行
        self._cost_row.update_values([
            _v(day, "total_cost"),
            _v(week, "total_cost"),
            _v(month, "total_cost"),
            _v(total, "total_cost"),
        ])


# ─── 实时 Agent 追踪面板 ──────────────────────


class LiveAgentPanel(QFrame):
    """右侧实时 Agent 追踪面板：显示所有运行中的 opencode 进程"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setStyleSheet("background-color: #0d1117; border: 1px solid #30363d; border-radius: 10px;")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 14, 16, 14)
        layout.setSpacing(8)

        # 标题
        header = QHBoxLayout()
        title = StrongBodyLabel("实时 Agent 追踪")
        title.setStyleSheet("font-size: 15px; color: #e6edf3;")
        header.addWidget(title)
        header.addStretch()
        self._count_label = CaptionLabel("0 个进程")
        self._count_label.setStyleSheet("color: #8b949e;")
        header.addWidget(self._count_label)
        layout.addLayout(header)

        # 表格: 代理, 模型, 服务商, 状态, 耗时, 金额
        self._table = TableWidget(self)
        self._table.setBorderVisible(True)
        self._table.setBorderRadius(4)
        self._table.setColumnCount(6)
        self._table.setHorizontalHeaderLabels([
            "代理", "模型", "服务商", "状态", "耗时", "金额"
        ])
        self._table.horizontalHeader().setSectionResizeMode(
            QHeaderView.ResizeMode.Stretch)
        self._table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self._table.setAlternatingRowColors(True)
        layout.addWidget(self._table)

    def update_processes(self, processes: List[dict]):
        """从 ProcessMonitor 数据更新"""
        self._table.setRowCount(len(processes))
        for i, p in enumerate(processes):
            # 代理
            agent = p.get("agent_type", "") or p.get("session_title", "")[:15] or f"PID:{p.get('pid', '')}"
            agent_short = agent[:20]
            self._table.setItem(i, 0, QTableWidgetItem(agent_short))

            # 模型
            model = p.get("model_id", "") or ""
            model_short = model.split("/")[-1][:15] if "/" in model else model[:15]
            self._table.setItem(i, 1, QTableWidgetItem(model_short or "-"))

            # 服务商
            provider = p.get("provider_id", "") or ""
            self._table.setItem(i, 2, QTableWidgetItem(provider or "-"))

            # 状态
            status = p.get("status", "") or "running"
            status_display = {"running": "● 运行中", "zombie": "✗ 已退出"}.get(status, status)
            s_item = QTableWidgetItem(status_display)
            if status == "running":
                s_item.setForeground(QColor("#3fb950"))
            elif status == "zombie":
                s_item.setForeground(QColor("#8b949e"))
            self._table.setItem(i, 3, s_item)

            # 耗时
            elapsed = p.get("elapsed", 0) or 0
            dur_item = QTableWidgetItem(_fmt_duration(elapsed))
            dur_item.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 4, dur_item)

            # 金额
            cost = p.get("cumulative_cost", 0) or 0
            cost_item = QTableWidgetItem(_fmt_cost(cost))
            cost_item.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(i, 5, cost_item)

        self._table.resizeColumnsToContents()
        running = sum(1 for p in processes if p.get("status") == "running")
        self._count_label.setText(f"{running} 运行中 / {len(processes)} 总计")


# ─── 概览页面 ──────────────────────────────────


class StatusHeader(QFrame):
    """状态头部栏：显示 OpenCode 工作/待机状态 + 进程数 + 概要"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setStyleSheet("""
            StatusHeader {
                background-color: #0d1117;
                border: 1px solid #30363d;
                border-radius: 10px;
                padding: 4px;
            }
        """)
        self.setFixedHeight(72)
        layout = QHBoxLayout(self)
        layout.setContentsMargins(20, 8, 20, 8)
        layout.setSpacing(16)

        # 状态指示灯 + 文本
        self._dot = QLabel("●")
        self._dot.setStyleSheet("font-size: 28px; color: #8b949e;")
        layout.addWidget(self._dot)

        status_text_layout = QVBoxLayout()
        status_text_layout.setSpacing(0)
        self._status_label = StrongBodyLabel("待机中")
        self._status_label.setStyleSheet("font-size: 18px; color: #8b949e;")
        status_text_layout.addWidget(self._status_label)
        self._sub_status = CaptionLabel("没有运行中的 OpenCode 进程")
        self._sub_status.setStyleSheet("color: #484f58; font-size: 11px;")
        status_text_layout.addWidget(self._sub_status)
        layout.addLayout(status_text_layout)

        layout.addSpacing(20)

        # 分隔线
        sep = QFrame()
        sep.setFrameShape(QFrame.Shape.VLine)
        sep.setStyleSheet("color: #21262d;")
        sep.setFixedWidth(1)
        layout.addWidget(sep)
        layout.addSpacing(16)

        # 进程数
        proc_layout = QVBoxLayout()
        proc_layout.setSpacing(0)
        self._proc_count = TitleLabel("0")
        self._proc_count.setStyleSheet("font-size: 26px; font-weight: bold; color: #e6edf3;")
        proc_layout.addWidget(self._proc_count, alignment=Qt.AlignmentFlag.AlignCenter)
        proc_hint = CaptionLabel("运行中进程")
        proc_hint.setStyleSheet("color: #8b949e; font-size: 11px;")
        proc_layout.addWidget(proc_hint, alignment=Qt.AlignmentFlag.AlignCenter)
        layout.addLayout(proc_layout)

        layout.addSpacing(20)

        # 分隔线
        sep2 = QFrame()
        sep2.setFrameShape(QFrame.Shape.VLine)
        sep2.setStyleSheet("color: #21262d;")
        sep2.setFixedWidth(1)
        layout.addWidget(sep2)
        layout.addSpacing(16)

        # 今日会话数
        sess_layout = QVBoxLayout()
        sess_layout.setSpacing(0)
        self._today_sessions = TitleLabel("-")
        self._today_sessions.setStyleSheet("font-size: 26px; font-weight: bold; color: #e6edf3;")
        sess_layout.addWidget(self._today_sessions, alignment=Qt.AlignmentFlag.AlignCenter)
        sess_hint = CaptionLabel("今日会话")
        sess_hint.setStyleSheet("color: #8b949e; font-size: 11px;")
        sess_layout.addWidget(sess_hint, alignment=Qt.AlignmentFlag.AlignCenter)
        layout.addLayout(sess_layout)

        layout.addStretch()

    def update_status(self, running_count: int, total_processes: int, today_sessions: int = 0):
        """更新状态显示"""
        if running_count > 0:
            self._dot.setStyleSheet("font-size: 28px; color: #3fb950;")
            self._status_label.setText("工作中")
            self._status_label.setStyleSheet("font-size: 18px; color: #3fb950;")
            agent_str = "个子 Agent" if running_count > 1 else "个 Agent"
            self._sub_status.setText(f"{running_count} {agent_str} 正在运行中")
        else:
            self._dot.setStyleSheet("font-size: 28px; color: #8b949e;")
            self._status_label.setText("待机中")
            self._status_label.setStyleSheet("font-size: 18px; color: #8b949e;")
            if total_processes > 0:
                self._sub_status.setText(f"{total_processes} 个进程已退出")
            else:
                self._sub_status.setText("没有运行中的 OpenCode 进程")

        self._proc_count.setText(str(running_count))
        self._today_sessions.setText(str(today_sessions))


class OverviewTab(QWidget):
    """概览面板：上50%四维统计 + 下50%实时agent追踪"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._layout = QVBoxLayout(self)
        self._layout.setContentsMargins(0, 0, 0, 0)
        self._layout.setSpacing(10)

        # 状态头部
        self._status_header = StatusHeader()
        self._layout.addWidget(self._status_header)

        # 上侧 50%: 四维统计
        self._stats_grid = PeriodStatsGrid()
        self._layout.addWidget(self._stats_grid, 1)

        # 下侧 50%: 实时 agent
        self._live_panel = LiveAgentPanel()
        self._layout.addWidget(self._live_panel, 1)

        # 外部刷新回调
        self._on_refresh_callback = None

    def set_on_refresh(self, callback):
        self._on_refresh_callback = callback

    def update_stats(self, day: dict, week: dict, month: dict, total: dict):
        """更新四维统计"""
        self._stats_grid.update_data(day, week, month, total)

        # 同时更新状态栏的今日会话数
        today_sessions = day.get("total_sessions", 0) if day else 0
        self._last_today_sessions = today_sessions or 0
        self._status_header.update_status(
            running_count=getattr(self, '_last_running_count', 0),
            total_processes=getattr(self, '_last_total_count', 0),
            today_sessions=self._last_today_sessions,
        )

    def update_live_agents(self, processes: List[dict]):
        """更新实时 agent 列表（来自 ProcessMonitor 数据）"""
        self._live_panel.update_processes(processes)

        # 同时刷新状态头部
        running = sum(1 for p in processes if p.get("status") == "running")
        total = len(processes)
        self._last_running_count = running
        self._last_total_count = total
        self._status_header.update_status(
            running_count=running,
            total_processes=total,
            today_sessions=self._last_today_sessions if hasattr(self, '_last_today_sessions') else 0,
        )


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

    def __init__(self, parent=None):
        super().__init__(parent)
        self._layout = QVBoxLayout(self)
        self._layout.setContentsMargins(0, 0, 0, 0)
        self._layout.setSpacing(0)

        # 顶层标题
        title_bar = QFrame()
        title_bar.setFixedHeight(48)
        title_layout = QHBoxLayout(title_bar)
        title_layout.setContentsMargins(16, 8, 16, 8)
        title_label = StrongBodyLabel("OpenCode 监控与统计")
        title_label.setStyleSheet("font-size: 18px;")
        title_layout.addWidget(title_label)
        title_layout.addStretch()

        # 数据库状态 + 刷新按钮
        self._db_status = CaptionLabel("")
        self._db_status.setStyleSheet("color: #8b949e;")
        title_layout.addWidget(self._db_status)

        self._refresh_all_btn = PushButton("全部刷新")
        self._refresh_all_btn.setIcon(FIF.SYNC)
        title_layout.addWidget(self._refresh_all_btn)

        self._layout.addWidget(title_bar)

        # Tab 页
        self._tabs = QTabWidget()
        self._tabs.setTabPosition(QTabWidget.TabPosition.North)

        self._overview_tab = OverviewTab()
        self._activity_tab = ActivityTab()
        self._sessions_tab = SessionsTab()
        self._agents_tab = AgentsTab()
        self._models_tab = ModelsTab()
        self._daily_tab = DailyTab()
        self._processes_tab = ProcessesTab()

        self._tabs.addTab(self._overview_tab, "概览")
        self._tabs.addTab(self._activity_tab, "近期会话活动")
        self._tabs.addTab(self._sessions_tab, "会话分析")
        self._tabs.addTab(self._agents_tab, "Agent 分析")
        self._tabs.addTab(self._models_tab, "模型统计")
        self._tabs.addTab(self._daily_tab, "日报表")
        self._tabs.addTab(self._processes_tab, "实时进程")

        self._layout.addWidget(self._tabs, stretch=1)

        # 刷新计时器（每 60 秒自动刷新概览页）
        self._auto_timer = QTimer(self)
        self._auto_timer.timeout.connect(self._auto_refresh_overview)
        self._auto_timer.setInterval(60000)

        # 数据引用
        self._monitor_store = None
        self._opencode_reader = None
        self._last_summary: dict = {}
        self._listeners: list = []

        # 连接刷新按钮
        self._refresh_all_btn.clicked.connect(self._do_refresh_all)
        self._overview_tab.set_on_refresh(self._do_refresh_all)
        self._activity_tab.set_on_refresh(self._do_refresh_all)
        self._sessions_tab.set_on_refresh(self._do_refresh_all)
        self._agents_tab.set_on_refresh(self._do_refresh_all)
        self._models_tab.set_on_refresh(self._do_refresh_all)
        self._daily_tab.set_on_refresh(self._do_refresh_all)

    def set_data_sources(self, monitor_store, opencode_reader,
                          process_monitor=None):
        """设置数据源引用

        Args:
            monitor_store: MonitorStore 实例
            opencode_reader: OpencodeDBReader 实例
            process_monitor: 可选的 ProcessMonitor 实例
        """
        self._monitor_store = monitor_store
        self._opencode_reader = opencode_reader
        self._process_monitor = process_monitor

        # 连接进程监控
        if process_monitor:
            self._processes_tab.set_process_monitor(process_monitor)

        # 更新 DB 状态
        if opencode_reader and opencode_reader.is_available():
            self._db_status.setText(f"● DB: {opencode_reader.db_path}")
            self._db_status.setStyleSheet("color: #3fb950;")
        else:
            self._db_status.setText("○ OpenCode DB 未找到")
            self._db_status.setStyleSheet("color: #f85149;")

    def start_auto_refresh(self):
        """启动自动刷新 + 进程监控"""
        self._auto_timer.start()
        # 启动实时进程监控（后台线程）
        if self._process_monitor and not self._process_monitor.is_running:
            self._process_monitor.start(
                callback=self._on_process_data,
                interval=10,
            )

    def stop_auto_refresh(self):
        """停止自动刷新 + 进程监控"""
        self._auto_timer.stop()
        if self._process_monitor and self._process_monitor.is_running:
            self._process_monitor.stop()

    def _on_process_data(self, processes: list):
        """ProcessMonitor 后台线程回调 — 通过信号安全切回主线程更新 UI"""
        # 转换为 dict 列表
        data = [
            {
                "pid": p.pid,
                "working_dir": p.working_dir,
                "session_title": p.session_title,
                "agent_type": p.agent_type,
                "model_id": p.model_id,
                "provider_id": p.provider_id,
                "cumulative_cost": p.cumulative_cost,
                "elapsed": p.elapsed,
                "cpu_percent": p.cpu_percent,
                "memory_mb": p.memory_mb,
                "status": p.status,
            }
            for p in processes
        ]
        self._pending_process_data = data
        # 用 QTimer.singleShot 安全切回主线程
        QTimer.singleShot(0, self._apply_process_data)

    def _apply_process_data(self):
        """主线程：应用缓存的进程数据到 UI（进程Tab + 概览实时Agent）"""
        if hasattr(self, '_pending_process_data') and self._pending_process_data is not None:
            data = self._pending_process_data
            self._processes_tab.update_processes(data)
            # 同时更新概览页的实时 agent 面板
            self._overview_tab.update_live_agents(data)
            self._pending_process_data = None

    def add_listener(self, callback):
        """添加数据更新监听器"""
        self._listeners.append(callback)

    def _auto_refresh_overview(self):
        """自动刷新概览页 — 四维统计 + 实时agent"""
        if not self._monitor_store:
            return
        try:
            # 四维统计（当日/周/月/总计）
            summary_day = self._monitor_store.get_summary(days=1)
            summary_week = self._monitor_store.get_summary(days=7)
            summary_month = self._monitor_store.get_summary(days=30)
            summary_total = self._monitor_store.get_summary(days=365)
            self._overview_tab.update_stats(summary_day, summary_week,
                                             summary_month, summary_total)
        except Exception as e:
            print(f"[Monitor] 自动刷新异常: {e}")

    def _do_refresh_all(self):
        """全量刷新所有标签页"""
        if not self._monitor_store or not self._opencode_reader:
            return

        try:
            # 刷新 DB 路径（发现新启动的 opencode 进程）
            if self._opencode_reader:
                changed = self._opencode_reader.refresh_db_path()
                if changed:
                    self._db_status.setText(f"● DB: {self._opencode_reader.db_path}")
                    self._db_status.setStyleSheet("color: #3fb950;")

            if self._opencode_reader and self._opencode_reader.is_available():
                self._monitor_store.sync_from_opencode_db(
                    self._opencode_reader, days=14)

            # --- 概览：四维统计 ---
            summary_day = self._monitor_store.get_summary(days=1)
            summary_week = self._monitor_store.get_summary(days=7)
            summary_month = self._monitor_store.get_summary(days=30)
            summary_total = self._monitor_store.get_summary(days=365)
            self._overview_tab.update_stats(summary_day, summary_week,
                                             summary_month, summary_total)

            # --- 近期会话活动 ---
            days_a = self._activity_tab.get_days()
            activities = self._monitor_store.get_recent_activity(limit=100)
            self._activity_tab.update_activity(activities)

            # --- 会话分析 ---
            days_s = self._sessions_tab.get_days()
            type_filter = self._sessions_tab.get_type_filter()
            sessions = self._monitor_store.get_session_snapshots(
                days=days_s, limit=500)
            if type_filter == "main":
                sessions = [s for s in sessions
                            if not s.get("parent_id") or not s["parent_id"].strip()]
            elif type_filter == "sub":
                sessions = [s for s in sessions
                            if s.get("parent_id") and s["parent_id"].strip()]
            self._sessions_tab.update_sessions(sessions)

            # Agent 分析
            a_days = self._agents_tab.get_days()
            agents = self._monitor_store.get_agent_type_usage(days=a_days)
            self._agents_tab.update_agents(agents)

            # 模型统计
            m_days = self._models_tab.get_days()
            models = self._monitor_store.get_model_usage(days=m_days)
            self._models_tab.update_models(models)

            # 日统计
            d_days = self._daily_tab.get_days()
            daily = self._monitor_store.get_daily_aggregates(days=d_days)
            self._daily_tab.update_daily(daily)

            # 通知监听器
            for cb in self._listeners:
                try:
                    cb()
                except Exception as e:
                    print(f"[Monitor] 监听器异常: {e}")

        except Exception as e:
            import traceback
            traceback.print_exc()
