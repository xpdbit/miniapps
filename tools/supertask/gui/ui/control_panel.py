# -*- coding: utf-8 -*-
"""
control_panel.py — 启停控制面板（暗色主题）
"""
import tkinter as tk
from tkinter import ttk
from typing import Callable

from . import theme
from .theme import THEME, DPI_SCALE, scale_px


class ControlPanel(ttk.Frame):
    """控制面板：启停、暂停、手动触发"""

    STATUS_COLORS = {
        "stopped": "#8b949e",
        "running": "#3fb950",
        "paused": "#d29922",
        "error": "#f85149",
    }

    def __init__(self, parent,
                 on_start: Callable = None, on_stop: Callable = None,
                 on_pause: Callable = None, on_resume: Callable = None,
                 on_explore: Callable = None, on_execute: Callable = None):
        super().__init__(parent, padding=(8, 6))
        self._callbacks = {
            "start": on_start, "stop": on_stop,
            "pause": on_pause, "resume": on_resume,
            "explore": on_explore, "execute": on_execute,
        }
        self._setup_ui()

    def _setup_ui(self):
        # 左侧：启停按钮组
        btn_frame = ttk.Frame(self)
        btn_frame.pack(side=tk.LEFT)

        self._start_btn = ttk.Button(btn_frame, text="▶ 启动循环",
                                     style="Primary.TButton",
                                     command=lambda: self._call("start"))
        self._start_btn.pack(side=tk.LEFT, padx=2)

        self._stop_btn = ttk.Button(btn_frame, text="■ 停止",
                                    style="Danger.TButton",
                                    command=lambda: self._call("stop"), state=tk.DISABLED)
        self._stop_btn.pack(side=tk.LEFT, padx=2)

        self._pause_btn = ttk.Button(btn_frame, text="⏸ 暂停",
                                     command=lambda: self._call("pause"), state=tk.DISABLED)
        self._pause_btn.pack(side=tk.LEFT, padx=2)

        # 分隔
        ttk.Separator(self, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10, pady=4)

        # 手动触发
        ttk.Button(self, text="🔍 手动探索",
                   command=lambda: self._call("explore")).pack(side=tk.LEFT, padx=2)
        ttk.Button(self, text="▶ 手动执行",
                   command=lambda: self._call("execute")).pack(side=tk.LEFT, padx=2)

        # 右侧：状态指示
        right_frame = ttk.Frame(self)
        right_frame.pack(side=tk.RIGHT)

        self._progress = ttk.Progressbar(right_frame, mode="indeterminate", length=100)
        self._progress.pack(side=tk.RIGHT, padx=(4, 0))

        self._status_label = ttk.Label(right_frame, text="● 已停止",
                                       foreground=self.STATUS_COLORS["stopped"],
                                       font=("Segoe UI", int(round(9 * theme.DPI_SCALE)), "bold"))
        self._status_label.pack(side=tk.RIGHT, padx=4)

        # ─── 底部状态统计栏 ────────────────────────────
        stats_sep = ttk.Separator(self, orient=tk.HORIZONTAL)
        stats_sep.pack(fill=tk.X, pady=(scale_px(6), 0))

        stats_frame = ttk.Frame(self)
        stats_frame.pack(fill=tk.X, pady=(scale_px(2), 0))

        stat_font = ("Segoe UI", scale_px(9))

        self._stat_proposed = ttk.Label(
            stats_frame, text="待审批: 0",
            foreground=THEME["primary"], font=stat_font)
        self._stat_proposed.pack(side=tk.LEFT, padx=scale_px(12))

        self._stat_approved = ttk.Label(
            stats_frame, text="排队中: 0",
            foreground=THEME["cyan"], font=stat_font)
        self._stat_approved.pack(side=tk.LEFT, padx=scale_px(12))

        self._stat_done = ttk.Label(
            stats_frame, text="已完成: 0",
            foreground=THEME["success"], font=stat_font)
        self._stat_done.pack(side=tk.LEFT, padx=scale_px(12))

        self._stat_failed = ttk.Label(
            stats_frame, text="已失败: 0",
            foreground=THEME["error"], font=stat_font)
        self._stat_failed.pack(side=tk.LEFT, padx=scale_px(12))

    def _call(self, name: str):
        cb = self._callbacks.get(name)
        if cb:
            cb()

    def set_running(self, running: bool, paused: bool = False):
        """更新按钮状态"""
        if running:
            self._start_btn.configure(state=tk.DISABLED)
            self._stop_btn.configure(state=tk.NORMAL)
            self._pause_btn.configure(state=tk.NORMAL)
            self._progress.start(50)

            if paused:
                self._status_label.configure(text="⏸ 已暂停",
                                             foreground=self.STATUS_COLORS["paused"])
                self._pause_btn.configure(text="▶ 恢复")
            else:
                self._status_label.configure(text="● 运行中",
                                             foreground=self.STATUS_COLORS["running"])
                self._pause_btn.configure(text="⏸ 暂停")
        else:
            self._start_btn.configure(state=tk.NORMAL)
            self._stop_btn.configure(state=tk.DISABLED)
            self._pause_btn.configure(state=tk.DISABLED)
            self._progress.stop()
            self._status_label.configure(text="● 已停止",
                                         foreground=self.STATUS_COLORS["stopped"])

    def update_stats(self, proposed: int = 0, approved: int = 0,
                     done: int = 0, failed: int = 0):
        """更新统计数字（线程安全）"""
        def _update():
            self._stat_proposed.configure(text=f"待审批: {proposed}")
            self._stat_approved.configure(text=f"排队中: {approved}")
            self._stat_done.configure(text=f"已完成: {done}")
            self._stat_failed.configure(text=f"已失败: {failed}")
        self.after(0, _update)
