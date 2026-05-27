# -*- coding: utf-8 -*-
"""program.ocp 配置文件解析与写入。

opencode-tui-enhance (oce) 配置管理。
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

DEFAULT_CONFIG: dict = {
    "version": 1,
    "project": {
        "name": "",
        "root": "",
        "description": "",
    },
    "opencode": {
        "default_model": "deepseek/deepseek-v4-pro",
        "max_parallel_agents": 5,
        "auto_save_interval_s": 300,
    },
    "oce": {
        "exclude_dirs": ["node_modules", ".git", "dist", "__pycache__"],
        "refresh_interval_s": 10,
        "theme": "github-dark",
        "log_retention_days": 30,
        "api_history_page_size": 50,
    },
    "projects": [],
}


def find_project_root(path: Optional[Path] = None) -> Optional[Path]:
    """向上查找包含 program.ocp 的项目根目录。"""
    start = path or Path.cwd()
    for parent in [start] + list(start.parents):
        if (parent / "program.ocp").exists():
            return parent
    return None


class OceConfig:
    """program.ocp 配置管理。"""

    def __init__(self, path: Optional[Path] = None):
        if path:
            self.path = path if path.suffix == ".ocp" else path / "program.ocp"
        else:
            root = find_project_root()
            self.path = root / "program.ocp" if root else None
        self._data: dict = {}
        self._dirty: set[str] = set()
        self.load()

    # ── 读写 ──

    def load(self) -> bool:
        """加载配置文件。返回是否成功。"""
        if not self.path or not self.path.exists():
            self._data = dict(DEFAULT_CONFIG)
            return False
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                self._data = json.load(f)
            self._dirty.clear()
            return True
        except (json.JSONDecodeError, OSError):
            self._data = dict(DEFAULT_CONFIG)
            return False

    def save(self) -> bool:
        """保存配置到文件。返回是否成功。"""
        if not self.path:
            return False
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.path, "w", encoding="utf-8") as f:
                json.dump(self._data, f, indent=2, ensure_ascii=False)
            self._dirty.clear()
            return True
        except OSError:
            return False

    # ── 查询与修改 ──

    def get(self, *keys: str, default=None):
        """按路径获取值。e.g. get('oce', 'theme') -> 'github-dark'"""
        d: dict = self._data
        for k in keys:
            if isinstance(d, dict):
                d = d.get(k, {})
            else:
                return default
        return d if d != {} else default

    def set(self, *args) -> None:
        """按路径设置值。e.g. set('oce', 'theme', 'github-light')"""
        if len(args) < 2:
            return
        *keys, value = args
        d = self._data
        for k in keys[:-1]:
            if k not in d or not isinstance(d.get(k), dict):
                d[k] = {}
            d = d[k]
        d[keys[-1]] = value
        self._dirty.add(".".join(keys))

    # ── 脏状态 ──

    @property
    def is_dirty(self) -> bool:
        return len(self._dirty) > 0

    @property
    def dirty_fields(self) -> set[str]:
        return self._dirty

    def clear_dirty(self) -> None:
        self._dirty.clear()

    # ── 属性 ──

    @property
    def available(self) -> bool:
        return self.path is not None and self.path.exists()

    @property
    def data(self) -> dict:
        return self._data
