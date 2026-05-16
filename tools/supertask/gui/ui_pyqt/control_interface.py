# -*- coding: utf-8 -*-
"""control_interface.py — 控制面板仪表盘（状态总览 + 手动操作 + 日志检视 + 队列检视）

布局：
  上侧 35%
    ├─ 左侧 50%: 待审批 / 排队中 / 已完成 / 已失败 数字 + Agent 状态 + 模型
    └─ 右侧 50%: 手动操作（项目选择、持续探索、执行队列、更新待审批）
  下侧 65%
    ├─ 左侧 50%: 运行日志（日志 + 终端子 tab）
    └─ 右侧 50%: 队列检视（工作队列表格）
"""
import os
import re
import subprocess
from datetime import datetime

from PyQt6.QtCore import Qt, QProcess
from PyQt6.QtGui import QColor
from PyQt6.QtWidgets import (QComboBox, QFrame, QGridLayout, QHBoxLayout,
                               QLabel, QLineEdit, QScrollBar, QSizePolicy,
                               QSplitter, QTabWidget, QTableWidgetItem,
                               QTextEdit, QVBoxLayout, QWidget,
                               QHeaderView, QAbstractItemView)
from qfluentwidgets import (
    BodyLabel, CaptionLabel, FluentIcon as FIF,
    PushButton, SimpleCardWidget, StrongBodyLabel, TitleLabel, TableWidget,
)

from gui.ui_pyqt.agent_status_interface import PhaseStatusBar
from gui.ui_pyqt.detail_widget import STATUS_COLORS, STATUS_LABELS
from .task_plan_interface import build_prompt_preview

# ─── 箭头图标路径 ───
_ARROW_SVG = os.path.join(os.path.dirname(__file__), '..', '..', 'resources', 'down_arrow.svg').replace('\\', '/')

# 匹配 ANSI 转义序列
_ANSI_RE = re.compile(r'\x1b\[[0-9;]*[a-zA-Z]')

