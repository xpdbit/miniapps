# -*- coding: utf-8 -*-
"""settings_interface.py — 配置设置表单 + 键盘快捷键参考页面。

Part of OCE PyQt6 GUI, following SuperTask ui_pyqt patterns.
"""

from __future__ import annotations

from typing import Optional

from PyQt6.QtCore import Qt, QProcess, QTimer
from PyQt6.QtGui import QFont
from PyQt6.QtWidgets import (
    QFormLayout,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QPushButton,
    QSpinBox,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)
from qfluentwidgets import (
    BodyLabel,
    CaptionLabel,
    ComboBox,
    PrimaryPushButton,
    SimpleCardWidget,
)

from ..core.config import OceConfig
from ..core.data_store import DataStore

__all__ = [
    "SettingsInterface",
    "SHORTCUT_TABLE",
]

# ── 快捷键对照表 ──

SHORTCUT_TABLE: list[tuple[str, str, str]] = [
    ("Ctrl+R", "全局", "强制刷新"),
    ("Ctrl+F", "API历史", "聚焦搜索框"),
    ("F1", "全局", "帮助弹窗"),
    ("Ctrl+Q", "全局", "退出确认"),
    ("Tab", "全局", "切换页面"),
    ("Enter", "列表", "选中行/查看详情"),
    ("← / →", "API历史", "翻页"),
]

# ── 模型默认选项 ──

_DEFAULT_MODELS: list[str] = [
    "deepseek/deepseek-v4-pro",
    "deepseek/deepseek-v3",
    "opencode-go/deepseek-v4-flash",
]

_REFRESH_INTERVAL_OPTIONS: list[str] = ["1s", "3s", "10s", "30s", "60s", "手动"]

_THEME_OPTIONS: list[str] = ["github-dark", "github-light"]

_THEME_DISPLAY: dict[str, str] = {
    "github-dark": "GitHub Dark",
    "github-light": "GitHub Light",
}

# ── 样式常量 ──

_INPUT_STYLE = """
    QLineEdit {
        background-color: #0d1117; color: #c9d1d9;
        border: 1px solid #30363d; border-radius: 6px;
        padding: 6px 10px; font-size: 13px;
    }
    QLineEdit:hover { border-color: #58a6ff; }
    QLineEdit:focus { border-color: #1f6feb; }
    QLineEdit:disabled { color: #484f58; }
"""

_COMBO_STYLE = """
    QComboBox {
        background-color: #0d1117; color: #e6edf3;
        border: 1px solid #30363d; border-radius: 6px;
        padding: 4px 8px; font-size: 13px; min-width: 180px;
    }
    QComboBox::drop-down { border: none; padding-right: 8px; width: 20px; }
    QComboBox QAbstractItemView {
        background-color: #161b22; color: #e6edf3;
        border: 1px solid #30363d;
        selection-background-color: #1f6feb;
    }
"""

_SPINBOX_STYLE = """
    QSpinBox {
        background-color: #0d1117; color: #c9d1d9;
        border: 1px solid #30363d; border-radius: 6px;
        padding: 4px 8px; font-size: 13px; min-width: 100px;
    }
    QSpinBox:hover { border-color: #58a6ff; }
    QSpinBox:focus { border-color: #1f6feb; }
"""

_TABLE_STYLE = """
    QTableWidget {
        background-color: #0d1117; color: #c9d1d9;
        border: 1px solid #30363d; border-radius: 8px;
        gridline-color: #21262d; font-size: 13px;
    }
    QTableWidget::item { padding: 6px 12px; }
    QTableWidget::item:selected { background-color: transparent; }
    QHeaderView::section {
        background-color: #161b22; color: #8b949e;
        border: none; border-bottom: 1px solid #30363d;
        padding: 8px 12px; font-weight: bold; font-size: 12px;
    }
"""


