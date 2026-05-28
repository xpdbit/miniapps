# -*- coding: utf-8 -*-
"""Template editor dialog — YAML editing with validation."""
from __future__ import annotations

from pathlib import Path

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QPlainTextEdit, QDialogButtonBox,
    QMessageBox,
)
import yaml

from prompt_tool.core.models import TemplateSchema
from prompt_tool.core.template_loader import save_template


class EditorDialog(QDialog):
    def __init__(
        self,
        prompts_dir: str,
        filename: str | None = None,
        parent=None,
    ) -> None:
        super().__init__(parent)
        self._prompts_dir = prompts_dir
        self._filename = filename
        self.setWindowTitle(f"编辑模板 — {filename}" if filename else "新建模板")
        self.resize(600, 500)

        layout = QVBoxLayout(self)

        self._editor = QPlainTextEdit()
        self._editor.setPlaceholderText("在此编写 YAML 模板内容...")
        layout.addWidget(self._editor, 1)

        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Save |
            QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self._on_save)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

        if filename:
            path = Path(prompts_dir) / filename
            if path.exists():
                self._editor.setPlainText(path.read_text(encoding="utf-8"))

    def _on_save(self) -> None:
        text = self._editor.toPlainText().strip()
        if not text:
            QMessageBox.warning(self, "错误", "内容不能为空")
            return
        try:
            data = yaml.safe_load(text)
            schema = TemplateSchema(**data)
        except Exception as e:
            QMessageBox.warning(self, "校验失败", f"YAML 解析或校验错误:\n{e}")
            return

        if not self._filename:
            self._filename = f"{schema.name.lower().replace(' ', '-')}.yaml"

        path = str(Path(self._prompts_dir) / self._filename)
        save_template(path, schema)
        QMessageBox.information(self, "成功", f"模板已保存: {self._filename}")
        self.accept()
