# -*- coding: utf-8 -*-
"""
task_panel.py — 提议列表 & 审批队列面板（暗色主题，CardList 卡片视图）
"""
import tkinter as tk
from tkinter import ttk
from typing import Callable, Optional

from .theme import THEME, DPI_SCALE, scale_px
from .card_list import CardList


class TaskPanel(ttk.Frame):
    """任务面板：左侧提议列表（CardList）+ 右侧审批队列（CardList）"""

    def __init__(self, parent, on_approve: Callable = None, on_remove: Callable = None,
                 on_reject: Callable = None):
        super().__init__(parent)
        self._on_approve = on_approve or (lambda ids: None)
        self._on_remove = on_remove or (lambda ids: None)
        self._on_reject = on_reject or (lambda ids: None)
        self._on_selection_change: Optional[Callable[[Optional[dict]], None]] = None
        self._proposed_items: list[dict] = []
        self._queue_items: list[dict] = []
        self._updating_selection = False

        self._setup_ui()

    def _setup_ui(self):
        """构建左右双列布局：提议列表 + 工作队列"""
        self.grid_columnconfigure(0, weight=1)
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # ── 左侧：AI 提议 ────────────────────────
        left = ttk.LabelFrame(self, text="  AI 提议  ", padding=scale_px(4))
        left.grid(row=0, column=0, sticky="nsew",
                  padx=(0, scale_px(2)), pady=scale_px(2))

        left_toolbar = ttk.Frame(left)
        left_toolbar.pack(fill=tk.X, pady=(0, scale_px(4)))

        ttk.Button(left_toolbar, text="批准选中", style="Primary.TButton",
                   command=self._approve_selected).pack(side=tk.LEFT, padx=scale_px(2))
        ttk.Button(left_toolbar, text="全部批准",
                   command=self._approve_all).pack(side=tk.LEFT, padx=scale_px(2))
        ttk.Button(left_toolbar, text="驳回选中", style="Danger.TButton",
                   command=self._reject_selected).pack(side=tk.LEFT, padx=scale_px(2))

        self._proposed_list = CardList(left)
        self._proposed_list.pack(fill=tk.BOTH, expand=True)
        self._proposed_list.set_on_selection_change(self._on_proposed_selection)

        # ── 右侧：工作队列 ──────────────────────
        right = ttk.LabelFrame(self, text="  工作队列  ", padding=scale_px(4))
        right.grid(row=0, column=1, sticky="nsew",
                   padx=(scale_px(2), 0), pady=scale_px(2))

        right_toolbar = ttk.Frame(right)
        right_toolbar.pack(fill=tk.X, pady=(0, scale_px(4)))

        ttk.Button(right_toolbar, text="移除选中", style="Danger.TButton",
                   command=self._remove_selected).pack(side=tk.LEFT, padx=scale_px(2))

        self._queue_list = CardList(right)
        self._queue_list.pack(fill=tk.BOTH, expand=True)
        self._queue_list.set_on_selection_change(self._on_queue_selection)

    # ─── 公开 API ────────────────────────────────

    def set_proposed(self, tasks: list[dict]) -> None:
        """设置提议列表"""
        self._proposed_items = list(tasks)
        self._proposed_list.set_items(tasks)

    def set_approved(self, tasks: list[dict]) -> None:
        """设置审批队列"""
        self._queue_items = list(tasks)
        self._queue_list.set_items(tasks)

    def set_on_selection_change(self, callback: Callable[[Optional[dict]], None]) -> None:
        """注册选中任务变化回调（供 MainWindow 更新 DetailPanel）"""
        self._on_selection_change = callback

    # ─── 选中变化处理 ───────────────────────────

    def _on_proposed_selection(self, _selected_ids: list[int]) -> None:
        """左侧提议列表选中变化 — 清除右侧选中后回调"""
        if self._updating_selection:
            return
        self._updating_selection = True
        try:
            self._queue_list.clear_selection()
            task = self._find_selected_task(self._proposed_list, self._proposed_items)
            if self._on_selection_change:
                self._on_selection_change(task)
        finally:
            self._updating_selection = False

    def _on_queue_selection(self, _selected_ids: list[int]) -> None:
        """右侧队列列表选中变化 — 清除左侧选中后回调"""
        if self._updating_selection:
            return
        self._updating_selection = True
        try:
            self._proposed_list.clear_selection()
            task = self._find_selected_task(self._queue_list, self._queue_items)
            if self._on_selection_change:
                self._on_selection_change(task)
        finally:
            self._updating_selection = False

    def _find_selected_task(self, card_list: CardList,
                            items: list[dict]) -> Optional[dict]:
        """从 CardList 的选中 ID 映射回完整任务 dict"""
        ids = card_list.get_selected()
        if not ids:
            return None
        for item in items:
            if item["id"] == ids[0]:
                return item
        return None

    # ─── 操作 ───────────────────────────────────

    def _approve_selected(self) -> None:
        """批准左侧选中的提议任务"""
        ids = self._proposed_list.get_selected()
        if ids:
            self._on_approve(ids)

    def _approve_all(self) -> None:
        """批准左侧全部提议任务"""
        ids = [item["id"] for item in self._proposed_items]
        if ids:
            self._on_approve(ids)

    def _remove_selected(self) -> None:
        """从右侧工作队列移除选中任务"""
        ids = self._queue_list.get_selected()
        if ids:
            self._on_remove(ids)

    def _reject_selected(self) -> None:
        """驳回左侧选中的提议任务"""
        ids = self._proposed_list.get_selected()
        if ids:
            self._on_reject(ids)
