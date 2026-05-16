# -*- coding: utf-8 -*-
"""config_interface.py — 配置面板（提示词 / UI 主题 / Agent 设置 / 行为设置）"""
import os
from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout,
                                QTextEdit, QTabWidget, QFrame,
                                QListWidget, QLineEdit, QPushButton,
                                QMessageBox, QAbstractItemView, QComboBox)
from PyQt6.QtCore import Qt, QSize
from PyQt6.QtGui import QIcon
from qfluentwidgets import (BodyLabel, CaptionLabel, StrongBodyLabel,
                              PrimaryPushButton, PushButton, SimpleCardWidget,
                              ComboBox, SpinBox, TextEdit, SwitchButton,
                              InfoBar, InfoBarPosition, FluentIcon as FIF)

# ─── 图标路径 ───
_ARROW_SVG = os.path.join(os.path.dirname(__file__), '..', '..', 'resources', 'down_arrow.svg').replace('\\', '/')
_SYNC_SVG = os.path.join(os.path.dirname(__file__), '..', '..', 'resources', 'sync.svg').replace('\\', '/')

# 从 opencode_runner 获取可用模型列表
try:
    from gui.core.opencode_runner import get_available_models
except ImportError:
    def get_available_models(force_refresh=False):
        return []

# ─── 默认提示词（直接硬编码，不依赖 loop_manager 导入） ───

_DEFAULT_EXPLORE = """/ulw-loop
请探索{project_filter}（忽略 plan/ 和 .git），发现需要改进的领域，生成 **粗粒度** 的任务提议。

重点关注：
- 需要修复一批相关文件的问题（如：某个模块的类型错误、API 路由缺少校验）
- 可以增加的一项独立功能（如：添加数据导出功能、新增筛选条件）
- 需要重构的模块（如：将某个组件拆分为更小的子组件）

**不要** 生成过于细节的任务（如修改单行代码、修复单个变量名、添加单条注释）。
每项提议应该至少涉及多个文件的修改或一项完整的功能。

## 优先级分配规则
| 优先级 | 含义 | 适用场景 |
|--------|------|----------|
| fix P0 | 最高 | 安全漏洞、数据丢失、线上崩溃 |
| fix P1 | 高 | 功能缺陷、用户体验严重受损 |
| fix P2 | 中 | 类型错误、轻微功能问题 |
| fix P3 | 低 | 代码风格、轻微优化、注释缺失 |
| idea | 点子 | 新功能提议、改进想法 |

将任务列表以 YAML 格式写入 state/proposed_tasks.yaml，格式如下：
```yaml
- id: 1
  description: 任务描述（粗粒度，涉及多个文件或完整功能）
  priority: fix P3
  status: proposed
- id: 2
  description: 任务描述
  priority: idea
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

## 🚫 严禁事项（违反会导致 opencode 终止会话）
- ❌ 输出纯文本等待消息
- ❌ 输出任何不含 tool call 的纯文本段落
- ✅ 每一条文本输出之后，必须立即跟随至少一个 tool call

完成后请输出 ===TASK_DONE===
"""

_DEFAULT_EXECUTE = """/ulw-loop
请执行以下开发任务：

任务描述：{desc}

要求：
- 完成后，修改 state/approved_queue.yaml 中对应项的 status 为 done。
- 若遇到无法自动完成的错误，将 status 改为 error，并在 error 字段中附加原因。
- 若需追加新任务，写入 proposed_tasks.yaml（status: proposed，待人工审批）。
- 忽略 plan 文件夹。

## 🔄 后台子任务等待策略
如果派出了后台子任务，必须用 background_output 轮询，不要输出等待文本：
- ✅ 正确：直接调用 background_output(task_id="xxx") 检查结果
- ❌ 错误：输出 "waiting...", "<!-- 等待 -->", "正在等待...", 或任何不含 tool call 的纯文本

## 🚫 严禁事项（违反会导致 opencode 终止会话）
- ❌ 输出纯文本等待消息
- ❌ 输出任何不含 tool call 的纯文本段落
- ✅ 每一条文本输出之后，必须立即跟随至少一个 tool call

完成后请输出 ===TASK_DONE===
"""

_DEFAULT_EVALUATE = """/ulw-loop
你是一个高级代码审查专家。请对以下 AI 生成的待审批任务提议进行二次评估。

{content}

## 评估标准

对每条提议逐一评估：

### 1. 真实性验证
- 提议描述的问题是否在代码库中真实存在？
- 引用的文件路径和行号是否准确？
- 如果无法确认，标注为"待验证"

### 2. 优先级重评
- 原优先级是否合理？请根据实际影响重新判断
- fix P0: 安全漏洞、数据丢失、线上崩溃
- fix P1: 功能缺陷、用户体验严重受损
- fix P2: 类型错误、轻微功能问题
- fix P3: 代码风格、轻微优化、注释缺失
- idea: 新功能提议

### 3. 同类合并
- 如果多条提议本质上是同一类问题，合并为一条
- 合并后的提议描述应汇总所有涉及的文件

### 4. 修复难度预估
- 为每条保留的提议添加 estimated_effort 字段: quick(<5min) / normal(5-20min) / heavy(>20min)

## 输出要求
将评估结果写回 state/proposed_tasks.yaml：
- 移除确认为假阳性的提议
- 合并同类项
- 调整优先级
- 添加 verified: true/false/unknown 字段

注意：仅更新 YAML 文件，不要执行任何任务，不要修改代码文件。

完成后请输出 ===TASK_DONE===
"""

