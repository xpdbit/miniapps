# -*- coding: utf-8 -*-
"""
opencode_runner.py — 调用 opencode CLI 子进程
发送指令，捕获输出，支持超时和错误处理
"""

import json
import os
import subprocess
import sys
import threading
import time
from typing import Tuple, Optional, List

import psutil
from PyQt6.QtCore import QObject, pyqtSignal


# ─── 模型列表缓存 ──────────────────────────────

_AVAILABLE_MODELS_CACHE: Optional[List[str]] = None


def get_available_models(force_refresh: bool = False) -> List[str]:
    """获取 opencode 当前可用的所有模型列表（provider/model-id 格式）。
    
    读取策略：
    1. 优先调用 `opencode models` CLI（最完整，含免费模型）
    2. 回退到解析 ~/.config/opencode/opencode.json 的 provider 段
    3. 缓存结果，force_refresh=True 强制重新读取
    
    Returns:
        模型名列表，如 ['deepseek/deepseek-v4-pro', 'opencode-go/deepseek-v4-flash', ...]
    """
    global _AVAILABLE_MODELS_CACHE
    if _AVAILABLE_MODELS_CACHE is not None and not force_refresh:
        return _AVAILABLE_MODELS_CACHE

    models = _fetch_models_via_cli()
    if not models:
        models = _parse_opencode_json_models()
    
    _AVAILABLE_MODELS_CACHE = models
    return models


def _parse_opencode_json_models() -> List[str]:
    """从 opencode.json 的 provider 段解析所有可用模型。
    
    opencode.json 结构:
    {
      "provider": {
        "provider-name": {
          "models": {
            "model-id": { "name": "...", ... }
          }
        }
      }
    }
    """
    config_dir = os.environ.get("OPENCODE_CONFIG_DIR", "")
    if not config_dir:
        config_dir = os.path.join(os.path.expanduser("~"), ".config", "opencode")
    
    config_path = os.path.join(config_dir, "opencode.json")
    if not os.path.isfile(config_path):
        return []
    
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
    except (json.JSONDecodeError, OSError):
        return []
    
    providers = config.get("provider", {})
    if not isinstance(providers, dict):
        return []
    
    models: List[str] = []
    for provider_name, provider_cfg in providers.items():
        if not isinstance(provider_cfg, dict):
            continue
        provider_models = provider_cfg.get("models", {})
        if not isinstance(provider_models, dict):
            continue
        for model_id in provider_models:
            models.append(f"{provider_name}/{model_id}")
    
    models.sort()
    return models


def _fetch_models_via_cli() -> List[str]:
    """通过 `opencode models` CLI 命令获取可用模型列表（回退方案）。"""
    try:
        result = subprocess.run(
            ["opencode", "models"],
            capture_output=True, text=True, timeout=15,
            shell=True,
        )
        if result.returncode != 0:
            return []
        lines = result.stdout.strip().split("\n")
        models = [line.strip() for line in lines if line.strip() and "/" in line]
        models.sort()
        return models
    except Exception:
        return []


def _kill_process_tree(proc: subprocess.Popen, timeout: int = 5):
    """跨平台安全终止进程树。
    Unix: 向进程组发 SIGTERM/SIGKILL。
    Windows: 使用 taskkill /T 递归终止。"""
    if not proc or proc.poll() is not None:
        return
    try:
        if sys.platform == "win32":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                capture_output=True, timeout=timeout,
            )
            # taskkill 外部终止后需 poll 以更新 returncode
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.poll()
        else:
            import signal
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                proc.wait(timeout=2)
    except Exception:
        try:
            proc.kill()
            proc.wait(timeout=2)
        except Exception:
            pass


