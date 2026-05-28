# -*- coding: utf-8 -*-
"""
本地开发控制台 — 启动器
委托实际逻辑到同目录下的 dev_console.py
"""
import subprocess
import sys
import os

if __name__ == "__main__":
    script = os.path.join(os.path.dirname(__file__), "dev_console.py")
    sys.exit(subprocess.run([sys.executable, script]).returncode)
