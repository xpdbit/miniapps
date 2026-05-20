"""ocp 入口 — CLI 解析 + App 启动。"""

from __future__ import annotations

import sys
from pathlib import Path

from app.app import OcpApp
from app.data_store import DataStore
from cli.args import parse_args
from core.ocp_config import OcpConfig, find_project_root


def main(argv: list[str] | None = None) -> None:
    """ocp 主入口。"""
    args = parse_args(argv)

    # 确定项目路径
    project_root = None
    if args.project:
        project_root = args.project.resolve()
    elif args.config:
        project_root = args.config.parent.resolve()
    else:
        found = find_project_root()
        if found:
            project_root = found

    # 加载配置
    config = OcpConfig(path=args.config or project_root)
    if config.path and not config.available:
        print(f"⚠ program.ocp 不存在或无效，将以无项目模式启动", file=sys.stderr)

    # 初始化 DataStore
    db_path = str(args.db_path.resolve()) if args.db_path else None
    DataStore.get_instance(db_path=db_path)

    # 启动 TUI App
    app = OcpApp(config=config)
    app.run()


if __name__ == "__main__":
    main()
