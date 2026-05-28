# -*- coding: utf-8 -*-
"""prompt-tool 入口 — CLI 解析 + GUI 启动。"""
from __future__ import annotations

import sys
import argparse


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="prompt-tool",
        description="prompt-tool — 提示词模板引擎",
    )
    parser.add_argument(
        "-p", "--project",
        type=str,
        help="项目根目录路径（包含 .prompts/）",
    )
    parser.add_argument(
        "--version",
        action="version",
        version="prompt-tool 0.1.0",
    )
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()
    from prompt_tool.gui.main import main as gui_main
    sys.exit(gui_main(project_root=args.project))


if __name__ == "__main__":
    main()
