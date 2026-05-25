# -*- coding: utf-8 -*-
"""
proposal_merger.py — 提议合并器

解决 AI 重写 proposed_tasks.yaml 时丢失元数据（proposed_at、project）的问题。
由脚本（Python）而非 agent（AI）负责：
  1. 探索前：快照现有提议的时间戳和元数据
  2. 探索后：将 AI 写的新提议与旧提议智能合并
  3. 保留已有提议的原始 proposed_at，仅对新提议设置当前时间
  4. 自动补充 project 字段

设计原则：
  - 确定性：脚本逻辑不依赖 AI 行为
  - 幂等性：多次合并不会产生重复
  - 保守性：已有提议优先保留原始时间戳
  - 智能匹配：描述相似的任务（AI 微调后的版本）自动合并，不产生重复
"""
import hashlib
import os
import re
import threading
from datetime import datetime
from difflib import SequenceMatcher
from typing import Any, Optional

import yaml


def _now_iso() -> str:
    """返回当前时间的 ISO 格式字符串"""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _task_fingerprint(task: dict) -> str:
    """计算任务的内容指纹（基于 description + priority，忽略 id 和时间戳）。

    同一任务在不同 AI 轮次中可能被分配不同 id，通过内容指纹识别"同一任务"。
    """
    desc = str(task.get("description", "")).strip()
    priority = str(task.get("priority", "")).strip()
    raw = f"{desc}|{priority}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def _description_similarity(a: str, b: str) -> float:
    """计算两个任务描述的相似度（0.0 ~ 1.0）。

    使用 SequenceMatcher 的 ratio()，忽略大小写和首尾空白。
    返回值 >= 0.55 认为"可能是同一任务"。
    """
    a_clean = a.strip().lower()
    b_clean = b.strip().lower()
    if not a_clean or not b_clean:
        return 0.0
    return SequenceMatcher(None, a_clean, b_clean).ratio()


# 描述相似度阈值：超过此值认为可能是同一任务被 AI 微调了描述
_SIMILARITY_THRESHOLD = 0.55

# 通用兜底关键词：当 project_label 为"全部项目"等通用值时使用
_GENERIC_LABELS = frozenset({"全部项目", "全部", "所有项目", "项目仓库", "all", ""})

# 项目名称 → 关键词列表的默认映射（兜底用，当未传入 projects 时使用）
_DEFAULT_PROJECT_KEYWORDS: dict[str, list[str]] = {
    "FTG 食物主题生成器": ["ftg-miniapp", "ftg-server", "ftg"],
    "Game1 挂机放置游戏": ["game1-miniapp", "game1-server", "game1"],
    "AI-Tavern 角色聊天": ["tavern-miniapp", "tavern-server", "tavern"],
    "Dashboard": ["dashboard"],
    "supertask 工具": ["supertask"],
}


def _infer_project_from_description(description: str,
                                     projects: list[dict] | None = None) -> str:
    """根据任务描述中的关键字推断实际归属项目。

    匹配策略（大小写不敏感）：
    1. 如果传入了 projects 配置，从中提取 (label, source_dirs) 构建关键词映射
    2. 回退到 _DEFAULT_PROJECT_KEYWORDS
    3. 扫描描述中的每个关键词，返回第一个匹配的项目名
    4. 无匹配返回空字符串

    Args:
        description: 任务描述文本
        projects: 可选的 config.yaml projects 列表

    Returns:
        匹配的项目名，或空字符串
    """
    desc_lower = description.lower()
    if not desc_lower:
        return ""

    # 构建关键词映射
    mapping: dict[str, list[str]] = {}
    if projects:
        mapping = _build_keyword_mapping_from_projects(projects)
        # 将关键词转为小写以支持大小写不敏感匹配
        mapping = {label: [kw.lower() for kw in kws] for label, kws in mapping.items()}
    else:
        mapping = _DEFAULT_PROJECT_KEYWORDS

    # 按关键词匹配
    for label, keywords in mapping.items():
        for kw in keywords:
            if kw and kw.lower() in desc_lower:
                return label

    return ""


def _build_keyword_mapping_from_projects(projects: list[dict]) -> dict[str, list[str]]:
    """从 config.yaml 的 projects 列表构建 项目名→关键词 映射。

    每个项目的 source_dirs（如 apps/ftg-miniapp/src/）会被解析为关键词（如 ftg-miniapp）。
    如果 source_dirs 为空，回退到项目 name 字段 + label 分词。
    """
    mapping: dict[str, list[str]] = {}
    for p in projects:
        label = str(p.get("label", p.get("name", ""))).strip()
        if not label:
            continue
        source_dirs = p.get("source_dirs", [])
        keywords: list[str] = []
        for d in source_dirs:
            # 从路径中提取项目关键词：apps/ftg-miniapp/src/ → ftg-miniapp
            # 跳过 apps/, servers/, tools/ 等常见前缀和 src/ 后缀
            path_parts = [x for x in d.strip("/").split("/") if x not in ("src", "")]
            # 取最后一个非通用前缀的目录名（如 ftg-miniapp, game1-server）
            project_part = path_parts[-1] if path_parts else ""
            if project_part and project_part not in ("apps", "servers", "tools", "src"):
                keywords.append(project_part)
        # 如果没有 source_dirs，回退到 name 字段 + label 分词
        if not keywords:
            name = str(p.get("name", "")).strip()
            if name and name != label:
                keywords.append(name)
            # 对 label 进行分词（如 "supertask 工具" → "supertask", "工具"）
            label_words = label.split()
            for word in label_words:
                if word not in keywords:
                    keywords.append(word)
        mapping[label] = keywords if keywords else [label]
    return mapping


