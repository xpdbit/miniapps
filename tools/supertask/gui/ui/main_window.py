# -*- coding: utf-8 -*-
"""
main_window.py — 主窗口布局（暗色主题 + 高 DPI + PanedWindow）
"""
import tkinter as tk
from tkinter import ttk, messagebox
from typing import Optional

from .theme import THEME, DPI_SCALE, scale_px, setup_high_dpi
from .control_panel import ControlPanel
from .task_panel import TaskPanel
from .detail_panel import DetailPanel
from .log_panel import LogPanel
from .terminal_panel import TerminalPanel
from .history_panel import HistoryPanel
from ..core.loop_manager import LoopManager


def setup_theme(root: tk.Tk, scale: float = 1.0):
    """配置 ttk 暗色主题（scale: DPI 缩放因子）"""
    style = ttk.Style(root)
    style.theme_use("clam")

    # 按缩放因子计算字号
    base_font = int(round(9 * scale))
    ui_font = ("Segoe UI", base_font)
    ui_font_bold = ("Segoe UI", base_font, "bold")
    header_font = ("Segoe UI", int(round(11 * scale)), "bold")
    mono_font = ("Consolas", int(round(10 * scale)))
    mono_sm = ("Consolas", int(round(9 * scale)))
    bold_font = ("Segoe UI", int(round(9 * scale)), "bold")

    # 全局默认
    style.configure(".", background=THEME["bg"], foreground=THEME["text"],
                    fieldbackground=THEME["surface"], borderwidth=1,
                    relief="flat", font=ui_font)

    # TFrame
    style.configure("TFrame", background=THEME["bg"])
    style.configure("Card.TFrame", background=THEME["surface"], relief="solid")

    # TLabel
    style.configure("TLabel", background=THEME["bg"], foreground=THEME["text"])
    style.configure("Secondary.TLabel", foreground=THEME["text_secondary"])
    style.configure("Header.TLabel", font=header_font, foreground=THEME["text"])

    # TButton
    pad = int(round(12 * scale)), int(round(6 * scale))
    pad_primary = int(round(14 * scale)), int(round(7 * scale))
    style.configure("TButton", background=THEME["surface"], foreground=THEME["text"],
                    borderwidth=1, padding=pad, font=ui_font)
    style.map("TButton",
              background=[("active", THEME["border"]), ("disabled", THEME["bg"])],
              foreground=[("disabled", THEME["text_secondary"])])

    # Primary button
    style.configure("Primary.TButton", background=THEME["primary"], foreground="#ffffff",
                    borderwidth=0, padding=pad_primary, font=bold_font)
    style.map("Primary.TButton", background=[("active", THEME["primary_hover"]),
                                              ("disabled", THEME["surface"])])

    # Danger button
    style.configure("Danger.TButton", background=THEME["error"], foreground="#ffffff",
                    borderwidth=0, padding=pad)
    style.map("Danger.TButton", background=[("active", "#ff7b72"),
                                             ("disabled", THEME["surface"])])

    # TLabelframe
    style.configure("TLabelframe", background=THEME["bg"], borderwidth=1,
                    relief="solid", bordercolor=THEME["border"])
    style.configure("TLabelframe.Label", background=THEME["bg"], foreground=THEME["text"],
                    font=bold_font)

    # TNotebook
    tab_pad = int(round(16 * scale)), int(round(8 * scale))
    style.configure("TNotebook", background=THEME["bg"], borderwidth=0)
    style.configure("TNotebook.Tab", background=THEME["surface"], foreground=THEME["text"],
                    padding=tab_pad, font=ui_font)
    style.map("TNotebook.Tab",
              background=[("selected", THEME["bg"])],
              foreground=[("selected", THEME["primary"])],
              expand=[("selected", [1, 1, 1, 0])])

    # TEntry
    style.configure("TEntry", fieldbackground=THEME["input_bg"],
                    foreground=THEME["input_fg"], insertcolor=THEME["text"])

    # TCheckbutton
    style.configure("TCheckbutton", background=THEME["bg"], foreground=THEME["text"])
    style.map("TCheckbutton", background=[("active", THEME["bg"])])

    # TProgressbar
    style.configure("TProgressbar", background=THEME["primary"], troughcolor=THEME["surface"],
                    borderwidth=0, thickness=int(round(4 * scale)))

    # TSeparator
    style.configure("TSeparator", background=THEME["border"])

    # TScrollbar
    style.configure("TScrollbar", background=THEME["surface"], troughcolor=THEME["bg"],
                    borderwidth=0, arrowcolor=THEME["text"])

    # 设置根窗口背景
    root.configure(bg=THEME["bg"])