class OpencodeRunner(QObject):
    """opencode CLI 调用器 — 使用后台读取线程避免 Windows 管道阻塞"""

    def __init__(self, working_dir: str, timeout: int = 600, parent=None):
        super().__init__(parent)
        self.working_dir = working_dir
        self._original_working_dir = working_dir  # 保存原始目录，用于 worktree 模式恢复
        self.timeout = timeout
        self._process: Optional[subprocess.Popen] = None
        self._exit_code: Optional[int] = None   # 最后退出的进程 exit code
        self._suspended: bool = False           # 手动暂停标志（进程树）
        self._model: str = ""                   # 当前模型名（通过 --model 传递给 opencode）
        # 后台读取线程（解决 Windows select.select 不支持管道的问题）
        self._reader_thread: Optional[threading.Thread] = None
        self._reader_lock = threading.Lock()
        self._lines: list[str] = []            # 缓冲的行队列
        self._reader_eof = False               # 读取线程是否已读到 EOF

    def set_working_dir(self, path: str):
        """动态切换工作目录（用于 worktree 隔离模式）。
        调用后所有后续的 run/run_async_start/run_with_completion_signal
        将在新目录中执行 opencode。"""
        self.working_dir = path

    def reset_working_dir(self):
        """恢复到构造时的工作目录"""
        self.working_dir = self._original_working_dir

    def set_model(self, model: str):
        """设置当前模型名（通过 --model 传递给 opencode CLI）"""
        self._model = model.strip() if model else ""

    def _build_cmd(self) -> list[str]:
        """构建 opencode 命令列表，根据 _model 决定是否插入 --model 参数"""
        cmd = ["opencode"]
        if self._model:
            cmd.extend(["--model", self._model])
        cmd.append("run")
        return cmd

    def run(self, prompt: str) -> Tuple[bool, str]:
        """同步调用 opencode（通过 stdin 传递 prompt），返回 (success, output)"""
        try:
            result = subprocess.run(
                self._build_cmd(),
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
        # 先清理任何残留进程
        if self._process:
            _kill_process_tree(self._process)
            self._process = None
            time.sleep(0.3)

        try:
            self._process = subprocess.Popen(
                self._build_cmd(),
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
                self._exit_code = self._process.returncode
                self._process = None
                return False
            except subprocess.TimeoutExpired:
                # 进程仍在运行 → 启动成功
                self._exit_code = None
                self._reader_eof = False
                self._suspended = False
                self._lines.clear()
                # 启动后台读取线程
                self._start_reader()
                return True
        except Exception:
            self._process = None
            self._exit_code = -1
            return False

    def _start_reader(self):
        """启动后台管道读取线程"""
        self._reader_thread = threading.Thread(
            target=self._reader_loop, daemon=True,
        )
        self._reader_thread.start()

    def _reader_loop(self):
        """后台线程：持续从管道读取行，写入缓冲队列"""
        proc = self._process
        if not proc or not proc.stdout:
            return
        try:
            while True:
                line = proc.stdout.readline()
                if not line:
                    break  # EOF
                with self._reader_lock:
                    self._lines.append(line)
        except (OSError, ValueError):
            pass
        finally:
            self._reader_eof = True

    def read_line(self) -> Optional[str]:
        """从缓冲队列取一行（非阻塞，无数据返回 None）"""
        with self._reader_lock:
            if self._lines:
                return self._lines.pop(0)
        return None

    def has_output(self, timeout: float = 0.01) -> bool:
        """检查缓冲队列是否有数据（非阻塞）"""
        with self._reader_lock:
            return len(self._lines) > 0

    def is_running(self) -> bool:
        """检查异步进程是否在运行"""
        if not self._process:
            return False
        return self._process.poll() is None

    def kill(self):
        """终止子进程（整个进程树），等待读取线程结束。
        先恢复暂停的进程以确保 kill 信号能正常传递。"""
        if self._process:
            # 如果进程被暂停，先恢复再终止（确保 kill 信号生效）
            if self.is_suspended():
                try:
                    self.resume()
                except Exception:
                    pass
            _kill_process_tree(self._process)
            self._exit_code = self._process.returncode
            self._suspended = False
            # 等待读取线程检测到 EOF 后退出
            reader = self._reader_thread
            if reader and reader.is_alive():
                reader.join(timeout=3)
            self._process = None

    def _suspend_process_tree(self, pid: int) -> bool:
        """挂起整个进程树（包括 shell 和所有子进程）。
        在 shell=True 模式下，pid 是 shell，需要递归挂起子进程树才能真正暂停 agent。"""
        try:
            root = psutil.Process(pid)
            # 先挂起子进程（自底向上），再挂起父进程
            children = root.children(recursive=True)
            for child in children:
                try:
                    child.suspend()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
            root.suspend()
            return True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            return False

    def _resume_process_tree(self, pid: int) -> bool:
        """恢复整个进程树（包括 shell 和所有子进程）。"""
        try:
            root = psutil.Process(pid)
            # 先恢复父进程，再恢复子进程（自顶向下）
            root.resume()
            children = root.children(recursive=True)
            for child in children:
                try:
                    child.resume()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
            return True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            return False

    def suspend(self) -> bool:
        """暂停（挂起）Agent 进程树 — 使用 psutil 跨平台实现。
        由于 shell=True 下 pid 是 shell，会递归挂起整个进程树确保 agent 真正停止。
        Windows: NtSuspendProcess, Unix: SIGSTOP。
        返回 True 表示成功，False 表示进程不存在或无权限。"""
        if not self._process or self._process.poll() is not None:
            return False
        if self._suspended:
            return True  # 已经是暂停状态，幂等
        if self._suspend_process_tree(self._process.pid):
            self._suspended = True
            return True
        return False

    def resume(self) -> bool:
        """恢复（继续）已暂停的 Agent 进程树 — 使用 psutil 跨平台实现。
        递归恢复整个进程树（shell + agent + 子进程）。
        返回 True 表示成功，False 表示进程不存在或无权限。"""
        if not self._process:
            return False
        if not self._suspended:
            return True  # 已经是运行状态，幂等
        if self._resume_process_tree(self._process.pid):
            self._suspended = False
            return True
        return False

    def is_suspended(self) -> bool:
        """检查 Agent 是否处于手动暂停状态。
        使用内部布尔标志位（而非 psutil status()），避免 shell=True 下
        shell 状态与 agent 状态不一致的问题。"""
        return self._suspended

    def is_eof(self) -> bool:
        """读取线程是否已到达 EOF（进程输出完毕）"""
        return self._reader_eof

    def run_with_completion_signal(self, prompt: str, timeout: int = 600,
                                    completion_signal: str = "===TASK_DONE===") -> Tuple[bool, str]:
        """异步启动 opencode，使用后台读取线程收集输出，轮询检测完成信号。
        用于 /ulw-loop 模式（进程不会自动退出，需通过信号判断完成）。
        Agent 暂停期间不计入超时（通过 is_suspended() 检查）。
        Windows 兼容：使用后台线程读取而非 select.select（避免 pipe 不可 select 问题）。"""
        try:
            process = subprocess.Popen(
                self._build_cmd(),
                cwd=self.working_dir,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                shell=True,
            )
            self._process = process
            self._reader_eof = False
            self._suspended = False
            self._lines.clear()

            if process.stdin:
                process.stdin.write(prompt)
                process.stdin.close()

            # 启动后台读取线程（复用类已有的 _start_reader / _reader_loop）
            self._start_reader()

            output_parts: list[str] = []
            start_time = time.time()
            total_suspended = 0.0
            _was_suspended = False
            _suspend_begin = 0.0
            signal_found = False

            while True:
                # 超时检查：Agent 暂停期间不计入超时
                _cur_suspended = self.is_suspended()
                if _cur_suspended and not _was_suspended:
                    _suspend_begin = time.time()
                elif not _cur_suspended and _was_suspended:
                    total_suspended += time.time() - _suspend_begin
                _was_suspended = _cur_suspended

                if not _cur_suspended and time.time() - start_time - total_suspended > timeout:
                    _kill_process_tree(process)
                    self._process = None
                    output = "".join(output_parts)
                    return False, output + f"\n[超时 {timeout}s，未收到完成信号]"

                # 进程已退出且所有缓冲行已消费
                if process.poll() is not None and not self._lines:
                    break

                # 非阻塞读取缓冲行
                line = self.read_line()
                if line:
                    output_parts.append(line)
                    if completion_signal in line:
                        signal_found = True
                        break
                else:
                    # 无数据可用，短暂休眠避免忙等
                    time.sleep(0.1)

            # 信号已找到或进程退出 → kill 进程，读取剩余输出
            try:
                _kill_process_tree(process)
            except Exception:
                pass
            finally:
                self._process = None

            if process.stdout:
                try:
                    remaining = process.stdout.read()
                    if remaining:
                        output_parts.append(remaining)
                except Exception:
                    pass

            output = "".join(output_parts)
            return signal_found, output.strip()

        except Exception as e:
            self._process = None
            return False, f"异常: {str(e)}"

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
