# -*- coding: utf-8 -*-
"""task_plan_interface.py — AI 驱动的任务规划界面
左：输入描述 + 开始规划按钮 + 规划结果
右：AI 生成的多选问题卡片
"""
import re
import yaml

from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QFrame,
                               QTextEdit, QSplitter, QScrollArea,
                               QButtonGroup, QRadioButton, QCheckBox,
                               QSizePolicy)
from PyQt6.QtCore import Qt
from qfluentwidgets import (BodyLabel, PrimaryPushButton, PushButton,
                              SimpleCardWidget, StrongBodyLabel, CaptionLabel,
                              InfoBar, InfoBarPosition)


class QuestionCard(SimpleCardWidget):
    """单个规划问题卡片：问题文本 + 选项按钮组"""

    def __init__(self, question_data: dict, index: int, parent=None,
                 on_selection_changed=None):
        super().__init__(parent)
        self._index = index
        self._question = question_data.get("question", "")
        self._options = question_data.get("options", [])
        self._qtype = question_data.get("type", "single")  # single | multi
        self._selected: list[int] = []
        self._buttons: list = []  # QRadioButton or QCheckBox
        self._on_selection_changed = on_selection_changed  # parent callback

        self.setBorderRadius(8)
        self.setMinimumHeight(100)
        self.setStyleSheet("""
            SimpleCardWidget {
                background-color: #161b22;
                border: 1px solid #30363d;
                border-radius: 8px;
            }
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 12, 16, 12)
        layout.setSpacing(8)

        # 问题文本
        q_label = StrongBodyLabel(f"Q{index + 1}. {self._question}")
        q_label.setStyleSheet("color: #e6edf3; font-size: 14px;")
        q_label.setWordWrap(True)
        layout.addWidget(q_label)

        # 选项按钮组
        self._button_group = QButtonGroup(self)
        self._button_group.setExclusive(self._qtype == "single")

        options_layout = QVBoxLayout()
        options_layout.setSpacing(4)

        for i, opt in enumerate(self._options):
            row = QHBoxLayout()
            row.setSpacing(6)

            if self._qtype == "multi":
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
                    width: 16px;
                    height: 16px;
                    border: 2px solid #30363d;
                    border-radius: 8px;
                    background: #0d1117;
                }
                QCheckBox::indicator {
                    width: 16px;
                    height: 16px;
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
            options_layout.addLayout(row)

        layout.addLayout(options_layout)

    def _on_option_toggled(self, idx: int, checked: bool):
        if self._qtype == "single":
            if checked:
                self._selected = [idx]
        else:
            if checked:
                if idx not in self._selected:
                    self._selected.append(idx)
            else:
                if idx in self._selected:
                    self._selected.remove(idx)
        # 通知父组件选择变化
        if self._on_selection_changed:
            self._on_selection_changed()

    def get_selected(self) -> list[int]:
        return sorted(self._selected)

    def get_selected_texts(self) -> list[str]:
        return [self._options[i] for i in self.get_selected() if 0 <= i < len(self._options)]


class TaskPlanInterface(QWidget):
    """AI 驱动的任务规划界面"""

    _PLANNER_PROMPT = """你是一个任务规划专家。用户输入了一个高级任务描述，请生成 3-5 个关键规划问题，
每个问题提供 2-4 个选项，帮助明确任务方向和实现细节。

用户输入: {user_input}

以 YAML 格式返回（不要包含 markdown 代码块标记）：
questions:
  - question: "问题描述"
    options:
      - 选项A的描述
      - 选项B的描述
      - 选项C的描述
    type: single
  - question: "下一个问题"
    options:
      - 选项1
      - 选项2
    type: multi

完成后请输出 ===TASK_DONE===
"""

    def __init__(self, parent=None, loop_manager=None):
        super().__init__(parent)
        self._loop = loop_manager
        self._questions: list[dict] = []
        self._cards: list[QuestionCard] = []
        self._planning_result: str = ""

        self._setup_ui()

    def set_loop_manager(self, loop_manager):
        """设置 LoopManager 引用（供 app.py 注入）"""
        self._loop = loop_manager

    def _setup_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(16, 16, 16, 16)
        main_layout.setSpacing(12)

        # 标题栏
        title_row = QHBoxLayout()
        title_row.addWidget(BodyLabel("任务规划"))
        title_row.addStretch()
        self._clear_btn = PushButton("清空")
        self._clear_btn.clicked.connect(self._clear_all)
        title_row.addWidget(self._clear_btn)
        main_layout.addLayout(title_row)

        # 水平分割：左输入 | 右问答
        self._splitter = QSplitter(Qt.Orientation.Horizontal, self)

        # ═══ 左侧：输入区 ═══
        left_w = QWidget()
        left_layout = QVBoxLayout(left_w)
        left_layout.setContentsMargins(0, 0, 8, 0)
        left_layout.setSpacing(8)

        left_layout.addWidget(StrongBodyLabel("📝 任务描述"))
        left_layout.addWidget(CaptionLabel(
            "输入高级任务描述，AI 将生成规划问题引导您细化需求"
        ))

        self._input_edit = QTextEdit()
        self._input_edit.setPlaceholderText(
            "例如：为 Dashboard 添加数据导出功能，支持 CSV 和 Excel 格式..."
        )
        self._input_edit.setStyleSheet("""
            QTextEdit {
                background-color: #0d1117;
                color: #c9d1d9;
                border: 1px solid #30363d;
                border-radius: 8px;
                padding: 8px;
                font-size: 13px;
                font-family: "Microsoft YaHei", sans-serif;
            }
            QTextEdit:focus {
                border-color: #58a6ff;
            }
        """)
        self._input_edit.setMinimumHeight(120)
        left_layout.addWidget(self._input_edit)

        self._start_btn = PrimaryPushButton("🚀 开始规划")
        self._start_btn.clicked.connect(self._on_start_plan)
        left_layout.addWidget(self._start_btn)

        # 取消按钮（初始隐藏，规划进行时显示）
        self._cancel_btn = PushButton("⏹ 取消规划")
        self._cancel_btn.setVisible(False)
        self._cancel_btn.clicked.connect(self._on_cancel_plan)
        self._cancel_btn.setStyleSheet("""
            QPushButton {
                color: #f85149;
                border-color: #f85149;
            }
            QPushButton:hover {
                background-color: rgba(248, 81, 73, 0.15);
            }
        """)
        left_layout.addWidget(self._cancel_btn)

        # 分隔线
        left_layout.addSpacing(8)
        sep = self._make_separator()
        left_layout.addWidget(sep)
        left_layout.addSpacing(8)

        left_layout.addWidget(StrongBodyLabel("📋 规划结果"))

        self._result_edit = QTextEdit()
        self._result_edit.setReadOnly(True)
        self._result_edit.setPlaceholderText("选择完所有问题后将在此显示最终任务规约...")
        self._result_edit.setStyleSheet("""
            QTextEdit {
                background-color: #0d1117;
                color: #e6edf3;
                border: 1px solid #30363d;
                border-radius: 8px;
                padding: 8px;
                font-size: 13px;
                font-family: Consolas, "Microsoft YaHei", monospace;
            }
        """)
        left_layout.addWidget(self._result_edit, 1)

        self._splitter.addWidget(left_w)

        # ═══ 右侧：问题卡片区 ═══
        right_w = QWidget()
        right_layout = QVBoxLayout(right_w)
        right_layout.setContentsMargins(8, 0, 0, 0)
        right_layout.setSpacing(8)

        right_header = QHBoxLayout()
        right_header.addWidget(StrongBodyLabel("❓ 规划问题"))
        right_header.addStretch()
        self._submit_btn = PrimaryPushButton("✓ 确认选择")
        self._submit_btn.clicked.connect(self._on_submit)
        right_header.addWidget(self._submit_btn)
        right_layout.addLayout(right_header)

        self._status_label = CaptionLabel(
            "输入任务描述并点击「开始规划」以生成问题"
        )
        self._status_label.setStyleSheet("color: #484f58; font-size: 11px;")
        right_layout.addWidget(self._status_label)

        # 可滚动卡片区
        self._scroll_area = QScrollArea()
        self._scroll_area.setWidgetResizable(True)
        self._scroll_area.setStyleSheet("""
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
        """)

        self._cards_container = QWidget()
        self._cards_layout = QVBoxLayout(self._cards_container)
        self._cards_layout.setContentsMargins(0, 0, 0, 0)
        self._cards_layout.setSpacing(12)
        self._cards_layout.addStretch()

        self._scroll_area.setWidget(self._cards_container)
        right_layout.addWidget(self._scroll_area, 1)

        self._splitter.addWidget(right_w)
        self._splitter.setSizes([400, 500])

        main_layout.addWidget(self._splitter, 1)

        # 初始化禁用提交按钮
        self._submit_btn.setEnabled(False)

    @staticmethod
    def _make_separator():
        sep = QFrame()
        sep.setFrameShape(QFrame.Shape.HLine)
        sep.setStyleSheet("color: #30363d;")
        return sep

    # ─── 规划流程 ─────────────────────────

    def _on_start_plan(self):
        """点击开始规划 → 调用 LoopManager 的 trigger_plan"""
        user_input = self._input_edit.toPlainText().strip()
        if not user_input:
            InfoBar.warning(
                title="输入为空",
                content="请先输入任务描述再开始规划",
                orient=Qt.Orientation.Horizontal,
                isClosable=True,
                position=InfoBarPosition.TOP,
                duration=3000,
                parent=self,
            )
            return

        self._start_btn.setEnabled(False)
        self._start_btn.setVisible(False)
        self._cancel_btn.setVisible(True)
        self._start_btn.setText("⏳ 规划中...")
        self._status_label.setText("正在与 AI 沟通，生成规划问题...")
        self._status_label.setStyleSheet("color: #d29922; font-size: 11px;")
        self._clear_cards()

        prompt = self._PLANNER_PROMPT.format(user_input=user_input)

        if self._loop:
            self._loop.trigger_plan(prompt, self._on_plan_result)
        else:
            self._status_label.setText("错误：未连接到 LoopManager")
            self._status_label.setStyleSheet("color: #f85149; font-size: 11px;")
            self._start_btn.setEnabled(True)
            self._start_btn.setText("🚀 开始规划")

    def _on_plan_result(self, output: str):
        """AI 返回结果后的回调（在后台线程中调用，通过 QTimer 回到主线程）"""
        from PyQt6.QtCore import QTimer
        QTimer.singleShot(0, lambda: self._process_plan_result(output))

    def _process_plan_result(self, output: str):
        """在主线程中处理 AI 返回的规划结果"""
        self._reset_plan_ui()

        if not output:
            self._status_label.setText("规划失败：AI 未返回结果")
            self._status_label.setStyleSheet("color: #f85149; font-size: 11px;")
            return

        # 解析 YAML
        questions = self._parse_questions(output)
        if not questions:
            self._status_label.setText("规划失败：无法解析 AI 返回的问题列表。请检查 AI 输出格式。")
            self._status_label.setStyleSheet("color: #f85149; font-size: 11px;")
            return

        self._questions = questions
        self._render_cards()
        self._status_label.setText(f"已生成 {len(questions)} 个规划问题，请选择选项")
        self._status_label.setStyleSheet("color: #3fb950; font-size: 11px;")
        # 提交按钮初始禁用，待用户选择后启用
        self._check_submit_enabled()

    def _parse_questions(self, text: str) -> list[dict]:
        """从 AI 输出文本中解析 questions YAML"""
        # 移除非 YAML 内容（完成信号、markdown 标记等）
        text = re.sub(r'===TASK_DONE===', '', text)
        text = re.sub(r'```yaml|```', '', text)

        # 尝试提取 questions 列表
        try:
            data = yaml.safe_load(text)
            if isinstance(data, dict) and "questions" in data:
                return data["questions"]
            if isinstance(data, list):
                return data
        except yaml.YAMLError:
            pass

        # 回退：尝试找 "questions:" 行并解析
        match = re.search(r'questions:\s*\n((?:\s+-.+\n?)+)', text, re.MULTILINE)
        if match:
            try:
                data = yaml.safe_load("questions:\n" + match.group(1))
                if isinstance(data, dict) and "questions" in data:
                    return data["questions"]
            except yaml.YAMLError:
                pass

        return []

    # ─── 卡片渲染 ─────────────────────────

    def _clear_cards(self):
        """清空所有问题卡片"""
        for card in self._cards:
            card.setParent(None)
            card.deleteLater()
        self._cards.clear()
        self._questions.clear()
        self._submit_btn.setEnabled(False)
        self._result_edit.clear()

    def _clear_all(self):
        """清空所有状态"""
        self._input_edit.clear()
        self._clear_cards()
        self._reset_plan_ui()
        self._status_label.setText(
            "输入任务描述并点击「开始规划」以生成问题"
        )
        self._status_label.setStyleSheet("color: #484f58; font-size: 11px;")

    def _render_cards(self):
        """根据 self._questions 渲染问题卡片到右侧可滚动区域"""
        self._clear_cards()

        for i, q_data in enumerate(self._questions):
            card = QuestionCard(q_data, i, self._cards_container,
                               on_selection_changed=self._check_submit_enabled)
            self._cards_layout.insertWidget(
                self._cards_layout.count() - 1, card  # 插入到 stretch 之前
            )
            self._cards.append(card)

    def _check_submit_enabled(self):
        """检查是否所有问题都已有选择，决定提交按钮状态"""
        all_ready = self._cards and all(
            card.get_selected() for card in self._cards
        )
        self._submit_btn.setEnabled(all_ready)

    def _on_cancel_plan(self):
        """取消当前规划操作"""
        if self._loop:
            self._loop.requestInterruption()
        self._reset_plan_ui()
        self._status_label.setText("规划已取消")
        self._status_label.setStyleSheet("color: #d29922; font-size: 11px;")

    def _reset_plan_ui(self):
        """重置规划 UI 状态"""
        self._start_btn.setVisible(True)
        self._start_btn.setEnabled(True)
        self._start_btn.setText("🚀 开始规划")
        self._cancel_btn.setVisible(False)

    # ─── 提交选择 ─────────────────────────

    def _on_submit(self):
        """用户确认选择 → 生成最终任务规约"""
        if not self._questions or not self._cards:
            return

        all_selected = True
        result_parts = []

        for i, card in enumerate(self._cards):
            selected = card.get_selected_texts()
            question = self._questions[i].get("question", f"问题{i + 1}")

            if not selected:
                all_selected = False
                result_parts.append(f"### Q{i + 1}. {question}\n⚠️ 未选择\n")
            else:
                choices = "\n".join(f"  - {s}" for s in selected)
                result_parts.append(f"### Q{i + 1}. {question}\n{choices}\n")

        if not all_selected:
            InfoBar.warning(
                title="未完成选择",
                content="请为所有问题选择至少一个选项",
                orient=Qt.Orientation.Horizontal,
                isClosable=True,
                position=InfoBarPosition.TOP,
                duration=3000,
                parent=self,
            )
            return

        # 构建最终规约
        task_desc = self._input_edit.toPlainText().strip()
        result = f"## 任务规划结果\n\n**原始描述:** {task_desc}\n\n**规划决策:**\n\n"
        result += "\n".join(result_parts)
        result += "\n---\n*以上规划结果由 AI 生成，用户选择确认*"

        self._result_edit.setPlainText(result)
        self._planning_result = result

        InfoBar.success(
            title="规划完成",
            content="任务规约已生成，请查看左侧结果面板",
            orient=Qt.Orientation.Horizontal,
            isClosable=True,
            position=InfoBarPosition.TOP,
            duration=3000,
            parent=self,
        )



