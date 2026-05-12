# -*- coding: utf-8 -*-
"""
theme.py — 主题色彩、DPI 检测与缩放（无循环导入）
"""
import sys
import ctypes

# ─── 主题色彩 ──────────────────────────────────

THEME = {
    "bg": "#0d1117",
    "surface": "#161b22",
    "border": "#30363d",
    "text": "#e6edf3",
    "text_secondary": "#8b949e",
    "primary": "#58a6ff",
    "primary_hover": "#79c0ff",
    "success": "#3fb950",
    "warning": "#d29922",
    "error": "#f85149",
    "purple": "#bc8cff",
    "cyan": "#39c5cf",
    "input_bg": "#0d1117",
    "input_fg": "#c9d1d9",
    "select_bg": "#1f6feb",
    "select_fg": "#ffffff",
}

# ─── DPI 缩放 ──────────────────────────────────

DPI_SCALE: float = 1.0


def scale_px(n: int) -> int:
    """Scale pixel value by DPI_SCALE"""
    return max(1, round(n * DPI_SCALE))


def get_windows_scaling() -> float:
    """获取 Windows 实际显示缩放比例（多重回退策略）"""
    if sys.platform != "win32":
        return 1.0

    for method in (_dpi_from_temp_window, _dpi_from_desktop_dc, _dpi_from_registry):
        try:
            result = method()
            if result and result > 1.0:
                return result
        except Exception:
            continue
    return 1.0


def _dpi_from_temp_window() -> float:
    """通过临时窗口获取实际 DPI（Win10 1607+ GetDpiForWindow）"""
    try:
        hwnd = ctypes.windll.user32.CreateWindowExW(
            0, "STATIC", "", 0, 0, 0, 0, 0, 0, 0, 0, 0
        )
        if not hwnd:
            return 0.0
        try:
            dpi = ctypes.windll.user32.GetDpiForWindow(hwnd)
            return dpi / 96.0 if dpi > 0 else 0.0
        finally:
            ctypes.windll.user32.DestroyWindow(hwnd)
    except Exception:
        return 0.0


def _dpi_from_desktop_dc() -> float:
    """通过桌面 DC 获取 LOGPIXELSX"""
    hdc = ctypes.windll.user32.GetDC(0)
    if not hdc:
        return 0.0
    try:
        dpi_x = ctypes.windll.gdi32.GetDeviceCaps(hdc, 88)
        return dpi_x / 96.0 if dpi_x > 0 else 0.0
    finally:
        ctypes.windll.user32.ReleaseDC(0, hdc)


def _dpi_from_registry() -> float:
    """从注册表读取 Windows 缩放设置"""
    import winreg
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER,
            r"Control Panel\Desktop\WindowMetrics")
        applied_dpi, _ = winreg.QueryValueEx(key, "AppliedDPI")
        winreg.CloseKey(key)
        return applied_dpi / 96.0 if applied_dpi > 0 else 0.0
    except Exception:
        return 0.0


def setup_high_dpi(root) -> float:
    """启用高 DPI 支持，返回缩放因子"""
    global DPI_SCALE

    if sys.platform != "win32":
        DPI_SCALE = 1.0
        return 1.0

    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except Exception:
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass

    scale = get_windows_scaling()
    scale = max(1.0, scale)

    root.tk.call("tk", "scaling", scale)
    DPI_SCALE = scale
    return scale
