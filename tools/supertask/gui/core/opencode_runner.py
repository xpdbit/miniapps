# -*- coding: utf-8 -*-
"""
opencode_runner.py — 调用 opencode CLI 子进程
发送指令，捕获输出，支持超时和错误处理
"""

import subprocess
import os
import time
from typing import Tuple, Optional

from PyQt6.QtCore import QObject, pyqtSignal


class OpencodeRunner(QObject):
    """opencode CLI 调用器"""

    def __init__(self, working_dir: str, timeout: int = 600, parent=None):
        super().__init__(parent)
        self.working_dir = working_dir
        self.timeout = timeout
        self._process: Optional[subprocess.Popen] = None

    def run(self, prompt: str) -> Tuple[bool, str]:
        """同步调用 opencode（通过 stdin 传递 prompt），返回 (success, output)"""
        try:
            result = subprocess.run(
                ["opencode", "run"],
                cwd=self.working_dir,
                input=prompt,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=self.timeout,
                shell=True,
            )
            output = (result.stdout or "") + (result.stderr or "")
            return result.returncode == 0, output.strip()
        except subprocess.TimeoutExpired:
            return False, f"超时 ({self.timeout}s)"
        except FileNotFoundError:
            return False, "opencode 未找到，请确保已安装并在 PATH 中"
        except Exception as e:
            return False, f"异常: {str(e)}"

    def run_async_start(self, prompt: str) -> bool:
        """异步启动 opencode 进程，返回是否成功启动"""
        try:
            self._process = subprocess.Popen(
                ["opencode", "run"],
                cwd=self.working_dir,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                shell=True,
            )
            if self._process.stdin:
                self._process.stdin.write(prompt)
                self._process.stdin.close()

            # shell=True 下 Popen 始终成功（shell 本身被创建），
            # 需等待短暂时间检查 opencode 是否真的启动了
            try:
                self._process.wait(timeout=0.5)
                # 进程已退出 → opencode 未找到或启动失败
                self._process = None
                return False
            except subprocess.TimeoutExpired:
                # 进程仍在运行 → 启动成功
                return True
        except Exception:
            self._process = None
            return False

    def read_line(self) -> Optional[str]:
        """读取一行异步输出"""
        if not self._process or not self._process.stdout:
            return None
        try:
            return self._process.stdout.readline()
        except Exception:
            return None

    def is_running(self) -> bool:
        """检查异步进程是否在运行"""
        if not self._process:
            return False
        return self._process.poll() is None

    def kill(self):
        """终止子进程"""
        if self._process:
            try:
                self._process.kill()
                self._process.wait(timeout=5)
            except Exception:
                pass
            self._process = None

    def get_git_commit(self) -> str:
        """获取最新 commit hash"""
        try:
            result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=self.working_dir,
                capture_output=True,
                text=True,
                shell=True,
                timeout=10,
            )
            return result.stdout.strip() if result.returncode == 0 else ""
        except Exception:
            return ""

    def git_push(self) -> Tuple[bool, str]:
        """执行 git add + commit + pull --rebase + push"""
        ts = time.strftime("%Y-%m-%d %H:%M:%S")
        msg = f"[auto] 执行阶段 {ts}"

        try:
            subprocess.run(["git", "add", "-A"], cwd=self.working_dir,
                           shell=True, timeout=30, capture_output=True)

            result = subprocess.run(["git", "diff", "--cached", "--quiet"],
                                    cwd=self.working_dir, shell=True, timeout=10)
            if result.returncode != 0:
                subprocess.run(["git", "commit", "-m", msg],
                               cwd=self.working_dir, shell=True, timeout=30,
                               capture_output=True)

            subprocess.run(["git", "pull", "--rebase", "origin", "master"],
                           cwd=self.working_dir, shell=True, timeout=60,
                           capture_output=True)

            result = subprocess.run(["git", "push", "origin", "master"],
                                    cwd=self.working_dir, shell=True, timeout=60,
                                    capture_output=True, text=True)

            return result.returncode == 0, (result.stdout + result.stderr).strip()
        except Exception as e:
            return False, str(e)
