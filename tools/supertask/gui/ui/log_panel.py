# -*- coding: utf-8 -*-
"""
log_panel.py — 彩色日志显示面板（暗色主题）
"""
import tkinter as tk
from tkinter import ttk
from datetime import datetime

from . import theme


class LogPanel(ttk.Frame):
    """彩色日志面板"""

    COLORS = {
        "info": "#3fb950",
        "error": "#f85149",
        "decision": "#58a6ff",
        "approved": "#bc8cff",
    }
    PREFIX = {
        "info": "·",
        "error": "✗",
        "decision": "▶",
        "approved": "✓",
    }

    def __init__(self, parent):
        super().__init__(parent)
        self._setup_ui()

    def _setup_ui(self):
        # 工具栏
        toolbar = ttk.Frame(self)
        toolbar.pack(fill=tk.X, padx=4, pady=(4, 2))

        ttk.Label(toolbar, text="运行日志", style="Header.TLabel").pack(side=tk.LEFT)

        right = ttk.Frame(toolbar)
        right.pack(side=tk.RIGHT)

        self._auto_scroll = tk.BooleanVar(value=True)
        ttk.Checkbutton(right, text="自动滚动", variable=self._auto_scroll).pack(side=tk.RIGHT, padx=4)
        ttk.Button(right, text="清空", command=self._clear).pack(side=tk.RIGHT)

        # 日志文本区
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

        for level, color in self.COLORS.items():
            self._text.tag_configure(level, foreground=color)
        self._text.tag_configure("ts", foreground="#8b949e")

    def append(self, level: str, message: str):
        """添加一条日志"""
        self._text.configure(state=tk.NORMAL)
        prefix = self.PREFIX.get(level, "·")
        ts = datetime.now().strftime("%H:%M:%S")
        self._text.insert(tk.END, f"[{ts}] ", "ts")
        self._text.insert(tk.END, f"{prefix} {message}\n", level)
        self._text.configure(state=tk.DISABLED)

        if self._auto_scroll.get():
            self._text.see(tk.END)

    def _clear(self):
        self._text.configure(state=tk.NORMAL)
        self._text.delete("1.0", tk.END)
        self._text.configure(state=tk.DISABLED)
