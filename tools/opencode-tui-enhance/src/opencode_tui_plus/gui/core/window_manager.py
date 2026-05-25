# -*- coding: utf-8 -*-
"""窗口管理 — OC 终端窗口批量整合功能。

提供三种整合模式：
1. 平铺桌面 (tile) — 将各窗口网格排列于桌面工作区
2. 嵌入 OCE (embed) — 将窗口重设父窗口到 OCE 容器控件
3. 统一容器 (container) — 创建独立父窗口容纳所有终端
"""

from __future__ import annotations

import platform
from typing import Optional

_HAS_WIN32 = False
_win32_modules: tuple | None = None


def _ensure_win32():
    """延迟导入 win32 模块，返回 (win32api, win32con, win32gui, win32process)。"""
    global _HAS_WIN32, _win32_modules
    if _win32_modules is not None:
        return _win32_modules
    if platform.system() != "Windows":
        _win32_modules = None
        return None
    try:
        import win32api
        import win32con
        import win32gui
        import win32process
        _win32_modules = (win32api, win32con, win32gui, win32process)
        _HAS_WIN32 = True
        return _win32_modules
    except ImportError:
        _win32_modules = None
        return None


def list_oc_terminal_windows(session_ids: list[str]) -> list[int]:
    """枚举与 session_ids 匹配的所有终端窗口 HWND 列表。

    匹配规则：
    - 窗口标题中包含 session_id → 直接命中
    - 窗口是终端类型 (cmd/PowerShell/Windows Terminal) 且进程命令行包含 session_id

    Returns:
        HWND 整型列表。
    """
    if not session_ids:
        return []

    win32 = _ensure_win32()
    if win32 is None:
        return []
    _, _, win32gui, win32process = win32

    session_set = set(session_ids)
    found: list[int] = []

    # 对 ID 中含路径分隔符的做归一化
    sid_lower_map: dict[str, str] = {}
    for sid in session_ids:
        key = sid.lower()
        sid_lower_map[key] = sid

    def enum_callback(hwnd: int, _) -> None:
        if not win32gui.IsWindowVisible(hwnd):
            return

        text = win32gui.GetWindowText(hwnd)
        text_lower = text.lower()

        # 直接匹配窗口标题
        for sid in session_ids:
            if sid and sid in text:
                found.append(hwnd)
                return

        # 匹配终端窗口类型
        terminal_kw = [
            "cmd.exe", "powershell", "终端", "terminal",
            "command prompt", "windows powershell",
        ]
        if any(kw in text_lower for kw in terminal_kw):
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            if pid and _process_matches_any(pid, session_set):
                found.append(hwnd)

    try:
        win32gui.EnumWindows(enum_callback, None)
    except Exception:
        pass

    # 去重（以防重复匹配）
    seen: set[int] = set()
    unique: list[int] = []
    for h in found:
        if h not in seen:
            seen.add(h)
            unique.append(h)
    return unique


def _process_matches_any(pid: int, session_set: set[str]) -> bool:
    """检查进程命令行是否包含任一 session_id。"""
    try:
        import psutil
    except ImportError:
        return False
    try:
        proc = psutil.Process(pid)
        cmdline = " ".join(proc.cmdline()).lower()
        return any(sid.lower() in cmdline for sid in session_set)
    except Exception:
        return False


def tile_on_desktop(session_ids: list[str]) -> int:
    """将所有 OC 窗口平铺排列到桌面工作区。

    Returns:
        成功排列的窗口数。
    """
    hwnds = list_oc_terminal_windows(session_ids)
    if not hwnds:
        return 0

    win32 = _ensure_win32()
    if win32 is None:
        return 0
    win32api, win32con, win32gui, _ = win32

    # 获取当前主显示器工作区
    try:
        pt = (0, 0)
        monitor = win32api.MonitorFromPoint(pt)
        info = win32api.GetMonitorInfo(monitor)
    except Exception:
        return 0

    work = info.get("Work", (0, 0, 1920, 1080))
    left, top, right, bottom = work
    desk_w = max(right - left, 800)
    desk_h = max(bottom - top, 600)

    n = len(hwnds)
    cols = int(n ** 0.5)
    if cols * cols < n:
        cols += 1
    rows = (n + cols - 1) // cols

    cell_w = desk_w // cols
    cell_h = desk_h // rows

    count = 0
    for i, hwnd in enumerate(hwnds):
        try:
            win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
            col = i % cols
            row = i // cols
            win32gui.SetWindowPos(
                hwnd, 0,
                left + col * cell_w, top + row * cell_h,
                cell_w, cell_h,
                win32con.SWP_NOACTIVATE | win32con.SWP_NOZORDER,
            )
            count += 1
        except Exception:
            continue

    return count


