# -*- coding: utf-8 -*-
"""quick_launch_interface.py — OCE 快捷启动仪表盘

提供卡片式快捷启动面板，集成 localdev 功能：
- 基础设施 (MySQL/Redis) 启停卡片
- 项目服务启停卡片（每个服务一张卡片）
- 批量操作按钮（重启所有 / 杀死端口 / 清理日志 / 配置服务）
- 实时状态刷新（端口检测 + Docker 容器检测）
"""
from __future__ import annotations

from typing import Optional

from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtWidgets import (
    QApplication, QFrame, QGridLayout, QHBoxLayout, QLabel,
    QPushButton, QVBoxLayout, QWidget, QScrollArea,
)
from qfluentwidgets import CaptionLabel, StrongBodyLabel

from ..core.localdev_manager import LocalDevManager


# ── 暗色主题色板（与 overview_interface.py 保持一致） ──

DARK_BG = "#0d1117"
CARD_BG = "#161b22"
BORDER = "#30363d"
TEXT_PRIMARY = "#e6edf3"
TEXT_SECONDARY = "#8b949e"
ACCENT_GREEN = "#3fb950"
ACCENT_RED = "#f85149"
ACCENT_BLUE = "#58a6ff"
ACCENT_ORANGE = "#f0883e"
ACCENT_GOLD = "#d29922"
STATUS_GRAY = "#484f58"

# ── 样式常量 ──

_CARD_STYLE = f"""
    QFrame#serviceCard {{
        background-color: {CARD_BG};
        border: 1px solid {BORDER};
        border-radius: 10px;
    }}
    QFrame#serviceCard:hover {{
        border-color: {ACCENT_BLUE};
    }}
"""

_BTN_STYLE = """
    QPushButton {{
        background-color: {bg}; color: #fff;
        border: none; border-radius: 4px;
        padding: 4px 14px; font-size: 12px; font-weight: bold;
    }}
    QPushButton:hover {{
        background-color: {hover};
    }}
"""

_BTN_PRIMARY = _BTN_STYLE.format(bg="#238636", hover="#2ea043")
_BTN_DANGER = _BTN_STYLE.format(bg="#8b1a1a", hover="#a62b2b")
_BTN_SECONDARY = _BTN_STYLE.format(bg="#21262d", hover="#30363d")


