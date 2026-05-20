# -*- coding: utf-8 -*-
"""task_plan_interface.py — AI 驱动的任务规划界面（v2）

新布局:
  子Tab "头脑风暴":
    上侧50%: 提示词预览
    下侧50%: 头脑风暴问答
  子Tab "预期":
    任务描述（原始任务描述）
    预期补充
    约束补充

新增功能:
  - 快照管理：实时自动保存 + 撤销/恢复
  - 移除清空功能
"""
import json
import os
import re
import yaml
from dataclasses import dataclass, field
from datetime import datetime
from string import Template
from typing import Optional

from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QFrame,
                               QTextEdit, QSplitter, QScrollArea,
                               QButtonGroup, QRadioButton, QCheckBox,
                               QSizePolicy, QLabel, QTabWidget)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal
from qfluentwidgets import (BodyLabel, PrimaryPushButton, PushButton,
                               SimpleCardWidget, StrongBodyLabel, CaptionLabel,
                               InfoBar, InfoBarPosition)


# ─── 快照管理器 ────────────────────────────────

@dataclass
class TaskPlanSnapshot:
    """单个任务规划快照"""
    timestamp: str
    task_desc: str
    expected: str
    constraints: str
    qa_history: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp,
            "task_desc": self.task_desc,
            "expected": self.expected,
            "constraints": self.constraints,
            "qa_history": self.qa_history,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "TaskPlanSnapshot":
        return cls(
            timestamp=data.get("timestamp", ""),
            task_desc=data.get("task_desc", ""),
            expected=data.get("expected", ""),
            constraints=data.get("constraints", ""),
            qa_history=data.get("qa_history", []),
        )


