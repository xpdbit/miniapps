# -*- coding: utf-8 -*-
"""automation_interface.py — 自动化面板

包含两个子面板：
- 定向迭代：prompt → 时间上限 → 启动循环
- 探索模式：项目扫描 → 提议 → 审批 → 执行
"""

from __future__ import annotations

import os
import threading
from datetime import datetime
from typing import Optional

from PyQt6.QtCore import Qt, pyqtSignal, QTimer
from PyQt6.QtGui import QTextCursor
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout,
    QTextEdit,
    QTabWidget, QTableWidget, QTableWidgetItem,
    QHeaderView, QProgressBar,
    QSplitter,
)
from qfluentwidgets import (
    FluentIcon as FIF,
    PushButton, PrimaryPushButton, InfoBar,
    ComboBox, SpinBox, TextEdit,
    BodyLabel, TitleLabel, SubtitleLabel,
    TableWidget,
)

from oce.core.runner import AgentRunner, get_available_models
from oce.core.state_manager import StateManager, TaskState, TaskStatus
from oce.core.loop_engine import LoopEngine
from oce.gui.core.config import OceConfig



class IterationPanel(QWidget):
    """定向迭代子面板"""

    task_started = pyqtSignal(str)      # task_id
    task_stopped = pyqtSignal(str)      # task_id
    log_message = pyqtSignal(str, str)  # level, message

    def __init__(self, state_manager: StateManager, runner: AgentRunner,
                 loop_engine: LoopEngine, config: Optional[OceConfig] = None,
                 parent=None):
        super().__init__(parent)
        self._sm = state_manager
        self._runner = runner
        self._engine = loop_engine
        self._config = config or OceConfig()
        self._current_task_id: Optional[str] = None
        self._thread: Optional[threading.Thread] = None

        self._init_ui()
        self._connect_signals()
        self._refresh_task_list()

    def _init_ui(self):
        self.setStyleSheet("background-color: #0d1117;")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        # ── 标题 ──
        title = TitleLabel("定向迭代")
        layout.addWidget(title)

        desc = BodyLabel("AI 自动执行定向迭代改进，支持 Prompt 驱动的增量代码优化。")
        layout.addWidget(desc)

        # ── Prompt ──
        layout.addWidget(BodyLabel("Prompt:"))
        self._prompt_edit = TextEdit()
        self._prompt_edit.setPlaceholderText(
            "输入改进目标，如：\"优化项目代码质量，修复类型错误，消除重复代码\""
        )
        self._prompt_edit.setMaximumHeight(100)
        layout.addWidget(self._prompt_edit)

        # ── 时间和项目 ──
        settings_row = QHBoxLayout()
        settings_row.addWidget(BodyLabel("时间上限 (分钟):"))
        self._time_spin = SpinBox()
        self._time_spin.setRange(5, 1440)
        _saved_time_limit = self._config.get("automation", "iteration_time_limit", default=120)
        self._time_spin.setValue(int(_saved_time_limit) if isinstance(_saved_time_limit, int) else 120)
        settings_row.addWidget(self._time_spin)

        settings_row.addSpacing(20)
        settings_row.addWidget(BodyLabel("项目目录:"))
        self._project_combo = ComboBox()
        self._project_combo.setMinimumWidth(200)
        # 默认项 + 已有项目列表
        self._project_combo.addItem(os.getcwd())
        projects = self._config.get("projects", default=[])
        if isinstance(projects, list):
            for proj in projects:
                p = proj if isinstance(proj, str) else (proj.get("path", "") if isinstance(proj, dict) else "")
                if p and isinstance(p, str) and self._project_combo.findText(p) < 0:
                    self._project_combo.addItem(p)
        # 恢复保存的项目路径
        _saved_project = self._config.get("automation", "iteration_project", default="")
        if isinstance(_saved_project, str) and _saved_project and self._project_combo.findText(_saved_project) >= 0:
            self._project_combo.setCurrentText(_saved_project)
        settings_row.addWidget(self._project_combo, 1)
        layout.addLayout(settings_row)

        # ── 模型选择 ──
        model_row = QHBoxLayout()
        model_row.addWidget(BodyLabel("执行模型:"))
        self._model_combo = ComboBox()
        self._model_combo.setMinimumWidth(200)
        models = get_available_models()
        if models:
            self._model_combo.addItems(models)
        else:
            self._model_combo.addItem("deepseek/deepseek-v4-pro")

        # 从主配置恢复上次使用的模型
        _saved_model = self._config.get("automation", "iteration_model", default="")
        if isinstance(_saved_model, str) and _saved_model:
            if self._model_combo.findText(_saved_model) < 0:
                self._model_combo.addItem(_saved_model)
            self._model_combo.setCurrentText(_saved_model)

        model_row.addWidget(self._model_combo, 1)
        model_row.addStretch()
        layout.addLayout(model_row)

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
        info_row = QHBoxLayout()
        self._round_label = BodyLabel("当前轮次: -")
        info_row.addWidget(self._round_label)
        info_row.addSpacing(20)
        self._elapsed_label = BodyLabel("已用时间: -")
        info_row.addWidget(self._elapsed_label)
        info_row.addSpacing(20)
        self._files_label = BodyLabel("累计修改: -")
        info_row.addWidget(self._files_label)
        info_row.addStretch()
        layout.addLayout(info_row)

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
        self._model_combo.currentTextChanged.connect(self._on_model_changed)
        self._project_combo.currentTextChanged.connect(self._on_project_changed)
        self._time_spin.valueChanged.connect(self._on_time_changed)

    # ── 按钮事件 ──

    def _on_start(self):
        # 并发防护：定向迭代同时只能运行一个
        if self._engine.is_running:
            InfoBar.warning("提示", "已有任务正在运行中，定向迭代模式下只能同时运行一个任务", parent=self)
            return

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

    # ── 配置持久化 ──

    def _save_automation(self) -> None:
        """保存当前自动化面板配置到 program.save。"""
        try:
            self._config.set(
                "automation", "iteration_model",
                self._model_combo.currentText().strip(),
            )
            self._config.set(
                "automation", "iteration_project",
                self._project_combo.currentText().strip(),
            )
            self._config.set(
                "automation", "iteration_time_limit",
                self._time_spin.value(),
            )
            self._config.save()
        except Exception:
            pass  # 保存失败不阻塞 UI

    def _on_model_changed(self, model: str) -> None:
        """模型选择变化时自动保存。"""
        if not model.strip():
            return
        self._save_automation()

    def _on_project_changed(self, project: str) -> None:
        """项目目录变化时自动保存。"""
        self._save_automation()

    def _on_time_changed(self, value: int) -> None:
        """时间上限变化时自动保存。"""
        self._save_automation()

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
        self.setStyleSheet("background-color: #0d1117;")
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
                 loop_engine: LoopEngine, config: Optional[OceConfig] = None,
                 parent=None):
        super().__init__(parent)
        self._sm = state_manager
        self._runner = runner
        self._engine = loop_engine
        self._config = config

        self._init_ui()

    def _init_ui(self):
        self.setStyleSheet("background-color: #0d1117;")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        splitter = QSplitter(Qt.Orientation.Horizontal)

        # ── 左面板（70%）：选项卡 ──
        tabs = QTabWidget()
        self._iteration_panel = IterationPanel(
            self._sm, self._runner, self._engine, config=self._config
        )
        self._exploration_panel = ExplorationPanel(self._sm, self._engine)
        tabs.addTab(self._iteration_panel, "定向迭代")
        tabs.addTab(self._exploration_panel, "探索模式")
        splitter.addWidget(tabs)

        # ── 右面板（30%）：Agent 输出 ──
        self._output_widget = QWidget()
        output_layout = QVBoxLayout(self._output_widget)
        output_layout.setContentsMargins(8, 8, 8, 8)
        output_layout.addWidget(SubtitleLabel("Agent 输出"))
        self._output_edit = QTextEdit()
        self._output_edit.setReadOnly(True)
        self._output_edit.setStyleSheet("""
            QTextEdit {
                background-color: #0d1117;
                color: #c9d1d9;
                font-family: 'Cascadia Code', 'Consolas', monospace;
                font-size: 12px;
                border: 1px solid #30363d;
                border-radius: 4px;
                padding: 4px;
            }
        """)
        output_layout.addWidget(self._output_edit)
        splitter.addWidget(self._output_widget)

        # 70/30 初始比例
        splitter.setSizes([700, 300])
        splitter.setStretchFactor(0, 7)
        splitter.setStretchFactor(1, 3)
        splitter.setChildrenCollapsible(False)

        layout.addWidget(splitter)

        # 连接日志信号
        self._iteration_panel.log_message.connect(self._on_log_message)
        self._exploration_panel.log_message.connect(self._on_log_message)

        # ── 日志缓冲：批量刷新，避免高频 append 卡 UI ──
        self._log_buffer: list[str] = []
        self._log_flush_timer = QTimer(self)
        self._log_flush_timer.setInterval(200)  # 200ms 批次
        self._log_flush_timer.timeout.connect(self._flush_log_buffer)
        self._log_flush_timer.start()

    def _flush_log_buffer(self):
        """批量刷新日志缓冲到 UI"""
        if not self._log_buffer:
            return
        lines = "\n".join(self._log_buffer)
        self._log_buffer.clear()

        doc = self._output_edit.document()
        if doc is not None and doc.blockCount() > 1000:
            cursor = self._output_edit.textCursor()
            cursor.movePosition(QTextCursor.MoveOperation.Start)
            cursor.movePosition(QTextCursor.MoveOperation.Down, QTextCursor.MoveMode.KeepAnchor, 200)
            cursor.removeSelectedText()
            cursor.deleteChar()
        self._output_edit.append(lines)

    def _on_log_message(self, level: str, message: str):
        """将日志加入缓冲队列（批量刷新）"""
        self._log_buffer.append(f"[{level}] {message}")

    def deleteLater(self) -> None:
        """清理资源"""
        self._log_flush_timer.stop()
        self._flush_log_buffer()
        super().deleteLater()
