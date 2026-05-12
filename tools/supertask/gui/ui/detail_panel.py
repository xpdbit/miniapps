# -*- coding: utf-8 -*-
"""
detail_panel.py — 任务详情卡片面板（暗色主题，文档卡片式垂直布局）
"""
import tkinter as tk
from tkinter import ttk
from typing import Callable, Optional

from .theme import THEME, DPI_SCALE, scale_px

STATUS_COLORS: dict[str, str] = {
    "pending": "#58a6ff",
    "done": "#3fb950",
    "error": "#f85149",
    "failed_blocked": "#d29922",
    "cancelled": "#8b949e",
}

STATUS_LABELS: dict[str, str] = {
    "pending": "待处理",
    "done": "完成",
    "error": "失败",
    "failed_blocked": "阻塞",
    "cancelled": "已取消",
}


class DetailPanel(ttk.LabelFrame):
    """任务详情卡片——文档卡片式垂直布局，含操作按钮"""

    def __init__(
        self,
        parent,
        on_approve: Optional[Callable[[list[int]], None]] = None,
        on_reject: Optional[Callable[[list[int]], None]] = None,
        on_remove: Optional[Callable[[list[int]], None]] = None,
        **kwargs,
    ):
        super().__init__(parent, text="  任务详情  ", padding=scale_px(6), **kwargs)
        self._desc_text: Optional[tk.Text] = None
        self._error_text: Optional[tk.Text] = None
        self._current_task: Optional[dict] = None
        self._on_approve = on_approve or (lambda ids: None)
        self._on_reject = on_reject or (lambda ids: None)
        self._on_remove = on_remove or (lambda ids: None)
        self._setup_card_ui()
        self.show_task(None)

    def _setup_card_ui(self):
        """构建文档卡片式垂直布局"""
        fs_label = scale_px(9)
        fs_content = scale_px(10)

        # ── 空状态 ────────────────────────────────
        self._empty_frame = ttk.Frame(self)
        self._empty_label = ttk.Label(
            self._empty_frame,
            text="选择一个任务以查看详情",
            foreground=THEME["text_secondary"],
            font=("", scale_px(11)),
            anchor="center",
        )
        self._empty_label.pack(expand=True, fill=tk.BOTH)
        self._empty_frame.pack(fill=tk.BOTH, expand=True)

        # ── 卡片容器 ──────────────────────────────
        # 使用 tk.Frame 支持 highlightbackground/highlightthickness 实现边框
        self._card_frame = tk.Frame(
            self,
            bg=THEME["surface"],
            highlightbackground=THEME["border"],
            highlightthickness=1,
        )
        # 卡片内部 padding
        self._card_inner = tk.Frame(self._card_frame, bg=THEME["surface"])
        self._card_inner.pack(fill=tk.BOTH, expand=True, padx=scale_px(12), pady=scale_px(10))

        # ── Header: 状态标志（第一行）+ ID（第二行）— 左上角垂直两行─
        self._status_label = ttk.Label(
            self._card_inner, text="",
            font=("", scale_px(11), "bold"),
        )
        self._status_label.pack(anchor="w", pady=(0, scale_px(2)))

        self._id_label = ttk.Label(
            self._card_inner, text="",
            foreground=THEME["text_secondary"],
            font=("", fs_content),
        )
        self._id_label.pack(anchor="w")

        ttk.Separator(self._card_inner, orient=tk.HORIZONTAL).pack(
            fill=tk.X, pady=(scale_px(6), scale_px(6)))

        # ── 描述标签 ──────────────────────────────
        ttk.Label(
            self._card_inner, text="  📝 描述",
            font=("", fs_label),
        ).pack(anchor="w", pady=(0, scale_px(2)))

        # ── 描述文本区（可扩展） ────────────────────
        desc_frame = ttk.Frame(self._card_inner)
        desc_frame.pack(fill=tk.BOTH, expand=True, pady=(0, scale_px(4)))

        self._desc_text = tk.Text(
            desc_frame,
            wrap=tk.WORD,
            state=tk.DISABLED,
            font=("Consolas", fs_content),
            bg=THEME["bg"],
            fg=THEME["text"],
            relief=tk.FLAT,
            borderwidth=1,
            padx=scale_px(8),
            pady=scale_px(6),
            highlightbackground=THEME["border"],
            highlightthickness=1,
        )
        self._desc_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        desc_sb = ttk.Scrollbar(desc_frame, orient=tk.VERTICAL, command=self._desc_text.yview)
        self._desc_text.configure(yscrollcommand=desc_sb.set)
        desc_sb.pack(side=tk.RIGHT, fill=tk.Y)

        # ── 错误区（默认隐藏）───────────────────────
        self._error_sep = ttk.Separator(self._card_inner, orient=tk.HORIZONTAL)

        self._error_title = ttk.Label(
            self._card_inner, text="  ⚠ 错误信息",
            foreground=THEME["error"],
            font=("", fs_label),
        )

        err_frame = ttk.Frame(self._card_inner)
        self._err_frame = err_frame

        self._error_text = tk.Text(
            err_frame,
            wrap=tk.WORD,
            state=tk.DISABLED,
            font=("Consolas", fs_content),
            bg=THEME["bg"],
            fg=THEME["error"],
            relief=tk.FLAT,
            borderwidth=1,
            padx=scale_px(8),
            pady=scale_px(6),
            highlightbackground=THEME["error"],
            highlightthickness=1,
        )
        self._error_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        err_sb = ttk.Scrollbar(err_frame, orient=tk.VERTICAL, command=self._error_text.yview)
        self._error_text.configure(yscrollcommand=err_sb.set)
        err_sb.pack(side=tk.RIGHT, fill=tk.Y)

        # ── 元数据区（默认隐藏）────────────────────
        self._meta_sep = ttk.Separator(self._card_inner, orient=tk.HORIZONTAL)

        meta = ttk.Frame(self._card_inner)
        self._meta_frame = meta

        self._priority_label = ttk.Label(meta, text="", font=("", fs_content))
        self._priority_label.pack(side=tk.LEFT, padx=(0, scale_px(16)))

        self._fail_count_label = ttk.Label(
            meta, text="", foreground=THEME["warning"], font=("", fs_content)
        )
        self._fail_count_label.pack(side=tk.LEFT)

        # ── 底部操作栏栏 ───────────────────────────
        ttk.Separator(self._card_inner, orient=tk.HORIZONTAL).pack(
            fill=tk.X, pady=(scale_px(6), scale_px(4)))

        footer = ttk.Frame(self._card_inner)
        footer.pack(fill=tk.X)

        self._approve_btn = ttk.Button(
            footer, text="批准", style="Primary.TButton",
            command=self._on_approve_clicked,
        )
        self._approve_btn.pack(side=tk.LEFT, padx=scale_px(2))

        self._reject_btn = ttk.Button(
            footer, text="驳回", style="Danger.TButton",
            command=self._on_reject_clicked,
        )
        self._reject_btn.pack(side=tk.LEFT, padx=scale_px(2))

        self._remove_btn = ttk.Button(
            footer, text="移除", style="Danger.TButton",
            command=self._on_remove_clicked,
        )
        self._remove_btn.pack(side=tk.LEFT, padx=scale_px(2))

        # 初始隐藏卡片
        self._card_frame.pack_forget()

    # ─── 操作按钮回调 ──────────────────────────

    def _on_approve_clicked(self):
        """点击批准：将当前任务 ID 传给回调"""
        if self._current_task and self._current_task.get("id") is not None:
            self._on_approve([self._current_task["id"]])

    def _on_reject_clicked(self):
        """点击驳回：将当前任务 ID 传给回调"""
        if self._current_task and self._current_task.get("id") is not None:
            self._on_reject([self._current_task["id"]])

    def _on_remove_clicked(self):
        """点击移除：将当前任务 ID 传给回调"""
        if self._current_task and self._current_task.get("id") is not None:
            self._on_remove([self._current_task["id"]])

    # ─── 公开 API ────────────────────────────────

    def show_task(self, task: Optional[dict] = None):
        """展示任务详情卡片，task 为 None 或空时显示空状态"""
        self._current_task = task

        if not task:
            self._card_frame.pack_forget()
            self._empty_frame.pack(fill=tk.BOTH, expand=True)
            return

        # 切换到卡片视图
        self._empty_frame.pack_forget()
        self._card_frame.pack(fill=tk.BOTH, expand=True)

        # 头部：状态标志 + ID
        status = task.get("status", "pending")
        label = STATUS_LABELS.get(status, status)
        color = STATUS_COLORS.get(status, THEME["text"])
        self._status_label.configure(text=f"● {label}", foreground=color)
        self._id_label.configure(text=f"ID: {task.get('id', '')}")

        # 描述区
        self._desc_text.configure(state=tk.NORMAL)
        self._desc_text.delete("1.0", tk.END)
        self._desc_text.insert("1.0", task.get("description", ""))
        self._desc_text.configure(state=tk.DISABLED)

        # 错误区（有条件显示）
        error_msg = task.get("error", "")
        if error_msg:
            self._error_sep.pack(fill=tk.X, pady=(scale_px(6), scale_px(2)))
            self._error_title.pack(anchor="w", pady=(0, scale_px(2)))
            self._err_frame.pack(fill=tk.BOTH, pady=(0, scale_px(4)))
            self._error_text.configure(state=tk.NORMAL)
            self._error_text.delete("1.0", tk.END)
            self._error_text.insert("1.0", error_msg)
            self._error_text.configure(state=tk.DISABLED)
        else:
            self._error_sep.pack_forget()
            self._error_title.pack_forget()
            self._err_frame.pack_forget()

        # 元数据栏（有条件显示）
        priority = task.get("priority", "")
        fail_count = task.get("fail_count", 0)
        if priority or fail_count:
            self._meta_sep.pack(fill=tk.X, pady=(scale_px(4), scale_px(2)))
            self._meta_frame.pack(fill=tk.X, pady=(0, scale_px(2)))
            p_text = f"优先级: {priority}" if priority else ""
            self._priority_label.configure(text=p_text)
            fc_text = f"失败次数: {fail_count}" if fail_count else ""
            self._fail_count_label.configure(text=fc_text)
        else:
            self._meta_sep.pack_forget()
            self._meta_frame.pack_forget()

        # 启用操作按钮
        self._approve_btn.configure(state=tk.NORMAL)
        self._reject_btn.configure(state=tk.NORMAL)
        self._remove_btn.configure(state=tk.NORMAL)
