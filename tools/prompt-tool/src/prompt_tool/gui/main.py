# -*- coding: utf-8 -*-
"""PyQt6 GUI 启动入口。"""
from __future__ import annotations

import sys
from pathlib import Path

from PyQt6.QtWidgets import QApplication, QMainWindow, QSplitter
from PyQt6.QtCore import Qt

from prompt_tool.gui.ui_pyqt.template_list import TemplateListPanel
from prompt_tool.gui.ui_pyqt.form_panel import FormPanel
from prompt_tool.gui.ui_pyqt.preview_panel import PreviewPanel


class MainWindow(QMainWindow):
    def __init__(self, project_root: str | None = None) -> None:
        super().__init__()
        self._project_root = project_root
        self.setWindowTitle("Prompt Tool — 提示词模板引擎")
        self.resize(1100, 700)

        # Determine .prompts/ path
        self._prompts_dir = self._resolve_prompts_dir()
        self._current_template: dict | None = None

        # 3-panel layout
        splitter = QSplitter(Qt.Orientation.Horizontal)

        self._template_list = TemplateListPanel(self._prompts_dir)
        self._form_panel = FormPanel()
        self._preview_panel = PreviewPanel()

        splitter.addWidget(self._template_list)
        splitter.addWidget(self._preview_panel)
        splitter.addWidget(self._form_panel)
        splitter.setSizes([250, 450, 300])

        self.setCentralWidget(splitter)

        # Connect signals
        self._template_list.template_selected.connect(self._on_template_selected)
        self._form_panel.values_changed.connect(self._on_values_changed)

        # Load initial templates
        self._template_list.refresh()

    def _resolve_prompts_dir(self) -> str:
        if self._project_root:
            return str(Path(self._project_root) / ".prompts")
        return str(Path.cwd() / ".prompts")

    def _on_template_selected(self, template_info: dict) -> None:
        self._current_template = template_info
        schema = template_info["schema"]
        self._form_panel.load_variables(schema.variables)
        self._preview_panel.show_template(schema.template)

    def _on_values_changed(self, values: dict) -> None:
        if not self._current_template:
            return
        schema = self._current_template["schema"]
        from prompt_tool.core.template_engine import parse_template
        from prompt_tool.core.renderer import render
        nodes = parse_template(schema.template)
        result = render(nodes, values)
        self._preview_panel.show_rendered(result)


def main(project_root: str | None = None) -> int:
    app = QApplication(sys.argv)
    app.setApplicationName("Prompt Tool")
    window = MainWindow(project_root=project_root)
    window.show()
    return app.exec()
