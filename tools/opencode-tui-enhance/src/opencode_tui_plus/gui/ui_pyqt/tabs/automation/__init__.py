# -*- coding: utf-8 -*-
"""automation_interface.py — 自动化面板

包含两个子面板：
- 定向迭代：prompt → 时间上限 → 启动循环
- 探索模式：项目扫描 → 提议 → 审批 → 执行
"""

from __future__ import annotations

import os
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

from PyQt6.QtCore import Qt, QTimer, pyqtSignal
from PyQt6.QtGui import QFont
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QPushButton, QTextEdit, QSpinBox, QComboBox,
    QTabWidget, QTableWidget, QTableWidgetItem,
    QHeaderView, QProgressBar, QGroupBox, QCheckBox,
    QSplitter, QMessageBox, QLineEdit,
)
from qfluentwidgets import (
    FluentIcon as FIF,
    PushButton, PrimaryPushButton, InfoBar, InfoBarPosition,
    ComboBox, LineEdit, SpinBox, TextEdit, StrongBodyLabel,
    BodyLabel, TitleLabel, SubtitleLabel, CardWidget,
    TableWidget,
)

from opencode_tui_plus.core.runner import AgentRunner, Stage, get_available_models
from opencode_tui_plus.core.state_manager import StateManager, TaskState, TaskStatus
from opencode_tui_plus.core.loop_engine import LoopEngine
from opencode_tui_plus.core.supervisor import Supervisor
from opencode_tui_plus.core.diff_analyzer import DiffAnalyzer, DiffStat