_DEFAULT_VERIFY = """/ulw-loop
你是一个代码审查专家。请检查以下已完成任务的成果实现情况：

{tasks}

## 检查步骤
对每项已完成的任务：
1. 阅读任务的 description 字段，准确理解任务的原始要求
2. 在代码库中搜索任务描述涉及的模块、文件、功能或修复
3. 仔细验证该功能/修复是否已实际存在于代码库中
4. 判断实现是否完整、有无遗漏、是否存在缺陷或漏洞

## 判定标准
- 已验证通过: 任务描述的功能已完整、正确地实现在代码库中
- 需要修补: 实现不完整、有严重遗漏、存在缺陷或安全漏洞

## 修补任务要求
对于标记为"需要修补"的任务，请在 state/approved_queue.yaml 中新增修补任务项：
- description 格式: "【修补】{原任务描述摘要} — {发现的具体问题}"
- status: "pending"
- priority: "fix P1"

注意：仅更新 YAML 文件，不要执行任何任务，不要修改代码文件。

完成后请输出 ===TASK_DONE===
"""

_DEFAULT_CHECK_FIX = """/ulw-loop
你是一个代码质量专家。请对 {project_label} 项目进行全面检查和自动修复：

源目录: {source_dirs}
排除: {exclude_dirs}

## 检查项目
1. TypeScript 类型检查 — 对每个目录运行 npm run type-check，修复所有错误
2. ESLint 检查 — 对每个目录运行 npm run lint，修复所有错误
3. 空 catch 块 — 搜索并修复所有空的 catch(e) {} 块
4. 硬编码密钥 — 搜索 .env、密码、API Key 等敏感信息
5. console.log 残留 — 将调试用的 console.log 替换为日志框架
6. as any 类型断言 — 搜索并修复所有 as any 类型断言
7. 未使用的 import — 清理未使用的 import 语句
8. Prettier 格式化 — 确保代码格式一致

## 输出要求
完成后输出简短总结：检查了多少文件 / 修复了多少问题 / 有哪些无法自动修复

然后输出 ===TASK_DONE===
"""

_DEFAULT_DEPLOY = """/ulw-loop
请执行部署操作：将当前项目部署到远程服务器（ECS）。

执行部署脚本 deploy/scripts/deploy.sh 或 deploy_remote.bat（取决于平台）。

## 要求
1. 确认部署脚本存在于项目根目录
2. 执行部署命令
3. 等待部署完成（流式输出部署日志）
4. 报告部署结果（成功/失败）

完成后请输出 ===TASK_DONE===
"""

_DEFAULT_FINISH = """请更新项目文档：
- 更新根目录 AGENTS.md（反映最新的项目结构和代码变更）
- 更新 docs/ 中相关文件
- 忽略 plan 文件夹

然后执行 Git 推送（如配置了自动推送）。"""


