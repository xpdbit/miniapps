# -*- coding: utf-8 -*-
"""config_interface.py — 配置面板（提示词 / UI 主题 / Agent 设置 / 行为设置）"""
from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout,
                                QTextEdit, QTabWidget, QFrame)
from PyQt6.QtCore import Qt
from qfluentwidgets import (BodyLabel, CaptionLabel, StrongBodyLabel,
                              PrimaryPushButton, PushButton, SimpleCardWidget,
                              ComboBox, SpinBox, TextEdit, SwitchButton,
                              InfoBar, InfoBarPosition)

# ─── 默认提示词（直接硬编码，不依赖 loop_manager 导入） ───

_DEFAULT_EXPLORE = """/ulw-loop
请探索{project_filter}（忽略 plan/ 和 .git），发现需要改进的领域，生成 **粗粒度** 的任务提议。

重点关注：
- 需要修复一批相关文件的问题（如：某个模块的类型错误、API 路由缺少校验）
- 可以增加的一项独立功能（如：添加数据导出功能、新增筛选条件）
- 需要重构的模块（如：将某个组件拆分为更小的子组件）

**不要** 生成过于细节的任务（如修改单行代码、修复单个变量名、添加单条注释）。
每项提议应该至少涉及多个文件的修改或一项完整的功能。

将任务列表以 YAML 格式写入 state/proposed_tasks.yaml，格式如下：
```yaml
- id: 1
  description: 任务描述（粗粒度，涉及多个文件或完整功能）
  status: proposed
- id: 2
  description: 任务描述
  status: proposed
```

注意：仅写入 YAML 文件，不要执行任何任务，不要修改其他文件。

完成后请输出 ===TASK_DONE==="""

_DEFAULT_UPDATE = """/ulw-loop
以下是当前待审批任务列表：

{content}

请根据项目最新状态逐一检查每项：
- 已完成的任务标记 status: done
- 不再有效的任务标记 status: cancelled
- 需要调整描述的更新 description
- 可补充新任务（粗粒度：至少涉及多个文件或一项完整功能）

将更新后的完整列表写回 state/proposed_tasks.yaml（保持 YAML 格式）。
注意：仅更新 YAML 文件，不要执行任务。

完成后请输出 ===TASK_DONE==="""

_DEFAULT_EXECUTE = """/ulw-loop
请执行以下开发任务：

任务描述：{desc}

要求：
- 完成后，修改 state/approved_queue.yaml 中对应项的 status 为 done。
- 若遇到无法自动完成的错误，将 status 改为 error，并在 error 字段中附加原因。
- 若需追加新任务，写入 proposed_tasks.yaml（status: proposed，待人工审批）。
- 忽略 plan 文件夹。

完成后请输出 ===TASK_DONE==="""