class ServiceCard(QFrame):
    """单个服务的快捷操作卡片。

    显示服务名称、端口、运行状态及操作按钮。
    """

    def __init__(self, title: str, subtitle: str, port: Optional[int] = None,
                 parent: QWidget | None = None):
        super().__init__(parent)
        self.setObjectName("serviceCard")
        self.setStyleSheet(_CARD_STYLE)
        self.setMinimumSize(200, 130)
        self.setMaximumWidth(280)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 12, 16, 12)
        layout.setSpacing(6)

        # ── 第一行：名称 + 状态指示灯 ──
        top_row = QHBoxLayout()
        top_row.setSpacing(8)

        self._status_dot = QLabel("●")
        self._status_dot.setStyleSheet(
            f"color: {STATUS_GRAY}; font-size: 14px; border: none; "
            f"background: transparent;")
        top_row.addWidget(self._status_dot)

        name_label = StrongBodyLabel(title)
        name_label.setStyleSheet(
            f"color: {TEXT_PRIMARY}; font-size: 14px; border: none; "
            f"background: transparent;")
        top_row.addWidget(name_label)

        top_row.addStretch()

        self._status_text = CaptionLabel("检测中")
        self._status_text.setStyleSheet(
            f"color: {TEXT_SECONDARY}; font-size: 11px; border: none; "
            f"background: transparent;")
        top_row.addWidget(self._status_text)

        layout.addLayout(top_row)

        # ── 第二行：端口/副标题 ──
        if subtitle:
            sub_label = CaptionLabel(subtitle)
            sub_label.setStyleSheet(
                f"color: {TEXT_SECONDARY}; font-size: 11px; border: none; "
                f"background: transparent;")
            layout.addWidget(sub_label)

        layout.addStretch()

        # ── 第三行：操作按钮 ──
        btn_row = QHBoxLayout()
        btn_row.setSpacing(8)

        self._start_btn = QPushButton("启动")
        self._start_btn.setStyleSheet(_BTN_PRIMARY)
        self._start_btn.setFixedHeight(26)
        btn_row.addWidget(self._start_btn)

        self._stop_btn = QPushButton("停止")
        self._stop_btn.setStyleSheet(_BTN_DANGER)
        self._stop_btn.setFixedHeight(26)
        btn_row.addWidget(self._stop_btn)

        self._restart_btn = QPushButton("重启")
        self._restart_btn.setStyleSheet(_BTN_SECONDARY)
        self._restart_btn.setFixedHeight(26)
        btn_row.addWidget(self._restart_btn)

        btn_row.addStretch()
        layout.addLayout(btn_row)

    def set_status(self, running: bool, detail: str = "") -> None:
        """更新状态显示。

        Args:
            running: 是否运行中
            detail: 额外状态描述（可选）
        """
        if running:
            color = ACCENT_GREEN
            text = detail or "运行中"
        else:
            color = STATUS_GRAY
            text = detail or "已停止"

        self._status_dot.setStyleSheet(
            f"color: {color}; font-size: 14px; border: none; "
            f"background: transparent;")
        self._status_text.setText(text)

        # 根据状态调整按钮可用性
        self._start_btn.setEnabled(not running)
        self._stop_btn.setEnabled(running)
        self._restart_btn.setEnabled(running)

    def set_buttons_enabled(self, enabled: bool) -> None:
        """启用/禁用所有操作按钮。"""
        self._start_btn.setEnabled(enabled)
        self._stop_btn.setEnabled(enabled)
        self._restart_btn.setEnabled(enabled)


# ── 快捷启动页面 ──


