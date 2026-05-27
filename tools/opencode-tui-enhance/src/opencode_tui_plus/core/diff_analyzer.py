# -*- coding: utf-8 -*-
"""
diff_analyzer.py — Git Diff 统计与分析

解析 git diff 输出，提供结构化统计、收敛判断和摘要生成。
用于定向迭代模式中每轮改进后的差异分析。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class DiffStat:
    """单轮 diff 的结构化统计"""
    files_changed: int = 0
    insertions: int = 0
    deletions: int = 0
    file_list: list[str] = field(default_factory=list)


class DiffAnalyzer:
    """Git diff 分析器 — 纯静态方法，无状态"""

    # 匹配 git diff --stat 的最后一行: "N files changed, M insertions(+), K deletions(-)"
    _STAT_RE = re.compile(
        r'(\d+)\s+files?\s+changed'
        r'(?:,\s*(\d+)\s+insertions?\(\+\))?'
        r'(?:,\s*(\d+)\s+deletions?\(\-\))?'
    )

    @staticmethod
    def analyze(raw_diff: str) -> DiffStat:
        """解析 git diff 输出，提取结构化统计。

        Args:
            raw_diff: git diff 或 git diff --stat 的原始输出

        Returns:
            DiffStat 包含文件数、增删行数、文件列表
        """
        if not raw_diff.strip():
            return DiffStat()

        stat = DiffStat()
        lines = raw_diff.split('\n')

        # 解析 --stat 汇总行
        for line in lines:
            m = DiffAnalyzer._STAT_RE.search(line)
            if m:
                stat.files_changed = int(m.group(1))
                if m.group(2):
                    stat.insertions = int(m.group(2))
                if m.group(3):
                    stat.deletions = int(m.group(3))
                break

        # 提取涉及的文件列表
        # git diff 格式: "diff --git a/path b/path" 或 "--- a/path" / "+++ b/path"
        diff_file_re = re.compile(r'^diff --git a/(.+?) b/(.+?)$')
        for line in lines:
            m = diff_file_re.match(line)
            if m:
                file_path = m.group(2)  # 用 b/ (新文件) 的路径
                if file_path not in stat.file_list:
                    stat.file_list.append(file_path)

        return stat

    @staticmethod
    def is_converging(history: list[DiffStat], threshold: float = 0.3) -> bool:
        """判断改进是否收敛。

        比较最近两轮的改动量：如果最新一轮的 total_changes
        比上一轮减少了 threshold 比例以上，视为收敛。

        Args:
            history: 按时间顺序排列的 DiffStat 列表
            threshold: 收敛阈值 (0.0-1.0)，默认 0.3

        Returns:
            True 表示改动量在下降（可能收敛）
        """
        if len(history) < 2:
            return False

        prev = history[-2].insertions + history[-2].deletions
        curr = history[-1].insertions + history[-1].deletions

        if prev == 0:
            return True  # 上一轮就没改动，已是收敛

        ratio = curr / prev
        return ratio < (1.0 - threshold)

    @staticmethod
    def summarize(history: list[DiffStat]) -> str:
        """生成前几轮的简洁摘要，供 runner 拼入 prompt。

        Args:
            history: 按时间顺序排列的 DiffStat 列表

        Returns:
            人类可读的摘要字符串
        """
        if not history:
            return "（无历史轮次）"

        parts: list[str] = []
        for i, s in enumerate(history):
            round_num = i + 1
            files = s.files_changed
            ins = s.insertions
            dels = s.deletions
            parts.append(
                f"第 {round_num} 轮：修改了 {files} 个文件，"
                f"+{ins} 行，-{dels} 行"
            )
            if s.file_list:
                # 列出前 10 个文件，超过则省略
                preview = s.file_list[:10]
                file_str = '、'.join(f'`{f}`' for f in preview)
                if len(s.file_list) > 10:
                    file_str += f'... 等共 {len(s.file_list)} 个文件'
                parts.append(f"  涉及文件：{file_str}")

        return '\n'.join(parts)

    @staticmethod
    def total_changes(history: list[DiffStat]) -> DiffStat:
        """汇总所有轮次的改动。

        Returns:
            合并后的 DiffStat
        """
        total = DiffStat()
        all_files: set[str] = set()
        for s in history:
            total.files_changed += s.files_changed
            total.insertions += s.insertions
            total.deletions += s.deletions
            all_files.update(s.file_list)
        total.file_list = sorted(all_files)
        return total