def reparent_to_container(
    parent_hwnd: int,
    session_ids: list[str],
) -> int:
    """将 OC 窗口重设父窗口到指定的容器控件。

    移除窗口标题栏 / 边框 / 系统菜单，使其嵌入容器内部。

    Args:
        parent_hwnd: 容器 QWidget 的 HWND（通过 int(widget.winId()) 获取）
        session_ids: 活跃会话 ID 列表

    Returns:
        成功重设的窗口数。
    """
    hwnds = list_oc_terminal_windows(session_ids)
    if not hwnds:
        return 0

    win32 = _ensure_win32()
    if win32 is None:
        return 0
    _, win32con, win32gui, _ = win32

    success = 0
    for hwnd in hwnds:
        try:
            # 移除窗口装饰样式
            style = win32gui.GetWindowLong(hwnd, win32con.GWL_STYLE)
            style &= ~(
                win32con.WS_CAPTION
                | win32con.WS_THICKFRAME
                | win32con.WS_MINIMIZEBOX
                | win32con.WS_MAXIMIZEBOX
                | win32con.WS_SYSMENU
                | win32con.WS_DLGFRAME
                | win32con.WS_BORDER
            )
            win32gui.SetWindowLong(hwnd, win32con.GWL_STYLE, style)

            # 移除扩展样式（如工具窗口标识）
            ex_style = win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE)
            ex_style &= ~(
                win32con.WS_EX_WINDOWEDGE
                | win32con.WS_EX_CLIENTEDGE
                | win32con.WS_EX_DLGMODALFRAME
            )
            win32gui.SetWindowLong(hwnd, win32con.GWL_EXSTYLE, ex_style)

            # 重设父窗口
            win32gui.SetParent(hwnd, parent_hwnd)

            # 应用样式变更
            win32gui.SetWindowPos(
                hwnd, 0, 0, 0, 0, 0,
                win32con.SWP_NOMOVE | win32con.SWP_NOSIZE
                | win32con.SWP_NOZORDER | win32con.SWP_FRAMECHANGED
                | win32con.SWP_SHOWWINDOW,
            )
            success += 1
        except Exception:
            continue

    return success


def restore_windows(hwnds: list[int]) -> int:
    """将之前嵌入容器的窗口恢复到独立桌面窗口。

    分离父窗口、恢复标准标题栏和边框样式。

    Args:
        hwnds: 需要恢复的 HWND 列表。

    Returns:
        成功恢复的窗口数。
    """
    if not hwnds:
        return 0

    win32 = _ensure_win32()
    if win32 is None:
        return 0
    _, win32con, win32gui, _ = win32

    success = 0
    for hwnd in hwnds:
        try:
            # 分离父窗口 → 桌面
            win32gui.SetParent(hwnd, 0)

            # 恢复标准窗口样式
            style = win32gui.GetWindowLong(hwnd, win32con.GWL_STYLE)
            style |= (
                win32con.WS_CAPTION
                | win32con.WS_THICKFRAME
                | win32con.WS_MINIMIZEBOX
                | win32con.WS_MAXIMIZEBOX
                | win32con.WS_SYSMENU
            )
            win32gui.SetWindowLong(hwnd, win32con.GWL_STYLE, style)

            ex_style = win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE)
            ex_style |= (
                win32con.WS_EX_WINDOWEDGE
                | win32con.WS_EX_CLIENTEDGE
            )
            win32gui.SetWindowLong(hwnd, win32con.GWL_EXSTYLE, ex_style)

            win32gui.SetWindowPos(
                hwnd, 0, 0, 0, 0, 0,
                win32con.SWP_NOMOVE | win32con.SWP_NOSIZE
                | win32con.SWP_NOZORDER | win32con.SWP_FRAMECHANGED
                | win32con.SWP_SHOWWINDOW,
            )

            # 居中显示
            win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
            success += 1
        except Exception:
            continue

    return success