class MainWindow:
    """SuperTask 主窗口"""

    def __init__(self, working_dir: str, state_dir: str, logs_dir: str):
        self.root = tk.Tk()
        self.root.title("SuperTask — AI 自主开发监督系统")
        self._working_dir = working_dir

        # 高 DPI 支持（必须在 theme 之前，返回缩放因子）
        self._scale = setup_high_dpi(self.root)

        # 暗色主题（传入缩放因子）
        setup_theme(self.root, self._scale)

        # 在当前屏幕全屏
        min_w = max(int(960 * self._scale), 800)
        min_h = max(int(600 * self._scale), 500)
        self.root.minsize(min_w, min_h)
        self.root.state("zoomed")

        # DPI 变化跟踪（用于跨显示器拖动时重绘）
        self._last_dpi = self._measure_dpi()
        self._rebuilding = False
        self._initialized = False
        self.root.bind("<Configure>", self._on_window_configure)

        # 循环管理器
        self._loop = LoopManager(
            working_dir=working_dir,
            state_dir=state_dir,
            logs_dir=logs_dir,
            on_log=self._on_log,
            on_agent_output=self._on_agent_output,
            on_state_change=self._refresh_all,
        )

        self._setup_ui()
        self._initialized = True
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

        # 初始刷新
        self.root.after(500, self._refresh_all)

    def _measure_dpi(self) -> float:
        """测量当前屏幕 DPI（每英寸像素数）"""
        return self.root.winfo_fpixels("1i")

    def _on_window_configure(self, event) -> None:
        """窗口移动/尺寸变化时检测 DPI 是否改变"""
        if event.widget is not self.root or self._rebuilding or not self._initialized:
            return
        # 防抖：短时间内只检测一次
        now = event.time
        if hasattr(self, "_last_configure") and now - self._last_configure < 200:
            return
        self._last_configure = now

        current_dpi = self._measure_dpi()
        if abs(current_dpi - self._last_dpi) > 1:
            self._last_dpi = current_dpi
            self._on_dpi_change()

    def _on_dpi_change(self) -> None:
        """DPI 变化时重建 UI（跨显示器拖动）"""
        new_scale = self._last_dpi / 96.0
        self._scale = new_scale
        # 更新模块级 DPI_SCALE（使 scale_px() 使用新值）
        from . import theme as _theme
        _theme.DPI_SCALE = new_scale
        # 重新应用主题
        setup_theme(self.root, new_scale)
        # 重建内容区域
        self._rebuild_content()
        # 重建后刷新
        self.root.after(200, self._refresh_all)

    def _rebuild_content(self) -> None:
        """销毁并重建 Notebook 内容区域"""
        self._rebuilding = True
        try:
            if self._content:
                self._content.destroy()
            self._create_content()
        finally:
            self._rebuilding = False

    def _setup_ui(self):
        # ── 控制面板（顶部）──────────────────────────
        self._control = ControlPanel(
            self.root,
            on_start=self._loop.start,
            on_stop=self._loop.stop,
            on_pause=self._loop.pause,
            on_resume=self._loop.resume,
            on_explore=self._loop.trigger_explore,
            on_execute=self._loop.trigger_execute,
        )
        self._control.pack(fill=tk.X, padx=scale_px(6), pady=(scale_px(6), scale_px(2)))

        # ── Notebook 内容区域（可重建）────────────
        self._content = ttk.Frame(self.root)
        self._content.pack(fill=tk.BOTH, expand=True, padx=scale_px(6), pady=(scale_px(2), scale_px(6)))
        self._create_content()

        # 定期更新按钮状态
        self._update_control_state()

    def _create_content(self):
        """创建 Notebook 内容（提议与工作 | 日志 | 终端 | 历史）"""
        notebook = ttk.Notebook(self._content)
        notebook.pack(fill=tk.BOTH, expand=True)

        # Tab 1: 提议与工作（PanedWindow: TaskPanel | DetailPanel）
        work_frame = ttk.Frame(notebook)
        pane = ttk.PanedWindow(work_frame, orient=tk.HORIZONTAL)

        self._task_panel = TaskPanel(
            pane,
            on_approve=self._on_approve,
            on_remove=self._on_remove,
            on_reject=self._on_reject,
        )
        pane.add(self._task_panel, weight=6)

        self._detail_panel = DetailPanel(
            pane,
            on_approve=self._on_approve,
            on_reject=self._on_reject,
            on_remove=self._on_remove,
        )
        pane.add(self._detail_panel, weight=4)

        pane.pack(fill=tk.BOTH, expand=True)
        notebook.add(work_frame, text="  提议与工作  ")

        # 连接 TaskPanel 选中 → DetailPanel
        self._task_panel.set_on_selection_change(self._on_task_selected)

        # Tab 2: 日志
        self._log_panel = LogPanel(notebook)
        notebook.add(self._log_panel, text="  日志  ")

        # Tab 3: 终端
        self._terminal = TerminalPanel(notebook, working_dir=self._working_dir)
        notebook.add(self._terminal, text="  终端  ")

        # Tab 4: 历史
        self._history_panel = HistoryPanel(notebook)
        notebook.add(self._history_panel, text="  历史  ")

        # 绑定终端到循环管理器
        self._loop.set_terminal(self._terminal)

    # ─── 回调 ───────────────────────────────────

    def _on_log(self, level: str, message: str):
        """日志回调（在 UI 线程调用）"""
        self.root.after(0, lambda: self._log_panel.append(level, message))

    def _on_agent_output(self, text: str):
        """Agent 输出回调 — 追加到终端显示区"""
        self.root.after(0, lambda: self._terminal.append_output(text))

    def _on_task_selected(self, task: Optional[dict] = None):
        """TaskPanel 选中变化时更新 DetailPanel"""
        self._detail_panel.show_task(task)

    def _refresh_all(self):
        """刷新所有面板，包括统计"""
        try:
            proposed = self._loop.fm.load_proposed()
            approved = self._loop.fm.load_approved()
            self.root.after(0, lambda: self._task_panel.set_proposed(proposed))
            self.root.after(0, lambda: self._task_panel.set_approved(approved))

            # 更新统计
            proposed_count = len(proposed)
            approved_count = len([t for t in approved if t.get("status") == "pending"])
            done_count = len([t for t in approved if t.get("status") == "done"])
            failed_count = len(
                [t for t in approved if t.get("status") in ("error", "failed_blocked")]
            )
            self.root.after(0, lambda: self._control.update_stats(
                proposed=proposed_count,
                approved=approved_count,
                done=done_count,
                failed=failed_count,
            ))

            # 刷新历史（已完成/失败任务）
            history_tasks = [t for t in approved
                             if t.get("status") in ("done", "error", "failed_blocked", "cancelled")]
            self.root.after(0, lambda: self._history_panel.set_tasks(history_tasks))
        except Exception:
            pass

    def _update_control_state(self):
        """更新控制面板按钮状态"""
        self._control.set_running(self._loop.is_running(), self._loop.is_paused())
        self.root.after(500, self._update_control_state)

    def _on_approve(self, task_ids):
        self._loop.fm.approve_tasks(task_ids)
        self._log_panel.append("decision", f"已批准 {len(task_ids)} 个任务")
        self._refresh_all()

    def _on_remove(self, task_ids):
        approved = self._loop.fm.load_approved()
        approved = [t for t in approved if t.get("id") not in task_ids]
        self._loop.fm.save_approved(approved)
        self._log_panel.append("decision", f"已移除 {len(task_ids)} 个任务")
        self._refresh_all()

    def _on_reject(self, task_ids):
        """驳回提议任务：从 proposed_tasks.yaml 中移除"""
        proposed = self._loop.fm.load_proposed()
        proposed = [t for t in proposed if t.get("id") not in task_ids]
        self._loop.fm.save_proposed(proposed)
        self._log_panel.append("decision", f"已驳回 {len(task_ids)} 个提议")
        self._refresh_all()

    def _on_close(self):
        if self._loop.is_running():
            if not messagebox.askyesno("确认退出", "循环正在运行，确定退出吗？"):
                return
        self._loop.stop()
        self.root.destroy()

    def run(self):
        self.root.mainloop()
