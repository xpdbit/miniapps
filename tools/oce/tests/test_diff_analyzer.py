# -*- coding: utf-8 -*-
"""diff_analyzer.py 单元测试"""

import pytest
from oce.core.diff_analyzer import DiffAnalyzer, DiffStat


class TestDiffAnalyzer:

    def test_analyze_empty(self):
        """空 diff 返回零统计"""
        stat = DiffAnalyzer.analyze("")
        assert stat.files_changed == 0
        assert stat.insertions == 0
        assert stat.deletions == 0
        assert stat.file_list == []

    def test_analyze_single_file(self):
        """单文件 diff 正确解析"""
        raw = """diff --git a/test.py b/test.py
--- a/test.py
+++ b/test.py
@@ -1,3 +1,5 @@
+new line
+another line
 1 file changed, 2 insertions(+)"""
        stat = DiffAnalyzer.analyze(raw)
        assert stat.files_changed == 1
        assert stat.insertions == 2
        assert stat.deletions == 0
        assert "test.py" in stat.file_list

    def test_analyze_multiple_files(self):
        """多文件 diff 正确解析"""
        raw = """diff --git a/a.py b/a.py
--- a/a.py
+++ b/a.py
diff --git a/b.py b/b.py
--- a/b.py
+++ b/b.py
 2 files changed, 5 insertions(+), 3 deletions(-)"""
        stat = DiffAnalyzer.analyze(raw)
        assert stat.files_changed == 2
        assert stat.insertions == 5
        assert stat.deletions == 3
        assert len(stat.file_list) == 2

    def test_is_converging_true(self):
        """改动量下降超过阈值 → 收敛"""
        history = [
            DiffStat(insertions=50, deletions=20),  # 70 total
            DiffStat(insertions=20, deletions=10),  # 30 total (57% 下降)
        ]
        assert DiffAnalyzer.is_converging(history, threshold=0.3) is True

    def test_is_converging_false(self):
        """改动量未明显下降 → 未收敛"""
        history = [
            DiffStat(insertions=50, deletions=20),  # 70 total
            DiffStat(insertions=45, deletions=18),  # 63 total (10% 下降)
        ]
        assert DiffAnalyzer.is_converging(history, threshold=0.3) is False

    def test_is_converging_insufficient_data(self):
        """少于 2 轮 → 不判断收敛"""
        assert DiffAnalyzer.is_converging([DiffStat()]) is False
        assert DiffAnalyzer.is_converging([]) is False

    def test_summarize(self):
        """摘要生成包含关键信息"""
        history = [
            DiffStat(files_changed=5, insertions=100, deletions=30,
                     file_list=["a.py", "b.py", "c.py"]),
        ]
        summary = DiffAnalyzer.summarize(history)
        assert "第 1 轮" in summary
        assert "5 个文件" in summary
        assert "+100" in summary
        assert "-30" in summary

    def test_total_changes(self):
        """汇总所有轮次"""
        history = [
            DiffStat(files_changed=2, insertions=10, deletions=5, file_list=["a.py"]),
            DiffStat(files_changed=3, insertions=20, deletions=8, file_list=["b.py", "c.py"]),
        ]
        total = DiffAnalyzer.total_changes(history)
        assert total.insertions == 30
        assert total.deletions == 13
        assert len(total.file_list) == 3