class SettingsInterface(QWidget):
    """设置页面 — 项目配置设置表单 + 键盘快捷键参考。"""

    def __init__(self, parent: Optional[QWidget] = None):
        super().__init__(parent)
        self._config = OceConfig()
        self._dirty_fields: set[str] = set()
        self._loading = False
        self._model_process: Optional[QProcess] = None
        self._setup_ui()
        self._load_config()

    # ── UI 构建 ──

    def _setup_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(20)

        # ── 标题 ──
        title_row = QHBoxLayout()
        title_label = BodyLabel("设置")
        title_label.setStyleSheet("background: transparent; border: none;")
        title_row.addWidget(title_label)
        title_row.addStretch()
        self._save_btn = PrimaryPushButton("💾 保存配置")
        self._save_btn.clicked.connect(self._on_save)
        title_row.addWidget(self._save_btn)
        layout.addLayout(title_row)

        # ── 保存状态标签 ──
        self._status_label = CaptionLabel("")
        self._status_label.setStyleSheet("font-size: 12px; padding: 2px 4px; background: transparent;")
        self._status_label.setVisible(False)
        layout.addWidget(self._status_label)

        # ── Section 1: 项目设置 ──
        settings_card = SimpleCardWidget(self)
        settings_card.setBorderRadius(8)
        form_layout = QFormLayout(settings_card)
        form_layout.setContentsMargins(24, 20, 24, 20)
        form_layout.setSpacing(14)
        form_layout.setLabelAlignment(Qt.AlignmentFlag.AlignRight)

        # 1. 项目路径（只读）
        self._project_path_edit = QLineEdit(self)
        self._project_path_edit.setReadOnly(True)
        self._project_path_edit.setStyleSheet(_INPUT_STYLE)
        self._project_path_edit.setText(
            str(self._config.path.parent) if self._config.path else ""
        )
        form_layout.addRow(self._make_form_label("项目路径"), self._project_path_edit)

        # 2. 项目名称
        self._project_name_edit = QLineEdit(self)
        self._project_name_edit.setPlaceholderText("项目名称")
        self._project_name_edit.setStyleSheet(_INPUT_STYLE)
        self._project_name_edit.textChanged.connect(
            lambda: self._mark_dirty("project.name")
        )
        path_row = QHBoxLayout()
        path_row.setSpacing(6)
        path_row.addWidget(self._project_name_edit)
        self._dirty_project_name = self._make_dirty_dot()
        path_row.addWidget(self._dirty_project_name)
        path_row.addStretch()
        form_layout.addRow(self._make_form_label("项目名称"), path_row)

        # 3. 默认模型
        model_row = QHBoxLayout()
        model_row.setSpacing(6)
        self._model_combo = ComboBox(self)
        self._model_combo.addItems(list(_DEFAULT_MODELS))
        self._model_combo.setStyleSheet(_COMBO_STYLE)
        self._model_combo.currentIndexChanged.connect(
            lambda: self._mark_dirty("opencode.default_model")
        )
        model_row.addWidget(self._model_combo)
        self._model_refresh_btn = QPushButton("⟳", self)
        self._model_refresh_btn.setFixedSize(32, 32)
        self._model_refresh_btn.setToolTip("刷新模型列表 (opencode models)")
        self._model_refresh_btn.setStyleSheet("""
            QPushButton {
                border: 1px solid #30363d; border-radius: 6px;
                background-color: #0d1117; color: #8b949e;
                font-size: 16px;
            }
            QPushButton:hover { border-color: #58a6ff; color: #e6edf3; }
        """)
        self._model_refresh_btn.clicked.connect(self._on_refresh_models)
        model_row.addWidget(self._model_refresh_btn)
        self._dirty_model = self._make_dirty_dot()
        model_row.addWidget(self._dirty_model)
        model_row.addStretch()
        form_layout.addRow(self._make_form_label("默认模型"), model_row)

        # 4. 刷新频率
        interval_row = QHBoxLayout()
        interval_row.setSpacing(6)
        self._interval_combo = ComboBox(self)
        self._interval_combo.addItems(list(_REFRESH_INTERVAL_OPTIONS))
        self._interval_combo.setStyleSheet(_COMBO_STYLE)
        self._interval_combo.currentIndexChanged.connect(
            lambda: self._mark_dirty("oce.refresh_interval_s")
        )
        interval_row.addWidget(self._interval_combo)
        self._dirty_interval = self._make_dirty_dot()
        interval_row.addWidget(self._dirty_interval)
        interval_row.addStretch()
        form_layout.addRow(self._make_form_label("刷新频率"), interval_row)

        # 5. 自动保存间隔
        autosave_row = QHBoxLayout()
        autosave_row.setSpacing(6)
        self._autosave_spin = QSpinBox(self)
        self._autosave_spin.setRange(30, 3600)
        self._autosave_spin.setSingleStep(30)
        self._autosave_spin.setSuffix(" s")
        self._autosave_spin.setStyleSheet(_SPINBOX_STYLE)
        self._autosave_spin.valueChanged.connect(
            lambda: self._mark_dirty("opencode.auto_save_interval_s")
        )
        autosave_row.addWidget(self._autosave_spin)
        self._dirty_autosave = self._make_dirty_dot()
        autosave_row.addWidget(self._dirty_autosave)
        autosave_row.addStretch()
        form_layout.addRow(self._make_form_label("自动保存(s)"), autosave_row)

        # 6. 排除目录
        excl_row = QHBoxLayout()
        excl_row.setSpacing(6)
        self._exclude_edit = QLineEdit(self)
        self._exclude_edit.setPlaceholderText("node_modules, .git, dist, __pycache__")
        self._exclude_edit.setStyleSheet(_INPUT_STYLE)
        self._exclude_edit.textChanged.connect(
            lambda: self._mark_dirty("oce.exclude_dirs")
        )
        excl_row.addWidget(self._exclude_edit)
        self._dirty_exclude = self._make_dirty_dot()
        excl_row.addWidget(self._dirty_exclude)
        excl_row.addStretch()
        form_layout.addRow(self._make_form_label("排除目录"), excl_row)

        # 7. 主题
        theme_row = QHBoxLayout()
        theme_row.setSpacing(6)
        self._theme_combo = ComboBox(self)
        self._theme_combo.addItems([_THEME_DISPLAY[t] for t in _THEME_OPTIONS])
        self._theme_combo.setStyleSheet(_COMBO_STYLE)
        self._theme_combo.currentIndexChanged.connect(
            lambda: self._mark_dirty("oce.theme")
        )
        theme_row.addWidget(self._theme_combo)
        self._dirty_theme = self._make_dirty_dot()
        theme_row.addWidget(self._dirty_theme)
        theme_row.addStretch()
        form_layout.addRow(self._make_form_label("主题"), theme_row)

        layout.addWidget(settings_card)

        # ── Section 2: 快捷键参考 ──
        shortcut_label = BodyLabel("快捷键参考")
        shortcut_label.setStyleSheet("font-size: 15px; font-weight: 600; color: #e6edf3; padding: 4px 0; background: transparent; border: none;")
        layout.addWidget(shortcut_label)

        self._shortcut_table = QTableWidget(len(SHORTCUT_TABLE), 3, self)
        self._shortcut_table.setHorizontalHeaderLabels(["快捷键", "范围", "功能"])
        self._shortcut_table.setStyleSheet(_TABLE_STYLE)
        self._shortcut_table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self._shortcut_table.setSelectionMode(QTableWidget.SelectionMode.NoSelection)
        self._shortcut_table.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        vh = self._shortcut_table.verticalHeader()
        if vh is not None:
            vh.setVisible(False)
        hh = self._shortcut_table.horizontalHeader()
        if hh is not None:
            hh.setStretchLastSection(True)
            hh.setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
            hh.setSectionResizeMode(1, QHeaderView.ResizeMode.ResizeToContents)

        for row_idx, (key, scope, desc) in enumerate(SHORTCUT_TABLE):
            key_item = QTableWidgetItem(key)
            key_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            key_font = QFont()
            key_font.setBold(True)
            key_item.setFont(key_font)
            self._shortcut_table.setItem(row_idx, 0, key_item)

            scope_item = QTableWidgetItem(scope)
            scope_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self._shortcut_table.setItem(row_idx, 1, scope_item)

            desc_item = QTableWidgetItem(desc)
            self._shortcut_table.setItem(row_idx, 2, desc_item)

        self._shortcut_table.setMaximumHeight(
            self._shortcut_table.rowHeight(0) * (len(SHORTCUT_TABLE) + 1) + 6
        )
        layout.addWidget(self._shortcut_table)

        layout.addStretch()

    # ── 辅助组件 ──

    @staticmethod
    def _make_form_label(text: str) -> CaptionLabel:
        label = CaptionLabel(text)
        label.setFixedWidth(80)
        label.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        label.setStyleSheet("color: #8b949e; font-size: 13px; background: transparent; border: none;")
        return label

    @staticmethod
    def _make_dirty_dot() -> QLabel:
        dot = QLabel("")
        dot.setFixedSize(12, 12)
        dot.setVisible(False)
        return dot

    def _set_dirty_dot(self, dot: QLabel, dirty: bool) -> None:
        if dirty:
            dot.setText("●")
            dot.setStyleSheet("color: #f0883e; font-size: 10px;")
            dot.setVisible(True)
        else:
            dot.setText("")
            dot.setVisible(False)

    # ── 配置加载 ──

    def _load_config(self) -> None:
        self._loading = True
        data = self._config.data

        # 项目名称
        proj = data.get("project", {}) if isinstance(data.get("project"), dict) else {}
        name = str(proj.get("name", "")) if not isinstance(proj.get("name"), str) else proj.get("name", "")
        self._project_name_edit.setText(name or "")

        # 默认模型
        oc = data.get("opencode", {}) if isinstance(data.get("opencode"), dict) else {}
        model = str(oc.get("default_model", _DEFAULT_MODELS[0])) if not isinstance(oc.get("default_model"), str) else oc.get("default_model", _DEFAULT_MODELS[0])
        idx = self._model_combo.findText(model)
        if idx >= 0:
            self._model_combo.setCurrentIndex(idx)
        else:
            self._model_combo.addItem(model)
            self._model_combo.setCurrentIndex(self._model_combo.count() - 1)

        # 刷新频率
        ocfg = data.get("oce", {}) if isinstance(data.get("oce"), dict) else {}
        interval_s = ocfg.get("refresh_interval_s", 10)
        if not isinstance(interval_s, int):
            interval_s = 10
        interval_map = {1: "1s", 3: "3s", 10: "10s", 30: "30s", 60: "60s"}
        interval_label = interval_map.get(interval_s, "手动")
        idx = self._interval_combo.findText(interval_label)
        if idx >= 0:
            self._interval_combo.setCurrentIndex(idx)

        # 自动保存
        save_s = oc.get("auto_save_interval_s", 300)
        if not isinstance(save_s, int):
            save_s = 300
        self._autosave_spin.setValue(save_s)

        # 排除目录
        exclude = ocfg.get("exclude_dirs", [])
        if isinstance(exclude, list):
            self._exclude_edit.setText(", ".join(exclude))
        elif isinstance(exclude, str):
            self._exclude_edit.setText(exclude)

        # 主题
        theme = ocfg.get("theme", "github-dark")
        if not isinstance(theme, str):
            theme = "github-dark"
        theme_label = _THEME_DISPLAY.get(theme, "GitHub Dark")
        idx = self._theme_combo.findText(theme_label)
        if idx >= 0:
            self._theme_combo.setCurrentIndex(idx)

        self._loading = False
        self._clear_dirty()

    # ── 脏标记 ──

    def _mark_dirty(self, field: str) -> None:
        if self._loading:
            return
        self._dirty_fields.add(field)
        self._update_dirty_indicators()
        self._status_label.setVisible(False)

    def _clear_dirty(self) -> None:
        self._dirty_fields.clear()
        self._update_dirty_indicators()

    def _update_dirty_indicators(self) -> None:
        self._set_dirty_dot(self._dirty_project_name, "project.name" in self._dirty_fields)
        self._set_dirty_dot(self._dirty_model, "opencode.default_model" in self._dirty_fields)
        self._set_dirty_dot(self._dirty_interval, "oce.refresh_interval_s" in self._dirty_fields)
        self._set_dirty_dot(self._dirty_autosave, "opencode.auto_save_interval_s" in self._dirty_fields)
        self._set_dirty_dot(self._dirty_exclude, "oce.exclude_dirs" in self._dirty_fields)
        self._set_dirty_dot(self._dirty_theme, "oce.theme" in self._dirty_fields)

    # ── 保存 ──

    # 保存成功回调（由 OceWindow 设置）
    _on_config_saved = None

    def set_on_config_saved(self, callback) -> None:
        """设置配置保存成功后的回调。"""
        self._on_config_saved = callback

    def _on_save(self) -> None:
        try:
            cfg = self._config

            # 项目名称
            name = self._project_name_edit.text().strip()
            cfg.set("project", "name", name)

            # 默认模型
            model = self._model_combo.currentText().strip()
            cfg.set("opencode", "default_model", model)

            # 刷新频率
            interval_text = self._interval_combo.currentText().strip()
            interval_map = {"1s": 1, "3s": 3, "10s": 10, "30s": 30, "60s": 60}
            interval_s = interval_map.get(interval_text, 10)
            cfg.set("oce", "refresh_interval_s", interval_s)

            # 自动保存
            save_s = self._autosave_spin.value()
            cfg.set("opencode", "auto_save_interval_s", save_s)

            # 排除目录
            exclude_text = self._exclude_edit.text().strip()
            exclude_list = [d.strip() for d in exclude_text.split(",") if d.strip()]
            cfg.set("oce", "exclude_dirs", exclude_list)

            # 主题
            theme_label = self._theme_combo.currentText().strip()
            reverse_map = {v: k for k, v in _THEME_DISPLAY.items()}
            theme_key = reverse_map.get(theme_label, "github-dark")
            cfg.set("oce", "theme", theme_key)

            # 保存到文件
            ok = cfg.save()

            # 主题切换：立即应用
            if "oce.theme" in self._dirty_fields:
                store = DataStore.get_instance()
                store.theme = theme_key

            if ok:
                self._clear_dirty()
                self._status_label.setText("✓ 配置已保存")
                self._status_label.setStyleSheet(
                    "color: #3fb950; font-size: 12px; padding: 2px 4px;"
                )
                self._status_label.setVisible(True)
                # 3 秒后自动隐藏
                QTimer.singleShot(3000, lambda: self._status_label.setVisible(False))
                # 通知 OceWindow 配置已更改
                if self._on_config_saved:
                    self._on_config_saved()
            else:
                self._status_label.setText("✗ 保存失败")
                self._status_label.setStyleSheet(
                    "color: #f85149; font-size: 12px; padding: 2px 4px;"
                )
                self._status_label.setVisible(True)

        except Exception as e:
            self._status_label.setText(f"✗ 保存失败: {e}")
            self._status_label.setStyleSheet(
                "color: #f85149; font-size: 12px; padding: 2px 4px;"
            )
            self._status_label.setVisible(True)

    # ── 模型刷新 ──

    def _on_refresh_models(self) -> None:
        """异步运行 `opencode models` 更新模型列表。"""
        if self._model_process is not None:
            return  # 已有一个进行中

        self._model_refresh_btn.setEnabled(False)
        self._model_refresh_btn.setText("⋯")
        self._status_label.setText("正在刷新模型列表...")
        self._status_label.setStyleSheet("color: #58a6ff; font-size: 12px; padding: 2px 4px;")
        self._status_label.setVisible(True)

        self._model_process = QProcess(self)
        self._model_process.setProcessChannelMode(QProcess.ProcessChannelMode.MergedChannels)
        self._model_process.finished.connect(self._on_model_process_finished)
        self._model_process.errorOccurred.connect(self._on_model_process_error)
        self._model_process.start("opencode", ["models"])

    def _on_model_process_finished(self, exit_code: int) -> None:
        self._model_refresh_btn.setEnabled(True)
        self._model_refresh_btn.setText("⟳")

        if exit_code == 0 and self._model_process is not None:
            output = self._model_process.readAllStandardOutput().data().decode("utf-8", errors="replace")
            lines = [line.strip() for line in output.splitlines() if line.strip()]

            if lines:
                # 保留当前选中值
                current = self._model_combo.currentText().strip()
                self._model_combo.clear()
                self._model_combo.addItems(lines)
                idx = self._model_combo.findText(current)
                if idx >= 0:
                    self._model_combo.setCurrentIndex(idx)
                elif lines:
                    # 追加保留原值
                    self._model_combo.addItem(current)
                    self._model_combo.setCurrentIndex(self._model_combo.count() - 1)

                self._status_label.setText(f"✓ 已加载 {len(lines)} 个模型")
                self._status_label.setStyleSheet(
                    "color: #3fb950; font-size: 12px; padding: 2px 4px;"
                )
            else:
                self._status_label.setText("⚠ 未解析到模型列表，保留默认")
                self._status_label.setStyleSheet(
                    "color: #d29922; font-size: 12px; padding: 2px 4px;"
                )
        else:
            self._status_label.setText("⚠ opencode models 执行失败，保留默认列表")
            self._status_label.setStyleSheet(
                "color: #d29922; font-size: 12px; padding: 2px 4px;"
            )

        self._status_label.setVisible(True)
        QTimer.singleShot(3000, lambda: self._status_label.setVisible(False))
        self._model_process = None

    def _on_model_process_error(self, _error: QProcess.ProcessError) -> None:
        self._model_refresh_btn.setEnabled(True)
        self._model_refresh_btn.setText("⟳")
        self._status_label.setText("⚠ 无法启动 opencode，保留默认列表")
        self._status_label.setStyleSheet(
            "color: #d29922; font-size: 12px; padding: 2px 4px;"
        )
        self._status_label.setVisible(True)
        QTimer.singleShot(3000, lambda: self._status_label.setVisible(False))
        self._model_process = None
