# -*- coding: utf-8 -*-
"""
OCE GUI 入口 — 解析 CLI 参数后启动 PyQt6 主窗口。

对齐 SuperTask 的 gui/main.py 模式。
"""
from __future__ import annotations

import sys
from pathlib import Path

from .ui_pyqt.app import create_app
from .core.config import OceConfig, find_project_root
from .core.data_store import DataStore
from .core.logger import OceLogger


def main(config_path: str | None = None, db_path: str | None = None,
         project_root: str | None = None) -> int:
    """OCE GUI 主入口。

    Args:
        config_path: program.ocp 配置文件路径
        db_path: opencode SQLite 数据库路径
        project_root: 项目根目录路径

    Returns:
        app exit code
    """
    # ── 初始化日志 ──
    logger = OceLogger.get_instance()
    logger.startup("OCE 启动 — opencode-tui-enhance v0.2.0")

    # 确定项目路径
    resolved_root = None
    if project_root:
        resolved_root = Path(project_root).resolve()
        logger.info(f"项目路径: {resolved_root}")
    elif config_path:
        resolved_root = Path(config_path).parent.resolve()
        logger.info(f"从 config 推断项目路径: {resolved_root}")
    else:
        found = find_project_root()
        if found:
            resolved_root = found
            logger.info(f"自动发现项目路径: {resolved_root}")
        else:
            logger.warning("未找到 project_root，以无项目模式运行")

    # 加载配置
    config = OceConfig(path=Path(config_path) if config_path else resolved_root)
    if config.path and not config.available:
        msg = "program.ocp 不存在或无效，将以无项目模式启动"
        print(f"⚠ {msg}", file=sys.stderr)
        logger.warning(msg)
    else:
        logger.info(f"配置已加载: {config.path}")

    # 初始化 DataStore
    resolved_db = str(Path(db_path).resolve()) if db_path else None
    store = DataStore.get_instance(db_path=resolved_db)
    if store.available:
        logger.info(f"数据库已连接: {resolved_db or '自动检测'}")
    else:
        logger.warning(f"数据库不可用: {resolved_db or '未找到'}")

    # 启动 GUI
    logger.info("正在启动 GUI…")
    exit_code = create_app(config=config)
    logger.info(f"GUI 已关闭 (exit_code={exit_code})")
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
