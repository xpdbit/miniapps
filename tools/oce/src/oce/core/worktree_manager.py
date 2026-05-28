# -*- coding: utf-8 -*-
"""
worktree_manager.py — Git Worktree 生命周期管理
为每个任务创建隔离的临时 worktree，执行完成后同步状态变更并清理。

用法:
    wm = WorktreeManager(base_repo="E:\\.Code\\.miniapps", worktrees_dir=".worktrees")
    wt_path = wm.create("task-5")
    # ... 在 wt_path 中执行 opencode ...
    wm.sync_state("task-5")
    wm.remove("task-5")
"""

import os
import shutil
import subprocess
import sys
import threading
import time as _time_module
from dataclasses import dataclass, field
from typing import Optional

# ── Windows: 防止 subprocess 弹出 CLI 窗口 ──
_NO_WINDOW = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0

# 需要跨 worktree 同步的状态文件（相对于仓库根目录）
_SYNC_STATE_FILES = [
    "state/proposed_tasks.yaml",
    "state/approved_queue.yaml",
    "state/history.yaml",
    "state/cycle_counter.txt",
    "state/last_commit.txt",
]


@dataclass
class WorktreeInfo:
    """单个 worktree 的元数据"""
    task_id: str
    path: str           # 文件系统绝对路径
    branch: str         # 基于哪个分支创建
    created_at: float   # timestamp
    status: str = "active"  # active | done | error


