# -*- coding: utf-8 -*-
"""pytest 共享 fixtures。"""

import os
import tempfile
from typing import Generator

import pytest

from oce.core.state_manager import StateManager


@pytest.fixture
def state_manager() -> Generator[StateManager, None, None]:
    """创建临时目录的 StateManager。"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield StateManager(tmpdir)


@pytest.fixture
def temp_dirs() -> Generator[tuple[str, str], None, None]:
    """创建临时 state 和 logs 目录。"""
    with tempfile.TemporaryDirectory() as state_dir:
        with tempfile.TemporaryDirectory() as logs_dir:
            yield state_dir, logs_dir
