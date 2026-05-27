# -*- coding: utf-8 -*-
"""logger.py — OCE 运行日志模块

参照 SuperTask file_manager.py 的 write_log 模式，
输出到 logs/{date}.md，支持 5 级日志。
"""
from __future__ import annotations

import os
import sys
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional


class OceLogger:
    """OCE 文件日志记录器（线程安全）。

    日志文件位置：<项目根>/logs/{YYYYMMDD}.md
    格式：前缀 时间戳 消息
    """

    # 日志级别 → (文件前缀, 控制台前缀)
    LEVELS = {
        "startup":   ("[START]", "◆"),
        "info":      ("-",       "·"),
        "refresh":   ("[REFRESH]","↻"),
        "config":    ("[CONFIG]", "⚙"),
        "warning":   ("!",       "⚠"),
        "error":     ("✗",       "✗"),
    }

    _instance: Optional[OceLogger] = None
    _lock = threading.Lock()

    def __init__(self, logs_dir: Optional[str] = None):
        if logs_dir:
            self._logs_dir = Path(logs_dir)
        else:
            # 默认：项目根目录下的 logs/
            # logger.py 位置: .../gui/core/logger.py
            # 项目根: parents[4] → opencode-tui-enhance/
            self._logs_dir = Path(__file__).resolve().parents[4] / "logs"
        self._logs_dir.mkdir(parents=True, exist_ok=True)

    @classmethod
    def get_instance(cls, logs_dir: Optional[str] = None) -> OceLogger:
        """获取单例实例。"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls(logs_dir)
        return cls._instance

    # ── 写入 ──

    def log(self, level: str, message: str) -> None:
        """写入日志（线程安全）。"""
        now = datetime.now()
        date_str = now.strftime("%Y%m%d")
        time_str = now.strftime("%H:%M:%S")

        file_prefix, console_prefix = self.LEVELS.get(level, ("-", "·"))
        log_path = self._logs_dir / f"{date_str}.md"

        # 严重事件前加空行
        entry = ""
        if level in ("error", "warning"):
            entry += "\n"

        # 截断长消息（>200 字符时换行输出完整内容）
        max_len = 200
        if len(message) > max_len:
            truncated = message[:max_len] + "…"
            entry += f"{file_prefix} {time_str} {truncated}\n"
            entry += f"  {message}\n"
        else:
            entry += f"{file_prefix} {time_str} {message}\n"

        with self._lock:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(entry)

    # ── 便捷方法 ──

    def startup(self, message: str) -> None:
        """启动事件日志。"""
        self.log("startup", message)

    def info(self, message: str) -> None:
        """一般信息日志。"""
        self.log("info", message)

    def refresh(self, message: str) -> None:
        """数据刷新日志。"""
        self.log("refresh", message)

    def config(self, message: str) -> None:
        """配置变更日志。"""
        self.log("config", message)

    def warning(self, message: str) -> None:
        """警告日志。"""
        self.log("warning", message)

    def error(self, message: str) -> None:
        """错误日志。"""
        self.log("error", message)

    def supervisor(self, message: str) -> None:
        """监管 Agent 巡检日志 — 写入独立的 supervisor 日志文件。"""
        now = datetime.now()
        date_str = now.strftime("%Y%m%d")
        time_str = now.strftime("%H:%M:%S")
        log_path = self._logs_dir / f"{date_str}_supervisor.md"

        entry = f"[SV] {time_str} {message}\n"
        with self._lock:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(entry)

    def terminal(self, message: str) -> None:
        """Agent 终端 I/O 日志 — 写入独立文件。"""
        now = datetime.now()
        date_str = now.strftime("%Y%m%d")
        log_path = self._logs_dir / f"{date_str}_terminal.md"

        entry = f"{message}\n"
        with self._lock:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(entry)

    # ── 读取 ──

    def read_logs(self, date_str: Optional[str] = None) -> str:
        """读取指定日期的日志内容。"""
        if not date_str:
            date_str = datetime.now().strftime("%Y%m%d")
        log_path = self._logs_dir / f"{date_str}.md"
        if not log_path.is_file():
            return ""
        with open(log_path, "r", encoding="utf-8") as f:
            return f.read()

    @property
    def logs_dir(self) -> Path:
        return self._logs_dir
