# -*- coding: utf-8 -*-
"""
SuperTask GUI 入口
双击 miniapps_supertask.bat 启动
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from gui.ui_pyqt.app import create_app


def main():
    _script = os.path.abspath(__file__)
    # 项目根目录 .miniapps/（4级上: main.py -> gui -> supertask -> plan -> .miniapps）
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(_script))))
    # 状态目录（项目根目录 state/，与 opencode runner 工作目录一致）
    state_dir = os.path.join(base_dir, "state")
    # 日志目录保持在 supertask 项目内
    logs_dir = os.path.join(os.path.dirname(os.path.dirname(_script)), "logs")

    create_app(
        working_dir=base_dir,
        state_dir=state_dir,
        logs_dir=logs_dir,
    )


if __name__ == "__main__":
    main()