class IterationPanel(QWidget):
    """定向迭代子面板"""

    task_started = pyqtSignal(str)      # task_id
    task_stopped = pyqtSignal(str)      # task_id
    log_message = pyqtSignal(str, str)  # level, message

    def __init__(self, state_manager: StateManager, runner: AgentRunner,
                 loop_engine: LoopEngine, parent=None):
        super().__init__(parent)
        self._sm = state_manager
        self._runner = runner
        self._engine = loop_engine
        self._current_task_id: Optional[str] = None
        self._thread: Optional[threading.Thread] = None

        self._init_ui()
        self._connect_signals()
        self._refresh_task_list()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        # ── 标题 ──
        title = TitleLabel("定向迭代")
        layout.addWidget(title)

        # ── 任务配置区 ──
        config_group = QGroupBox("任务配置")
        config_layout = QVBoxLayout(config_group)

        # Prompt
        prompt_row = QHBoxLayout()
        prompt_row.addWidget(BodyLabel("Prompt:"))
        self._prompt_edit = TextEdit()
        self._prompt_edit.setPlaceholderText(
            "输入改进目标，如：\"优化项目代码质量，修复类型错误，消除重复代码\""
        )
        self._prompt_edit.setMaximumHeight(100)
        prompt_row.addWidget(self._prompt_edit, 1)
        config_layout.addLayout(prompt_row)

        # 时间和项目
        settings_row = QHBoxLayout()
        settings_row.addWidget(BodyLabel("时间上限 (分钟):"))
        self._time_spin = SpinBox()
        self._time_spin.setRange(5, 1440)
        self._time_spin.setValue(120)
        settings_row.addWidget(self._time_spin)

        settings_row.addSpacing(20)
        settings_row.addWidget(BodyLabel("项目目录:"))
        self._project_combo = ComboBox()
        self._project_combo.setMinimumWidth(200)
        self._project_combo.addItem(os.getcwd())
        settings_row.addWidget(self._project_combo, 1)

        config_layout.addLayout(settings_row)

        # 模型选择
        model_row = QHBoxLayout()
        model_row.addWidget(BodyLabel("执行模型:"))
        self._model_combo = ComboBox()
        self._model_combo.setMinimumWidth(200)
        models = get_available_models()
        if models:
            self._model_combo.addItems(models)
        else:
            self._model_combo.addItem("deepseek/deepseek-v4-pro")
        model_row.addWidget(self._model_combo, 1)
        model_row.addStretch()
        config_layout.addLayout(model_row)

        layout.addWidget(config_group)

        # ── 控制按钮 ──
        btn_row = QHBoxLayout()
        self._start_btn = PrimaryPushButton(FIF.PLAY, "启动迭代")
        self._start_btn.clicked.connect(self._on_start)
        btn_row.addWidget(self._start_btn)

        self._pause_btn = PushButton(FIF.PAUSE, "暂停")
        self._pause_btn.clicked.connect(self._on_pause)
        self._pause_btn.setEnabled(False)
        btn_row.addWidget(self._pause_btn)

        self._stop_btn = PushButton(FIF.CLOSE, "停止")
        self._stop_btn.clicked.connect(self._on_stop)
        self._stop_btn.setEnabled(False)
        btn_row.addWidget(self._stop_btn)

        btn_row.addStretch()

        self._status_label = BodyLabel("就绪")
        btn_row.addWidget(self._status_label)
        layout.addLayout(btn_row)

        # ── 进度条 ──
        self._progress = QProgressBar()
        self._progress.setRange(0, 100)
        self._progress.setValue(0)
        self._progress.setVisible(False)
        layout.addWidget(self._progress)

        # ── 运行信息 ──
        info_group = QGroupBox("运行状态")
        info_layout = QVBoxLayout(info_group)
        self._round_label = BodyLabel("当前轮次: -")
        info_layout.addWidget(self._round_label)
        self._elapsed_label = BodyLabel("已用时间: -")
        info_layout.addWidget(self._elapsed_label)
        self._files_label = BodyLabel("累计修改: -")
        info_layout.addWidget(self._files_label)
        layout.addWidget(info_group)

        # ── 历史任务列表 ──
        layout.addWidget(SubtitleLabel("历史任务"))
        self._task_table = TableWidget()
        self._task_table.setColumnCount(5)
        self._task_table.setHorizontalHeaderLabels([
            "任务 ID", "Prompt", "状态", "轮次", "修改文件"
        ])
        hdr = self._task_table.horizontalHeader()
        if hdr:
            hdr.setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        self._task_table.setMaximumHeight(200)
        layout.addWidget(self._task_table)

    def _connect_signals(self):
        self._engine.signals.log_received.connect(self._on_log)
        self._engine.signals.state_changed.connect(self._on_state_changed)
        self._engine.signals.round_completed.connect(self._on_round_done)
        self._engine.signals.task_completed.connect(self._on_task_done)
        self._engine.signals.task_failed.connect(self._on_task_failed)

    # ── 按钮事件 ──

    def _on_start(self):
        prompt = self._prompt_edit.toPlainText().strip()
        if not prompt:
            InfoBar.warning("提示", "请输入改进目标", parent=self)
            return

        project_root = self._project_combo.currentText().strip()
        time_limit = self._time_spin.value()

        task = self._sm.create_task(prompt, project_root, time_limit)
        self._current_task_id = task.task_id

        self._runner.set_working_dir(project_root)

        # 应用模型路由
        model = self._model_combo.currentText().strip()
        if model:
            self._runner.apply_model_routing(model, {})

        self._start_btn.setEnabled(False)
        self._pause_btn.setEnabled(True)
        self._stop_btn.setEnabled(True)
        self._status_label.setText(f"运行中 - {task.task_id}")
        self._progress.setVisible(True)
        self._progress.setValue(0)

        self.task_started.emit(task.task_id)

        self._thread = threading.Thread(
            target=self._engine.run_directed_iteration,
            args=(task.task_id,),
            daemon=True,
        )
        self._thread.start()

    def _on_pause(self):
        if self._engine._paused:
            self._engine.request_resume()
            self._pause_btn.setText("暂停")
            self._pause_btn.setIcon(FIF.PAUSE)
        else:
            self._engine.request_pause()
            self._pause_btn.setText("继续")
            self._pause_btn.setIcon(FIF.PLAY)

    def _on_stop(self):
        self._engine.request_stop()
        self._stop_btn.setEnabled(False)
        self._status_label.setText("正在停止...")

    # ── 信号处理 ──

    def _on_log(self, level: str, message: str):
        self.log_message.emit(level, message)

    def _on_state_changed(self):
        self._refresh_task_list()

    def _on_round_done(self, task_id: str, round_num: int, diff_stat):
        self._round_label.setText(f"当前轮次: {round_num}")
        if diff_stat:
            self._files_label.setText(
                f"累计修改: {diff_stat.files_changed} 文件, "
                f"+{diff_stat.insertions}/-{diff_stat.deletions} 行"
            )
        task = self._sm.load_task(task_id)
        if task:
            mins = int(task.elapsed_seconds // 60)
            secs = int(task.elapsed_seconds % 60)
            self._elapsed_label.setText(f"已用时间: {mins}分{secs}秒")
            total_secs = task.time_limit_minutes * 60
            if total_secs > 0:
                pct = min(int(task.elapsed_seconds / total_secs * 100), 100)
                self._progress.setValue(pct)

    def _on_task_done(self, task_id: str):
        self._reset_ui()
        InfoBar.success("完成", f"任务 {task_id} 已完成", parent=self)

    def _on_task_failed(self, task_id: str, error: str):
        self._reset_ui()
        InfoBar.error("失败", f"任务 {task_id} 失败: {error[:100]}", parent=self)

    def _reset_ui(self):
        self._current_task_id = None
        self._start_btn.setEnabled(True)
        self._pause_btn.setEnabled(False)
        self._stop_btn.setEnabled(False)
        self._status_label.setText("就绪")
        self._progress.setVisible(False)
        self._round_label.setText("当前轮次: -")
        self._elapsed_label.setText("已用时间: -")
        self._files_label.setText("累计修改: -")

    def _refresh_task_list(self):
        tasks = self._sm.list_tasks()
        self._task_table.setRowCount(len(tasks))
        for i, t in enumerate(tasks):
            self._task_table.setItem(i, 0, QTableWidgetItem(t.task_id[:20]))
            self._task_table.setItem(i, 1, QTableWidgetItem(t.prompt[:40]))
            self._task_table.setItem(i, 2, QTableWidgetItem(t.status))
            self._task_table.setItem(i, 3, QTableWidgetItem(
                f"{t.current_round}/{len(t.rounds)}"
            ))
            total_files = sum(r.files_changed for r in t.rounds)
            self._task_table.setItem(i, 4, QTableWidgetItem(str(total_files)))


class ExplorationPanel(QWidget):
    """探索模式子面板"""

    log_message = pyqtSignal(str, str)

    def __init__(self, state_manager: StateManager, loop_engine: LoopEngine, parent=None):
        super().__init__(parent)
        self._sm = state_manager
        self._engine = loop_engine

        self._init_ui()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        title = TitleLabel("探索模式")
        layout.addWidget(title)

        desc = BodyLabel("AI 自动扫描项目，发现改进机会并生成提议列表。")
        layout.addWidget(desc)

        # 项目选择
        proj_row = QHBoxLayout()
        proj_row.addWidget(BodyLabel("项目:"))
        self._project_combo = ComboBox()
        self._project_combo.addItem("全部项目")
        proj_row.addWidget(self._project_combo, 1)
        layout.addLayout(proj_row)

        # 按钮
        btn_row = QHBoxLayout()
        self._explore_btn = PrimaryPushButton(FIF.SEARCH, "开始探索")
        self._explore_btn.clicked.connect(self._on_explore)
        btn_row.addWidget(self._explore_btn)

        self._evaluate_btn = PushButton(FIF.FEEDBACK, "二次评估")
        self._evaluate_btn.clicked.connect(self._on_evaluate)
        btn_row.addWidget(self._evaluate_btn)

        self._execute_btn = PushButton(FIF.PLAY, "执行已批准")
        self._execute_btn.clicked.connect(self._on_execute)
        btn_row.addWidget(self._execute_btn)

        btn_row.addStretch()
        layout.addLayout(btn_row)

        # 提议表格
        layout.addWidget(SubtitleLabel("提议列表"))
        self._proposal_table = TableWidget()
        self._proposal_table.setColumnCount(4)
        self._proposal_table.setHorizontalHeaderLabels([
            "ID", "描述", "优先级", "状态"
        ])
        hdr2 = self._proposal_table.horizontalHeader()
        if hdr2:
            hdr2.setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        layout.addWidget(self._proposal_table, 1)

        self._refresh_proposals()

    def _on_explore(self):
        project = self._project_combo.currentText().strip()
        self._explore_btn.setEnabled(False)
        self._explore_btn.setText("探索中...")

        def _run():
            try:
                proposals = self._engine.run_exploration(project)
                self._refresh_proposals()
            finally:
                self._explore_btn.setEnabled(True)
                self._explore_btn.setText("开始探索")

        threading.Thread(target=_run, daemon=True).start()

    def _on_evaluate(self):
        proposals = self._sm.load_proposals()
        if not proposals:
            InfoBar.warning("提示", "暂无提议可评估", parent=self)
            return

        self._evaluate_btn.setEnabled(False)
        self._evaluate_btn.setText("评估中...")

        def _run():
            try:
                self._engine.run_proposal_evaluation(proposals)
                self._refresh_proposals()
            finally:
                self._evaluate_btn.setEnabled(True)
                self._evaluate_btn.setText("二次评估")

        threading.Thread(target=_run, daemon=True).start()

    def _on_execute(self):
        proposals = self._sm.load_proposals()
        # 获取已批准的提议（用户在表格中勾选 status=pending 的项）
        pending = [p for p in proposals if p.get("status") == "pending"]
        if not pending:
            InfoBar.warning("提示", "没有待执行的提议（请先在表格中将提议状态改为 pending）", parent=self)
            return

        self._execute_btn.setEnabled(False)
        self._execute_btn.setText("执行中...")

        def _run():
            try:
                count = self._engine.run_execution_queue(pending)
                InfoBar.success("完成", f"成功执行 {count}/{len(pending)} 项", parent=self)
                self._refresh_proposals()
            finally:
                self._execute_btn.setEnabled(True)
                self._execute_btn.setText("执行已批准")

        threading.Thread(target=_run, daemon=True).start()

    def _refresh_proposals(self):
        proposals = self._sm.load_proposals()
        self._proposal_table.setRowCount(len(proposals))
        for i, p in enumerate(proposals):
            self._proposal_table.setItem(i, 0,
                QTableWidgetItem(str(p.get("id", i + 1))))
            self._proposal_table.setItem(i, 1,
                QTableWidgetItem(str(p.get("description", ""))[:60]))
            self._proposal_table.setItem(i, 2,
                QTableWidgetItem(str(p.get("priority", ""))))
            self._proposal_table.setItem(i, 3,
                QTableWidgetItem(str(p.get("status", "proposed"))))


class AutomationInterface(QWidget):
    """自动化面板 — 组合迭代 + 探索两个子面板"""

    def __init__(self, state_manager: StateManager, runner: AgentRunner,
                 loop_engine: LoopEngine, parent=None):
        super().__init__(parent)
        self._sm = state_manager
        self._runner = runner
        self._engine = loop_engine

        self._init_ui()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        tabs = QTabWidget()
        self._iteration_panel = IterationPanel(self._sm, self._runner, self._engine)
        self._exploration_panel = ExplorationPanel(self._sm, self._engine)

        tabs.addTab(self._iteration_panel, "定向迭代")
        tabs.addTab(self._exploration_panel, "探索模式")

        layout.addWidget(tabs)