class ConfigInterface(QWidget):
    """配置页面 — 管理 SuperTask 所有可配置项"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._on_save_cb = None
        self._config: dict = {}
        self._dirty: bool = False      # 配置是否已修改但未保存
        self._loading: bool = False    # 正在加载配置（忽略变更信号）
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

        # ── 未保存变更提醒横幅（默认隐藏） ──
        self._dirty_banner = QFrame(self)
        self._dirty_banner.setStyleSheet("""
            QFrame {
                background-color: #1a2332;
                border: 1px solid #58a6ff;
                border-radius: 8px;
                padding: 10px 16px;
            }
        """)
        self._dirty_banner.setVisible(False)
        banner_layout = QHBoxLayout(self._dirty_banner)
        banner_layout.setContentsMargins(0, 0, 0, 0)
        banner_label = CaptionLabel("⚠ 配置已修改，请点击「保存配置」以应用更改")
        banner_label.setStyleSheet("color: #58a6ff; font-size: 13px; border: none;")
        banner_layout.addWidget(banner_label)
        banner_layout.addStretch()
        banner_save_btn = PrimaryPushButton("立即保存")
        banner_save_btn.setFixedWidth(100)
        banner_save_btn.clicked.connect(self._on_save)
        banner_layout.addWidget(banner_save_btn)
        layout.addWidget(self._dirty_banner)

        # ── Tab 控件（Edge 风格 pill 标签） ──
        _TAB_STYLE = """
            QTabWidget::pane {
                border: 1px solid #30363d; border-radius: 10px;
                background: #0d1117; padding: 6px 4px 4px 4px;
                top: -1px;
            }
            QTabBar::tab {
                color: #8b949e; background: transparent;
                border: 1px solid transparent; border-radius: 20px;
                padding: 8px 22px; margin: 0px 3px;
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
        """

        self._tabs = QTabWidget(self)
        self._tabs.setStyleSheet(_TAB_STYLE)

        # ── Tab 1: 通用设置 ──
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
        self._timeout_spin.setValue(1200)
        self._timeout_spin.setSuffix(" 秒")
        self._timeout_spin.setMinimumWidth(160)
        timeout_row.addWidget(self._timeout_spin)
        timeout_row.addStretch()
        form_layout.addLayout(timeout_row)

        # 默认模型
        model_row = QHBoxLayout()
        model_row.setSpacing(12)
        model_row.addWidget(_form_label("默认模型"))
        self._model_combo = QComboBox(self)
        # 从 opencode 配置动态读取模型列表
        _available_models = get_available_models()
        self._model_combo.addItems(
            ["（不使用默认模型）"] + _available_models
            if _available_models else
            [
                "（不使用默认模型）",
                "deepseek-v4-pro",
                "deepseek-v4-flash",
                "opencode-go/deepseek-v4-flash",
                "minimax-cn/MiniMax-M2.7",
            ]
        )
        self._model_combo.setCurrentIndex(0)
        self._model_combo.setMinimumWidth(240)
        self._model_combo.setEditable(True)
        self._model_combo.setToolTip("手动输入模型名或从预设中选择（留空=跟随 opencode 自动选择）")
        self._model_combo.setStyleSheet(f"""
            QComboBox {{
                background-color: #0d1117;
                color: #e6edf3;
                border: 1px solid #30363d;
                border-radius: 4px;
                padding: 4px 8px;
                min-width: 100px;
            }}
            QComboBox::drop-down {{
                border: none;
                padding-right: 8px;
                width: 20px;
            }}
            QComboBox::down-arrow {{
                image: url({_ARROW_SVG});
                width: 12px;
                height: 12px;
            }}
            QComboBox::down-arrow:hover {{
                image: url({_ARROW_SVG});
            }}
            QComboBox QAbstractItemView {{
                background-color: #161b22;
                color: #e6edf3;
                border: 1px solid #30363d;
                selection-background-color: #1f6feb;
            }}
        """)
        model_row.addWidget(self._model_combo)
        # 刷新模型列表按钮
        self._model_refresh_btn = QPushButton(self)
        self._model_refresh_btn.setIcon(QIcon(_SYNC_SVG))
        self._model_refresh_btn.setIconSize(QSize(16, 16))
        self._model_refresh_btn.setFixedSize(36, 36)
        self._model_refresh_btn.setToolTip("从 opencode 配置重新读取可用模型列表")
        self._model_refresh_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self._model_refresh_btn.setStyleSheet("""
            QPushButton {
                border: 1px solid #30363d;
                border-radius: 6px;
                background-color: #0d1117;
                padding: 0px;
            }
            QPushButton:hover {
                border-color: #58a6ff;
                background-color: #1c2433;
            }
            QPushButton:pressed {
                background-color: #0d419d;
            }
        """)
        self._model_refresh_btn.clicked.connect(self._on_refresh_models)
        model_row.addWidget(self._model_refresh_btn)
        model_row.addStretch()
        form_layout.addLayout(model_row)

        # 分阶段模型选择：探索 / 执行 / 检查 / 推送
        _MODEL_COMBO_STYLE = f"""
            QComboBox {{
                background-color: #0d1117;
                color: #e6edf3;
                border: 1px solid #30363d;
                border-radius: 4px;
                padding: 4px 8px;
                min-width: 100px;
            }}
            QComboBox::drop-down {{
                border: none;
                padding-right: 8px;
                width: 20px;
            }}
            QComboBox::down-arrow {{
                image: url({_ARROW_SVG});
                width: 12px;
                height: 12px;
            }}
            QComboBox QAbstractItemView {{
                background-color: #161b22;
                color: #e6edf3;
                border: 1px solid #30363d;
                selection-background-color: #1f6feb;
            }}
        """
        def _make_phase_model_combo() -> QComboBox:
            """创建分阶段模型下拉框（复用统一样式和预设列表）"""
            cb = QComboBox(self)
            cb.addItems(
                ["（跟随默认）"] + _available_models
                if _available_models else
                [
                    "（跟随默认）",
                    "deepseek-v4-pro",
                    "deepseek-v4-flash",
                    "opencode-go/deepseek-v4-flash",
                    "minimax-cn/MiniMax-M2.7",
                ]
            )
            cb.setCurrentIndex(0)
            cb.setMinimumWidth(240)
            cb.setEditable(True)
            cb.setToolTip("留空=使用上方默认模型，选择后覆盖默认值")
            cb.setStyleSheet(_MODEL_COMBO_STYLE)
            return cb

        # 探索模型
        explore_model_row = QHBoxLayout()
        explore_model_row.setSpacing(12)
        explore_model_row.addWidget(_form_label("探索模型"))
        self._model_explore_combo = _make_phase_model_combo()
        self._model_explore_combo.setToolTip("探索/提议阶段使用的模型（留空=使用默认模型）")
        explore_model_row.addWidget(self._model_explore_combo)
        explore_model_row.addStretch()
        form_layout.addLayout(explore_model_row)

        # 执行模型
        exec_model_row = QHBoxLayout()
        exec_model_row.setSpacing(12)
        exec_model_row.addWidget(_form_label("执行模型"))
        self._model_execute_combo = _make_phase_model_combo()
        self._model_execute_combo.setToolTip("执行任务阶段使用的模型（留空=使用默认模型）")
        exec_model_row.addWidget(self._model_execute_combo)
        exec_model_row.addStretch()
        form_layout.addLayout(exec_model_row)

        # 检查模型
        verify_model_row = QHBoxLayout()
        verify_model_row.setSpacing(12)
        verify_model_row.addWidget(_form_label("检查模型"))
        self._model_verify_combo = _make_phase_model_combo()
        self._model_verify_combo.setToolTip("检查验证阶段使用的模型（留空=使用默认模型）")
        verify_model_row.addWidget(self._model_verify_combo)
        verify_model_row.addStretch()
        form_layout.addLayout(verify_model_row)

        # 推送模型
        push_model_row = QHBoxLayout()
        push_model_row.setSpacing(12)
        push_model_row.addWidget(_form_label("推送模型"))
        self._model_push_combo = _make_phase_model_combo()
        self._model_push_combo.setToolTip("推送/收尾阶段使用的模型（留空=使用默认模型）")
        push_model_row.addWidget(self._model_push_combo)
        push_model_row.addStretch()
        form_layout.addLayout(push_model_row)

        # 二次评估模型
        evaluate_model_row = QHBoxLayout()
        evaluate_model_row.setSpacing(12)
        evaluate_model_row.addWidget(_form_label("评估模型"))
        self._model_evaluate_combo = _make_phase_model_combo()
        self._model_evaluate_combo.setToolTip("二次评估提议阶段使用的模型（留空=使用默认模型）。用高级模型重新评估提议的实用性和优先级。")
        evaluate_model_row.addWidget(self._model_evaluate_combo)
        evaluate_model_row.addStretch()
        form_layout.addLayout(evaluate_model_row)

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

        # 提议目标数量
        target_row = QHBoxLayout()
        target_row.setSpacing(12)
        target_row.addWidget(_form_label("提议目标"))
        self._proposed_target_spin = SpinBox(self)
        self._proposed_target_spin.setRange(1, 9999)
        self._proposed_target_spin.setValue(200)
        self._proposed_target_spin.setSuffix(" 条")
        self._proposed_target_spin.setMinimumWidth(160)
        target_row.addWidget(self._proposed_target_spin)
        target_hint = CaptionLabel("持续探索达到该数量后自动停止")
        target_hint.setStyleSheet("color: #484f58; font-size: 12px;")
        target_row.addWidget(target_hint)
        target_row.addStretch()
        form_layout.addLayout(target_row)

        settings_layout.addWidget(settings_card)
        settings_layout.addStretch()
        self._tabs.addTab(settings_tab, "通用设置")

        # ── Tab 2: 提示词 ──
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

        # ── 孙 tab 样式（略小于父级 pill tab） ──
        _SUB_TAB_STYLE = """
            QTabWidget::pane {
                border: 1px solid #21262d; border-radius: 8px;
                background: #0d1117; padding: 4px;
                top: -1px;
            }
            QTabBar::tab {
                color: #8b949e; background: transparent;
                border: 1px solid transparent; border-radius: 16px;
                padding: 6px 18px; margin: 0px 2px;
                font-size: 12px; font-weight: 500;
            }
            QTabBar::tab:hover {
                color: #c9d1d9; background: #21262d;
                border-color: #30363d;
            }
            QTabBar::tab:selected {
                color: #e6edf3; background: #30363d;
                border-color: #484f58;
            }
        """

        # 嵌套 Tab 控件（孙 tab）
        self._prompt_sub_tabs = QTabWidget(prompt_tab)
        self._prompt_sub_tabs.setStyleSheet(_SUB_TAB_STYLE)

        # 探索提议
        explore_tab = QWidget()
        explore_layout = QVBoxLayout(explore_tab)
        explore_layout.setContentsMargins(8, 8, 8, 8)
        self._prompt_explore = TextEdit(self)
        self._prompt_explore.setPlaceholderText(
            "默认：浏览仓库生成粗粒度任务提议 → 写入 proposed_tasks.yaml"
        )
        self._prompt_explore.setStyleSheet(_PROMPT_STYLE)
        explore_layout.addWidget(self._prompt_explore)
        self._prompt_sub_tabs.addTab(explore_tab, "探索提议")

        # 更新任务（原更新待审批）
        update_tab = QWidget()
        update_layout = QVBoxLayout(update_tab)
        update_layout.setContentsMargins(8, 8, 8, 8)
        self._prompt_update = TextEdit(self)
        self._prompt_update.setPlaceholderText(
            "默认：重新检查项目，更新任务项内容（描述、预期成果、约束等）"
        )
        self._prompt_update.setStyleSheet(_PROMPT_STYLE)
        update_layout.addWidget(self._prompt_update)
        self._prompt_sub_tabs.addTab(update_tab, "更新任务")

        # 执行任务
        execute_tab = QWidget()
        execute_layout = QVBoxLayout(execute_tab)
        execute_layout.setContentsMargins(8, 8, 8, 8)
        self._prompt_execute = TextEdit(self)
        self._prompt_execute.setPlaceholderText(
            "默认：执行开发任务，完成后更新 approved_queue.yaml（{desc} 占位符）"
        )
        self._prompt_execute.setStyleSheet(_PROMPT_STYLE)
        execute_layout.addWidget(self._prompt_execute)
        self._prompt_sub_tabs.addTab(execute_tab, "执行任务")

        # 二次评估
        evaluate_tab = QWidget()
        evaluate_layout = QVBoxLayout(evaluate_tab)
        evaluate_layout.setContentsMargins(8, 8, 8, 8)
        self._prompt_evaluate = TextEdit(self)
        self._prompt_evaluate.setPlaceholderText(
            "默认：用高级模型重新评估待审批提议的实用性和优先级"
        )
        self._prompt_evaluate.setStyleSheet(_PROMPT_STYLE)
        evaluate_layout.addWidget(self._prompt_evaluate)
        self._prompt_sub_tabs.addTab(evaluate_tab, "二次评估")

        # 检查成果
        verify_tab = QWidget()
        verify_layout = QVBoxLayout(verify_tab)
        verify_layout.setContentsMargins(8, 8, 8, 8)
        self._prompt_verify = TextEdit(self)
        self._prompt_verify.setPlaceholderText(
            "默认：检查已完成任务的代码实现率，发现遗漏时自动生成修补提议"
        )
        self._prompt_verify.setStyleSheet(_PROMPT_STYLE)
        verify_layout.addWidget(self._prompt_verify)
        self._prompt_sub_tabs.addTab(verify_tab, "检查成果")

        # 检查修复
        check_fix_tab = QWidget()
        check_fix_layout = QVBoxLayout(check_fix_tab)
        check_fix_layout.setContentsMargins(8, 8, 8, 8)
        self._prompt_check_fix = TextEdit(self)
        self._prompt_check_fix.setPlaceholderText(
            "默认：对项目运行代码检查（类型/lint）并自动修复常见问题"
        )
        self._prompt_check_fix.setStyleSheet(_PROMPT_STYLE)
        check_fix_layout.addWidget(self._prompt_check_fix)
        self._prompt_sub_tabs.addTab(check_fix_tab, "检查修复")

        # 部署云端
        deploy_tab = QWidget()
        deploy_layout = QVBoxLayout(deploy_tab)
        deploy_layout.setContentsMargins(8, 8, 8, 8)
        self._prompt_deploy = TextEdit(self)
        self._prompt_deploy.setPlaceholderText(
            "默认：将当前项目部署到远程服务器（ECS）"
        )
        self._prompt_deploy.setStyleSheet(_PROMPT_STYLE)
        deploy_layout.addWidget(self._prompt_deploy)
        self._prompt_sub_tabs.addTab(deploy_tab, "部署云端")

        # 更新文档并推送
        finish_tab = QWidget()
        finish_layout = QVBoxLayout(finish_tab)
        finish_layout.setContentsMargins(8, 8, 8, 8)
        self._prompt_finish = TextEdit(self)
        self._prompt_finish.setPlaceholderText(
            "默认：更新项目文档并推送代码到 Github 仓库"
        )
        self._prompt_finish.setStyleSheet(_PROMPT_STYLE)
        finish_layout.addWidget(self._prompt_finish)
        self._prompt_sub_tabs.addTab(finish_tab, "更新文档并推送")

        prompt_layout.addWidget(self._prompt_sub_tabs)

        self._tabs.addTab(prompt_tab, "提示词")

        # ── Tab 3: 项目名称 ──
        projects_tab = QWidget()
        projects_layout = QVBoxLayout(projects_tab)
        projects_layout.setContentsMargins(16, 16, 16, 16)
        projects_layout.setSpacing(10)

        proj_hint = CaptionLabel("管理控制面板「项目选择」下拉菜单中的项目列表。「全部」选项始终保留。")
        proj_hint.setStyleSheet("color: #484f58; font-size: 11px;")
        projects_layout.addWidget(proj_hint)

        # 输入行：添加新项目
        add_row = QHBoxLayout()
        add_row.setSpacing(8)
        self._proj_input = QLineEdit()
        self._proj_input.setPlaceholderText("输入项目名称（如 ftg, game1, tavern）")
        self._proj_input.setStyleSheet("""
            QLineEdit {
                background-color: #0d1117; color: #c9d1d9;
                border: 1px solid #30363d; border-radius: 6px;
                padding: 8px 12px; font-size: 13px;
            }
            QLineEdit:hover { border-color: #58a6ff; }
            QLineEdit:focus { border-color: #1f6feb; }
        """)
        add_row.addWidget(self._proj_input)

        self._proj_add_btn = PushButton("添加")
        self._proj_add_btn.clicked.connect(self._on_add_project)
        add_row.addWidget(self._proj_add_btn)
        projects_layout.addLayout(add_row)

        # 项目列表
        self._proj_list = QListWidget()
        self._proj_list.setSelectionMode(QAbstractItemView.SelectionMode.ExtendedSelection)
        self._proj_list.setStyleSheet("""
            QListWidget {
                background-color: #0d1117; color: #c9d1d9;
                border: 1px solid #30363d; border-radius: 8px;
                padding: 4px; font-size: 13px; outline: none;
            }
            QListWidget::item {
                padding: 8px 12px; border-radius: 4px;
            }
            QListWidget::item:selected {
                background-color: #1f6feb; color: #ffffff;
            }
            QListWidget::item:hover {
                background-color: #21262d;
            }
        """)
        projects_layout.addWidget(self._proj_list, stretch=1)

        # 操作按钮行
        op_row = QHBoxLayout()
        op_row.setSpacing(8)
        self._proj_remove_btn = PushButton("删除选中")
        self._proj_remove_btn.clicked.connect(self._on_remove_projects)
        op_row.addWidget(self._proj_remove_btn)
        op_row.addStretch()
        projects_layout.addLayout(op_row)

        self._tabs.addTab(projects_tab, "项目名称")

        # ── Tab 4: 使用说明 ──
        help_tab = QWidget()
        help_layout = QVBoxLayout(help_tab)
        help_layout.setContentsMargins(16, 16, 16, 16)
        help_layout.setSpacing(12)

        help_title = StrongBodyLabel("SuperTask 使用说明")
        help_title.setStyleSheet("font-size: 18px; color: #e6edf3;")
        help_layout.addWidget(help_title)

        _HELP_LABEL_STYLE = "color: #c9d1d9; font-size: 13px; line-height: 1.6;"

        intro = CaptionLabel(
            "SuperTask 是 AI 自主开发监督系统，通过循环驱动 AI 代理（opencode）自动探索项目、提出任务，"
            "经人工审批后执行开发、文档、推送等操作。"
        )
        intro.setStyleSheet(_HELP_LABEL_STYLE)
        intro.setWordWrap(True)
        help_layout.addWidget(intro)

        # ── 制表符 раздел ──
        def _help_section(text: str) -> StrongBodyLabel:
            lbl = StrongBodyLabel(text)
            lbl.setStyleSheet("font-size: 14px; color: #58a6ff; margin-top: 8px;")
            return lbl

        def _help_content(text: str) -> CaptionLabel:
            lbl = CaptionLabel(text)
            lbl.setStyleSheet(_HELP_LABEL_STYLE + "padding-left: 16px;")
            lbl.setWordWrap(True)
            return lbl

        # ── 导航栏 ──
        help_layout.addWidget(_help_section("📌 导航栏"))
        help_layout.addWidget(_help_content(
            "控制面板 — 仪表盘：任务统计、操作按钮、运行日志、队列检视\n"
            "提议与工作 — 查看/审批提议、管理工作队列\n"
            "任务规划 — AI 驱动的任务细化与规划\n"
            "Agent 状态 — 监控 agent 运行状态与性能\n"
            "日志与终端 — 系统日志 + 交互式终端\n"
            "配置 — 全局设置、提示词编辑、项目管理\n"
            "历史 — 已完成/已拒绝任务记录"
        ))

        # ── 控制面板操作按钮 ──
        help_layout.addWidget(_help_section("⚡ 控制面板按钮"))
        help_layout.addWidget(_help_content(
            "持续探索 — AI 持续遍历项目发现改进领域，直到手动停止或达到目标提议数量\n"
            "执行队列 — 按顺序执行工作队列中的待处理任务\n"
            "更新任务 — 重新检查项目，更新任务项内容（描述、预期成果、约束等）\n"
            "检查成果 — 检查已完成任务的代码实现率，发现遗漏时自动生成修补提议\n"
            "检查修复 — 对项目运行代码检查（类型/lint）并自动修复常见问题\n"
            "部署云端 — 将项目部署到远程 ECS 服务器\n"
            "更新文档并推送 — 更新项目文档并推送代码到 Github"
        ))

        # ── 提示词编辑 ──
        help_layout.addWidget(_help_section("✏️ 提示词编辑（配置 → 提示词）"))
        help_layout.addWidget(_help_content(
            "探索提议 — 浏览仓库生成粗粒度任务提议的 prompt 模板\n"
            "更新任务 — 重新检查项目状态，更新所有任务项的 prompt 模板\n"
            "执行任务 — 执行开发任务时使用的 prompt 模板（支持 {desc} 占位符）\n"
            "二次评估 — 用高级模型重新评估提议真实性和优先级的 prompt 模板\n"
            "检查成果 — 验证已完成任务实现率的 prompt 模板\n"
            "检查修复 — 代码检查与自动修复的 prompt 模板\n"
            "部署云端 — 部署操作相关的 prompt 模板\n"
            "更新文档并推送 — 文档更新和 Git 推送的 prompt 模板"
        ))

        # ── 通用设置 ──
        help_layout.addWidget(_help_section("⚙️ 通用设置（配置 → 通用设置）"))
        help_layout.addWidget(_help_content(
            "主题 — 切换深色/浅色显示模式\n"
            "超时时间 — Agent 执行超时限制（秒）\n"
            "默认/分阶段模型 — 指定各阶段使用的 AI 模型（留空跟随 opencode 自动选择）\n"
            "自动推送 — 完成后自动执行 git push\n"
            "轮次间隔 — 主循环各轮次间的等待时间\n"
            "最大重试 — Agent 失败后的最大重试次数\n"
            "提议目标 — 持续探索达到该提议数量后自动停止"
        ))

        # ── 项目名称 ──
        help_layout.addWidget(_help_section("📁 项目名称（配置 → 项目名称）"))
        help_layout.addWidget(_help_content(
            "管理控制面板「项目选择」下拉菜单中的项目列表。\n"
            "添加/删除项目以限定 AI 探索和执行的范围。\n"
            "「全部」选项始终保留，选择后操作覆盖所有项目。"
        ))

        help_layout.addStretch()
        self._tabs.addTab(help_tab, "使用说明")

        layout.addWidget(self._tabs)

        # 连接信号
        self._save_btn.clicked.connect(self._on_save)
        self._reset_btn.clicked.connect(self._on_reset)

        # ── 连接脏标记信号：任意控件值变更时触发提醒 ──
        # 提示词
        self._prompt_explore.textChanged.connect(lambda: self._mark_dirty())
        self._prompt_update.textChanged.connect(lambda: self._mark_dirty())
        self._prompt_execute.textChanged.connect(lambda: self._mark_dirty())
        self._prompt_evaluate.textChanged.connect(lambda: self._mark_dirty())
        self._prompt_verify.textChanged.connect(lambda: self._mark_dirty())
        self._prompt_check_fix.textChanged.connect(lambda: self._mark_dirty())
        self._prompt_deploy.textChanged.connect(lambda: self._mark_dirty())
        self._prompt_finish.textChanged.connect(lambda: self._mark_dirty())
        # 通用设置
        self._theme_combo.currentIndexChanged.connect(lambda: self._mark_dirty())
        self._timeout_spin.valueChanged.connect(lambda: self._mark_dirty())
        self._model_combo.currentTextChanged.connect(lambda: self._mark_dirty())
        self._model_explore_combo.currentTextChanged.connect(lambda: self._mark_dirty())
        self._model_execute_combo.currentTextChanged.connect(lambda: self._mark_dirty())
        self._model_verify_combo.currentTextChanged.connect(lambda: self._mark_dirty())
        self._model_push_combo.currentTextChanged.connect(lambda: self._mark_dirty())
        self._model_evaluate_combo.currentTextChanged.connect(lambda: self._mark_dirty())
        self._auto_push_switch.checkedChanged.connect(lambda: self._mark_dirty())
        self._cycle_spin.valueChanged.connect(lambda: self._mark_dirty())
        self._retry_spin.valueChanged.connect(lambda: self._mark_dirty())
        self._proposed_target_spin.valueChanged.connect(lambda: self._mark_dirty())
        # 项目列表变更通过添加/删除按钮间接触发，不直接连接
        self._proj_add_btn.clicked.connect(lambda: self._mark_dirty())
        self._proj_remove_btn.clicked.connect(lambda: self._mark_dirty())

    def set_config(self, config: dict):
        """加载配置到 UI。未配置的提示词字段显示默认内容（留空 = 使用代码内置默认值）。"""
        self._loading = True  # 加载期间不触发脏标记
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
        self._prompt_evaluate.setPlainText(
            prompts.get("evaluate") or _DEFAULT_EVALUATE
        )
        self._prompt_verify.setPlainText(
            prompts.get("verify_deliverables") or _DEFAULT_VERIFY
        )
        self._prompt_check_fix.setPlainText(
            prompts.get("check_fix") or _DEFAULT_CHECK_FIX
        )
        self._prompt_deploy.setPlainText(
            prompts.get("deploy") or _DEFAULT_DEPLOY
        )
        self._prompt_finish.setPlainText(
            prompts.get("finish") or _DEFAULT_FINISH
        )

        # UI
        ui = config.get("ui", {})
        theme = ui.get("theme", "dark")
        self._theme_combo.setCurrentIndex(0 if theme == "dark" else 1)

        # Agent
        agent = config.get("agent", {})
        self._timeout_spin.setValue(agent.get("timeout", 1200))

        # 默认模型
        model = agent.get("model", "")
        self._set_combo_model(self._model_combo, model)

        # 分阶段模型
        self._set_combo_model(self._model_explore_combo, agent.get("model_explore", ""))
        self._set_combo_model(self._model_execute_combo, agent.get("model_execute", ""))
        self._set_combo_model(self._model_verify_combo, agent.get("model_verify", ""))
        self._set_combo_model(self._model_push_combo, agent.get("model_push", ""))
        self._set_combo_model(self._model_evaluate_combo, agent.get("model_evaluate", ""))

        # 行为
        behavior = config.get("behavior", {})
        self._auto_push_switch.setChecked(behavior.get("auto_push", False))
        self._cycle_spin.setValue(behavior.get("cycle_interval", 5))
        self._retry_spin.setValue(behavior.get("max_retries", 2))
        self._proposed_target_spin.setValue(behavior.get("proposed_target_count", 200))

        # 项目
        projects = config.get("projects", [])
        self._proj_list.clear()
        for p in projects:
            if isinstance(p, dict):
                label = p.get("label", p.get("name", "?"))
                self._proj_list.addItem(label)
                # 存储完整 dict 到 item data 中
                item = self._proj_list.item(self._proj_list.count() - 1)
                if item:
                    item.setData(Qt.ItemDataRole.UserRole, p)
            else:
                self._proj_list.addItem(str(p))

        self._loading = False
        self._mark_dirty(False)

    def get_config(self) -> dict:
        """从 UI 收集配置。内容与默认值相同时存空字符串（由 loop_manager 使用代码内置默认值）。"""
        explore = self._prompt_explore.toPlainText().strip()
        update = self._prompt_update.toPlainText().strip()
        execute = self._prompt_execute.toPlainText().strip()
        evaluate = self._prompt_evaluate.toPlainText().strip()
        verify = self._prompt_verify.toPlainText().strip()
        check_fix = self._prompt_check_fix.toPlainText().strip()
        deploy = self._prompt_deploy.toPlainText().strip()
        finish = self._prompt_finish.toPlainText().strip()
        return {
            "prompts": {
                "explore": "" if explore == _DEFAULT_EXPLORE else explore,
                "update_proposed": "" if update == _DEFAULT_UPDATE else update,
                "execute": "" if execute == _DEFAULT_EXECUTE else execute,
                "evaluate": "" if evaluate == _DEFAULT_EVALUATE else evaluate,
                "verify_deliverables": "" if verify == _DEFAULT_VERIFY else verify,
                "check_fix": "" if check_fix == _DEFAULT_CHECK_FIX else check_fix,
                "deploy": "" if deploy == _DEFAULT_DEPLOY else deploy,
                "finish": "" if finish == _DEFAULT_FINISH else finish,
            },
            "ui": {
                "theme": "dark" if self._theme_combo.currentIndex() == 0 else "light",
            },
            "agent": {
                "timeout": self._timeout_spin.value(),
                "model": "" if self._model_combo.currentText().strip() == self._model_combo.itemText(0) else self._model_combo.currentText().strip(),
                "model_explore": self._get_phase_model_value(self._model_explore_combo),
                "model_execute": self._get_phase_model_value(self._model_execute_combo),
                "model_verify": self._get_phase_model_value(self._model_verify_combo),
                "model_push": self._get_phase_model_value(self._model_push_combo),
                "model_evaluate": self._get_phase_model_value(self._model_evaluate_combo),
            },
            "behavior": {
                "auto_push": self._auto_push_switch.isChecked(),
                "cycle_interval": self._cycle_spin.value(),
                "max_retries": self._retry_spin.value(),
                "proposed_target_count": self._proposed_target_spin.value(),
            },
            "projects": [
                self._get_project_item_data(i)
                for i in range(self._proj_list.count())
            ],
        }

    def set_on_save(self, callback):
        """注册保存回调：callback(config_dict)"""
        self._on_save_cb = callback

    def _on_save(self):
        """保存配置"""
        config = self.get_config()
        if self._on_save_cb:
            self._on_save_cb(config)
        self._mark_dirty(False)
        InfoBar.success(
            title="配置已保存",
            content="配置已保存并生效。项目列表已同步到控制面板。",
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

    def _on_add_project(self):
        """添加新项目到列表"""
        name = self._proj_input.text().strip()
        if not name:
            return
        # 检查重复
        for i in range(self._proj_list.count()):
            if self._proj_list.item(i).text() == name:
                QMessageBox.warning(self, "重复", f"项目「{name}」已存在")
                return
        self._proj_list.addItem(name)
        self._proj_input.clear()

    def _on_remove_projects(self):
        """删除选中的项目"""
        selected = self._proj_list.selectedItems()
        if not selected:
            QMessageBox.information(self, "提示", "请先选择要删除的项目")
            return
        for item in selected:
            row = self._proj_list.row(item)
            self._proj_list.takeItem(row)

    def _get_project_item_data(self, index: int) -> dict:
        """获取指定索引的项目数据。
        优先返回 UserRole 中存储的 dict（新格式），
        否则根据文本构造一个最小 dict（兼容旧格式）。
        """
        item = self._proj_list.item(index)
        if not item:
            return {}
        data = item.data(Qt.ItemDataRole.UserRole)
        if data and isinstance(data, dict):
            return data
        # 旧格式：仅文本，构造最小 dict
        name = item.text()
        return {"name": name, "label": name, "source_dirs": []}

    @staticmethod
    def _set_combo_model(combo: QComboBox, model: str):
        """设置模型下拉框的值：在列表中找到匹配项则选中，否则追加后选中。"""
        if model:
            idx = combo.findText(model)
            if idx >= 0:
                combo.setCurrentIndex(idx)
            else:
                combo.addItem(model)
                combo.setCurrentIndex(combo.count() - 1)
        else:
            combo.setCurrentIndex(0)

    @staticmethod
    def _get_phase_model_value(combo: QComboBox) -> str:
        """提取分阶段模型下拉框的值：选择「跟随默认」时返回空字符串。"""
        text = combo.currentText().strip()
        return "" if text == combo.itemText(0) else text

    def _mark_dirty(self, dirty: bool = True):
        """标记配置为已修改/已保存，控制未保存提醒横幅的显隐。"""
        if self._loading:
            return  # 加载期间忽略变更
        self._dirty = dirty
        self._dirty_banner.setVisible(dirty)

    def _on_refresh_models(self):
        """从 opencode 配置重新读取可用模型列表，刷新所有模型下拉框。"""
        models = get_available_models(force_refresh=True)
        if not models:
            InfoBar.warning(
                title="刷新失败",
                content="无法读取 opencode 模型列表，请确认 opencode 已安装。",
                orient=Qt.Orientation.Horizontal,
                isClosable=True,
                position=InfoBarPosition.TOP,
                duration=3000,
                parent=self,
            )
            return

        # 刷新所有模型下拉框
        combos = [
            self._model_combo,
            self._model_explore_combo,
            self._model_execute_combo,
            self._model_verify_combo,
            self._model_push_combo,
            self._model_evaluate_combo,
        ]
        first_texts = [
            "（不使用默认模型）",
            "（跟随默认）", "（跟随默认）", "（跟随默认）", "（跟随默认）",
            "（跟随默认）",
        ]
        # 各下拉框的首项文本不同，需分别保留
        first_texts = [
            "（不使用默认模型）",
            "（跟随默认）", "（跟随默认）", "（跟随默认）", "（跟随默认）",
        ]
        for combo, first_text in zip(combos, first_texts):
            current = combo.currentText().strip()
            combo.clear()
            combo.addItem(first_text)
            combo.addItems(models)
            # 尝试恢复之前的选中项
            if current and current != first_text:
                idx = combo.findText(current)
                combo.setCurrentIndex(idx if idx >= 0 else 0)

        InfoBar.success(
            title="模型列表已刷新",
            content=f"已加载 {len(models)} 个可用模型。",
            orient=Qt.Orientation.Horizontal,
            isClosable=True,
            position=InfoBarPosition.TOP,
            duration=2000,
            parent=self,
        )
