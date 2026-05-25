# -*- coding: utf-8 -*-
"""Windows 终端窗口焦点跳转。

通过 win32gui 查找并聚焦目标会话的终端窗口。
迁移自 core/window_focus.py，内容不变。
"""
from __future__ import annotations

import platform
from typing import Optional

try:
    import psutil as _psutil
    HAS_PSUTIL = True
except ImportError:
    _psutil = None  # type: ignore
    HAS_PSUTIL = False


def focus_terminal_window(session_id: str) -> bool:
    """将焦点切换到指定会话的终端窗口。

    Args:
        session_id: 目标会话 ID。

    Returns:
        是否成功定位并聚焦。
    """
    if platform.system() != "Windows":
        return False

    try:
        import win32con
        import win32gui
        import win32process
    except ImportError:
        return False

    target_hwnd: Optional[int] = None

    def enum_callback(hwnd: int, _) -> None:
        nonlocal target_hwnd
        if not win32gui.IsWindowVisible(hwnd):
            return
        text = win32gui.GetWindowText(hwnd)
        if session_id and session_id in text:
            target_hwnd = hwnd
            return
        if any(kw in text for kw in ["cmd.exe", "PowerShell", "终端", "Terminal"]):
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            if pid and _is_session_process(pid, session_id):
                target_hwnd = hwnd

    try:
        win32gui.EnumWindows(enum_callback, None)
    except Exception:
        return False

    if target_hwnd:
        try:
            win32gui.ShowWindow(target_hwnd, win32con.SW_RESTORE)
            win32gui.SetForegroundWindow(target_hwnd)
            return True
        except Exception:
            return False

    return False


def _is_session_process(pid: int, session_id: str) -> bool:
    """检查 PID 是否与 session_id 关联。"""
    if not HAS_PSUTIL or _psutil is None:
        return False
    try:
        proc = _psutil.Process(pid)
        cmdline = " ".join(proc.cmdline()).lower()
        return session_id.lower() in cmdline
    except (_psutil.NoSuchProcess, _psutil.AccessDenied):
        return False
