# -*- coding: utf-8 -*-
"""Center panel — template source and rendered preview."""
from __future__ import annotations

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QTabWidget, QPlainTextEdit,
    QPushButton, QApplication,
)


class PreviewPanel(QWidget):
    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)

        self._tabs = QTabWidget()

        # Source tab
        self._source_edit = QPlainTextEdit()
        self._source_edit.setReadOnly(True)
        self._tabs.addTab(self._source_edit, "模板源码")

        # Preview tab
        self._preview_edit = QPlainTextEdit()
        self._preview_edit.setReadOnly(True)
        self._tabs.addTab(self._preview_edit, "渲染预览")

        layout.addWidget(self._tabs, 1)

        # Copy button
        self._copy_btn = QPushButton("📋 复制到剪贴板")
        self._copy_btn.clicked.connect(self._copy_to_clipboard)
        layout.addWidget(self._copy_btn)

    def show_template(self, source: str) -> None:
        self._source_edit.setPlainText(source)

    def show_rendered(self, text: str) -> None:
        self._preview_edit.setPlainText(text)
        self._tabs.setCurrentIndex(1)

    def _copy_to_clipboard(self) -> None:
        text = self._preview_edit.toPlainText()
        if text:
            QApplication.clipboard().setText(text)