class SnapshotManager:
    """快照管理器：提供 undo/redo 功能，实时自动保存到磁盘"""

    MAX_SNAPSHOTS = 50
    SAVE_FILENAME = "snapshots.json"

    def __init__(self, state_dir: str):
        self._snapshots: list[TaskPlanSnapshot] = []
        self._current_index: int = -1
        self._save_dir = os.path.join(state_dir, "task_plan_snapshots")
        os.makedirs(self._save_dir, exist_ok=True)
        self._save_path = os.path.join(self._save_dir, self.SAVE_FILENAME)
        self._load_from_disk()

    def save(self, task_desc: str, expected: str, constraints: str,
             qa_history: list[dict]) -> Optional[TaskPlanSnapshot]:
        """保存当前状态为快照。若状态无变化则跳过。"""
        snapshot = TaskPlanSnapshot(
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            task_desc=task_desc,
            expected=expected,
            constraints=constraints,
            qa_history=[dict(q) for q in qa_history],  # 深拷贝
        )

        # 检查是否与当前快照相同（去重）
        if self._current_index >= 0 and self._current_index < len(self._snapshots):
            current = self._snapshots[self._current_index]
            if (current.task_desc == task_desc and
                    current.expected == expected and
                    current.constraints == constraints and
                    current.qa_history == snapshot.qa_history):
                return None  # 无变化，不保存

        # 截断 redo 栈
        if self._current_index < len(self._snapshots) - 1:
            self._snapshots = self._snapshots[:self._current_index + 1]

        self._snapshots.append(snapshot)
        self._current_index = len(self._snapshots) - 1

        # 限制最大快照数
        if len(self._snapshots) > self.MAX_SNAPSHOTS:
            overflow = len(self._snapshots) - self.MAX_SNAPSHOTS
            self._snapshots = self._snapshots[overflow:]
            self._current_index -= overflow

        self._persist()
        return snapshot

    def undo(self) -> Optional[TaskPlanSnapshot]:
        """撤销：返回上一个快照"""
        if self._current_index > 0:
            self._current_index -= 1
            self._persist()
            return self._snapshots[self._current_index]
        return None

    def redo(self) -> Optional[TaskPlanSnapshot]:
        """恢复：返回下一个快照"""
        if self._current_index < len(self._snapshots) - 1:
            self._current_index += 1
            self._persist()
            return self._snapshots[self._current_index]
        return None

    def can_undo(self) -> bool:
        return self._current_index > 0

    def can_redo(self) -> bool:
        return self._current_index < len(self._snapshots) - 1

    def get_current(self) -> Optional[TaskPlanSnapshot]:
        if 0 <= self._current_index < len(self._snapshots):
            return self._snapshots[self._current_index]
        return None

    def _persist(self):
        """持久化到磁盘"""
        try:
            data = {
                "current_index": self._current_index,
                "snapshots": [s.to_dict() for s in self._snapshots],
            }
            with open(self._save_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception:
            pass  # 静默失败，不影响 UI

    def _load_from_disk(self):
        """从磁盘恢复快照"""
        try:
            if os.path.exists(self._save_path):
                with open(self._save_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self._snapshots = [
                    TaskPlanSnapshot.from_dict(s)
                    for s in data.get("snapshots", [])
                ]
                self._current_index = data.get("current_index", len(self._snapshots) - 1)
                # 修正越界
                if self._current_index >= len(self._snapshots):
                    self._current_index = len(self._snapshots) - 1
                if self._current_index < 0 and self._snapshots:
                    self._current_index = 0
        except Exception:
            self._snapshots = []
            self._current_index = -1


# ─── 头脑风暴 Prompt 模板 ───────────────────────

_BRAINSTORM_PROMPT = """你是一个任务规划专家。根据用户输入的任务信息，逐步引导用户细化任务需求。
每次只生成一个规划问题，用户回答后你将生成下一个问题。

## 任务信息
**任务描述**: $task_desc

**预期成果**: $expected_outcomes

**约束条件**: $constraints

## 问答历史
$history

## 当前轮次: 第 $round_num 轮

请生成下一个规划问题（不要包含 markdown 代码块标记）。
问题应帮助明确：技术选型、实现优先级、架构决策、风险点等。

以 YAML 格式返回：
question: "问题描述"
options:
  - 选项A的描述
  - 选项B的描述
  - 选项C的描述
  - 选项D的描述（可选）
type: single

如果已经收集了足够的信息（通常 3-5 轮问答后已足够），请输出 ===PLAN_COMPLETE=== 作为完成信号，
并附上完整的任务规约（含所有问答决策总结）。

格式示例:
===PLAN_COMPLETE===
## 最终任务规约
...
"""


# ─── 问题卡片组件 ─────────────────────────────────

class BrainstormCard(SimpleCardWidget):
    """头脑风暴问题卡片：显示单个问题 + 选项按钮组"""

    def __init__(self, question_data: dict, question_index: int,
                 parent=None, on_option_selected=None):
        super().__init__(parent)
        self._qdata = question_data
        self._qindex = question_index
        self._selected_indices: list[int] = []
        self._buttons: list = []
        self._on_option_selected = on_option_selected

        self.setBorderRadius(8)
        self.setMinimumHeight(120)
        self.setStyleSheet("""
            SimpleCardWidget {
                background-color: #161b22;
                border: 1px solid #30363d;
                border-radius: 8px;
            }
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 14, 16, 14)
        layout.setSpacing(10)

        # 问题文本
        question_text = question_data.get("question", "")
        q_label = StrongBodyLabel(f"Q{question_index + 1}. {question_text}")
        q_label.setStyleSheet("color: #e6edf3; font-size: 14px; line-height: 1.5;")
        q_label.setWordWrap(True)
        layout.addWidget(q_label)

        # 选项按钮组
        options = question_data.get("options", [])
        qtype = question_data.get("type", "single")

        self._button_group = QButtonGroup(self)
        self._button_group.setExclusive(qtype == "single")

        opts_layout = QVBoxLayout()
        opts_layout.setSpacing(4)

        for i, opt in enumerate(options):
            row = QHBoxLayout()
            row.setSpacing(6)

            if qtype == "multi":
                btn = QCheckBox(str(opt), self)
            else:
                btn = QRadioButton(str(opt), self)

            btn.setStyleSheet("""
                QRadioButton, QCheckBox {
                    color: #c9d1d9;
                    font-size: 13px;
                    spacing: 8px;
                }
                QRadioButton::indicator {
                    width: 16px; height: 16px;
                    border: 2px solid #30363d;
                    border-radius: 8px;
                    background: #0d1117;
                }
                QCheckBox::indicator {
                    width: 16px; height: 16px;
                    border: 2px solid #30363d;
                    border-radius: 3px;
                    background: #0d1117;
                }
                QRadioButton::indicator:checked, QCheckBox::indicator:checked {
                    background: #1f6feb;
                    border-color: #1f6feb;
                }
                QRadioButton:hover, QCheckBox:hover {
                    color: #58a6ff;
                }
            """)
            btn.toggled.connect(lambda checked, idx=i: self._on_option_toggled(idx, checked))
            self._button_group.addButton(btn)
            self._buttons.append(btn)
            row.addWidget(btn)
            row.addStretch()
            opts_layout.addLayout(row)

        layout.addLayout(opts_layout)

        # 下一题按钮（初始隐藏，选择后显示）
        self._next_btn = PrimaryPushButton("→ 下一题")
        self._next_btn.setVisible(False)
        self._next_btn.clicked.connect(self._on_next_clicked)
        btn_row = QHBoxLayout()
        btn_row.addStretch()
        btn_row.addWidget(self._next_btn)
        layout.addLayout(btn_row)

    def _on_option_toggled(self, idx: int, checked: bool):
        qtype = self._qdata.get("type", "single")
        if qtype == "single":
            if checked:
                self._selected_indices = [idx]
        else:
            if checked:
                if idx not in self._selected_indices:
                    self._selected_indices.append(idx)
            else:
                if idx in self._selected_indices:
                    self._selected_indices.remove(idx)

        # 有选择时显示「下一题」按钮
        self._next_btn.setVisible(bool(self._selected_indices))

    def _on_next_clicked(self):
        if self._on_option_selected and self._selected_indices:
            selected_texts = self.get_selected_texts()
            question_text = self._qdata.get("question", "")
            self._on_option_selected(self._qindex, question_text, selected_texts)

    def get_selected(self) -> list[int]:
        return sorted(self._selected_indices)

    def get_selected_texts(self) -> list[str]:
        options = self._qdata.get("options", [])
        return [options[i] for i in self.get_selected()
                if 0 <= i < len(options)]


# ─── 文本编辑框工厂函数 ────────────────────────────

_TEXTEDIT_STYLE = """
    QTextEdit {
        background-color: #0d1117;
        color: #c9d1d9;
        border: 1px solid #30363d;
        border-radius: 8px;
        padding: 10px;
        font-size: 13px;
        font-family: "Microsoft YaHei", sans-serif;
    }
    QTextEdit:focus {
        border-color: #58a6ff;
    }
"""

_PREVIEW_STYLE = """
    QTextEdit {
        background-color: #0d1117;
        color: #e6edf3;
        border: 1px solid #30363d;
        border-radius: 8px;
        padding: 10px;
        font-size: 12px;
        font-family: Consolas, "Microsoft YaHei", monospace;
        line-height: 1.5;
    }
"""

_SCROLL_AREA_STYLE = """
    QScrollArea {
        background-color: transparent;
        border: none;
    }
    QScrollBar:vertical {
        background: #0d1117;
        width: 8px;
        border-radius: 4px;
    }
    QScrollBar::handle:vertical {
        background: #30363d;
        border-radius: 4px;
        min-height: 30px;
    }
    QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
        height: 0px;
    }
"""

_PLAN_RESULT_STYLE = """
    QTextEdit {
        background-color: #0d1117;
        color: #e6edf3;
        border: 1px solid #30363d;
        border-radius: 8px;
        padding: 10px;
        font-size: 13px;
        font-family: "Microsoft YaHei", sans-serif;
    }
"""

_CANCEL_BTN_STYLE = """
    QPushButton {
        color: #f85149; border-color: #f85149;
    }
    QPushButton:hover {
        background-color: rgba(248, 81, 73, 0.15);
    }
"""


# ─── 公共函数：提示词预览生成 ─────────────────────

def build_prompt_preview(task_desc: str = "", expected: str = "",
                         constraints: str = "",
                         qa_history: list[dict] | None = None,
                         project_name: str = "") -> str:
    """生成提示词预览文本（可被任意视图复用）。

    Args:
        task_desc: 原始任务描述（对应【任务描述】）
        expected: 预期成果补充（对应【预期成果】）
        constraints: 约束补充（对应【约束】）
        qa_history: 头脑风暴问答历史列表
        project_name: 项目名称（对应【项目名称】）

    Returns:
        格式化的提示词预览纯文本
    """
    desc = task_desc.strip() if task_desc else ""
    exp = expected.strip() if expected else ""
    cons = constraints.strip() if constraints else ""
    qa = qa_history or []
    proj = project_name.strip() if project_name else ""

    if not desc and not exp and not cons and not qa:
        return ""

    # 构建问答历史文本
    qa_lines: list[str] = []
    for i, item in enumerate(qa):
        q = item.get("question", "")
        answers = item.get("answer", [])
        qa_lines.append(f"Q{i + 1}: {q}")
        for ans in answers:
            qa_lines.append(f"  A: {ans}")

    lines = [
        "# 提示词预览",
        "",
        "【项目名称】",
        proj if proj else "（未填写项目名称）",
        "",
        "【任务描述】",
        "> 原始的任务描述",
        desc if desc else "（未填写任务描述）",
        "",
        "【预期成果】",
        "> 预期成果，需要对照",
        exp if exp else "（未填写预期效果）",
        "",
        "【约束】",
        "> 约束补充，需要遵守",
        cons if cons else "（未填写约束）",
        "",
        "【头脑风暴历史】",
        "> 头脑风暴历史是任务的细节，需要完成",
    ]
    if qa_lines:
        lines.extend(qa_lines)
    else:
        lines.append("  （暂无头脑风暴记录）")

    return "\n".join(lines)


# ─── 主页界面 ─────────────────────────────────

class TaskPlanInterface(QWidget):
    """AI 驱动的任务规划界面（v2 — 子Tab布局 + 快照管理）"""

    # 完成信号
    PLAN_COMPLETE = "===PLAN_COMPLETE==="

    # 跨线程回调信号
    _brainstorm_result_ready = pyqtSignal(str)

    def __init__(self, parent=None, loop_manager=None):
        super().__init__(parent)
        self._loop = loop_manager
        self._active_task: Optional[dict] = None
        self._active_task_name: str = "未选定"

        # 头脑风暴状态
        self._qa_history: list[dict] = []
        self._round_num: int = 0
        self._is_planning: bool = False
        self._current_card: Optional[BrainstormCard] = None
        self._planning_result: str = ""

        # 快照管理器（惰性初始化，需要 state_dir）
        self._snapshot_manager: Optional[SnapshotManager] = None
        self._auto_save_timer = QTimer(self)
        self._auto_save_timer.setSingleShot(True)
        self._auto_save_timer.timeout.connect(self._on_auto_save)

        # 连接跨线程信号
        self._brainstorm_result_ready.connect(self._process_brainstorm_result)

        self._setup_ui()
        self._update_header()

    # ─── 快照管理 ──────────────────────────────

    def _init_snapshot_manager(self):
        """惰性初始化快照管理器（依赖 state_dir）"""
        if self._snapshot_manager is not None:
            return
        if self._loop and hasattr(self._loop, 'fm'):
            state_dir = getattr(self._loop.fm, 'state_dir', '')
            if state_dir:
                self._snapshot_manager = SnapshotManager(state_dir)
                # 从磁盘恢复上次保存的状态
                current = self._snapshot_manager.get_current()
                if current:
                    self._restore_from_snapshot(current, silent=True)
                # 如果没有快照，立即保存初始状态
                else:
                    self._do_save_snapshot()
                self._update_undo_redo_buttons()

    def _schedule_auto_save(self):
        """调度自动保存（2 秒防抖）"""
        if self._snapshot_manager is None or not self._auto_save_timer:
            return
        self._auto_save_timer.start(2000)

    def _on_auto_save(self):
        """定时器触发：执行自动保存"""
        self._do_save_snapshot()

    def _do_save_snapshot(self) -> Optional[TaskPlanSnapshot]:
        """执行快照保存"""
        if self._snapshot_manager is None:
            return None
        task_desc = self._prompt_supplement.toPlainText().strip()
        expected = self._expected_supplement.toPlainText().strip()
        constraints = self._constraints_supplement.toPlainText().strip()
        result = self._snapshot_manager.save(
            task_desc, expected, constraints, self._qa_history,
        )
        if result is not None:
            self._update_undo_redo_buttons()
        return result

    def _on_undo(self):
        """撤销按钮点击"""
        if self._snapshot_manager is None or not self._snapshot_manager.can_undo():
            return
        snapshot = self._snapshot_manager.undo()
        if snapshot:
            self._restore_from_snapshot(snapshot)
            self._update_undo_redo_buttons()
            InfoBar.info(
                title="已撤销",
                content=f"已恢复到 {snapshot.timestamp} 的快照",
                orient=Qt.Orientation.Horizontal,
                isClosable=True,
                position=InfoBarPosition.TOP,
                duration=2000,
                parent=self,
            )

    def _on_redo(self):
        """恢复按钮点击"""
        if self._snapshot_manager is None or not self._snapshot_manager.can_redo():
            return
        snapshot = self._snapshot_manager.redo()
        if snapshot:
            self._restore_from_snapshot(snapshot)
            self._update_undo_redo_buttons()
            InfoBar.info(
                title="已恢复",
                content=f"已恢复到 {snapshot.timestamp} 的快照",
                orient=Qt.Orientation.Horizontal,
                isClosable=True,
                position=InfoBarPosition.TOP,
                duration=2000,
                parent=self,
            )

    def _restore_from_snapshot(self, snapshot: TaskPlanSnapshot, silent: bool = False):
        """从快照恢复所有编辑器状态"""
        # 阻止 textChanged 信号触发自动保存（通过临时断开信号）
        self._prompt_supplement.blockSignals(True)
        self._expected_supplement.blockSignals(True)
        self._constraints_supplement.blockSignals(True)

        self._prompt_supplement.setPlainText(snapshot.task_desc)
        self._expected_supplement.setPlainText(snapshot.expected)
        self._constraints_supplement.setPlainText(snapshot.constraints)
        self._qa_history = snapshot.qa_history

        self._prompt_supplement.blockSignals(False)
        self._expected_supplement.blockSignals(False)
        self._constraints_supplement.blockSignals(False)

        self._refresh_preview()

        if not silent:
            self._cancel_auto_save()  # 恢复时取消待定的自动保存

    def _update_undo_redo_buttons(self):
        """更新撤销/恢复按钮的启用状态"""
        if self._undo_btn is not None and self._snapshot_manager:
            self._undo_btn.setEnabled(self._snapshot_manager.can_undo())
        if self._redo_btn is not None and self._snapshot_manager:
            self._redo_btn.setEnabled(self._snapshot_manager.can_redo())

    def _cancel_auto_save(self):
        """取消待定的自动保存定时器"""
        if self._auto_save_timer and self._auto_save_timer.isActive():
            self._auto_save_timer.stop()

    # ─── LoopManager 注入 ─────────────────────

    def set_loop_manager(self, loop_manager):
        """设置 LoopManager 引用（供 app.py 注入）"""
        self._loop = loop_manager
        # 初始化快照管理器
        self._init_snapshot_manager()

    def set_active_task(self, task: Optional[dict]):
        """设置当前选定的任务（由「选定任务」按钮触发）"""
        self._active_task = task
        if task:
            desc = task.get("desc", task.get("description", ""))
            self._active_task_name = str(desc)[:60] if desc else f"#{task.get('id', '?')}"
            # 自动填充提示补充框
            self._prompt_supplement.setPlainText(str(desc))
            # 自动填充预期补充框
            expected = task.get("expected", task.get("acceptance_criteria", ""))
            if expected:
                self._expected_supplement.setPlainText(str(expected))
            else:
                self._expected_supplement.clear()
            # 约束补充保持用户之前填写的内容
        else:
            self._active_task_name = "未选定"
        self._update_header()
        self._refresh_preview()

    def _update_header(self):
        """更新头部标题"""
        self._header_label.setText(f"任务规划 - {self._active_task_name}")

    # ─── UI 构建 ─────────────────────────────────

    def _setup_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(16, 16, 16, 16)
        main_layout.setSpacing(12)

        # ═══ Header ═══
        header_row = QHBoxLayout()
        self._header_label = StrongBodyLabel("任务规划 - 未选定")
        self._header_label.setStyleSheet(
            "font-size: 18px; color: #e6edf3; font-weight: bold;"
        )
        header_row.addWidget(self._header_label)
        header_row.addStretch()

        # 撤销按钮
        self._undo_btn = PushButton("↩ 撤销")
        self._undo_btn.setEnabled(False)
        self._undo_btn.clicked.connect(self._on_undo)
        header_row.addWidget(self._undo_btn)

        # 恢复按钮
        self._redo_btn = PushButton("↪ 恢复")
        self._redo_btn.setEnabled(False)
        self._redo_btn.clicked.connect(self._on_redo)
        header_row.addWidget(self._redo_btn)

        main_layout.addLayout(header_row)

        # ═══ 子 Tab 容器 ═══
        self._tab_widget = QTabWidget(self)
        self._tab_widget.setStyleSheet("""
            QTabWidget::pane {
                border: 1px solid #30363d; border-radius: 10px;
                background: #0d1117; padding: 8px 4px 4px 4px;
                top: -1px;
            }
            QTabBar::tab {
                color: #8b949e; background: transparent;
                border: 1px solid transparent; border-radius: 20px;
                padding: 8px 20px; margin: 0px 3px;
                font-size: 13px; font-weight: 500;
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

        # ── Tab 1: 头脑风暴 ──
        self._setup_brainstorm_tab()
        self._tab_widget.addTab(self._brainstorm_tab, "🧠 头脑风暴")

        # ── Tab 2: 预期 ──
        self._setup_expected_tab()
        self._tab_widget.addTab(self._expected_tab, "📋 预期")

        main_layout.addWidget(self._tab_widget, 1)

    def _setup_brainstorm_tab(self):
        """构建「头脑风暴」子Tab：上50%提示词预览 + 下50%问答"""
        self._brainstorm_tab = QWidget()
        brainstorm_splitter = QSplitter(Qt.Orientation.Vertical)
        brainstorm_splitter.setChildrenCollapsible(False)

        # ── 上侧 50%：提示词预览 ──
        preview_w = QWidget()
        preview_layout = QVBoxLayout(preview_w)
        preview_layout.setContentsMargins(0, 0, 0, 0)
        preview_layout.setSpacing(6)

        preview_header = QHBoxLayout()
        preview_header.addWidget(StrongBodyLabel("🔍 提示词预览"))
        preview_header.addStretch()
        self._copy_prompt_btn = PushButton("复制")
        self._copy_prompt_btn.clicked.connect(self._copy_preview)
        preview_header.addWidget(self._copy_prompt_btn)
        preview_layout.addLayout(preview_header)

        self._preview_edit = QTextEdit()
        self._preview_edit.setReadOnly(True)
        self._preview_edit.setPlaceholderText(
            "在「预期」Tab 中输入任务描述、预期成果和约束条件后，此处将显示完整的提示词…"
        )
        self._preview_edit.setStyleSheet(_PREVIEW_STYLE)
        preview_layout.addWidget(self._preview_edit, 1)

        brainstorm_splitter.addWidget(preview_w)

        # ── 下侧 50%：头脑风暴问答 ──
        brainstorm_w = QWidget()
        brainstorm_layout = QVBoxLayout(brainstorm_w)
        brainstorm_layout.setContentsMargins(0, 0, 0, 0)
        brainstorm_layout.setSpacing(6)

        b_header = QHBoxLayout()
        b_header.addWidget(StrongBodyLabel("💬 头脑风暴问答"))
        b_header.addStretch()

        # 控制按钮
        self._start_brainstorm_btn = PrimaryPushButton("🚀 开始规划")
        self._start_brainstorm_btn.clicked.connect(self._on_start_brainstorm)
        b_header.addWidget(self._start_brainstorm_btn)

        self._cancel_brainstorm_btn = PushButton("⏹ 取消")
        self._cancel_brainstorm_btn.setVisible(False)
        self._cancel_brainstorm_btn.clicked.connect(self._on_cancel_brainstorm)
        self._cancel_brainstorm_btn.setStyleSheet(_CANCEL_BTN_STYLE)
        b_header.addWidget(self._cancel_brainstorm_btn)
        brainstorm_layout.addLayout(b_header)

        # 状态标签
        self._brainstorm_status = CaptionLabel(
            "在「预期」Tab 中输入任务描述后，点击「开始规划」启动逐题问答"
        )
        self._brainstorm_status.setStyleSheet("color: #484f58; font-size: 11px;")
        self._brainstorm_status.setWordWrap(True)
        brainstorm_layout.addWidget(self._brainstorm_status)

        # 可滚动区域（问题卡片）
        self._brainstorm_scroll = QScrollArea()
        self._brainstorm_scroll.setWidgetResizable(True)
        self._brainstorm_scroll.setStyleSheet(_SCROLL_AREA_STYLE)

        self._brainstorm_container = QWidget()
        self._brainstorm_inner_layout = QVBoxLayout(self._brainstorm_container)
        self._brainstorm_inner_layout.setContentsMargins(0, 0, 0, 0)
        self._brainstorm_inner_layout.setSpacing(12)
        self._brainstorm_inner_layout.addStretch()

        self._brainstorm_scroll.setWidget(self._brainstorm_container)
        brainstorm_layout.addWidget(self._brainstorm_scroll, 1)

        # 完成规约显示区（初始隐藏）
        self._plan_result_area = QTextEdit()
        self._plan_result_area.setReadOnly(True)
        self._plan_result_area.setVisible(False)
        self._plan_result_area.setStyleSheet(_PLAN_RESULT_STYLE)
        brainstorm_layout.addWidget(self._plan_result_area, 1)

        brainstorm_splitter.addWidget(brainstorm_w)
        brainstorm_splitter.setSizes([400, 400])

        tab_layout = QVBoxLayout(self._brainstorm_tab)
        tab_layout.setContentsMargins(0, 8, 0, 0)
        tab_layout.addWidget(brainstorm_splitter)

    def _setup_expected_tab(self):
        """构建「预期」子Tab：任务描述 + 预期补充 + 约束补充"""
        self._expected_tab = QWidget()
        tab_layout = QVBoxLayout(self._expected_tab)
        tab_layout.setContentsMargins(0, 8, 0, 0)
        tab_layout.setSpacing(12)

        # ── 任务描述 ──
        desc_w = QWidget()
        desc_layout = QVBoxLayout(desc_w)
        desc_layout.setContentsMargins(0, 0, 0, 0)
        desc_layout.setSpacing(6)

        desc_header = QHBoxLayout()
        desc_header.addWidget(StrongBodyLabel("📝 任务描述"))
        desc_header.addStretch()
        desc_layout.addLayout(desc_header)

        desc_label = CaptionLabel("原始的任务描述，选定任务后自动填充")
        desc_label.setStyleSheet("color: #8b949e; font-size: 11px;")
        desc_label.setWordWrap(True)
        desc_layout.addWidget(desc_label)

        self._prompt_supplement = QTextEdit()
        self._prompt_supplement.setPlaceholderText(
            "例如：为 Dashboard 添加数据导出功能，支持 CSV 和 Excel 格式…"
        )
        self._prompt_supplement.setStyleSheet(_TEXTEDIT_STYLE)
        self._prompt_supplement.textChanged.connect(self._on_field_changed)
        desc_layout.addWidget(self._prompt_supplement, 1)

        tab_layout.addWidget(desc_w, 1)

        # ── 预期补充 ──
        expected_w = QWidget()
        expected_layout = QVBoxLayout(expected_w)
        expected_layout.setContentsMargins(0, 0, 0, 0)
        expected_layout.setSpacing(6)

        expected_header = QHBoxLayout()
        expected_header.addWidget(StrongBodyLabel("🎯 预期补充"))
        expected_header.addStretch()
        expected_layout.addLayout(expected_header)

        expected_label = CaptionLabel("预期成果，需要对照。描述期望的产出物、验收标准等")
        expected_label.setStyleSheet("color: #8b949e; font-size: 11px;")
        expected_label.setWordWrap(True)
        expected_layout.addWidget(expected_label)

        self._expected_supplement = QTextEdit()
        self._expected_supplement.setPlaceholderText(
            "例如：\n- 后端 API 返回 JSON，前端使用 Ant Design Table 展示\n"
            "- 支持按日期范围和数据类型筛选\n"
            "- 需处理大文件导出的超时问题…"
        )
        self._expected_supplement.setStyleSheet(_TEXTEDIT_STYLE)
        self._expected_supplement.textChanged.connect(self._on_field_changed)
        expected_layout.addWidget(self._expected_supplement, 1)

        tab_layout.addWidget(expected_w, 1)

        # ── 约束补充 ──
        constraints_w = QWidget()
        constraints_layout = QVBoxLayout(constraints_w)
        constraints_layout.setContentsMargins(0, 0, 0, 0)
        constraints_layout.setSpacing(6)

        constraints_header = QHBoxLayout()
        constraints_header.addWidget(StrongBodyLabel("🔒 约束补充"))
        constraints_header.addStretch()
        constraints_layout.addLayout(constraints_header)

        constraints_label = CaptionLabel("约束条件，需要遵守。描述技术限制、规范要求等")
        constraints_label.setStyleSheet("color: #8b949e; font-size: 11px;")
        constraints_label.setWordWrap(True)
        constraints_layout.addWidget(constraints_label)

        self._constraints_supplement = QTextEdit()
        self._constraints_supplement.setPlaceholderText(
            "例如：\n- 必须兼容 IE11\n- 不能修改数据库 schema\n- 使用现有的 Ant Design 组件库…"
        )
        self._constraints_supplement.setStyleSheet(_TEXTEDIT_STYLE)
        self._constraints_supplement.textChanged.connect(self._on_field_changed)
        constraints_layout.addWidget(self._constraints_supplement, 1)

        tab_layout.addWidget(constraints_w, 1)

    def _on_field_changed(self):
        """任意文本字段变化时：刷新预览 + 调度自动保存"""
        self._refresh_preview()
        self._init_snapshot_manager()
        self._schedule_auto_save()

    # ─── 提示词预览 ──────────────────────────────

    def _refresh_preview(self):
        """实时刷新提示词预览（委托公共函数）"""
        task_desc = self._prompt_supplement.toPlainText().strip()
        expected = self._expected_supplement.toPlainText().strip()
        constraints = self._constraints_supplement.toPlainText().strip()

        result = build_prompt_preview(task_desc, expected, constraints, self._qa_history)
        if result:
            self._preview_edit.setPlainText(result)
        else:
            self._preview_edit.clear()

    def _copy_preview(self):
        """复制提示词预览到剪贴板"""
        text = self._preview_edit.toPlainText()
        if text:
            from PyQt6.QtWidgets import QApplication
            app = QApplication.instance()
            if hasattr(app, 'clipboard'):
                app.clipboard().setText(text)  # type: ignore[attr-defined]
            InfoBar.success(
                title="已复制",
                content="提示词已复制到剪贴板",
                orient=Qt.Orientation.Horizontal,
                isClosable=True,
                position=InfoBarPosition.TOP,
                duration=2000,
                parent=self,
            )

    # ─── 头脑风暴流程 ────────────────────────────

    def _on_start_brainstorm(self):
        """点击「开始规划」→ 启动逐题问答"""
        task_desc = self._prompt_supplement.toPlainText().strip()

        if not task_desc:
            InfoBar.warning(
                title="输入为空",
                content="请先在「预期」Tab 中输入任务描述",
                orient=Qt.Orientation.Horizontal,
                isClosable=True,
                position=InfoBarPosition.TOP,
                duration=3000,
                parent=self,
            )
            return

        # 保存当前状态为快照
        self._init_snapshot_manager()
        self._do_save_snapshot()

        # 重置状态
        self._qa_history.clear()
        self._round_num = 0
        self._is_planning = True
        self._clear_brainstorm_cards()
        self._plan_result_area.setVisible(False)
        self._brainstorm_scroll.setVisible(True)
        self._planning_result = ""

        # 更新 UI 状态
        self._start_brainstorm_btn.setVisible(False)
        self._cancel_brainstorm_btn.setVisible(True)
        self._prompt_supplement.setReadOnly(True)
        self._expected_supplement.setReadOnly(True)
        self._constraints_supplement.setReadOnly(True)

        # 发送第一轮问题
        self._send_brainstorm_round()

    def _send_brainstorm_round(self):
        """组装 prompt 并发送给 AI，获取下一轮问题"""
        self._round_num += 1

        task_desc = self._prompt_supplement.toPlainText().strip()
        expected = self._expected_supplement.toPlainText().strip()
        constraints = self._constraints_supplement.toPlainText().strip()

        # 构建问答历史文本
        history_lines = []
        for i, qa in enumerate(self._qa_history):
            history_lines.append(f"Q{i + 1}: {qa['question']}")
            history_lines.append(f"A{i + 1}: {'; '.join(qa.get('answer', []))}")
        history_text = "\n".join(history_lines) if history_lines else "（首轮，无历史）"

        try:
            prompt = Template(_BRAINSTORM_PROMPT).safe_substitute(
                task_desc=task_desc,
                expected_outcomes=expected or "（未指定）",
                constraints=constraints or "（无约束）",
                history=history_text,
                round_num=str(self._round_num),
            )
        except Exception as e:
            self._brainstorm_status.setText(f"构建 prompt 失败: {e}")
            self._brainstorm_status.setStyleSheet("color: #f85149; font-size: 11px;")
            self._reset_brainstorm_ui()
            return

        self._brainstorm_status.setText(
            f"⏳ 第 {self._round_num} 轮：正在与 AI 沟通，生成规划问题…"
        )
        self._brainstorm_status.setStyleSheet("color: #d29922; font-size: 11px;")

        if self._loop:
            self._loop.trigger_plan(prompt, self._on_brainstorm_result)
        else:
            self._brainstorm_status.setText("错误：未连接到 LoopManager")
            self._brainstorm_status.setStyleSheet("color: #f85149; font-size: 11px;")
            self._reset_brainstorm_ui()

    def _on_brainstorm_result(self, output: str):
        """AI 返回结果后的回调（在后台线程中调用，通过 pyqtSignal 回到主线程）"""
        self._brainstorm_result_ready.emit(output)

    def _process_brainstorm_result(self, output: str):
        """在主线程中处理 AI 返回的头脑风暴结果"""
        if not self._is_planning:
            return

        try:
            self._do_process_result(output)
        except Exception as e:
            self._brainstorm_status.setText(f"处理规划结果时出错: {e}")
            self._brainstorm_status.setStyleSheet("color: #f85149; font-size: 11px;")
            self._reset_brainstorm_ui()

    def _do_process_result(self, output: str):
        """实际处理 AI 返回的头脑风暴结果"""
        if not output:
            self._brainstorm_status.setText("规划失败：AI 未返回结果")
            self._brainstorm_status.setStyleSheet("color: #f85149; font-size: 11px;")
            self._reset_brainstorm_ui()
            return

        # 检查完成信号
        if self.PLAN_COMPLETE in output:
            self._handle_plan_complete(output)
            return

        # 解析问题数据
        question_data = self._parse_single_question(output)
        if not question_data:
            self._brainstorm_status.setText(
                "规划失败：无法解析 AI 返回的问题。请检查 AI 输出格式。"
            )
            self._brainstorm_status.setStyleSheet("color: #f85149; font-size: 11px;")
            self._reset_brainstorm_ui()
            return

        # 渲染头脑风暴卡片
        self._render_brainstorm_card(question_data)
        self._brainstorm_status.setText(
            f"第 {self._round_num} 轮：请选择一个选项后点击「下一题」"
        )
        self._brainstorm_status.setStyleSheet("color: #3fb950; font-size: 11px;")

    def _parse_single_question(self, text: str) -> Optional[dict]:
        """从 AI 输出文本中解析单个问题（YAML 格式）"""
        # 清理文本
        text = re.sub(r'===TASK_DONE===|===PLAN_COMPLETE===', '', text)
        text = re.sub(r'```yaml|```', '', text)

        try:
            data = yaml.safe_load(text)
            if isinstance(data, dict) and "question" in data:
                options = data.get("options", [])
                if not isinstance(options, (list, tuple)):
                    options = [str(options)] if options else []
                return {
                    "question": str(data.get("question", "")),
                    "options": [str(o) for o in options],
                    "type": data.get("type", "single"),
                }
        except yaml.YAMLError:
            pass

        # 回退：尝试正则提取
        q_match = re.search(r'question:\s*["\']?(.+?)["\']?\s*\n', text, re.DOTALL)
        if q_match:
            question = q_match.group(1).strip()
            options = re.findall(r'\s*-\s+(.+)', text)
            return {
                "question": question,
                "options": options if options else ["是", "否"],
                "type": "single",
            }

        return None

    def _render_brainstorm_card(self, question_data: dict):
        """在头脑风暴区域渲染单个问题卡片"""
        self._clear_brainstorm_cards()

        card = BrainstormCard(
            question_data,
            len(self._qa_history),
            self._brainstorm_container,
            on_option_selected=self._on_option_selected,
        )
        self._brainstorm_inner_layout.insertWidget(
            self._brainstorm_inner_layout.count() - 1, card
        )
        self._current_card = card

    def _on_option_selected(self, qindex: int, question: str, answers: list[str]):
        """用户选择答案后 → 记录历史 → 保存快照 → 发送下一轮"""
        if not self._is_planning:
            return

        # 记录本轮问答
        self._qa_history.append({
            "question": question,
            "answer": answers,
        })

        # 清除当前卡片
        self._clear_brainstorm_cards()
        self._refresh_preview()

        # 保存快照（问答历史变化）
        self._init_snapshot_manager()
        self._do_save_snapshot()

        # 发送下一轮
        self._send_brainstorm_round()

    def _handle_plan_complete(self, output: str):
        """处理规划完成信号"""
        self._is_planning = False
        self._clear_brainstorm_cards()

        # 提取最终规约（移除完成信号标记）
        final_spec = re.sub(r'===PLAN_COMPLETE===', '', output).strip()
        if not final_spec:
            final_spec = self._build_final_spec()

        self._planning_result = final_spec

        # 显示最终规约
        self._plan_result_area.setPlainText(final_spec)
        self._plan_result_area.setVisible(True)
        self._brainstorm_scroll.setVisible(False)

        self._brainstorm_status.setText(
            f"✅ 规划完成！共 {len(self._qa_history)} 轮问答"
        )
        self._brainstorm_status.setStyleSheet("color: #3fb950; font-size: 11px;")

        # 规划完成时保存最终快照
        self._init_snapshot_manager()
        self._do_save_snapshot()

        InfoBar.success(
            title="规划完成",
            content=f"经过 {len(self._qa_history)} 轮问答，任务规约已生成",
            orient=Qt.Orientation.Horizontal,
            isClosable=True,
            position=InfoBarPosition.TOP,
            duration=5000,
            parent=self,
        )

        self._reset_brainstorm_ui()

    def _build_final_spec(self) -> str:
        """根据问答历史构建最终规约"""
        task_desc = self._prompt_supplement.toPlainText().strip()
        expected = self._expected_supplement.toPlainText().strip()
        constraints = self._constraints_supplement.toPlainText().strip()

        parts = [
            "## 任务规划结果",
            "",
            f"**原始描述:** {task_desc}",
            "",
        ]
        if expected:
            parts.append(f"**预期成果:** {expected}")
            parts.append("")
        if constraints:
            parts.append(f"**约束条件:** {constraints}")
            parts.append("")

        parts.append("**规划决策（头脑风暴问答）:**")
        parts.append("")

        for i, qa in enumerate(self._qa_history):
            parts.append(f"### Q{i + 1}. {qa['question']}")
            for ans in qa.get("answer", []):
                parts.append(f"  - {ans}")
            parts.append("")

        parts.append("---")
        parts.append("*以上规划结果由 AI 生成，用户逐轮选择确认*")

        return "\n".join(parts)

    def _on_cancel_brainstorm(self):
        """取消当前头脑风暴"""
        self._is_planning = False
        if self._loop:
            self._loop.requestInterruption()
        self._clear_brainstorm_cards()
        self._brainstorm_status.setText("规划已取消")
        self._brainstorm_status.setStyleSheet("color: #d29922; font-size: 11px;")
        self._brainstorm_scroll.setVisible(True)
        self._plan_result_area.setVisible(False)
        self._reset_brainstorm_ui()

    def _reset_brainstorm_ui(self):
        """重置头脑风暴 UI 状态"""
        self._is_planning = False
        self._start_brainstorm_btn.setVisible(True)
        self._cancel_brainstorm_btn.setVisible(False)
        self._prompt_supplement.setReadOnly(False)
        self._expected_supplement.setReadOnly(False)
        self._constraints_supplement.setReadOnly(False)

    def _clear_brainstorm_cards(self):
        """清空所有头脑风暴卡片"""
        if self._current_card:
            self._current_card.setParent(None)
            self._current_card.deleteLater()
            self._current_card = None