class QuickLaunchInterface(QWidget):
    """快捷启动仪表盘页面。

    以卡片网格展示基础设施和项目服务，支持一键启停。
    """

    def __init__(self, parent: QWidget | None = None):
        super().__init__(parent)
        self._manager: LocalDevManager = LocalDevManager.get_instance()

        # 缓存卡片引用以便更新状态
        self._infra_cards: dict[str, ServiceCard] = {}
        self._service_cards: dict[str, ServiceCard] = {}

        self._setup_ui()
        self._connect_signals()
        self._manager.subscribe(self._on_status_updated)

        # 定时刷新状态
        self._status_timer = QTimer(self)
        self._status_timer.setInterval(5000)  # 每 5 秒刷新
        self._status_timer.timeout.connect(self._on_refresh)
        self._status_timer.start()

        # 首次刷新
        QTimer.singleShot(500, self._on_refresh)

    def _setup_ui(self) -> None:
        self.setStyleSheet(f"background-color: {DARK_BG};")

        # 可滚动内容区域
        scroll = QScrollArea(self)
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        scroll.setStyleSheet(f"""
            QScrollArea {{ background-color: {DARK_BG}; border: none; }}
            QScrollBar:vertical {{
                background: {CARD_BG}; width: 8px;
                border-radius: 4px;
            }}
            QScrollBar::handle:vertical {{
                background: {BORDER}; border-radius: 4px;
                min-height: 30px;
            }}
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
                height: 0;
            }}
        """)

        content = QWidget()
        content.setStyleSheet(f"background-color: {DARK_BG};")
        main_layout = QVBoxLayout(content)
        main_layout.setContentsMargins(16, 16, 16, 16)
        main_layout.setSpacing(16)

        # ── 1. 基础设施区域标题 ──
        infra_header = StrongBodyLabel("基础设施")
        infra_header.setStyleSheet(
            f"color: {TEXT_PRIMARY}; font-size: 16px; border: none; "
            f"background: transparent;")
        main_layout.addWidget(infra_header)

        infra_port_desc = " + ".join(
            f"{s['name']} ({s.get('port', '?')})"
            for s in self._manager.infra_services)
        infra_desc = CaptionLabel(
            f"{infra_port_desc} — Docker 容器管理")
        infra_desc.setStyleSheet(
            f"color: {TEXT_SECONDARY}; font-size: 12px; border: none; "
            f"background: transparent;")
        main_layout.addWidget(infra_desc)

        # 基础设施卡片网格
        infra_grid = QHBoxLayout()
        infra_grid.setSpacing(12)
        for svc in self._manager.infra_services:
            card = ServiceCard(
                title=svc["name"],
                subtitle=f"容器: {svc['container']} | 端口: {svc['port']}",
                port=svc["port"],
            )
            card._start_btn.clicked.connect(
                lambda checked, n=svc["name"]: self._on_start_infra(n))
            card._stop_btn.clicked.connect(
                lambda checked, n=svc["name"]: self._on_stop_infra(n))
            card._restart_btn.setVisible(False)  # 基础设施暂不支持单容器重启
            infra_grid.addWidget(card)
            self._infra_cards[svc["name"]] = card
        infra_grid.addStretch()
        main_layout.addLayout(infra_grid)

        # ── 基础设施批量操作 ──
        infra_actions = QHBoxLayout()
        infra_actions.setSpacing(8)

        self._start_all_infra_btn = QPushButton("启动全部")
        self._start_all_infra_btn.setStyleSheet(_BTN_PRIMARY)
        self._start_all_infra_btn.setFixedHeight(30)
        self._start_all_infra_btn.clicked.connect(self._on_start_all_infra)
        infra_actions.addWidget(self._start_all_infra_btn)

        self._stop_all_infra_btn = QPushButton("停止全部")
        self._stop_all_infra_btn.setStyleSheet(_BTN_DANGER)
        self._stop_all_infra_btn.setFixedHeight(30)
        self._stop_all_infra_btn.clicked.connect(self._on_stop_all_infra)
        infra_actions.addWidget(self._stop_all_infra_btn)

        infra_actions.addStretch()
        main_layout.addLayout(infra_actions)

        # ── 分隔线 ──
        divider = QFrame()
        divider.setFrameShape(QFrame.Shape.HLine)
        divider.setStyleSheet(f"color: {BORDER}; border: none; "
                              f"border-top: 1px solid {BORDER};")
        divider.setFixedHeight(1)
        main_layout.addWidget(divider)

        # ── 2. 项目服务区域标题 ──
        svc_header = StrongBodyLabel("项目服务")
        svc_header.setStyleSheet(
            f"color: {TEXT_PRIMARY}; font-size: 16px; border: none; "
            f"background: transparent;")
        main_layout.addWidget(svc_header)

        svc_desc = CaptionLabel("在 Windows Terminal 标签页中启动/停止各项目服务")
        svc_desc.setStyleSheet(
            f"color: {TEXT_SECONDARY}; font-size: 12px; border: none; "
            f"background: transparent;")
        main_layout.addWidget(svc_desc)

        # 项目服务卡片网格
        self._service_grid = QGridLayout()
        self._service_grid.setSpacing(12)
        self._build_service_cards()
        main_layout.addLayout(self._service_grid)

        # ── 项目服务批量操作 ──
        svc_actions = QHBoxLayout()
        svc_actions.setSpacing(8)

        self._start_all_btn = QPushButton("启动全部")
        self._start_all_btn.setStyleSheet(_BTN_PRIMARY)
        self._start_all_btn.setFixedHeight(30)
        self._start_all_btn.clicked.connect(self._on_start_all_services)
        svc_actions.addWidget(self._start_all_btn)

        self._restart_all_btn = QPushButton("重启全部")
        self._restart_all_btn.setStyleSheet(_BTN_SECONDARY)
        self._restart_all_btn.setFixedHeight(30)
        self._restart_all_btn.clicked.connect(self._on_restart_all)
        svc_actions.addWidget(self._restart_all_btn)

        self._kill_port_btn = QPushButton("杀死端口进程")
        self._kill_port_btn.setStyleSheet(_BTN_DANGER)
        self._kill_port_btn.setFixedHeight(30)
        self._kill_port_btn.clicked.connect(self._on_kill_ports)
        svc_actions.addWidget(self._kill_port_btn)

        svc_actions.addStretch()

        self._clean_logs_btn = QPushButton("清理日志")
        self._clean_logs_btn.setStyleSheet(_BTN_SECONDARY)
        self._clean_logs_btn.setFixedHeight(30)
        self._clean_logs_btn.clicked.connect(self._on_clean_logs)
        svc_actions.addWidget(self._clean_logs_btn)

        main_layout.addLayout(svc_actions)

        main_layout.addStretch()

        scroll.setWidget(content)

        # 页面主布局
        page_layout = QVBoxLayout(self)
        page_layout.setContentsMargins(0, 0, 0, 0)
        page_layout.addWidget(scroll)

    def _build_service_cards(self) -> None:
        """构建项目服务卡片网格。"""
        # 清理旧卡片
        for card in self._service_cards.values():
            self._service_grid.removeWidget(card)
            card.deleteLater()
        self._service_cards.clear()

        # 3 列网格
        cols = 3
        enabled_names = set(self._manager.enabled_names)

        for i, svc in enumerate(self._manager.server_services):
            subtitle = f"端口: {svc['port']} | {svc['command']}"
            if svc["name"] not in enabled_names:
                subtitle += " (未启用)"

            card = ServiceCard(
                title=svc["name"],
                subtitle=subtitle,
                port=svc["port"],
            )

            svc_name = svc["name"]
            card._start_btn.clicked.connect(
                lambda checked, n=svc_name: self._on_start_service(n))
            card._stop_btn.clicked.connect(
                lambda checked, n=svc_name: self._on_stop_service(n))
            card._restart_btn.clicked.connect(
                lambda checked, n=svc_name: self._on_restart_service(n))

            self._service_grid.addWidget(card, i // cols, i % cols)
            self._service_cards[svc["name"]] = card

    # ── 信号连接 ──

    def _connect_signals(self) -> None:
        pass

    # ── 状态刷新 ──

    def force_refresh(self) -> None:
        """外部触发强制刷新（如 Ctrl+R）。"""
        self._manager.refresh_status()
        self._update_ui()

    def _on_refresh(self) -> None:
        """定时刷新：更新所有服务状态。"""
        self._manager.refresh_status()
        self._update_ui()

    def _on_status_updated(self) -> None:
        """LocalDevManager 通知状态变更。"""
        self._update_ui()

    def _update_ui(self) -> None:
        """根据缓存的状态更新所有卡片。"""
        # 基础设施
        infra_status = self._manager.infra_status
        for name, card in self._infra_cards.items():
            running = infra_status.get(name, False)
            card.set_status(running)

        # 项目服务
        svc_status = self._manager.service_status
        for name, card in self._service_cards.items():
            running = svc_status.get(name, False)
            card.set_status(running)

    # ── 基础设施操作 ──

    @staticmethod
    def _get_container_name(infra_name: str) -> str:
        """从 manager 配置中查找基础设施的容器名。"""
        mgr = LocalDevManager.get_instance()
        for svc in mgr.infra_services:
            if svc["name"] == infra_name:
                return svc.get("container", "")
        return ""

    def _on_start_infra(self, name: str) -> None:
        """启动单个 Docker 容器。"""
        container = self._get_container_name(name)
        if not container:
            self._flash(f"未知基础设施: {name}")
            return
        self._set_busy(True)
        ok = self._manager.start_single_docker(container)
        self._set_busy(False)
        if not ok:
            self._flash(f"启动 {name} 失败，请确认 Docker Desktop 已运行")

    def _on_stop_infra(self, name: str) -> None:
        """停止单个 Docker 容器。"""
        container = self._get_container_name(name)
        if not container:
            self._flash(f"未知基础设施: {name}")
            return
        self._set_busy(True)
        self._manager.stop_single_docker(container)
        self._set_busy(False)

    def _on_start_all_infra(self) -> None:
        self._set_busy(True)
        ok = self._manager.start_infra()
        self._set_busy(False)
        if not ok:
            self._flash("启动基础设施失败")

    def _on_stop_all_infra(self) -> None:
        self._set_busy(True)
        self._manager.stop_infra()
        self._set_busy(False)

    # ── 项目服务操作 ──

    def _on_start_service(self, name: str) -> None:
        card = self._service_cards.get(name)
        if card:
            card.set_buttons_enabled(False)
        self._manager.start_service(name)
        # 3 秒后自动恢复按钮
        QTimer.singleShot(3000, lambda: self._update_ui())

    def _on_stop_service(self, name: str) -> None:
        card = self._service_cards.get(name)
        if card:
            card.set_buttons_enabled(False)
        self._manager.stop_service(name)
        QTimer.singleShot(2000, lambda: self._update_ui())

    def _on_restart_service(self, name: str) -> None:
        card = self._service_cards.get(name)
        if card:
            card.set_buttons_enabled(False)
        self._manager.restart_service(name)
        QTimer.singleShot(3000, lambda: self._update_ui())

    def _on_start_all_services(self) -> None:
        self._set_busy(True)
        self._manager.start_all_services()
        QTimer.singleShot(3000, lambda: self._set_busy(False))

    def _on_restart_all(self) -> None:
        self._set_busy(True)
        self._manager.restart_all_services()
        QTimer.singleShot(5000, lambda: self._set_busy(False))

    def _on_kill_ports(self) -> None:
        self._set_busy(True)
        count = self._manager.kill_port_processes()
        self._set_busy(False)
        self._flash(f"已杀死 {count} 个进程")

    def _on_clean_logs(self) -> None:
        self._set_busy(True)
        count, size_mb = self._manager.clean_logs()
        self._set_busy(False)
        if count > 0:
            self._flash(f"已清理 {count} 个日志文件 ({size_mb:.2f} MB)")
        else:
            self._flash("日志目录为空")

    # ── 辅助 ──

    def _set_busy(self, busy: bool) -> None:
        """批量操作时禁用/启用所有按钮。

        注意：阻塞操作前先 processEvents() 让禁用状态渲染到屏幕，
        避免用户看到界面"卡死"假象。
        """
        for card in list(self._infra_cards.values()) + list(self._service_cards.values()):
            card.set_buttons_enabled(not busy)
        self._start_all_infra_btn.setEnabled(not busy)
        self._stop_all_infra_btn.setEnabled(not busy)
        self._start_all_btn.setEnabled(not busy)
        self._restart_all_btn.setEnabled(not busy)
        self._kill_port_btn.setEnabled(not busy)
        self._clean_logs_btn.setEnabled(not busy)
        if busy:
            QApplication.processEvents()

    def _flash(self, msg: str) -> None:
        """短暂显示提示（通过父窗口状态栏）。

        使用计数器避免连续调用导致状态残留。
        """
        parent = self.window()
        flash = getattr(parent, "flash_message", None)
        if callable(flash):
            flash(msg, 3000)
            return

        hint = getattr(parent, "_hint_label", None)
        if hint is not None:
            # 递增计数器，只恢复最早捕获的文本
            self._flash_counter = getattr(self, "_flash_counter", 0) + 1
            counter = self._flash_counter
            if counter == 1:
                self._flash_restore_text = hint.text()
            hint.setText(msg)
            QTimer.singleShot(3000, lambda c=counter: self._do_flash_restore(c))

    def _do_flash_restore(self, counter: int) -> None:
        """仅当 counter 仍匹配最新计数时才恢复文本。"""
        if counter != getattr(self, "_flash_counter", 0):
            return  # 有更新的 flash，跳过恢复
        hint = getattr(self.window(), "_hint_label", None)
        if hint is not None:
            restore = getattr(self, "_flash_restore_text", "[F1 帮助]  [Ctrl+Q 退出]")
            hint.setText(restore)

    # ── 生命周期 ──

    def cleanup(self) -> None:
        """清理资源。"""
        self._manager.unsubscribe(self._on_status_updated)
        self._status_timer.stop()

    def deleteLater(self) -> None:
        self.cleanup()
        super().deleteLater()