class ProposalMerger:
    """提议合并器 — 探索前后的状态管理。

    用法:
        merger = ProposalMerger(state_dir)
        # 1. 探索前：快照
        merger.snapshot()
        # 2. AI 探索（AI 写入 proposed_tasks.yaml）
        # 3. 探索后：合并
        merger.merge(project_label="FTG 食物主题生成器")
    """

    def __init__(self, state_dir: str, lock: Optional[threading.RLock] = None):
        self.state_dir = state_dir
        self._proposed_path = os.path.join(state_dir, "proposed_tasks.yaml")
        # 快照数据结构：{fingerprint: {"proposed_at": "...", "project": "...", "id": int, "description": str}}
        self._snapshot: dict[str, dict[str, Any]] = {}
        # 下次可用的最大 ID
        self._max_id: int = 0
        # 共享锁（与 FileManager 共用，防止竞态条件）
        self._lock = lock

    def snapshot(self):
        """探索前：保存现有提议的元数据快照（使用共享锁）。

        快照键为内容指纹，值为 {proposed_at, project, id, description}。
        无论 AI 如何重写文件，合并时都能恢复原始时间戳。
        """
        if self._lock:
            self._lock.acquire()
        try:
            existing = self._load_proposed_no_lock()
            self._snapshot.clear()
            self._max_id = 0
            for task in existing:
                fp = _task_fingerprint(task)
                proposed_at = task.get("proposed_at", "")
                project = task.get("project", task.get("source", ""))
                tid = task.get("id", 0)
                desc = str(task.get("description", ""))
                self._snapshot[fp] = {
                    "proposed_at": proposed_at,
                    "project": project,
                    "id": tid,
                    "description": desc,
                }
                if tid > self._max_id:
                    self._max_id = tid
        finally:
            if self._lock:
                self._lock.release()

    def _load_proposed_no_lock(self) -> list[dict]:
        """加载 proposed_tasks.yaml（内部方法，调用者负责加锁）"""
        if not os.path.isfile(self._proposed_path):
            return []
        try:
            with open(self._proposed_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or []
        except (yaml.YAMLError, OSError):
            return []
        return data if isinstance(data, list) else []

    def _find_similar_snapshot(self, task: dict, exclude_fps: set[str]) -> tuple[str, dict] | None:
        """在快照中查找与给定任务描述最相似的条目（相似度 ≥ 阈值）。

        Args:
            task: 当前文件中的任务
            exclude_fps: 已匹配的指纹集（避免重复匹配）

        Returns:
            (fingerprint, snapshot_entry) 或 None
        """
        desc = str(task.get("description", "")).strip()
        if not desc:
            return None

        best_fp = ""
        best_score = 0.0
        best_entry = None

        for fp, snap in self._snapshot.items():
            if fp in exclude_fps:
                continue
            snap_desc = str(snap.get("description", "")).strip()
            if not snap_desc:
                continue
            score = _description_similarity(desc, snap_desc)
            if score > best_score and score >= _SIMILARITY_THRESHOLD:
                best_score = score
                best_fp = fp
                best_entry = snap

        return (best_fp, best_entry) if best_entry else None

    def merge(self, project_label: str = "", projects: list[dict] | None = None) -> list[dict]:
        """探索后：合并 AI 写的新提议与快照中的旧提议（全程持锁，防止竞态条件）。

        策略：
            0. 精确指纹匹配 → 直接恢复快照中的 proposed_at 和 project
            1. 相似描述匹配 → 视为同一任务被 AI 微调，合并内容但保留原始时间戳
            2. 不匹配的新任务 → 设置 proposed_at = now
            3. 快照中有但新文件中不存在的 → 检查是否有相似任务已合并，若无则恢复
            4. 所有任务统一分配不重复的 id
            5. 如果 project_label 是通用值（如"全部项目"），自动从描述推断具体项目

        Args:
            project_label: 探索的项目显示名称（如 "FTG 食物主题生成器"）。
            projects: 可选的 config.yaml projects 配置列表，用于推断项目归属。

        Returns:
            合并后的完整提议列表（已写入文件）
        """
        if self._lock:
            self._lock.acquire()
        try:
            current = self._load_proposed_no_lock()

            merged: list[dict] = []
            seen_snapshot_fps: set[str] = set()  # 已通过指纹或相似匹配消耗的快照条目
            seen_current_fps: set[str] = set()   # 已处理的当前任务（防重复）
            next_id = self._max_id + 1

            # 第一遍：处理当前文件中的任务
            for task in current:
                fp = _task_fingerprint(task)
                if fp in seen_current_fps:
                    continue
                seen_current_fps.add(fp)

                new_task = dict(task)

                if fp in self._snapshot:
                    # ── 精确匹配：保留原始时间戳和元数据 ──
                    snap = self._snapshot[fp]
                    seen_snapshot_fps.add(fp)
                    if snap.get("proposed_at"):
                        new_task["proposed_at"] = snap["proposed_at"]
                    if snap.get("project") and not new_task.get("project"):
                        new_task["project"] = snap["project"]
                    if snap.get("id", 0) > 0:
                        new_task["id"] = snap["id"]
                else:
                    # ── 尝试相似匹配：AI 可能微调了描述 ──
                    similar = self._find_similar_snapshot(task, seen_snapshot_fps)
                    if similar:
                        sim_fp, snap = similar
                        seen_snapshot_fps.add(sim_fp)
                        # 保留 AI 的新描述（接受微调），但继承原始时间戳和 project
                        if snap.get("proposed_at"):
                            new_task["proposed_at"] = snap["proposed_at"]
                        if snap.get("project") and not new_task.get("project"):
                            new_task["project"] = snap["project"]
                        if snap.get("id", 0) > 0:
                            new_task["id"] = snap["id"]
                    else:
                        # ── 真正的新任务 ──
                        if not new_task.get("proposed_at"):
                            new_task["proposed_at"] = _now_iso()

                # ── 公共：兜底补充 project 字段（精确匹配/相似匹配/新任务都走这里） ──
                if not new_task.get("project"):
                    # 如果 project_label 是通用值（如"全部项目"），从描述推断具体项目
                    if project_label and project_label not in _GENERIC_LABELS:
                        new_task["project"] = project_label
                    else:
                        desc = str(new_task.get("description", ""))
                        inferred = _infer_project_from_description(desc, projects)
                        if inferred:
                            new_task["project"] = inferred

                new_task.setdefault("status", "proposed")
                merged.append(new_task)

            # 第二遍：补充快照中有但未被任何匹配消耗的任务（AI 可能误删）
            for fp, snap in self._snapshot.items():
                if fp not in seen_snapshot_fps:
                    restored = {
                        "id": snap.get("id", next_id),
                        "description": str(snap.get("description", f"原任务 #{snap.get('id', '?')}")),
                        "priority": "fix P3",
                        "status": "proposed",
                        "proposed_at": snap.get("proposed_at", _now_iso()),
                    }
                    if snap.get("project"):
                        restored["project"] = snap["project"]
                    merged.append(restored)
                    next_id += 1

            # 第三遍：重新分配 id，确保无重复
            used_ids: set[int] = set()
            for task in merged:
                tid = task.get("id", 0)
                if tid <= 0 or tid in used_ids:
                    while next_id in used_ids:
                        next_id += 1
                    task["id"] = next_id
                    used_ids.add(next_id)
                    next_id += 1
                else:
                    used_ids.add(tid)

            # 排序：按 id 升序
            merged.sort(key=lambda t: t.get("id", 0))

            # 写回文件
            self._save_proposed_no_lock(merged)

            return merged
        finally:
            if self._lock:
                self._lock.release()

    def _load_proposed(self) -> list[dict]:
        """加载 proposed_tasks.yaml（使用共享锁确保线程安全）"""
        if self._lock:
            self._lock.acquire()
        try:
            return self._load_proposed_no_lock()
        finally:
            if self._lock:
                self._lock.release()

    def _save_proposed(self, tasks: list[dict]):
        """保存 proposed_tasks.yaml，原子写入确保不丢数据（使用共享锁）"""
        if self._lock:
            self._lock.acquire()
        try:
            self._save_proposed_no_lock(tasks)
        finally:
            if self._lock:
                self._lock.release()

    def _save_proposed_no_lock(self, tasks: list[dict]):
        """保存 proposed_tasks.yaml（内部方法，调用者负责加锁）"""
        tmp_path = self._proposed_path + ".tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            yaml.dump(tasks, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
        os.replace(tmp_path, self._proposed_path)  # 原子替换


def merge_proposals_safe(state_dir: str, project_label: str = "",
                         projects: list[dict] | None = None,
                         lock: Optional[threading.RLock] = None) -> list[dict]:
    """便捷函数：一步完成快照→合并流程。

    用于替代 loop_manager._phase_explore 中的 save_proposed 回填逻辑。

    Args:
        state_dir: SuperTask state 目录路径
        project_label: 当前探索项目的显示名称
        projects: 可选的 config.yaml projects 配置列表，用于推断项目归属
        lock: 可选的共享锁（与 FileManager 共用，防止竞态条件）

    Returns:
        合并后的完整提议列表
    """
    merger = ProposalMerger(state_dir, lock=lock)
    merger.snapshot()
    return merger.merge(project_label, projects)
