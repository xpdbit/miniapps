# -*- coding: utf-8 -*-
"""Left panel — template list with search and categories."""
from __future__ import annotations

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QLineEdit, QTreeWidget,
    QTreeWidgetItem, QPushButton, QMessageBox,
)
from PyQt6.QtCore import pyqtSignal, Qt

from prompt_tool.core.template_loader import load_all_templates


class TemplateListPanel(QWidget):
    template_selected = pyqtSignal(dict)

    def __init__(self, prompts_dir: str, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._prompts_dir = prompts_dir
        self._templates: list[dict] = []

        layout = QVBoxLayout(self)
        layout.setContentsMargins(4, 4, 4, 4)

        self._search = QLineEdit()
        self._search.setPlaceholderText("搜索模板...")
        self._search.textChanged.connect(self._filter_templates)
        layout.addWidget(self._search)

        self._tree = QTreeWidget()
        self._tree.setHeaderHidden(True)
        self._tree.itemClicked.connect(self._on_item_clicked)
        layout.addWidget(self._tree, 1)

        btn_add = QPushButton("+ 新建模板")
        btn_add.clicked.connect(self._on_new_template)
        layout.addWidget(btn_add)

    def set_prompts_dir(self, d: str) -> None:
        self._prompts_dir = d
        self.refresh()

    def refresh(self) -> None:
        self._templates = load_all_templates(self._prompts_dir)
        self._build_tree("")

    def _build_tree(self, filter_text: str) -> None:
        self._tree.clear()
        categories: dict[str, list[dict]] = {}
        for t in self._templates:
            cat = t["schema"].category or "未分类"
            if filter_text.lower() in t["schema"].name.lower() or \
               filter_text.lower() in cat.lower():
                categories.setdefault(cat, []).append(t)

        for cat_name, templates in sorted(categories.items()):
            cat_item = QTreeWidgetItem([cat_name])
            cat_item.setFlags(cat_item.flags() & ~Qt.ItemFlag.ItemIsSelectable)
            for t in templates:
                item = QTreeWidgetItem([t["schema"].name])
                item.setData(0, Qt.ItemDataRole.UserRole, t)
                cat_item.addChild(item)
            self._tree.addTopLevelItem(cat_item)
            cat_item.setExpanded(True)

    def _filter_templates(self, text: str) -> None:
        self._build_tree(text)

    def _on_item_clicked(self, item: QTreeWidgetItem, column: int) -> None:
        data = item.data(0, Qt.ItemDataRole.UserRole)
        if data:
            self.template_selected.emit(data)

    def _on_new_template(self) -> None:
        QMessageBox.information(self, "新建", "模板编辑器将在后续版本实现")
