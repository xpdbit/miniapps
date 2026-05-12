# -*- coding: utf-8 -*-
"""
history_panel.py — 历史记录面板（已完成/失败任务）
"""
import tkinter as tk
from tkinter import ttk

from . import theme
from .card_list import STATUS_COLORS, STATUS_LABELS


class HistoryPanel(ttk.Frame):
    """历史记录面板：展示已完成和失败的任务列表"""

    def __init__(self, parent):
        super().__init__(parent)
        self._items: list[dict] = []
        self._setup_ui()

    def _setup_ui(self):
        # 工具栏
        toolbar = ttk.Frame(self)
        toolbar.pack(fill=tk.X, padx=4, pady=(4, 2))

        ttk.Label(toolbar, text="执行历史", style="Header.TLabel").pack(side=tk.LEFT)

        ttk.Button(toolbar, text="刷新",
                   command=self._refresh).pack(side=tk.RIGHT, padx=4)
        ttk.Button(toolbar, text="清空",
                   command=self._clear).pack(side=tk.RIGHT)

        # 历史列表区（Canvas + Scrollbar）
        fs = int(round(9 * theme.DPI_SCALE))
        frame = ttk.Frame(self)
        frame.pack(fill=tk.BOTH, expand=True, padx=4, pady=(2, 4))

        self._text = tk.Text(frame, wrap=tk.WORD, state=tk.DISABLED,
                             font=("Consolas", fs), bg="#0d1117", fg="#c9d1d9",
                             insertbackground="#c9d1d9", relief=tk.FLAT,
                             borderwidth=1, padx=8, pady=6,
                             highlightbackground="#30363d", highlightthickness=1)
        sb = ttk.Scrollbar(frame, orient=tk.VERTICAL, command=self._text.yview)
        self._text.configure(yscrollcommand=sb.set)
        self._text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        sb.pack(side=tk.RIGHT, fill=tk.Y)

        # 标签颜色
        for status, color in STATUS_COLORS.items():
            self._text.tag_configure(f"status_{status}", foreground=color)
        self._text.tag_configure("desc", foreground="#e6edf3")
        self._text.tag_configure("sep", foreground="#30363d")

    def set_tasks(self, tasks: list[dict]) -> None:
        """设置历史任务列表并刷新显示"""
        self._items = list(tasks)
        self._render()

    def _render(self) -> None:
        """渲染历史记录"""
        self._text.configure(state=tk.NORMAL)
        self._text.delete("1.0", tk.END)

        if not self._items:
            self._text.insert(tk.END, "(无历史记录)\n", "desc")
        else:
            for task in self._items:
                status = task.get("status", "pending")
                desc = task.get("description", "?")
                label = STATUS_LABELS.get(status, status)
                self._text.insert(tk.END, f"[{label}] ", f"status_{status}")
                self._text.insert(tk.END, f"{desc}\n", "desc")
                self._text.insert(tk.END, "─" * 40 + "\n", "sep")

        self._text.configure(state=tk.DISABLED)
        self._text.see(tk.END)

    def _refresh(self) -> None:
        """手动刷新"""
        self._render()

    def _clear(self) -> None:
        """清空显示"""
        self._items = []
        self._text.configure(state=tk.NORMAL)
        self._text.delete("1.0", tk.END)
        self._text.insert(tk.END, "(已清空)\n", "desc")
        self._text.configure(state=tk.DISABLED)
