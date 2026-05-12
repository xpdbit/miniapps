# -*- coding: utf-8 -*-
"""
card_list.py — Canvas 绘制的卡片列表组件，替代 Treeview
"""
import tkinter as tk
from tkinter import ttk
from typing import Callable

from .theme import THEME, DPI_SCALE, scale_px

# ─── 颜色常量（不依赖 DPI）───────────────────────────

STATUS_COLORS = {
    "pending": "#58a6ff",
    "done": "#3fb950",
    "error": "#f85149",
    "failed_blocked": "#d29922",
    "cancelled": "#8b949e",
}

STATUS_LABELS = {
    "pending": "待处理",
    "done": "完成",
    "error": "失败",
    "failed_blocked": "阻塞",
    "cancelled": "已取消",
}


class CardList(ttk.Frame):
    """Canvas 绘制的卡片列表，支持多选、悬停高亮、滚轮滚动、键盘导航"""

    def __init__(self, parent, **kwargs):
        super().__init__(parent, **kwargs)

        # ─── DPI 缩放常量（__init__ 中计算，此时 DPI_SCALE 已正确设置）─
        self._card_height = scale_px(60)
        self._card_margin = scale_px(4)
        self._card_padding = scale_px(8)
        self._left_border = scale_px(4)
        self._font_size = scale_px(10)
        self._badge_size = scale_px(8)

        # ─── 数据状态 ────────────────────────────
        self._items: list[dict] = []
        self._selected: set[int] = set()
        self._hover_idx: int | None = None
        self._last_clicked_idx: int | None = None
        self._on_selection_change: Callable[[list[int]], None] | None = None
        self._canvas_width: int = 0

        # ─── Canvas + Scrollbar ──────────────────
        self._canvas = tk.Canvas(
            self,
            bg=THEME["bg"],
            highlightthickness=0,
            relief=tk.FLAT,
        )
        self._scrollbar = ttk.Scrollbar(
            self,
            orient=tk.VERTICAL,
            command=self._canvas.yview,
        )
        self._canvas.configure(yscrollcommand=self._scrollbar.set)

        self._canvas.pack(side=tk.LEFT, expand=True, fill=tk.BOTH)
        self._scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        # ─── 事件绑定 ────────────────────────────
        self._canvas.bind("<Configure>", self._on_configure)
        self._canvas.bind("<Button-1>", self._on_click)
        self._canvas.bind("<Control-Button-1>", self._on_ctrl_click)
        self._canvas.bind("<Shift-Button-1>", self._on_shift_click)
        self._canvas.bind("<Motion>", self._on_motion)
        self._canvas.bind("<Leave>", self._on_leave)
        self._canvas.bind("<MouseWheel>", self._on_mousewheel)       # Windows
        self._canvas.bind("<Button-4>", self._on_mousewheel)         # Linux up
        self._canvas.bind("<Button-5>", self._on_mousewheel)         # Linux down
        self._canvas.bind("<Up>", self._on_key_up)
        self._canvas.bind("<Down>", self._on_key_down)
        self._canvas.bind("<Home>", self._on_key_home)
        self._canvas.bind("<End>", self._on_key_end)

        # 让 canvas 可聚焦以接收键盘事件
        self._canvas.focus_set()

    # ─── 公开 API ────────────────────────────────

    def set_on_selection_change(self, callback: Callable[[list[int]], None]) -> None:
        """注册选中项变化回调"""
        self._on_selection_change = callback

    def set_items(self, items: list[dict]) -> None:
        """设置数据项并重绘

        每个 item dict 应包含:
            id (int):          唯一标识
            description (str): 描述文字
            status (str):      状态 (pending/done/error/failed_blocked/cancelled)
        """
        self._items = list(items)
        self._selected.clear()
        self._last_clicked_idx = None
        self._hover_idx = None
        self.draw_items()
        self._fire_selection_change()

    def get_selected(self) -> list[int]:
        """返回已选中的 item id 列表（排序）"""
        return sorted(self._selected)

    def clear_selection(self) -> None:
        """清空选中状态"""
        if self._selected:
            self._selected.clear()
            self._last_clicked_idx = None
            self.draw_items()
            self._fire_selection_change()

    # ─── 绘制 ────────────────────────────────────

    def draw_items(self) -> None:
        """清空并重新绘制所有卡片"""
        self._canvas.delete("cards")

        if not self._items:
            self._canvas.configure(scrollregion=(0, 0, 0, 0))
            return

        total_h = self._card_margin + len(self._items) * (self._card_height + self._card_margin)
        w = max(self._canvas_width, 1)
        self._canvas.configure(scrollregion=(0, 0, w, total_h))

        for idx in range(len(self._items)):
            self._draw_card(idx)

    def _draw_card(self, idx: int) -> None:
        """绘制单张卡片"""
        item = self._items[idx]
        is_selected = item["id"] in self._selected
        is_hovered = idx == self._hover_idx

        y = self._card_margin + idx * (self._card_height + self._card_margin)
        w = max(self._canvas_width - 2 * self._card_margin, 1)
        h = self._card_height

        # ── 背景 ──
        if is_selected:
            bg_color = THEME["select_bg"]
        elif is_hovered:
            bg_color = THEME["border"]
        else:
            bg_color = THEME["surface"]

        outline_color = (
            STATUS_COLORS.get(item.get("status", "pending"), "#58a6ff")
            if is_selected
            else THEME["border"]
        )

        self._canvas.create_rectangle(
            self._card_margin, y, self._card_margin + w, y + h,
            fill=bg_color, outline=outline_color,
            tags=("cards",),
        )

        # ── 左侧彩色边框 ──
        border_color = STATUS_COLORS.get(item.get("status", "pending"), "#58a6ff")
        self._canvas.create_rectangle(
            self._card_margin, y, self._card_margin + self._left_border, y + h,
            fill=border_color, outline="",
            tags=("cards",),
        )

        # ── 描述文字 ──
        text_x = self._card_margin + self._card_padding + self._left_border + scale_px(8)
        text_y = y + self._card_padding
        text_max_w = w - self._card_padding * 2 - self._left_border - scale_px(50)

        self._canvas.create_text(
            text_x, text_y,
            text=item.get("description", ""),
            anchor="nw",
            width=max(text_max_w, 1),
            fill=THEME["text"],
            font=("Segoe UI", self._font_size),
            tags=("cards",),
        )

        # ── 状态徽标 ──
        badge_text = STATUS_LABELS.get(item.get("status", "pending"), "?")
        badge_color = STATUS_COLORS.get(item.get("status", "pending"), "#58a6ff")
        badge_x = self._card_margin + w - scale_px(8)
        badge_y = y + self._card_padding

        self._canvas.create_text(
            badge_x, badge_y,
            text=badge_text,
            anchor="ne",
            fill=badge_color,
            font=("Segoe UI", self._badge_size, "bold"),
            tags=("cards",),
        )

    # ─── 坐标转换 ─────────────────────────────────

    def _get_card_at(self, canvas_y: float) -> int | None:
        """根据 Canvas y 坐标返回卡片索引 (canvasy() 返回 float)"""
        if not self._items:
            return None

        canvas_y_int = int(canvas_y)
        adjusted = canvas_y_int - self._card_margin
        if adjusted < 0:
            return None

        card_step = self._card_height + self._card_margin
        idx = adjusted // card_step

        if idx >= len(self._items):
            return None

        # 检查是否落在卡片区域内（而非 margin 间隙）
        card_top = self._card_margin + idx * card_step
        card_bottom = card_top + self._card_height
        if not (card_top <= canvas_y_int < card_bottom):
            return None

        return idx

    def _clamp_index(self, idx: int) -> int:
        """将索引限制在有效范围内"""
        if not self._items:
            return -1
        return max(0, min(idx, len(self._items) - 1))

    # ─── 事件处理：鼠标 ───────────────────────────

    def _on_configure(self, event) -> None:
        """Canvas 大小变化时重绘"""
        self._canvas_width = event.width
        self.draw_items()

    def _on_click(self, event) -> None:
        """单击：选中单个"""
        self._canvas.focus_set()
        canvas_y = self._canvas.canvasy(event.y)
        idx = self._get_card_at(canvas_y)
        if idx is not None and 0 <= idx < len(self._items):
            item = self._items[idx]
            if "id" in item:
                self._selected = {item["id"]}
                self._last_clicked_idx = idx
                self.draw_items()
                self._fire_selection_change()

    def _on_ctrl_click(self, event) -> None:
        """Ctrl+单击：切换选中"""
        self._canvas.focus_set()
        canvas_y = self._canvas.canvasy(event.y)
        idx = self._get_card_at(canvas_y)
        if idx is not None and 0 <= idx < len(self._items):
            item = self._items[idx]
            if "id" in item:
                item_id = item["id"]
                if item_id in self._selected:
                    self._selected.discard(item_id)
                else:
                    self._selected.add(item_id)
                self._last_clicked_idx = idx
                self.draw_items()
                self._fire_selection_change()

    def _on_shift_click(self, event) -> None:
        """Shift+单击：范围选择"""
        self._canvas.focus_set()
        canvas_y = self._canvas.canvasy(event.y)
        click_idx = self._get_card_at(canvas_y)
        if click_idx is None or not (0 <= click_idx < len(self._items)):
            return

        if not self._selected or self._last_clicked_idx is None:
            item = self._items[click_idx]
            if "id" in item:
                self._selected = {item["id"]}
        else:
            start = min(self._last_clicked_idx, click_idx)
            end = max(self._last_clicked_idx, click_idx)
            self._selected = set()
            for i in range(start, end + 1):
                if i < len(self._items) and "id" in self._items[i]:
                    self._selected.add(self._items[i]["id"])

        self._last_clicked_idx = click_idx
        self.draw_items()
        self._fire_selection_change()

    def _on_motion(self, event) -> None:
        """鼠标悬停：高亮效果"""
        canvas_y = self._canvas.canvasy(event.y)
        idx = self._get_card_at(canvas_y)

        if idx != self._hover_idx:
            self._hover_idx = idx
            self.draw_items()

    def _on_leave(self, event) -> None:
        """鼠标离开：清除高亮"""
        if self._hover_idx is not None:
            self._hover_idx = None
            self.draw_items()

    def _on_mousewheel(self, event) -> None:
        """鼠标滚轮滚动"""
        if event.num == 4:          # Linux 向上
            scroll = -1
        elif event.num == 5:        # Linux 向下
            scroll = 1
        else:                       # Windows (event.delta: >0 向上, <0 向下)
            scroll = -1 if event.delta > 0 else 1

        self._canvas.yview_scroll(scroll, "units")

    # ─── 事件处理：键盘导航（弥补 Treeview 缺失）────────

    def _select_index(self, idx: int) -> None:
        """选中指定索引的卡片"""
        if not self._items or idx < 0 or idx >= len(self._items):
            return
        self._selected = {self._items[idx]["id"]}
        self._last_clicked_idx = idx

        # 确保选中项可见
        card_y = self._card_margin + idx * (self._card_height + self._card_margin)
        self._canvas.yview_moveto(card_y / max(self._canvas.bbox("all")[3] if self._canvas.bbox("all") else 1, 1))

        self.draw_items()
        self._fire_selection_change()

    def _get_current_focus_idx(self) -> int:
        """获取当前聚焦的卡片索引（选中项或最后点击项）"""
        if self._last_clicked_idx is not None and 0 <= self._last_clicked_idx < len(self._items):
            return self._last_clicked_idx
        if self._selected:
            # 找到第一个选中项的索引
            for idx, item in enumerate(self._items):
                if item["id"] in self._selected:
                    return idx
        return 0

    def _on_key_up(self, event) -> None:
        """↑ 键：选中上一个"""
        current = self._get_current_focus_idx()
        self._select_index(current - 1)

    def _on_key_down(self, event) -> None:
        """↓ 键：选中下一个"""
        current = self._get_current_focus_idx()
        self._select_index(current + 1)

    def _on_key_home(self, event) -> None:
        """Home 键：选中第一个"""
        self._select_index(0)

    def _on_key_end(self, event) -> None:
        """End 键：选中最后一个"""
        self._select_index(len(self._items) - 1)

    # ─── 内部 ────────────────────────────────────

    def _fire_selection_change(self) -> None:
        """触发选中变化回调"""
        if self._on_selection_change is not None:
            self._on_selection_change(self.get_selected())
