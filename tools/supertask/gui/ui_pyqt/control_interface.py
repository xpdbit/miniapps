# -*- coding: utf-8 -*-
"""control_interface.py — 控制面板仪表盘（状态总览 + 手动操作 + 日志检视 + 队列检视）

布局：
  上侧 35%
    ├─ 左侧 50%: 待审批 / 排队中 / 已完成 / 已失败 数字 + Agent 状态 + 模型
    └─ 右侧 50%: 手动操作（项目选择、持续探索、执行队列、更新待审批）
  下侧 65%
    ├─ 左侧 50%: 日志检视（彩色 HTML 实时日志）
    └─ 右侧 50%: 队列检视（工作队列表格）
"""
from datetime import datetime

from PyQt6.QtCore import Qt
from PyQt6.QtGui import QColor
from PyQt6.QtWidgets import (QComboBox, QFrame, QGridLayout, QHBoxLayout,
                               QLabel, QScrollBar, QSizePolicy,
                               QSplitter, QTableWidgetItem, QTextEdit,
                               QVBoxLayout, QWidget, QHeaderView,
                               QAbstractItemView)
from qfluentwidgets import (
    BodyLabel, CaptionLabel, FluentIcon as FIF,
    PushButton, SimpleCardWidget, StrongBodyLabel, TitleLabel, TableWidget,
)

from gui.ui_pyqt.agent_status_interface import PhaseStatusBar
from gui.ui_pyqt.detail_widget import STATUS_COLORS, STATUS_LABELS

# FIF 图标版本兼容（某些 qfluentwidgets 版本缺少部分图标）
_FIF_GITHUB = getattr(FIF, 'GITHUB', None) or FIF.SYNC
_FIF_SEARCH = getattr(FIF, 'SEARCH', None) or FIF.SYNC
_FIF_SEND = getattr(FIF, 'SEND', None) or FIF.SYNC
_FIF_SYNC = getattr(FIF, 'SYNC', None) or FIF.UP
_FIF_ACCEPT = getattr(FIF, 'ACCEPT', None) or FIF.SYNC
_FIF_PAUSE = getattr(FIF, 'PAUSE', None) or getattr(FIF, 'PAUSE_BADGE', None) or FIF.SYNC
_FIF_PLAY = getattr(FIF, 'PLAY', None) or getattr(FIF, 'PLAY_BADGE', None) or FIF.SYNC


# ─── 日志颜色 ───
_LOG_COLORS = {
    "info": "#3fb950",
    "error": "#f85149",
    "decision": "#58a6ff",
    "approved": "#bc8cff",
}
_LOG_PREFIX = {"info": "\u00b7", "error": "\u2717", "decision": "\u25b6", "approved": "\u2713"}
_LOG_BADGE = {
    "info": ("INFO", "#3fb950"),
    "error": ("ERROR", "#f85149"),
    "decision": ("DECIDE", "#58a6ff"),
    "approved": ("OK", "#bc8cff"),
}


class ValueLabel(QLabel):
    """带颜色的数字标签"""

    def __init__(self, text: str, color: str, parent: QWidget | None = None):
        super().__init__(text, parent)
        self.setStyleSheet(
            f"font-size: 28px; font-weight: bold; color: {color}; background: transparent;"
        )


