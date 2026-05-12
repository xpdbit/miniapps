# -*- coding: utf-8 -*-
"""control_interface.py — 控制面板（启停控制 + 状态统计）"""
from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import QFrame, QHBoxLayout, QLabel, QProgressBar, QVBoxLayout, QWidget
from qfluentwidgets import (
    BodyLabel,
    CaptionLabel,
    FluentIcon as FIF,
    PrimaryPushButton,
    PushButton,
    SimpleCardWidget,
    TitleLabel,
)


class ValueLabel(QLabel):
    """带颜色的数字标签"""

    def __init__(self, text: str, color: str, parent: QWidget | None = None):
        super().__init__(text, parent)
        self.setStyleSheet(
            f"font-size: 28px; font-weight: bold; color: {color}; background: transparent;"
        )


class ControlInterface(QWidget):
    """控制面板 —— 循环启停 + 任务统计"""

    def __init__(self, parent: QWidget | None = None):
        super().__init__(parent)
        self._stat_labels: dict[str, ValueLabel] = {}
        self._setup_ui()

    def _setup_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)

        # 标题
        layout.addWidget(TitleLabel("控制面板"))
        layout.addSpacing(16)

        # 统计卡片
        stats_card = SimpleCardWidget(self)
        stats_card.setBorderRadius(12)
        stats_layout = QHBoxLayout(stats_card)
        stats_layout.setSpacing(0)

        stats_data: list[tuple[str, str, str]] = [
            ("proposed", "待审批", "#58a6ff"),
            ("pending", "排队中", "#d29922"),
            ("done", "已完成", "#3fb950"),
            ("failed", "已失败", "#f85149"),
        ]
        for key, label, color in stats_data:
            col = QVBoxLayout()
            col.setAlignment(Qt.AlignmentFlag.AlignCenter)
            self._stat_labels[key] = ValueLabel("0", color, self)
            col.addWidget(
                self._stat_labels[key], alignment=Qt.AlignmentFlag.AlignCenter
            )
            col.addWidget(CaptionLabel(label), alignment=Qt.AlignmentFlag.AlignCenter)
            stats_layout.addLayout(col)
            if key != stats_data[-1][0]:
                vline = QFrame(self)
                vline.setFrameShape(QFrame.Shape.VLine)
                vline.setStyleSheet("color: #30363d;")
                stats_layout.addWidget(vline)

        layout.addWidget(stats_card)
        layout.addSpacing(16)

        # 控制按钮卡片
        ctrl_card = SimpleCardWidget(self)
        ctrl_card.setBorderRadius(12)
        ctrl_layout = QVBoxLayout(ctrl_card)

        btn_row = QHBoxLayout()
        btn_row.setSpacing(8)

        self._start_btn = PrimaryPushButton(FIF.PLAY, "启动循环", self)
        self._stop_btn = PushButton(FIF.CANCEL, "停止循环", self)
        self._pause_btn = PushButton(FIF.PAUSE, "暂停循环", self)
        self._explore_btn = PushButton(FIF.SEARCH, "手动探索", self)
        self._execute_btn = PushButton(FIF.SEND, "手动执行", self)

        self._stop_btn.setEnabled(False)
        self._pause_btn.setEnabled(False)

        btn_row.addWidget(self._start_btn)
        btn_row.addWidget(self._stop_btn)
        btn_row.addWidget(self._pause_btn)
        btn_row.addSpacing(16)
        vline2 = QFrame(self)
        vline2.setFrameShape(QFrame.Shape.VLine)
        vline2.setStyleSheet("color: #30363d;")
        btn_row.addWidget(vline2)
        btn_row.addSpacing(16)
        btn_row.addWidget(self._explore_btn)
        btn_row.addWidget(self._execute_btn)
        btn_row.addStretch()

        ctrl_layout.addWidget(BodyLabel("循环控制"))
        ctrl_layout.addSpacing(8)
        ctrl_layout.addLayout(btn_row)

        # 状态指示器
        ctrl_layout.addSpacing(8)
        self._status_label = CaptionLabel("● 已停止")
        self._status_label.setStyleSheet("color: #8b949e; font-size: 13px;")
        ctrl_layout.addWidget(self._status_label)

        # 进度条（不确定模式，仅在运行时显示）
        self._progress_bar = QProgressBar(self)
        self._progress_bar.setTextVisible(False)
        self._progress_bar.setRange(0, 0)
        self._progress_bar.setFixedHeight(4)
        self._progress_bar.setVisible(False)
        ctrl_layout.addWidget(self._progress_bar)

        layout.addWidget(ctrl_card)
        layout.addStretch()

    def update_stats(
        self,
        proposed: int = 0,
        approved: int = 0,
        done: int = 0,
        failed: int = 0,
    ) -> None:
        """更新统计数字"""
        self._stat_labels["proposed"].setText(str(proposed))
        self._stat_labels["pending"].setText(str(approved))
        self._stat_labels["done"].setText(str(done))
        self._stat_labels["failed"].setText(str(failed))

    def set_running(self, running: bool, paused: bool = False) -> None:
        """设置运行状态 —— 控制启停/暂停按钮启用/禁用 + 状态指示器"""
        self._start_btn.setEnabled(not running)
        self._stop_btn.setEnabled(running)
        self._pause_btn.setEnabled(running)

        if running and paused:
            self._pause_btn.setText("恢复循环")
            self._status_label.setText("⏸ 已暂停")
            self._status_label.setStyleSheet("color: #d29922; font-size: 13px;")
            self._progress_bar.setVisible(False)
        elif running:
            self._pause_btn.setText("暂停循环")
            self._status_label.setText("● 运行中")
            self._status_label.setStyleSheet("color: #3fb950; font-size: 13px;")
            self._progress_bar.setVisible(True)
        else:
            self._pause_btn.setText("暂停循环")
            self._status_label.setText("● 已停止")
            self._status_label.setStyleSheet("color: #8b949e; font-size: 13px;")
            self._progress_bar.setVisible(False)