class ConfigInterface(QWidget):
    """配置页面 — 管理 SuperTask 所有可配置项"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._on_save_cb = None
        self._config: dict = {}
        self._setup_ui()

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(16)

        # 标题行
        title_row = QHBoxLayout()
        title_row.addWidget(BodyLabel("配置"))
        title_row.addStretch()
        self._save_btn = PrimaryPushButton("保存配置", self)
        self._reset_btn = PushButton("恢复默认", self)
        title_row.addWidget(self._reset_btn)
        title_row.addWidget(self._save_btn)
        layout.addLayout(title_row)

        # ── Tab 控件 ──
        _TAB_STYLE = """
            QTabWidget::pane {
                border: 1px solid #30363d; border-radius: 8px;
                background: #0d1117; padding: 4px;
            }
            QTabBar::tab {
                color: #8b949e; background: #161b22;
                padding: 8px 20px;
                border: 1px solid #30363d; border-bottom: none;
                border-top-left-radius: 6px; border-top-right-radius: 6px;
                margin-right: 2px;
                font-size: 13px;
            }
            QTabBar::tab:selected {
                color: #e6edf3; background: #0d1117;
                border-bottom: 1px solid #0d1117;
            }
            QTabBar::tab:hover:!selected { color: #c9d1d9; }
        """

        self._tabs = QTabWidget(self)
        self._tabs.setStyleSheet(_TAB_STYLE)

        # ── Tab 1: 提示词 ──
        prompt_tab = QWidget()
        prompt_layout = QVBoxLayout(prompt_tab)
        prompt_layout.setContentsMargins(16, 16, 16, 16)
        prompt_layout.setSpacing(8)

        prompt_hint = CaptionLabel(
            "自定义各阶段的 prompt。内容留空时使用代码内置默认值。"
        )
        prompt_hint.setStyleSheet("color: #484f58; font-size: 11px;")
        prompt_layout.addWidget(prompt_hint)

        _PROMPT_STYLE = """
            TextEdit {
                background-color: #0d1117; color: #c9d1d9;
                border: 1px solid #30363d; border-radius: 6px;
                padding: 8px;
                font-family: Consolas, "Microsoft YaHei", monospace;
                font-size: 11px;
            }
        """

        prompt_layout.addWidget(CaptionLabel("探索提议（PROMPT_EXPLORE）"))
        self._prompt_explore = TextEdit(self)
        self._prompt_explore.setPlaceholderText(
            "默认：浏览仓库生成粗粒度任务提议 → 写入 proposed_tasks.yaml"
        )
        self._prompt_explore.setMinimumHeight(100)
        self._prompt_explore.setStyleSheet(_PROMPT_STYLE)
        prompt_layout.addWidget(self._prompt_explore, stretch=1)

        prompt_layout.addWidget(CaptionLabel("更新待审批（PROMPT_UPDATE）"))
        self._prompt_update = TextEdit(self)
        self._prompt_update.setPlaceholderText(
            "默认：检查待审批列表，标记 done/cancelled，补充新任务"
        )
        self._prompt_update.setMinimumHeight(100)
        self._prompt_update.setStyleSheet(_PROMPT_STYLE)
        prompt_layout.addWidget(self._prompt_update, stretch=1)

        prompt_layout.addWidget(CaptionLabel("执行任务（PROMPT_EXECUTE）"))
        self._prompt_execute = TextEdit(self)
        self._prompt_execute.setPlaceholderText(
            "默认：执行开发任务，完成后更新 approved_queue.yaml（{desc} 占位符）"
        )
        self._prompt_execute.setMinimumHeight(100)
        self._prompt_execute.setStyleSheet(_PROMPT_STYLE)
        prompt_layout.addWidget(self._prompt_execute, stretch=1)

        self._tabs.addTab(prompt_tab, "提示词")

        # ── Tab 2: 通用设置 ──
        settings_tab = QWidget()
        settings_layout = QVBoxLayout(settings_tab)
        settings_layout.setContentsMargins(16, 16, 16, 16)
        settings_layout.setSpacing(0)

        # ── 辅助函数 ──

        def _section_header(text: str) -> CaptionLabel:
            """节标题：蓝色小字，分组标识"""
            label = CaptionLabel(text)
            label.setStyleSheet(
                "color: #58a6ff; font-size: 11px; font-weight: bold;"
                " padding: 2px 0 4px 0;"
            )
            return label

        def _form_label(text: str) -> CaptionLabel:
            """表单行标签：固定宽度，右对齐灰色文字"""
            label = CaptionLabel(text)
            label.setFixedWidth(80)
            label.setAlignment(
                Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter
            )
            label.setStyleSheet("color: #8b949e; font-size: 13px;")
            return label

        def _form_separator() -> QFrame:
            """分组之间的细分隔线"""
            sep = QFrame(self)
            sep.setFrameShape(QFrame.Shape.HLine)
            sep.setStyleSheet("background-color: #21262d; max-height: 1px; margin: 4px 0;")
            return sep

        # ── 统一设置卡片 ──
        settings_card = SimpleCardWidget(self)
        settings_card.setBorderRadius(8)
        form_layout = QVBoxLayout(settings_card)
        form_layout.setContentsMargins(24, 20, 24, 20)
        form_layout.setSpacing(14)

        # ── 界面设置 ──
        form_layout.addWidget(_section_header("界面"))
        theme_row = QHBoxLayout()
        theme_row.setSpacing(12)
        theme_row.addWidget(_form_label("主题"))
        self._theme_combo = ComboBox(self)
        self._theme_combo.addItems(["深色模式 (Dark)", "浅色模式 (Light)"])
        self._theme_combo.setCurrentIndex(0)
        self._theme_combo.setMinimumWidth(200)
        theme_row.addWidget(self._theme_combo)
        theme_row.addStretch()
        form_layout.addLayout(theme_row)

        form_layout.addWidget(_form_separator())

        # ── Agent 设置 ──
        form_layout.addWidget(_section_header("Agent"))
        timeout_row = QHBoxLayout()
        timeout_row.setSpacing(12)
        timeout_row.addWidget(_form_label("超时时间"))
        self._timeout_spin = SpinBox(self)
        self._timeout_spin.setRange(60, 3600)
        self._timeout_spin.setValue(600)
        self._timeout_spin.setSuffix(" 秒")
        self._timeout_spin.setMinimumWidth(160)
        timeout_row.addWidget(self._timeout_spin)
        timeout_row.addStretch()
        form_layout.addLayout(timeout_row)

        form_layout.addWidget(_form_separator())

        # ── 行为设置 ──
        form_layout.addWidget(_section_header("行为"))

        # 自动 Git 推送
        push_row = QHBoxLayout()
        push_row.setSpacing(12)
        push_row.addWidget(_form_label("自动推送"))
        self._auto_push_switch = SwitchButton(self)
        self._auto_push_switch.setChecked(False)
        push_row.addWidget(self._auto_push_switch)
        push_hint = CaptionLabel("完成后自动 git push")
        push_hint.setStyleSheet("color: #484f58; font-size: 12px;")
        push_row.addWidget(push_hint)
        push_row.addStretch()
        form_layout.addLayout(push_row)

        # 轮次间隔
        cycle_row = QHBoxLayout()
        cycle_row.setSpacing(12)
        cycle_row.addWidget(_form_label("轮次间隔"))
        self._cycle_spin = SpinBox(self)
        self._cycle_spin.setRange(1, 120)
        self._cycle_spin.setValue(5)
        self._cycle_spin.setSuffix(" 秒")
        self._cycle_spin.setMinimumWidth(160)
        cycle_row.addWidget(self._cycle_spin)
        cycle_row.addStretch()
        form_layout.addLayout(cycle_row)

        # 最大重试
        retry_row = QHBoxLayout()
        retry_row.setSpacing(12)
        retry_row.addWidget(_form_label("最大重试"))
        self._retry_spin = SpinBox(self)
        self._retry_spin.setRange(1, 10)
        self._retry_spin.setValue(2)
        self._retry_spin.setSuffix(" 次")
        self._retry_spin.setMinimumWidth(160)
        retry_row.addWidget(self._retry_spin)
        retry_row.addStretch()
        form_layout.addLayout(retry_row)

        settings_layout.addWidget(settings_card)
        settings_layout.addStretch()
        self._tabs.addTab(settings_tab, "通用设置")

        layout.addWidget(self._tabs)

        # 连接信号
        self._save_btn.clicked.connect(self._on_save)
        self._reset_btn.clicked.connect(self._on_reset)

    def set_config(self, config: dict):
        """加载配置到 UI。未配置的提示词字段显示默认内容（留空 = 使用代码内置默认值）。"""
        self._config = config

        # 提示词：空字符串 = 使用代码默认值，但 UI 中展示默认内容供参考
        prompts = config.get("prompts", {})
        self._prompt_explore.setPlainText(
            prompts.get("explore") or _DEFAULT_EXPLORE
        )
        self._prompt_update.setPlainText(
            prompts.get("update_proposed") or _DEFAULT_UPDATE
        )
        self._prompt_execute.setPlainText(
            prompts.get("execute") or _DEFAULT_EXECUTE
        )

        # UI
        ui = config.get("ui", {})
        theme = ui.get("theme", "dark")
        self._theme_combo.setCurrentIndex(0 if theme == "dark" else 1)

        # Agent
        agent = config.get("agent", {})
        self._timeout_spin.setValue(agent.get("timeout", 600))

        # 行为
        behavior = config.get("behavior", {})
        self._auto_push_switch.setChecked(behavior.get("auto_push", False))
        self._cycle_spin.setValue(behavior.get("cycle_interval", 5))
        self._retry_spin.setValue(behavior.get("max_retries", 2))

    def get_config(self) -> dict:
        """从 UI 收集配置。内容与默认值相同时存空字符串（由 loop_manager 使用代码内置默认值）。"""
        explore = self._prompt_explore.toPlainText().strip()
        update = self._prompt_update.toPlainText().strip()
        execute = self._prompt_execute.toPlainText().strip()
        return {
            "prompts": {
                "explore": "" if explore == _DEFAULT_EXPLORE else explore,
                "update_proposed": "" if update == _DEFAULT_UPDATE else update,
                "execute": "" if execute == _DEFAULT_EXECUTE else execute,
            },
            "ui": {
                "theme": "dark" if self._theme_combo.currentIndex() == 0 else "light",
            },
            "agent": {
                "timeout": self._timeout_spin.value(),
            },
            "behavior": {
                "auto_push": self._auto_push_switch.isChecked(),
                "cycle_interval": self._cycle_spin.value(),
                "max_retries": self._retry_spin.value(),
            },
        }

    def set_on_save(self, callback):
        """注册保存回调：callback(config_dict)"""
        self._on_save_cb = callback

    def _on_save(self):
        """保存配置"""
        config = self.get_config()
        if self._on_save_cb:
            self._on_save_cb(config)
        InfoBar.success(
            title="配置已保存",
            content="新配置将在下次启动时生效。提示词修改即时生效。",
            orient=Qt.Orientation.Horizontal,
            isClosable=True,
            position=InfoBarPosition.TOP,
            duration=3000,
            parent=self,
        )

    def _on_reset(self):
        """恢复默认配置"""
        from gui.core.file_manager import FileManager
        default = dict(FileManager.DEFAULT_CONFIG)
        self.set_config(default)
        if self._on_save_cb:
            self._on_save_cb(default)
        InfoBar.info(
            title="已恢复默认",
            content="配置已重置为默认值。",
            orient=Qt.Orientation.Horizontal,
            isClosable=True,
            position=InfoBarPosition.TOP,
            duration=2000,
            parent=self,
        )
