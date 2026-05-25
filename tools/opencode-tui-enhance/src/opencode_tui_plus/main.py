# -*- coding: utf-8 -*-
"""oce 入口 — CLI 解析 + PyQt6 GUI 启动。"""
from __future__ import annotations

import sys
import argparse
from pathlib import Path


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """解析命令行参数。"""
    parser = argparse.ArgumentParser(
        prog="oce",
        description="opencode-tui-enhance — 桌面管理工具",
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
        version="oce 0.2.0",
    )
    return parser.parse_args(argv)


def main() -> None:
    """oce 主入口。"""
    args = parse_args()

    project_root = str(args.project.resolve()) if args.project else None
    config_path = str(args.config.resolve()) if args.config else None
    db_path = str(args.db_path.resolve()) if args.db_path else None

    from opencode_tui_plus.gui.main import main as gui_main
    sys.exit(gui_main(
        config_path=config_path,
        db_path=db_path,
        project_root=project_root,
    ))


if __name__ == "__main__":
    main()