# FIF 图标版本兼容（某些 qfluentwidgets 版本缺少部分图标）
_FIF_GITHUB = getattr(FIF, 'GITHUB', None) or FIF.SYNC
_FIF_SEARCH = getattr(FIF, 'SEARCH', None) or FIF.SYNC
_FIF_SEND = getattr(FIF, 'SEND', None) or FIF.SYNC
_FIF_SYNC = getattr(FIF, 'SYNC', None) or FIF.UP
_FIF_ACCEPT = getattr(FIF, 'ACCEPT', None) or FIF.SYNC
_FIF_DEPLOY = getattr(FIF, 'UP', None) or getattr(FIF, 'SEND', None) or _FIF_SYNC


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
        self._selected_task_id: int | None = None
        self._working_dir: str = ""
        self._terminal_history: list[str] = []
        self._terminal_history_idx: int = -1
        self._terminal_process: QProcess | None = None

        self._setup_ui()

    # ===================================================================
    # UI 构建
    # ===================================================================

    # ─── 公共访问（按钮/组件引用，供 app.py 连接） ───
    # _explore_btn / _execute_btn / _update_btn / _verify_btn / _deploy_btn / _github_btn 在 _setup_ui 中创建

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
        """上侧右侧：操作面板 — 标题栏含项目选择，下方两行任务操作按钮"""
        w = QWidget()
        layout = QVBoxLayout(w)
        layout.setContentsMargins(12, 0, 0, 0)
        layout.setSpacing(12)

        ctrl_card = SimpleCardWidget()
        ctrl_card.setBorderRadius(12)
        ctrl_layout = QVBoxLayout(ctrl_card)
        ctrl_layout.setSpacing(0)

        # ════════════════════════════════════════
        # 第 1 行：左侧 header + 右侧项目选择
        # ════════════════════════════════════════
        header_row = QHBoxLayout()
        header_row.setSpacing(12)

        # 左侧：操作标题
        header_row.addWidget(StrongBodyLabel("🔧 操作"))
        header_row.addStretch()

        # 右侧：项目选择
        self._project_combo = QComboBox()
        self._project_combo.addItems(["全部", "ftg", "game1", "tavern"])
        self._project_combo.setCurrentIndex(0)
        self._project_combo.setEditable(True)
        self._project_combo.setInsertPolicy(QComboBox.InsertPolicy.NoInsert)
        self._project_combo.setToolTip("选择目标项目，或输入自定义项目名")
        self._project_combo.setMinimumWidth(180)
        self._project_combo.setStyleSheet(f"""
            QComboBox {{
                color: #c9d1d9; background: #0d1117;
                border: 1px solid #30363d; border-radius: 6px;
                padding: 6px 28px 6px 12px; font-size: 13px;
            }}
            QComboBox:hover {{ border-color: #58a6ff; }}
            QComboBox::drop-down {{
                subcontrol-origin: padding;
                subcontrol-position: top right;
                width: 24px;
                border-left: none;
                border-top-right-radius: 6px;
                border-bottom-right-radius: 6px;
            }}
            QComboBox::down-arrow {{
                image: url({_ARROW_SVG});
                width: 12px;
                height: 12px;
            }}
            QComboBox QAbstractItemView {{
                color: #c9d1d9; background: #161b22;
                border: 1px solid #30363d; border-radius: 6px;
                selection-background-color: #1f6feb;
                padding: 4px;
            }}
            QComboBox QAbstractItemView::item {{
                padding: 6px 12px; border-radius: 4px;
            }}
            QComboBox QAbstractItemView::item:hover {{
                background: #21262d;
            }}
        """)
        header_row.addWidget(self._project_combo)

        ctrl_layout.addLayout(header_row)
        ctrl_layout.addSpacing(10)

        # ── 分隔线 ──
        ctrl_layout.addWidget(self._make_separator())
        ctrl_layout.addSpacing(12)

        # ════════════════════════════════════════
        # 第 2 组：任务操作（两行布局）
        # ════════════════════════════════════════
        ctrl_layout.addWidget(self._make_section_label("⚡ 任务操作"))
        ctrl_layout.addSpacing(8)

        _BTN_STYLE = """
            PushButton {
                background-color: #161b22;
                border: 1px solid #30363d;
                border-radius: 8px;
                min-width: 110px; min-height: 72px;
                font-size: 12px;
            }
            PushButton:hover {
                border-color: #58a6ff;
                background-color: #1c2433;
            }
            PushButton:pressed {
                background-color: #0d419d;
            }
        """

        # 第一行：持续探索、执行队列、更新任务
        row1 = QHBoxLayout()
        row1.setSpacing(8)

        btn_explore = PushButton(_FIF_SEARCH, "持续探索")
        btn_explore.setToolTip("AI 持续遍历项目发现改进领域，直到手动停止或达到目标提议数量")
        btn_explore.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        btn_explore.setStyleSheet(_BTN_STYLE)
        self._explore_btn = btn_explore
        row1.addWidget(btn_explore)

        btn_execute = PushButton(_FIF_SEND, "执行队列")
        btn_execute.setToolTip("按顺序执行工作队列中的待处理任务")
        btn_execute.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        btn_execute.setStyleSheet(_BTN_STYLE)
        self._execute_btn = btn_execute
        row1.addWidget(btn_execute)

        btn_update = PushButton(_FIF_SYNC, "更新任务")
        btn_update.setToolTip("重新检查项目，根据当前情况更新任务项内容（描述、预期成果、约束、头脑风暴历史）")
        btn_update.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        btn_update.setStyleSheet(_BTN_STYLE)
        self._update_btn = btn_update
        row1.addWidget(btn_update)

        ctrl_layout.addLayout(row1)
        ctrl_layout.addSpacing(8)

        # 第二行：检查成果、检查修复、部署云端、更新文档并推送
        row2 = QHBoxLayout()
        row2.setSpacing(8)

        btn_verify = PushButton(_FIF_ACCEPT, "检查成果")
        btn_verify.setToolTip("检查已完成任务的代码实现率，发现遗漏/缺陷/漏洞时自动生成修补提议并直接进入工作队列")
        btn_verify.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        btn_verify.setStyleSheet(_BTN_STYLE)
        self._verify_btn = btn_verify
        row2.addWidget(btn_verify)

        btn_check_fix = PushButton(_FIF_ACCEPT, "检查修复")
        btn_check_fix.setToolTip("对当前项目运行代码检查和自动修复（类型、lint、格式化等）")
        btn_check_fix.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        btn_check_fix.setStyleSheet(_BTN_STYLE)
        self._check_fix_btn = btn_check_fix
        row2.addWidget(btn_check_fix)

        btn_deploy = PushButton(_FIF_DEPLOY, "部署云端")
        btn_deploy.setToolTip("将当前项目部署到远程服务器（ECS）")
        btn_deploy.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        btn_deploy.setStyleSheet(_BTN_STYLE)
        self._deploy_btn = btn_deploy
        row2.addWidget(btn_deploy)

        btn_github = PushButton(_FIF_GITHUB, "更新文档并推送")
        btn_github.setToolTip("更新项目文档并推送代码到 Github 仓库")
        btn_github.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        btn_github.setStyleSheet(_BTN_STYLE)
        self._github_btn = btn_github
        row2.addWidget(btn_github)

        ctrl_layout.addLayout(row2)

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
        """构建下侧区域：左侧运行日志（日志+终端子tab） + 右侧队列，左右 50:50"""
        bottom_w = QWidget()
        bottom_layout = QHBoxLayout(bottom_w)
        bottom_layout.setContentsMargins(0, 12, 0, 0)  # 上边距分隔顶部和底部
        bottom_layout.setSpacing(0)

        bottom_splitter = QSplitter(Qt.Orientation.Horizontal)
        bottom_splitter.setHandleWidth(1)

        # 左侧：运行日志（含日志 + 终端子 tab）
        log_w = self._build_run_log_section()
        bottom_splitter.addWidget(log_w)

        # 右侧：队列检视
        queue_w = self._build_queue_viewer()
        bottom_splitter.addWidget(queue_w)

        bottom_splitter.setSizes([500, 500])
        bottom_splitter.setStretchFactor(0, 50)
        bottom_splitter.setStretchFactor(1, 50)
        bottom_layout.addWidget(bottom_splitter)
        return bottom_w

    def _build_run_log_section(self) -> QWidget:
        """下侧左侧：运行日志（含日志 + 终端子 tab）"""
        w = QWidget()
        layout = QVBoxLayout(w)
        layout.setContentsMargins(0, 0, 12, 0)
        layout.setSpacing(8)

        layout.addWidget(BodyLabel("运行日志"))

        self._log_tabs = QTabWidget()
        self._log_tabs.setStyleSheet("""
            QTabWidget::pane {
                border: none;
                background: transparent;
            }
            QTabBar::tab {
                background: #161b22;
                color: #8b949e;
                border: 1px solid #30363d;
                border-bottom: none;
                padding: 6px 16px;
                font-size: 12px;
                border-top-left-radius: 6px;
                border-top-right-radius: 6px;
                margin-right: 2px;
            }
            QTabBar::tab:selected {
                background: #0d1117;
                color: #c9d1d9;
                border-bottom: 2px solid #58a6ff;
            }
            QTabBar::tab:hover:!selected {
                background: #1c2433;
                color: #c9d1d9;
            }
        """)

        # 子 tab 1：日志
        log_widget = self._build_inner_log_viewer()
        self._log_tabs.addTab(log_widget, "日志")

        # 子 tab 2：终端
        terminal_widget = self._build_inner_terminal_viewer()
        self._log_tabs.addTab(terminal_widget, "终端")

        layout.addWidget(self._log_tabs, 1)
        return w

    def _build_inner_log_viewer(self) -> QWidget:
        """子 tab「日志」：彩色日志检视面板（原 _build_log_viewer）"""
        w = QWidget()
        layout = QVBoxLayout(w)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(8)

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

    def _build_inner_terminal_viewer(self) -> QWidget:
        """子 tab「终端」：交互式终端面板（命令输入 + 输出显示，与独立终端页共享数据源）"""
        w = QWidget()
        layout = QVBoxLayout(w)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(8)

        # ── 工具栏 ──
        toolbar = QHBoxLayout()
        toolbar.addStretch()

        self._terminal_auto_scroll_btn = PushButton("自动滚动: 开")
        self._terminal_auto_scroll_btn.setFixedWidth(120)
        self._terminal_auto_scroll_btn.setCheckable(True)
        self._terminal_auto_scroll_btn.setChecked(True)
        self._terminal_auto_scroll_btn.clicked.connect(self._toggle_terminal_auto_scroll)
        toolbar.addWidget(self._terminal_auto_scroll_btn)

        self._terminal_clear_btn = PushButton("清空")
        self._terminal_clear_btn.setFixedWidth(80)
        toolbar.addWidget(self._terminal_clear_btn)
        layout.addLayout(toolbar)

        # ── 输出区 ──
        self._terminal_text = QTextEdit()
        self._terminal_text.setReadOnly(True)
        self._terminal_text.setStyleSheet("""
            QTextEdit {
                background-color: #0d1117; color: #c9d1d9;
                border: 1px solid #30363d; border-radius: 8px;
                padding: 8px;
                font-family: "Consolas", "Microsoft YaHei", monospace;
                font-size: 12px;
            }
        """)
        layout.addWidget(self._terminal_text, 1)

        # ── 输入区 ──
        input_row = QHBoxLayout()
        input_row.setContentsMargins(0, 0, 0, 0)
        input_row.setSpacing(8)

        self._terminal_input = QLineEdit()
        self._terminal_input.setPlaceholderText("输入命令 (Enter 执行)...")
        self._terminal_input.setStyleSheet("""
            QLineEdit {
                background-color: #0d1117; color: #c9d1d9;
                border: 1px solid #30363d; border-radius: 6px;
                padding: 8px 12px;
                font-family: "Consolas", "Microsoft YaHei", monospace;
                font-size: 12px;
            }
        """)
        self._terminal_input.returnPressed.connect(self._on_terminal_command)
        # 安装键盘事件过滤器以支持上下箭头切换历史
        self._terminal_input.keyPressEvent = self._terminal_input_key_press

        send_btn = PushButton("发送")
        send_btn.setFixedWidth(60)
        send_btn.clicked.connect(self._on_terminal_command)

        input_row.addWidget(self._terminal_input, 1)
        input_row.addWidget(send_btn)
        layout.addLayout(input_row)

        self._terminal_clear_btn.clicked.connect(self._terminal_text.clear)
        return w

    # ── 终端交互 ──────────────────────────────────

    def _terminal_input_key_press(self, event):
        """拦截 QLineEdit 按键：↑↓ 切换命令历史"""
        from PyQt6.QtCore import Qt as QtCore
        if event.key() == QtCore.Key.Key_Up:
            self._terminal_history_up()
        elif event.key() == QtCore.Key.Key_Down:
            self._terminal_history_down()
        else:
            QLineEdit.keyPressEvent(self._terminal_input, event)

    def _terminal_history_up(self):
        if not self._terminal_history:
            return
        if self._terminal_history_idx > 0:
            self._terminal_history_idx -= 1
        self._terminal_input.setText(self._terminal_history[self._terminal_history_idx])

    def _terminal_history_down(self):
        if self._terminal_history_idx >= len(self._terminal_history) - 1:
            self._terminal_history_idx = len(self._terminal_history)
            self._terminal_input.clear()
            return
        self._terminal_history_idx += 1
        self._terminal_input.setText(self._terminal_history[self._terminal_history_idx])

    def _on_terminal_command(self):
        """执行终端输入的命令"""
        text = self._terminal_input.text().strip()
        if not text:
            return
        self._terminal_history.append(text)
        self._terminal_history_idx = len(self._terminal_history)
        self._terminal_input.clear()
        self._append_terminal_line(f"> {text}", "#58a6ff")

        if text.startswith("opencode"):
            self._run_opencode_command(text)
        else:
            self._run_shell_command(text)

    def _run_shell_command(self, command: str):
        """执行 shell 命令（subprocess，超时 30s）"""
        try:
            result = subprocess.run(
                command, shell=True,
                cwd=self._working_dir or None,
                capture_output=True, text=True, timeout=30,
            )
            out = (result.stdout or "") + (result.stderr or "")
            if out:
                self._append_terminal_line(out.rstrip())
            elif result.returncode != 0:
                self._append_terminal_line(f"(退出码: {result.returncode})", "#8b949e")
        except subprocess.TimeoutExpired:
            self._append_terminal_line("错误: 命令超时 (30s)", "#f85149")
        except Exception as e:
            self._append_terminal_line(f"错误: {e}", "#f85149")

    def _run_opencode_command(self, command: str):
        """执行 opencode 命令（QProcess 流式输出）"""
        if self._terminal_process:
            self._terminal_process.kill()
            self._terminal_process = None

        self._terminal_process = QProcess(self)
        if self._working_dir:
            self._terminal_process.setWorkingDirectory(self._working_dir)
        self._terminal_process.readyReadStandardOutput.connect(self._on_terminal_process_stdout)
        self._terminal_process.readyReadStandardError.connect(self._on_terminal_process_stderr)

        cmd = command[len("opencode"):].strip()
        self._terminal_process.start("opencode", ["run", cmd] if cmd else ["run"])

    def _on_terminal_process_stdout(self):
        if self._terminal_process:
            data = self._terminal_process.readAllStandardOutput().data().decode("utf-8", errors="replace")
            self._append_terminal_line(data)

    def _on_terminal_process_stderr(self):
        if self._terminal_process:
            data = self._terminal_process.readAllStandardError().data().decode("utf-8", errors="replace")
            self._append_terminal_line(data, "#f85149")

    def _append_terminal_line(self, text: str, color: str = "#c9d1d9"):
        """追加一行到终端输出区（过滤 ANSI，HTML 转义）"""
        text = _ANSI_RE.sub('', text)
        safe_text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        safe_text = safe_text.replace("\r\n", "\n").replace("\n", "<br>")
        html = f'<span style="color:{color}">{safe_text}</span>'
        self._terminal_text.insertHtml(html)
        if self._terminal_auto_scroll_btn.isChecked():
            sb = self._terminal_text.verticalScrollBar()
            sb.setValue(sb.maximum())

    # ── 终端输出（信号驱动）──────────────────────

    def _toggle_terminal_auto_scroll(self) -> None:
        """切换终端自动滚动"""
        checked = self._terminal_auto_scroll_btn.isChecked()
        self._terminal_auto_scroll_btn.setText("自动滚动: 开" if checked else "自动滚动: 关")

    def append_terminal_output(self, text: str) -> None:
        """追加终端输出（由 app.py 的 terminal_output / agent_output 信号转发）"""
        self._append_terminal_line(text)

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

    def set_working_dir(self, path: str) -> None:
        """设置终端命令执行的工作目录"""
        self._working_dir = path

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
            item.setToolTip(build_prompt_preview(task_desc=desc, project_name=t.get("project", "")))
            item.setForeground(Qt.GlobalColor.white)  # 由 qss 控制
            self._queue_table.setItem(i, 0, item)

            # 第 1 列：状态
            status = t.get("status", "pending")
            status_item = QTableWidgetItem(STATUS_LABELS.get(status, status))
            color = STATUS_COLORS.get(status, "#e6edf3")
            status_item.setForeground(QColor(color))
            self._queue_table.setItem(i, 1, status_item)

            # 高亮选定的任务行
            task_id = t.get("id")
            if self._selected_task_id is not None and task_id == self._selected_task_id:
                highlight = QColor("#1a3a5c")  # 深蓝色背景
                for col in range(self._queue_table.columnCount()):
                    cell = self._queue_table.item(i, col)
                    if cell:
                        cell.setBackground(highlight)

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

    def set_selected_task_id(self, task_id: int | None) -> None:
        """设置当前选定的任务 ID（用于队列行高亮）"""
        self._selected_task_id = task_id

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
        idx = self._project_combo.currentIndex()
        if idx <= 0:
            return None
        # 从 itemData 获取项目名（兼容 dict 和 str 两种 config 格式）
        data = self._project_combo.currentData()
        if data:
            return data
        text = self._project_combo.currentText()
        return None if text == "全部" else text

    def set_projects(self, projects: list):
        """更新项目下拉菜单项（从配置加载）。
        支持两种格式:
          - list[str]: 旧格式，直接用作显示名和项目名
          - list[dict]: 新格式，使用 label 作为显示名，name 作为项目名
        """
        current = self._project_combo.currentText()
        self._project_combo.blockSignals(True)
        self._project_combo.clear()
        self._project_combo.addItem("全部", None)
        for p in projects:
            if isinstance(p, dict):
                label = p.get("label", p.get("name", "?"))
                name = p.get("name", label)
                self._project_combo.addItem(label, name)
            else:
                self._project_combo.addItem(str(p), str(p))
        # 尝试恢复之前选中的项目
        idx = self._project_combo.findText(current)
        if idx >= 0:
            self._project_combo.setCurrentIndex(idx)
        else:
            self._project_combo.setCurrentIndex(0)
        self._project_combo.blockSignals(False)

    # ===================================================================
    # 内部事件
    # ===================================================================

    def _toggle_auto_scroll(self) -> None:
        """切换日志自动滚动"""
        checked = self._log_auto_scroll_btn.isChecked()
        self._log_auto_scroll_btn.setText("自动滚动: 开" if checked else "自动滚动: 关")
