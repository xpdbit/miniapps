"""CLI 参数解析。"""

from __future__ import annotations

import argparse
from pathlib import Path


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """解析命令行参数。"""
    parser = argparse.ArgumentParser(
        prog="ocp",
        description="opencode TUI Plus — 终端界面的 opencode 管理工具",
    )
    parser.add_argument(
        "-p", "--project",
        type=Path,
        help="项目根目录路径（自动检测 program.ocp）",
    )
    parser.add_argument(
        "-c", "--config",
        type=Path,
        help="program.ocp 配置文件路径",
    )
    parser.add_argument(
        "-d", "--db-path",
        type=Path,
        help="opencode SQLite 数据库路径",
    )
    parser.add_argument(
        "--version",
        action="version",
        version="ocp 0.1.0",
    )
    return parser.parse_args(argv)