class WorktreeManager:
    """Git Worktree 生命周期管理器 — 线程安全"""

    def __init__(self, base_repo: str, worktrees_dir: str = ".worktrees"):
        """
        Args:
            base_repo: 主仓库的绝对路径
            worktrees_dir: worktree 存放目录（相对于 base_repo）
        """
        self.base_repo = os.path.abspath(base_repo)
        self.worktrees_root = os.path.join(self.base_repo, worktrees_dir)
        self._lock = threading.RLock()
        self._active: dict[str, WorktreeInfo] = {}

        # 确保 worktrees 根目录存在
        os.makedirs(self.worktrees_root, exist_ok=True)

    # ─── 公开 API ──────────────────────────────

    def create(self, task_id: str, base_branch: str = "master") -> str:
        """为 task_id 创建临时 worktree，返回 worktree 的绝对路径。

        工作流程:
        1. 在 .worktrees/{task_id} 创建 worktree
        2. 从主仓库复制状态文件到 worktree (只读参考)
        3. 记录 worktree 元数据

        Raises:
            RuntimeError: git worktree add 失败
            FileExistsError: worktree 路径已存在
        """
        with self._lock:
            wt_path = os.path.join(self.worktrees_root, task_id)

            if os.path.exists(wt_path):
                # 尝试清理残留（可能是上次崩溃未清理）
                self._force_cleanup(task_id)

            # 1. 创建 git worktree
            self._log(f"创建 worktree: {wt_path} (基于 {base_branch})")
            try:
                subprocess.run(
                    ["git", "worktree", "add", wt_path, base_branch],
                    cwd=self.base_repo,
                    capture_output=True,
                    text=True,
                    timeout=60,
                    check=True,
                    creationflags=_NO_WINDOW,
                )
            except subprocess.CalledProcessError as e:
                raise RuntimeError(
                    f"git worktree add 失败: {e.stderr.strip() if e.stderr else str(e)}"
                )

            # 2. 复制状态文件到 worktree（确保 agent 能读到当前状态）
            self._copy_state_to_worktree(wt_path)

            # 3. 记录元数据
            info = WorktreeInfo(
                task_id=task_id,
                path=wt_path,
                branch=base_branch,
                created_at=_time_module.time(),
            )
            self._active[task_id] = info

            return wt_path

    def sync_state(self, task_id: str):
        """将 worktree 中的状态文件变更同步回主仓库。

        策略: 逐文件合并 —
        - proposed_tasks.yaml: 追加新增提议（去重）
        - approved_queue.yaml: 按 task_id 更新对应项的状态
        - history.yaml: 追加新增记录
        - cycle_counter.txt / last_commit.txt: 取最大值/最新值
        """
        with self._lock:
            wt_path = self._get_worktree_path(task_id)
            if not wt_path or not os.path.isdir(wt_path):
                self._log(f"worktree {task_id} 不存在，跳过状态同步")
                return

            self._log(f"同步状态: {task_id} -> 主仓库")
            import yaml

            for rel_path in _SYNC_STATE_FILES:
                wt_file = os.path.join(wt_path, rel_path)
                main_file = os.path.join(self.base_repo, rel_path)

                if not os.path.isfile(wt_file):
                    continue

                if rel_path.endswith(".yaml"):
                    self._merge_yaml(main_file, wt_file, rel_path, task_id)
                elif rel_path.endswith(".txt"):
                    self._merge_txt(main_file, wt_file, rel_path)

            self._log(f"状态同步完成: {task_id}")

    def remove(self, task_id: str):
        """移除 worktree 注册和目录。

        使用 git worktree remove 而非 rm -rf，确保 git 元数据正确清理。
        如果 git worktree remove 失败（如手动删除了目录），则 prune 清理残留。
        """
        with self._lock:
            wt_path = self._get_worktree_path(task_id)
            if not wt_path:
                return  # 已经不存在了

            self._log(f"移除 worktree: {task_id}")

            # 尝试 git worktree remove
            try:
                subprocess.run(
                    ["git", "worktree", "remove", wt_path, "--force"],
                    cwd=self.base_repo,
                    capture_output=True,
                    text=True,
                    timeout=30,
                    check=True,
                    creationflags=_NO_WINDOW,
                )
            except subprocess.CalledProcessError:
                # 可能目录已被手动删除 — 使用 prune 清理 git 元数据
                self._log(f"git worktree remove 失败，尝试 prune 清理: {task_id}")
                subprocess.run(
                    ["git", "worktree", "prune"],
                    cwd=self.base_repo,
                    capture_output=True,
                    timeout=30,
                    creationflags=_NO_WINDOW,
                )
                # 手动清理残留目录
                if os.path.isdir(wt_path):
                    shutil.rmtree(wt_path, ignore_errors=True)

            self._active.pop(task_id, None)

    def list_active(self) -> list[str]:
        """返回当前活跃的 worktree task_id 列表"""
        with self._lock:
            return list(self._active.keys())

    def get_path(self, task_id: str) -> Optional[str]:
        """获取指定 task_id 的 worktree 路径"""
        with self._lock:
            info = self._active.get(task_id)
            return info.path if info else None

    def cleanup_all(self):
        """清理所有活跃 worktree（用于 SuperTask 退出时）"""
        with self._lock:
            for task_id in list(self._active.keys()):
                try:
                    self.remove(task_id)
                except Exception as e:
                    self._log(f"清理 worktree {task_id} 失败: {e}")

    # ─── 内部方法 ──────────────────────────────

    def _get_worktree_path(self, task_id: str) -> Optional[str]:
        """获取 worktree 路径（兼容已从 _active 丢失但目录仍存在的情况）"""
        info = self._active.get(task_id)
        if info:
            return info.path
        # 回退：检查目录是否存在
        candidate = os.path.join(self.worktrees_root, task_id)
        if os.path.isdir(candidate):
            return candidate
        return None

    def _force_cleanup(self, task_id: str):
        """强制清理残留的 worktree（目录已存在但 _active 中无记录）"""
        wt_path = os.path.join(self.worktrees_root, task_id)
        self._log(f"清理残留 worktree: {wt_path}")
        try:
            subprocess.run(
                ["git", "worktree", "remove", wt_path, "--force"],
                cwd=self.base_repo,
                capture_output=True,
                timeout=30,
                creationflags=_NO_WINDOW,
            )
        except Exception:
            pass
        subprocess.run(
            ["git", "worktree", "prune"],
            cwd=self.base_repo,
            capture_output=True,
            timeout=30,
            creationflags=_NO_WINDOW,
        )
        if os.path.isdir(wt_path):
            shutil.rmtree(wt_path, ignore_errors=True)

    def _copy_state_to_worktree(self, wt_path: str):
        """将主仓库的状态文件复制到 worktree"""
        for rel_path in _SYNC_STATE_FILES:
            src = os.path.join(self.base_repo, rel_path)
            dst = os.path.join(wt_path, rel_path)
            if os.path.isfile(src):
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.copy2(src, dst)

    def _merge_yaml(self, main_file: str, wt_file: str, rel_path: str, task_id: str):
        """合并 YAML 状态文件 — 按 task_id 策略合并"""
        import yaml

        # 读取双方
        try:
            with open(main_file, "r", encoding="utf-8") as f:
                main_data = yaml.safe_load(f) or []
        except (FileNotFoundError, yaml.YAMLError):
            main_data = []
        try:
            with open(wt_file, "r", encoding="utf-8") as f:
                wt_data = yaml.safe_load(f) or []
        except (yaml.YAMLError, OSError):
            wt_data = []

        if not isinstance(main_data, list):
            main_data = []
        if not isinstance(wt_data, list):
            wt_data = []

        if rel_path == "state/approved_queue.yaml":
            # 按 task_id 更新状态
            main_by_id = {t.get("id"): t for t in main_data if isinstance(t, dict)}
            for wt_item in wt_data:
                if not isinstance(wt_item, dict):
                    continue
                wid = wt_item.get("id")
                if wid is not None and wid in main_by_id:
                    # 更新已有项的状态（保留 worktree 中的 status/error/completed_at）
                    main_by_id[wid].update({
                        k: v for k, v in wt_item.items()
                        if k in ("status", "error", "completed_at", "fail_count")
                    })
            # 重建列表保持原有顺序
            merged = []
            seen = set()
            for t in main_data:
                tid = t.get("id") if isinstance(t, dict) else None
                if tid is not None:
                    seen.add(tid)
                    merged.append(main_by_id.get(tid, t))
            # 追加主仓库中没有的新项
            for wt_item in wt_data:
                if isinstance(wt_item, dict) and wt_item.get("id") not in seen:
                    merged.append(wt_item)

        elif rel_path in ("state/proposed_tasks.yaml", "state/history.yaml"):
            # 按 id 去重合并：主仓库优先，worktree 中的新项追加
            main_ids = {t.get("id") for t in main_data if isinstance(t, dict)}
            merged = list(main_data)
            for wt_item in wt_data:
                if isinstance(wt_item, dict) and wt_item.get("id") not in main_ids:
                    merged.append(wt_item)
        else:
            merged = main_data

        # 写回主仓库
        with open(main_file, "w", encoding="utf-8") as f:
            yaml.dump(merged, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

    def _merge_txt(self, main_file: str, wt_file: str, rel_path: str):
        """合并文本文件 — 取最大值/最新值"""
        if rel_path == "state/cycle_counter.txt":
            try:
                with open(main_file, "r") as f:
                    main_val = int(f.read().strip())
            except (FileNotFoundError, ValueError):
                main_val = 0
            try:
                with open(wt_file, "r") as f:
                    wt_val = int(f.read().strip())
            except (ValueError, OSError):
                wt_val = 0
            with open(main_file, "w") as f:
                f.write(str(max(main_val, wt_val)))
        elif rel_path == "state/last_commit.txt":
            # 直接复制 worktree 中的最新值
            shutil.copy2(wt_file, main_file)

    @staticmethod
    def _log(message: str):
        """简单的控制台日志（后续可接入 FileManager 日志系统）"""
        import sys
        print(f"[WorktreeManager] {message}", file=sys.stderr)