class ControlInterface(QWidget):
    """控制面板 —— 统一仪表盘：顶部状态+控制，底部日志+队列"""

    def __init__(self, parent: QWidget | None = None):
        super().__init__(parent)
        self._stat_labels: dict[str, ValueLabel] = {}

        self._setup_ui()

    # ===================================================================
    # UI 构建
    # ===================================================================

    # ─── 公共访问（按钮/组件引用，供 app.py 连接） ───
    # _explore_btn / _execute_btn / _update_btn / _verify_btn / _github_btn 在 _setup_ui 中创建

    def _setup_ui(self) -> None:
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(24, 24, 24, 24)
        main_layout.setSpacing(0)

        main_layout.addWidget(TitleLabel("控制面板"))
        main_layout.addSpacing(12)

        # ── 主分割器（上下 35:65） ──
        main_splitter = QSplitter(Qt.Orientation.Vertical)
        main_splitter.setHandleWidth(1)

        # ===================== 上侧 35% =====================
        top_w = self._build_top_section()
        main_splitter.addWidget(top_w)

        # ===================== 下侧 65% =====================
        bottom_w = self._build_bottom_section()
        main_splitter.addWidget(bottom_w)

        main_splitter.setSizes([350, 650])
        main_splitter.setStretchFactor(0, 35)
        main_splitter.setStretchFactor(1, 65)
        main_layout.addWidget(main_splitter, 1)

    # ── 上侧 35% ──────────────────────────────────────────

    def _build_top_section(self) -> QWidget:
        """构建上侧区域：左侧状态 + 右侧控制，左右 50:50"""
        top_w = QWidget()
        top_layout = QHBoxLayout(top_w)
        top_layout.setContentsMargins(0, 0, 0, 12)  # 下边距分隔顶部和底部
        top_layout.setSpacing(0)

        top_splitter = QSplitter(Qt.Orientation.Horizontal)
        top_splitter.setHandleWidth(1)

        # 左侧：统计 + Agent 状态
        left_top = self._build_top_left()
        top_splitter.addWidget(left_top)

        # 右侧：手动操作
        right_top = self._build_top_right()
        top_splitter.addWidget(right_top)

        top_splitter.setSizes([500, 500])
        top_splitter.setStretchFactor(0, 50)
        top_splitter.setStretchFactor(1, 50)
        top_layout.addWidget(top_splitter)
        return top_w

    def _build_top_left(self) -> QWidget:
        """上侧左侧：统计数字 + Agent 状态条"""
        w = QWidget()
        layout = QVBoxLayout(w)
        layout.setContentsMargins(0, 0, 12, 0)
        layout.setSpacing(12)

        # ── 统计数字卡片 ──
        stats_card = SimpleCardWidget()
        stats_card.setBorderRadius(12)
        stats_layout = QHBoxLayout(stats_card)
        stats_layout.setSpacing(0)

        stats_data: list[tuple[str, str, str]] = [
            ("proposed", "待审批", "#58a6ff"),
            ("pending", "排队中", "#d29922"),
            ("done", "已完成", "#3fb950"),
            ("failed", "已失败", "#f85149"),
        ]
        for idx, (key, label, color) in enumerate(stats_data):
            col = QVBoxLayout()
            col.setAlignment(Qt.AlignmentFlag.AlignCenter)
            self._stat_labels[key] = ValueLabel("0", color)
            col.addWidget(
                self._stat_labels[key], alignment=Qt.AlignmentFlag.AlignCenter
            )
            col.addWidget(CaptionLabel(label), alignment=Qt.AlignmentFlag.AlignCenter)
            stats_layout.addLayout(col)
            if idx != len(stats_data) - 1:
                vline = QFrame()
                vline.setFrameShape(QFrame.Shape.VLine)
                vline.setStyleSheet("color: #30363d;")
                stats_layout.addWidget(vline)

        layout.addWidget(stats_card)

        # ── Agent 状态条（阶段 + 模型） ──
        self._phase_bar = PhaseStatusBar()
        layout.addWidget(self._phase_bar)

        # 弹性填充
        layout.addStretch()
        return w

    def _build_top_right(self) -> QWidget:
        """上侧右侧：手动操作 — 分组布局（项目选择 / 任务操作 / Agent控制）"""
        w = QWidget()
        layout = QVBoxLayout(w)
        layout.setContentsMargins(12, 0, 0, 0)
        layout.setSpacing(12)

        ctrl_card = SimpleCardWidget()
        ctrl_card.setBorderRadius(12)
        ctrl_layout = QVBoxLayout(ctrl_card)
        ctrl_layout.setSpacing(0)

        # ── 标题栏 ──
        ctrl_layout.addWidget(StrongBodyLabel("🔧 手动操作"))
        ctrl_layout.addSpacing(10)

        # ── 分隔线 ──
        ctrl_layout.addWidget(self._make_separator())
        ctrl_layout.addSpacing(12)

        # ════════════════════════════════════════
        # 第 1 组：项目选择
        # ════════════════════════════════════════
        ctrl_layout.addWidget(self._make_section_label("📋 项目选择"))
        ctrl_layout.addSpacing(6)

        self._project_combo = QComboBox()
        self._project_combo.addItems(["全部", "ftg", "game1", "tavern"])
        self._project_combo.setCurrentIndex(0)
        self._project_combo.setEditable(True)
        self._project_combo.setInsertPolicy(QComboBox.InsertPolicy.NoInsert)
        self._project_combo.setToolTip("选择要探索的目标项目，或输入自定义项目名")
        self._project_combo.setStyleSheet("""
            QComboBox {
                color: #c9d1d9; background: #0d1117;
                border: 1px solid #30363d; border-radius: 6px;
                padding: 6px 12px; font-size: 13px;
            }
            QComboBox:hover { border-color: #58a6ff; }
            QComboBox::drop-down { border: none; width: 24px; }
            QComboBox::down-arrow { image: none; }
            QComboBox QAbstractItemView {
                color: #c9d1d9; background: #161b22;
                border: 1px solid #30363d; border-radius: 6px;
                selection-background-color: #1f6feb;
                padding: 4px;
            }
            QComboBox QAbstractItemView::item {
                padding: 6px 12px; border-radius: 4px;
            }
            QComboBox QAbstractItemView::item:hover {
                background: #21262d;
            }
        """)
        ctrl_layout.addWidget(self._project_combo)
        ctrl_layout.addSpacing(16)

        # ════════════════════════════════════════
        # 第 2 组：任务操作（4:3 方块卡片水平布局）
        # ════════════════════════════════════════
        ctrl_layout.addWidget(self._make_separator())
        ctrl_layout.addSpacing(12)
        ctrl_layout.addWidget(self._make_section_label("⚡ 任务操作"))
        ctrl_layout.addSpacing(8)

        task_row = QHBoxLayout()
        task_row.setSpacing(8)

        # 按钮定义: (属性名, 图标, 文本, 工具提示)
        task_buttons = [
            ("_explore_btn", _FIF_SEARCH, "持续探索",
             "AI 遍历项目发现改进领域，生成粗粒度任务提议"),
            ("_execute_btn", _FIF_SEND, "执行队列",
             "按顺序执行工作队列中的待处理任务"),
            ("_update_btn", _FIF_SYNC, "更新待审批",
             "AI 检查并更新待审批列表状态（标记完成/失效/调整描述）"),
            ("_verify_btn", _FIF_ACCEPT, "检查成果",
             "检查已完成任务的代码实现率，发现遗漏/缺陷/漏洞时自动生成修补提议并直接进入工作队列"),
            ("_github_btn", _FIF_GITHUB, "更新文档并推送",
             "更新项目文档并推送代码到 Github 仓库"),
        ]

        for attr_name, icon, text, tooltip in task_buttons:
            # 卡片容器（4:3 ≈ 120:90）
            card = QWidget()
            card.setMinimumSize(120, 90)
            card.setSizePolicy(
                QSizePolicy.Policy.Expanding,
                QSizePolicy.Policy.Expanding,
            )
            card.setStyleSheet("""
                QWidget {
                    background-color: #161b22;
                    border: 1px solid #30363d;
                    border-radius: 8px;
                }
                QWidget:hover {
                    border-color: #58a6ff;
                }
            """)

            card_layout = QVBoxLayout(card)
            card_layout.setContentsMargins(4, 4, 4, 4)
            card_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)

            btn = PushButton(icon, text)
            btn.setToolTip(tooltip)
            btn.setSizePolicy(
                QSizePolicy.Policy.Expanding,
                QSizePolicy.Policy.Expanding,
            )
            setattr(self, attr_name, btn)

            card_layout.addWidget(btn, alignment=Qt.AlignmentFlag.AlignCenter)
            task_row.addWidget(card)

        ctrl_layout.addLayout(task_row)

        # ════════════════════════════════════════
        # 第 3 组：Agent 控制
        # ════════════════════════════════════════
        ctrl_layout.addWidget(self._make_separator())
        ctrl_layout.addSpacing(12)
        ctrl_layout.addWidget(self._make_section_label("🤖 Agent 控制"))
        ctrl_layout.addSpacing(8)

        row_agent = QHBoxLayout()
        row_agent.setSpacing(8)
        self._pause_agent_btn = PushButton(_FIF_PAUSE, "暂停")
        self._pause_agent_btn.setToolTip("挂起当前运行的 Agent 进程（可恢复）")
        self._resume_agent_btn = PushButton(_FIF_PLAY, "继续")
        self._resume_agent_btn.setToolTip("恢复已暂停的 Agent 进程")
        row_agent.addWidget(self._pause_agent_btn)
        row_agent.addWidget(self._resume_agent_btn)
        row_agent.addStretch()
        ctrl_layout.addLayout(row_agent)

        layout.addWidget(ctrl_card)
        layout.addStretch()
        return w

    @staticmethod
    def _make_separator() -> QFrame:
        """创建水平分隔线"""
        sep = QFrame()
        sep.setFrameShape(QFrame.Shape.HLine)
        sep.setStyleSheet("color: #30363d;")
        return sep

    @staticmethod
    def _make_section_label(text: str) -> CaptionLabel:
        """创建分组标题标签"""
        label = CaptionLabel(text)
        label.setStyleSheet("color: #8b949e; font-size: 11px; font-weight: bold;")
        return label

    # ── 下侧 65% ──────────────────────────────────────────

    def _build_bottom_section(self) -> QWidget:
        """构建下侧区域：左侧日志 + 右侧队列，左右 50:50"""
        bottom_w = QWidget()
        bottom_layout = QHBoxLayout(bottom_w)
        bottom_layout.setContentsMargins(0, 12, 0, 0)  # 上边距分隔顶部和底部
        bottom_layout.setSpacing(0)

        bottom_splitter = QSplitter(Qt.Orientation.Horizontal)
        bottom_splitter.setHandleWidth(1)

        # 左侧：日志检视
        log_w = self._build_log_viewer()
        bottom_splitter.addWidget(log_w)

        # 右侧：队列检视
        queue_w = self._build_queue_viewer()
        bottom_splitter.addWidget(queue_w)

        bottom_splitter.setSizes([500, 500])
        bottom_splitter.setStretchFactor(0, 50)
        bottom_splitter.setStretchFactor(1, 50)
        bottom_layout.addWidget(bottom_splitter)
        return bottom_w

    def _build_log_viewer(self) -> QWidget:
        """下侧左侧：彩色日志检视面板"""
        w = QWidget()
        layout = QVBoxLayout(w)
        layout.setContentsMargins(0, 0, 12, 0)
        layout.setSpacing(8)

        layout.addWidget(BodyLabel("运行日志"))
        toolbar = QHBoxLayout()
        toolbar.addStretch()

        self._log_auto_scroll_btn = PushButton("自动滚动: 开")
        self._log_auto_scroll_btn.setFixedWidth(120)
        self._log_auto_scroll_btn.setCheckable(True)
        self._log_auto_scroll_btn.setChecked(True)
        self._log_auto_scroll_btn.clicked.connect(self._toggle_auto_scroll)
        toolbar.addWidget(self._log_auto_scroll_btn)

        self._log_clear_btn = PushButton("清空")
        self._log_clear_btn.setFixedWidth(80)
        toolbar.addWidget(self._log_clear_btn)
        layout.addLayout(toolbar)

        self._log_text = QTextEdit()
        self._log_text.setReadOnly(True)
        self._log_text.setStyleSheet("""
            QTextEdit {
                background-color: #0d1117; color: #c9d1d9;
                border: 1px solid #30363d; border-radius: 8px;
                padding: 8px;
                font-family: "Consolas", "Microsoft YaHei", monospace;
                font-size: 12px;
            }
        """)
        layout.addWidget(self._log_text, 1)

        self._log_clear_btn.clicked.connect(self._log_text.clear)
        return w

    def _build_queue_viewer(self) -> QWidget:
        """下侧右侧：工作队列检视表格"""
        w = QWidget()
        layout = QVBoxLayout(w)
        layout.setContentsMargins(12, 0, 0, 0)
        layout.setSpacing(8)

        header_row = QHBoxLayout()
        header_row.addWidget(BodyLabel("队列检视"))
        header_row.addStretch()
        self._queue_count_label = CaptionLabel("")
        self._queue_count_label.setStyleSheet("color: #8b949e; font-size: 12px;")
        header_row.addWidget(self._queue_count_label)
        layout.addLayout(header_row)

        # 队列表格：描述 + 状态
        self._queue_table = TableWidget()
        self._queue_table.setColumnCount(2)
        self._queue_table.setHorizontalHeaderLabels(["描述", "状态"])
        self._queue_table.setBorderRadius(8)
        self._queue_table.horizontalHeader().setStretchLastSection(False)
        self._queue_table.horizontalHeader().setSectionResizeMode(
            0, QHeaderView.ResizeMode.Stretch
        )
        self._queue_table.horizontalHeader().setSectionResizeMode(
            1, QHeaderView.ResizeMode.ResizeToContents
        )
        self._queue_table.setEditTriggers(TableWidget.EditTrigger.NoEditTriggers)
        self._queue_table.setSelectionMode(TableWidget.SelectionMode.NoSelection)
        self._queue_table.setSortingEnabled(True)
        self._queue_table.verticalHeader().setDefaultSectionSize(28)
        layout.addWidget(self._queue_table, 1)

        # 底部提示
        self._queue_hint = CaptionLabel("无任务")
        self._queue_hint.setStyleSheet("color: #484f58; font-size: 11px;")
        layout.addWidget(self._queue_hint)

        return w

    # ===================================================================
    # 公共 API（供 app.py / LoopManager 调用）
    # ===================================================================

    def update_stats(
        self,
        proposed: int = 0,
        approved: int = 0,
        done: int = 0,
        failed: int = 0,
    ) -> None:
        """更新统计数字（由 app._refresh_all 调用）"""
        self._stat_labels["proposed"].setText(str(proposed))
        self._stat_labels["pending"].setText(str(approved))
        self._stat_labels["done"].setText(str(done))
        self._stat_labels["failed"].setText(str(failed))

    def set_approved(self, tasks: list[dict]) -> None:
        """填充工作队列列表（由 app._refresh_all 调用）"""
        self._queue_table.setRowCount(len(tasks))
        self._queue_count_label.setText(f"({len(tasks)})")

        for i, t in enumerate(tasks):
            # 第 0 列：描述
            desc = str(t.get("desc", t.get("description", "")))
            display = desc if len(desc) <= 80 else desc[:77] + "…"
            item = QTableWidgetItem(display)
            item.setToolTip(desc)
            item.setForeground(Qt.GlobalColor.white)  # 由 qss 控制
            self._queue_table.setItem(i, 0, item)

            # 第 1 列：状态
            status = t.get("status", "pending")
            status_item = QTableWidgetItem(STATUS_LABELS.get(status, status))
            color = STATUS_COLORS.get(status, "#e6edf3")
            status_item.setForeground(QColor(color))
            self._queue_table.setItem(i, 1, status_item)

        # 更新底部提示
        if tasks:
            statuses = [t.get("status", "pending") for t in tasks]
            pending = sum(1 for s in statuses if s == "pending")
            done = sum(1 for s in statuses if s == "done")
            failed = sum(1 for s in statuses if s in ("error", "failed_blocked"))
            parts = []
            if pending:
                parts.append(f"{pending} 进行中")
            if done:
                parts.append(f"{done} 已完成")
            if failed:
                parts.append(f"{failed} 失败")
            self._queue_hint.setText(" | ".join(parts) if parts else "无活跃任务")
        else:
            self._queue_hint.setText("无任务")

    def append_log(self, level: str, message: str) -> None:
        """追加日志（由 _on_log 转发）"""
        ts = datetime.now().strftime("%H:%M:%S")
        badge, bg = _LOG_BADGE.get(level, ("·", "transparent"))
        color = _LOG_COLORS.get(level, "#c9d1d9")
        safe_msg = message.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        html = (
            f'<span style="color:#8b949e">[{ts}]</span>'
            f'<span style="display:inline-block;background:{bg};color:#000;'
            f'padding:1px 5px;border-radius:3px;font-size:10px;font-weight:700;'
            f'margin:0 4px 0 2px;">{badge}</span>'
            f'<span style="color:{color}">{safe_msg}</span><br>'
        )
        self._log_text.insertHtml(html)
        if self._log_auto_scroll_btn.isChecked():
            sb = self._log_text.verticalScrollBar()
            sb.setValue(sb.maximum())

    def update_agent_status(self, status: dict) -> None:
        """更新 Agent 状态条（由 agent_status_changed 信号转发）"""
        phase = status.get("phase", "")
        phase_status = status.get("phase_status", "idle")
        elapsed = status.get("phase_elapsed", 0)
        self._phase_bar.update_phase(phase, phase_status, elapsed)
        self._phase_bar.update_model(status.get("global_model", ""))

    def get_selected_project(self) -> str | None:
        """返回 ComboBox 中选择的项目名，'全部'返回 None"""
        text = self._project_combo.currentText()
        return None if text == "全部" else text

    # ===================================================================
    # 内部事件
    # ===================================================================

    def _toggle_auto_scroll(self) -> None:
        """切换日志自动滚动"""
        checked = self._log_auto_scroll_btn.isChecked()
        self._log_auto_scroll_btn.setText("自动滚动: 开" if checked else "自动滚动: 关")
