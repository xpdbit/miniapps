# -*- coding: utf-8 -*-
"""
runner.py — 统一 Agent 执行器

合并 oce 和 SuperTask 的 opencode 调用逻辑，新增：
- 阶段感知的模型路由 (Stage Enum + config 映射)
- 多轮上下文注入 (previous diffs 摘要)
- Diff 分析集成
- 统一的重试和错误处理
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import time
from dataclasses import dataclass
from enum import Enum
from typing import Optional

import psutil

from .diff_analyzer import DiffAnalyzer, DiffStat
from .state_manager import StateManager

# ─── Windows: 防止 subprocess 弹出 CLI 窗口 ─────
_NO_WINDOW = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0


# ─── 阶段枚举 ──────────────────────────────────

class Stage(str, Enum):
    EXPLORATION = "exploration"                # 项目扫描
    PROPOSAL_GENERATION = "proposal_generation"  # 生成提议
    PROPOSAL_EVALUATION = "proposal_evaluation"  # 二次评估
    CODE_EXECUTION = "code_execution"            # 执行开发任务
    DIFF_SUMMARY = "diff_summary"                # 摘要生成
    DOCUMENTATION = "documentation"              # 文档更新
    SUPERVISOR = "supervisor"                    # 监管巡检


# ─── 结果数据类 ──────────────────────────────

@dataclass
class RunResult:
    """一次 agent 调用的结构化结果"""
    success: bool
    exit_code: int = -1
    duration_seconds: float = 0.0
    diff_raw: str = ""
    diff_stat: Optional[DiffStat] = None
    agent_output: str = ""
    error_message: str = ""


# ─── 进程树管理 ──────────────────────────────

def _kill_process_tree(proc: subprocess.Popen, timeout: int = 5):
    """跨平台安全终止进程树"""
    if not proc or proc.poll() is not None:
        return
    try:
        if sys.platform == "win32":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                capture_output=True, timeout=timeout,
                creationflags=_NO_WINDOW,
            )
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


# ─── 模型列表工具 ──────────────────────────────

_AVAILABLE_MODELS_CACHE: Optional[list[str]] = None


def get_available_models(force_refresh: bool = False) -> list[str]:
    """获取 opencode 可用的所有模型（provider/model 格式）"""
    global _AVAILABLE_MODELS_CACHE
    if _AVAILABLE_MODELS_CACHE is not None and not force_refresh:
        return _AVAILABLE_MODELS_CACHE

    models = _fetch_models_via_cli()
    if not models:
        models = _parse_opencode_json_models()

    _AVAILABLE_MODELS_CACHE = models
    return models


def _parse_opencode_json_models() -> list[str]:
    """从 opencode.json 解析模型列表"""
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

    models: list[str] = []
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


def _fetch_models_via_cli() -> list[str]:
    """通过 opencode models CLI 获取列表"""
    try:
        result = subprocess.run(
            ["opencode", "models"],
            capture_output=True, text=True, timeout=15,
            shell=True, creationflags=_NO_WINDOW,
        )
        if result.returncode != 0:
            return []
        lines = result.stdout.strip().split("\n")
        models = [line.strip() for line in lines if line.strip() and "/" in line]
        models.sort()
        return models
    except Exception:
        return []


# ─── Agent 执行器 ──────────────────────────────

class AgentRunner:
    """统一 Agent 执行器

    负责：
    1. 阶段→模型路由
    2. 组装 prompt（含前几轮 diff 摘要）
    3. 调用 opencode CLI
    4. 计算 git diff
    5. 返回 RunResult
    """

    # 重试配置
    MAX_RETRIES = 5
    RETRY_DELAYS = [5, 10, 20, 40, 60]  # 秒

    def __init__(
        self,
        working_dir: str,
        state_manager: Optional[StateManager] = None,
        timeout_minutes: int = 30,
    ):
        self.working_dir = working_dir
        self._original_working_dir = working_dir
        self._state_manager = state_manager
        self._timeout_minutes = timeout_minutes
        self._process: Optional[subprocess.Popen] = None
        self._suspended: bool = False

        # 模型路由配置（从 config.yaml 加载）
        self._stage_models: dict[str, str] = {}
        self._default_model: str = "deepseek/deepseek-v4-pro"

    # ─── 配置 ──────────────────────────────

    def set_working_dir(self, path: str):
        """切换工作目录（用于 worktree 模式）"""
        self.working_dir = path

    def reset_working_dir(self):
        """恢复原始工作目录"""
        self.working_dir = self._original_working_dir

    def set_timeout(self, minutes: int):
        """设置超时时间"""
        self._timeout_minutes = minutes

    def apply_model_routing(self, default_model: str, stage_models: dict[str, str]):
        """应用模型路由配置

        Args:
            default_model: 默认模型 (provider/model 格式)
            stage_models: {stage_name: model_ref, ...}
        """
        self._default_model = default_model
        self._stage_models = stage_models

    def get_model_for_stage(self, stage: Stage) -> str:
        """获取指定阶段使用的模型"""
        return self._stage_models.get(stage.value, self._default_model)

    # ─── 同步执行 ──────────────────────────

    def run(
        self,
        prompt: str,
        *,
        stage: Stage = Stage.CODE_EXECUTION,
        previous_diffs: list[str] | None = None,
        previous_diff_stats: list[DiffStat] | None = None,
        context_files: list[str] | None = None,
        timeout_minutes: int | None = None,
    ) -> RunResult:
        """同步执行一次 opencode agent 调用（带重试）。

        Args:
            prompt: 主提示词
            stage: 执行阶段（决定使用哪个模型）
            previous_diffs: 前几轮 diff 文件的路径列表（用于生成摘要）
            previous_diff_stats: 前几轮的 DiffStat（如已解析则直接使用）
            context_files: 附加上下文文件路径
            timeout_minutes: 超时覆盖（默认使用构造时的设置）

        Returns:
            RunResult 包含 diff 和统计信息
        """
        timeout = (timeout_minutes or self._timeout_minutes) * 60

        # 组装完整 prompt
        full_prompt = self._build_prompt(
            prompt,
            previous_diffs=previous_diffs,
            previous_diff_stats=previous_diff_stats,
            context_files=context_files,
        )

        # 获取模型
        model_ref = self.get_model_for_stage(stage)

        start_time = time.time()

        # 重试循环
        last_error = ""
        for attempt in range(self.MAX_RETRIES):
            if attempt > 0:
                delay = self.RETRY_DELAYS[min(attempt - 1, len(self.RETRY_DELAYS) - 1)]
                time.sleep(delay)

            try:
                success, output = self._call_opencode(
                    full_prompt, model_ref, timeout
                )

                if success:
                    # 计算 diff
                    diff_raw = self._get_git_diff()
                    diff_stat = DiffAnalyzer.analyze(diff_raw)

                    duration = time.time() - start_time
                    return RunResult(
                        success=True,
                        exit_code=0,
                        duration_seconds=duration,
                        diff_raw=diff_raw,
                        diff_stat=diff_stat,
                        agent_output=output,
                    )
                else:
                    last_error = output

            except FileNotFoundError:
                return RunResult(
                    success=False,
                    error_message="opencode 未找到，请确保已安装并在 PATH 中",
                )
            except Exception as e:
                last_error = str(e)

        # 全部重试失败
        duration = time.time() - start_time
        return RunResult(
            success=False,
            duration_seconds=duration,
            error_message=last_error,
        )

    # ─── 异步执行（用于终端流式输出） ──────

    def run_async_start(self, prompt: str, stage: Stage = Stage.CODE_EXECUTION) -> bool:
        """异步启动 opencode，返回是否成功启动

        用于终端面板的流式输出场景。
        """
        if self._process:
            _kill_process_tree(self._process)
            self._process = None
            time.sleep(0.3)

        model_ref = self.get_model_for_stage(stage)
        cmd = self._build_cmd(model_ref)

        try:
            self._process = subprocess.Popen(
                cmd,
                cwd=self.working_dir,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                shell=True,
                creationflags=_NO_WINDOW,
            )
            if self._process.stdin:
                self._process.stdin.write(prompt)
                self._process.stdin.close()

            # 短暂等待确认进程启动
            try:
                self._process.wait(timeout=0.5)
                self._process = None
                return False
            except subprocess.TimeoutExpired:
                self._suspended = False
                return True
        except Exception:
            self._process = None
            return False

    def is_running(self) -> bool:
        """检查异步进程是否在运行"""
        if not self._process:
            return False
        return self._process.poll() is None

    def is_suspended(self) -> bool:
        return self._suspended

    def read_line(self) -> Optional[str]:
        """非阻塞读取一行（用于终端流式输出）"""
        if not self._process or not self._process.stdout:
            return None
        try:
            import select
            if select.select([self._process.stdout], [], [], 0.1)[0]:
                line = self._process.stdout.readline()
                return line if line else None
        except (OSError, ValueError):
            pass
        return None

    def suspend(self) -> bool:
        """暂停（挂起）进程树"""
        if not self._process or self._process.poll() is not None:
            return False
        if self._suspended:
            return True
        try:
            root = psutil.Process(self._process.pid)
            for child in root.children(recursive=True):
                try:
                    child.suspend()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
            root.suspend()
            self._suspended = True
            return True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            return False

    def resume(self) -> bool:
        """恢复（继续）进程树"""
        if not self._process:
            return False
        if not self._suspended:
            return True
        try:
            root = psutil.Process(self._process.pid)
            root.resume()
            for child in root.children(recursive=True):
                try:
                    child.resume()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
            self._suspended = False
            return True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            return False

    def kill(self):
        """终止子进程"""
        if self._process:
            if self._suspended:
                try:
                    self.resume()
                except Exception:
                    pass
            _kill_process_tree(self._process)
            self._process = None
            self._suspended = False

    # ─── Git 操作 ──────────────────────────

    def _get_git_diff(self) -> str:
        """获取当前工作目录的 git diff（工作区 + 暂存区）"""
        try:
            result = subprocess.run(
                ["git", "diff", "HEAD"],
                cwd=self.working_dir,
                capture_output=True,
                text=True,
                timeout=30,
                creationflags=_NO_WINDOW,
            )
            return result.stdout if result.returncode == 0 else ""
        except Exception:
            return ""

    def get_git_commit(self) -> str:
        """获取最新 commit hash"""
        try:
            result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=self.working_dir,
                capture_output=True,
                text=True,
                timeout=10,
                creationflags=_NO_WINDOW,
            )
            return result.stdout.strip() if result.returncode == 0 else ""
        except Exception:
            return ""

    @staticmethod
    def _get_default_branch(repo_dir: str) -> str:
        """获取仓库默认分支名（优先 origin/HEAD，回退 master）"""
        try:
            result = subprocess.run(
                ["git", "symbolic-ref", "refs/remotes/origin/HEAD"],
                cwd=repo_dir,
                capture_output=True, text=True, timeout=10,
                creationflags=_NO_WINDOW,
            )
            if result.returncode == 0:
                ref = result.stdout.strip()
                branch = ref.removeprefix("refs/remotes/origin/")
                if branch:
                    return branch
        except Exception:
            pass
        return "master"

    def git_push(self) -> tuple[bool, str]:
        """执行 git add + commit + pull --rebase + push"""
        ts = time.strftime("%Y-%m-%d %H:%M:%S")
        msg = f"[auto] SuperTask 执行阶段 {ts}"

        try:
            subprocess.run(["git", "add", "-A"], cwd=self.working_dir,
                           timeout=30, capture_output=True,
                           creationflags=_NO_WINDOW)

            result = subprocess.run(["git", "diff", "--cached", "--quiet"],
                                    cwd=self.working_dir, timeout=10,
                                    creationflags=_NO_WINDOW)
            if result.returncode != 0:
                subprocess.run(["git", "commit", "-m", msg],
                               cwd=self.working_dir, timeout=30,
                               capture_output=True,
                               creationflags=_NO_WINDOW)

            branch = self._get_default_branch(self.working_dir)
            subprocess.run(["git", "pull", "--rebase", "origin", branch],
                           cwd=self.working_dir, timeout=60,
                           capture_output=True,
                           creationflags=_NO_WINDOW)

            result = subprocess.run(["git", "push", "origin", branch],
                                    cwd=self.working_dir, timeout=60,
                                    capture_output=True, text=True,
                                    creationflags=_NO_WINDOW)

            return result.returncode == 0, (result.stdout + result.stderr).strip()
        except Exception as e:
            return False, str(e)

    # ─── 内部方法 ──────────────────────────

    def _build_cmd(self, model_ref: str) -> list[str]:
        """构建 opencode CLI 命令"""
        cmd = ["opencode"]
        if model_ref:
            cmd.extend(["--model", model_ref])
        cmd.append("run")
        return cmd

    def _call_opencode(self, prompt: str, model_ref: str, timeout_seconds: int) -> tuple[bool, str]:
        """调用 opencode 子进程"""
        try:
            result = subprocess.run(
                self._build_cmd(model_ref),
                cwd=self.working_dir,
                input=prompt,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout_seconds,
                shell=True,
                creationflags=_NO_WINDOW,
            )
            output = (result.stdout or "") + (result.stderr or "")
            return result.returncode == 0, output.strip()
        except subprocess.TimeoutExpired:
            return False, f"超时 ({timeout_seconds}s)"
        except Exception as e:
            return False, f"异常: {str(e)}"

    def _build_prompt(
        self,
        base_prompt: str,
        *,
        previous_diffs: list[str] | None = None,
        previous_diff_stats: list[DiffStat] | None = None,
        context_files: list[str] | None = None,
    ) -> str:
        """组装完整 prompt（含上下文注入）

        关键设计：不直接拼接 diff 原文（会炸上下文窗口），而是注入摘要。
        """
        parts = [base_prompt]

        # 附加上下文文件
        if context_files:
            parts.append("\n## 参考文件")
            for f in context_files:
                parts.append(f"- {f}")

        # 前几轮改进摘要
        if previous_diff_stats:
            summary = DiffAnalyzer.summarize(previous_diff_stats)
            parts.append(f"\n## 前 {len(previous_diff_stats)} 轮改进摘要")
            parts.append(summary)
            parts.append("\n你看到的是当前代码基线，请在此基础上继续改进。")

        return "\n".join(parts)
