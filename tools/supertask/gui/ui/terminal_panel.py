# -*- coding: utf-8 -*-
"""
terminal_panel.py — 命令执行终端面板
每次命令独立运行 opencode run，异步捕获输出
"""
import tkinter as tk
from tkinter import ttk
import subprocess
import threading
import re
import os
from typing import Optional

from . import theme


class TerminalPanel(ttk.Frame):
    """命令终端 — 每次输入运行 opencode run，异步显示输出"""

    ANSI_COLORS = {
        "30": "#c9d1d9", "31": "#f85149", "32": "#3fb950", "33": "#d29922",
        "34": "#58a6ff", "35": "#bc8cff", "36": "#39c5cf", "37": "#c9d1d9",
        "90": "#8b949e", "91": "#ff7b72", "92": "#56d364", "93": "#e3b341",
        "94": "#79c0ff", "95": "#d2a8ff", "96": "#56d4dd", "97": "#f0f6fc",
    }

    def __init__(self, parent, working_dir: str = "."):
        super().__init__(parent)
        self.working_dir = working_dir
        self._running = False
        self._input_history: list[str] = []
        self._history_idx = 0
        self._setup_ui()
        self._bind_keys()

    # ─── UI 构建 ────────────────────────────────

    def _setup_ui(self):
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)

        fs = int(round(10 * theme.DPI_SCALE))  # 缩放后字号
        fs_sm = int(round(8 * theme.DPI_SCALE))

        # 终端显示区
        self._display = tk.Text(
            self, wrap=tk.WORD, state=tk.DISABLED,
            font=("Consolas", fs), bg="#0d1117", fg="#c9d1d9",
            insertbackground="#58a6ff", relief=tk.FLAT,
            borderwidth=0, padx=8, pady=6,
        )
        dsb = ttk.Scrollbar(self, orient=tk.VERTICAL, command=self._display.yview)
        self._display.configure(yscrollcommand=dsb.set)
        self._display.grid(row=0, column=0, sticky="nsew")
        dsb.grid(row=0, column=1, sticky="ns")

        # 配置 ANSI 颜色标签
        for code, color in self.ANSI_COLORS.items():
            self._display.tag_configure(f"c{code}", foreground=color)
            self._display.tag_configure(f"b{code}", foreground=color)
        self._display.tag_configure("bold", font=("Consolas", fs, "bold"))
        self._display.tag_configure("dim", foreground="#8b949e")
        self._display.tag_configure("prompt", foreground="#79c0ff", font=("Consolas", fs, "bold"))
        self._display.tag_configure("error", foreground="#f85149")
        self._display.tag_configure("success", foreground="#3fb950")
        self._display.tag_configure("info", foreground="#8b949e")

        # 输入栏
        input_frame = ttk.Frame(self)
        input_frame.grid(row=1, column=0, columnspan=2, sticky="ew", pady=(4, 0))

        ttk.Label(input_frame, text="$", font=("Consolas", fs, "bold")).pack(side=tk.LEFT, padx=(4, 4))
        self._input = ttk.Entry(input_frame, font=("Consolas", fs))
        self._input.pack(side=tk.LEFT, fill=tk.X, expand=True)
        self._input.bind("<Return>", self._on_enter)
        self._input.bind("<Up>", self._history_up)
        self._input.bind("<Down>", self._history_down)

        # 状态栏
        self._status = ttk.Label(
            self, text="就绪 — 输入命令后回车执行 opencode run",
            foreground="#8b949e", font=("Segoe UI", fs_sm),
        )
        self._status.grid(row=2, column=0, columnspan=2, sticky="ew", padx=4, pady=(2, 0))

    def _bind_keys(self):
        self._input.focus_set()

    # ─── 公开方法 ────────────────────────────────

    def send_command(self, text: str):
        """发送命令到终端执行（异步）"""
        if self._running:
            self._write_line("[!] 当前有命令正在执行，请等待完成\n", "error")
            return

        self._input_history.append(text)
        self._history_idx = len(self._input_history)
        self._input.delete(0, tk.END)

        self._write_line(f"$ {text}\n", "prompt")
        self._running = True
        self._status.configure(text="执行中...", foreground="#d29922")

        threading.Thread(target=self._run_command, args=(text,), daemon=True).start()

    def append_output(self, text: str):
        """公开方法：追加输出文本到终端显示区"""
        self._write_line(text + "\n")

    def is_running(self) -> bool:
        return self._running

    def stop_process(self):
        """终止当前命令（占位 — 子进程在线程内管理）"""
        self._write_line("[*] 终止请求已发送\n", "info")

    # ─── 命令执行 ────────────────────────────────

    def _run_command(self, prompt: str):
        """后台线程：运行 opencode run"""
        try:
            process = subprocess.Popen(
                ["opencode", "run", prompt],
                cwd=self.working_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True, encoding="utf-8", errors="replace",
                shell=True,
            )
            # 逐行读取输出
            for line in iter(process.stdout.readline, ""):
                if line:
                    self._write_line(line)
            process.stdout.close()
            returncode = process.wait(timeout=600)

            if returncode == 0:
                self._write_line("\n✓ 完成\n", "success")
                self._status_set("就绪", "#8b949e")
            else:
                self._write_line(f"\n✗ 退出码: {returncode}\n", "error")
                self._status_set(f"异常退出 ({returncode})", "#f85149")
        except subprocess.TimeoutExpired:
            self._write_line("\n⏱ 超时 (600s)\n", "error")
            self._status_set("超时", "#f85149")
        except FileNotFoundError:
            self._write_line("\n[!] opencode 未找到，请确保已安装并在 PATH 中\n", "error")
            self._status_set("opencode 未找到", "#f85149")
        except Exception as e:
            self._write_line(f"\n[!] 异常: {e}\n", "error")
            self._status_set("错误", "#f85149")
        finally:
            self._running = False
            self._input.focus_set()

    # ─── UI 更新（线程安全）─────────────────────

    def _write_line(self, text: str, color_tag: str | None = None):
        """在 UI 线程写入文本"""
        def _write():
            self._display.configure(state=tk.NORMAL)
            if color_tag:
                self._display.insert(tk.END, text, color_tag)
            else:
                self._process_ansi(text)
            self._display.see(tk.END)
            self._display.configure(state=tk.DISABLED)
        self.after(0, _write)

    def _status_set(self, text: str, color: str):
        def _set():
            self._status.configure(text=text, foreground=color)
        self.after(0, _set)

    def _process_ansi(self, text: str):
        """解析 ANSI 转义码，应用颜色标签"""
        parts = re.split(r"(\033\[[\d;]*m)", text)
        current_tags: list[str] = []

        for part in parts:
            if part.startswith("\033[") and part.endswith("m"):
                codes = part[2:-1].split(";")
                if not codes or codes == [""] or codes == ["0"]:
                    current_tags = []
                for code in codes:
                    if code == "0":
                        current_tags = []
                    elif code == "1":
                        current_tags.append("bold")
                    elif code == "2":
                        current_tags.append("dim")
                    elif code in self.ANSI_COLORS:
                        current_tags.append(f"c{code}")
            else:
                if part:
                    tags = tuple(current_tags) if current_tags else ()
                    self._display.insert(tk.END, part, tags)

    # ─── 输入处理 ────────────────────────────────

    def _on_enter(self, event):
        text = self._input.get().strip()
        if text:
            self.send_command(text)

    def _history_up(self, event):
        if self._input_history:
            self._history_idx = max(0, self._history_idx - 1)
            self._input.delete(0, tk.END)
            self._input.insert(0, self._input_history[self._history_idx])

    def _history_down(self, event):
        if self._history_idx < len(self._input_history) - 1:
            self._history_idx += 1
            self._input.delete(0, tk.END)
            self._input.insert(0, self._input_history[self._history_idx])
        else:
            self._history_idx = len(self._input_history)
            self._input.delete(0, tk.END)
