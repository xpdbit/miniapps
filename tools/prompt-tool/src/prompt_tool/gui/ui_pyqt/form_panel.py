# -*- coding: utf-8 -*-
"""Right panel — dynamic form generated from template variables."""
from __future__ import annotations

from typing import Any

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QFormLayout, QLineEdit,
    QPlainTextEdit, QComboBox, QCheckBox, QSpinBox, QLabel,
)
from PyQt6.QtCore import pyqtSignal

from prompt_tool.core.models import VariableDef


class FormPanel(QWidget):
    values_changed = pyqtSignal(dict)

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)

        title = QLabel("<b>变量填写</b>")
        layout.addWidget(title)

        self._form_layout = QFormLayout()
        layout.addLayout(self._form_layout)
        layout.addStretch()

        self._widgets: dict[str, QWidget] = {}

    def load_variables(self, variables: list[VariableDef]) -> None:
        self._widgets.clear()
        while self._form_layout.count():
            item = self._form_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        for var in variables:
            w = self._create_widget(var)
            self._widgets[var.name] = w
            self._form_layout.addRow(f"{var.label}{' *' if var.required else ''}:", w)

    def _create_widget(self, var: VariableDef) -> QWidget:
        if var.type == "text":
            w = QLineEdit()
            if var.default is not None:
                w.setText(str(var.default))
            w.textChanged.connect(self._emit_values)
        elif var.type == "textarea":
            w = QPlainTextEdit()
            if var.default is not None:
                w.setPlainText(str(var.default))
            w.textChanged.connect(self._emit_values)  # type: ignore[assignment]
        elif var.type == "select":
            w = QComboBox()
            if var.options:
                w.addItems(var.options)
                if var.default and var.default in var.options:
                    w.setCurrentText(str(var.default))
            w.currentTextChanged.connect(self._emit_values)
        elif var.type == "boolean":
            w = QCheckBox()
            if var.default:
                w.setChecked(bool(var.default))
            w.stateChanged.connect(self._emit_values)  # type: ignore[assignment]
        elif var.type == "number":
            w = QSpinBox()
            w.setRange(-99999, 99999)
            if var.default is not None:
                w.setValue(int(var.default))
            w.valueChanged.connect(self._emit_values)  # type: ignore[assignment]
        else:
            w = QLineEdit()
        return w

    def get_values(self) -> dict[str, Any]:
        values: dict[str, Any] = {}
        for name, w in self._widgets.items():
            if isinstance(w, QLineEdit):
                values[name] = w.text()
            elif isinstance(w, QPlainTextEdit):
                values[name] = w.toPlainText()
            elif isinstance(w, QComboBox):
                values[name] = w.currentText()
            elif isinstance(w, QCheckBox):
                values[name] = w.isChecked()
            elif isinstance(w, QSpinBox):
                values[name] = w.value()
        return values

    def _emit_values(self, *args: Any) -> None:
        self.values_changed.emit(self.get_values())
