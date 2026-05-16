# -*- coding: utf-8 -*-
"""Test the hybrid render engine: ${var} + {var} placeholder support."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from gui.core.prompt_manager import PromptTemplate, PromptManager


class TestHybridRender:
    """Test that both ${var} and {var} placeholder formats work."""

    def test_dollar_brace_format(self):
        """Original ${var} format still works."""
        t = PromptTemplate("test", "Hello ${name}, you have $count items")
        result = t.render(name="World", count="5")
        assert result == "Hello World, you have 5 items"

    def test_curly_brace_format(self):
        """New {var} format (config.yaml style) works."""
        t = PromptTemplate("test", "\u4efb\u52a1\u63cf\u8ff0\uff1a{desc}")
        result = t.render(desc="\u4fee\u590d\u7a7a catch \u5757")
        assert result == "\u4efb\u52a1\u63cf\u8ff0\uff1a\u4fee\u590d\u7a7a catch \u5757"

    def test_mixed_format(self):
        """Both formats can coexist in one template."""
        t = PromptTemplate("test", "\u9879\u76ee: ${project}, \u4efb\u52a1: {task}")
        result = t.render(project="FTG", task="\u6dfb\u52a0\u5bfc\u51fa")
        assert result == "\u9879\u76ee: FTG, \u4efb\u52a1: \u6dfb\u52a0\u5bfc\u51fa"

    def test_unmatched_curly_preserved(self):
        """Unknown {var} placeholders are left as-is (safe mode)."""
        t = PromptTemplate("test", "Hello {name}, code: {json}")
        result = t.render(name="World")
        assert result == "Hello World, code: {json}"

    def test_unmatched_dollar_preserved(self):
        """Unknown ${var} placeholders are left as-is."""
        t = PromptTemplate("test", "Hello ${name}, unknown: ${missing}")
        result = t.render(name="World")
        assert result == "Hello World, unknown: ${missing}"

    def test_double_braces_not_replaced(self):
        """Double curly braces (JSON examples) are preserved."""
        t = PromptTemplate("test", 'Config: {{ "key": "value" }}, desc: {desc}')
        result = t.render(desc="test")
        assert result == 'Config: {{ "key": "value" }}, desc: test'

    def test_no_placeholders(self):
        """Template with no placeholders is returned as-is."""
        t = PromptTemplate("test", "Just plain text")
        result = t.render(foo="bar")
        assert result == "Just plain text"


class TestInlineTemplates:
    """Test that set_inline() overrides file templates and defaults."""

    def test_set_inline_overrides_default(self):
        pm = PromptManager("nonexistent_dir")
        pm.set_inline("execute", "CUSTOM: {desc}")
        result = pm.render("execute", desc="test task")
        assert result == "CUSTOM: test task"

    def test_set_inline_overrides_file(self):
        pm = PromptManager("state/prompts")
        # File template is loaded first (if exists), then inline overrides
        pm.set_inline("execute", "OVERRIDE: {desc}")
        result = pm.render("execute", desc="custom")
        assert result == "OVERRIDE: custom"

    def test_non_string_variable_converted(self):
        """Non-string kwargs values are converted to string."""
        t = PromptTemplate("test", "Count: {n}, Flag: {flag}")
        result = t.render(n=42, flag=True)
        assert result == "Count: 42, Flag: True"


class TestConfigYamlStyle:
    """Test the actual config.yaml template patterns."""

    def test_execute_with_desc(self):
        template = """/ulw-loop
\u8bf7\u6267\u884c\u4ee5\u4e0b\u5f00\u53d1\u4efb\u52a1\uff1a

\u4efb\u52a1\u63cf\u8ff0\uff1a{desc}

\u8981\u6c42\uff1a
- \u5b8c\u6210\u540e\uff0c\u4fee\u6539 state/approved_queue.yaml \u4e2d\u5bf9\u5e94\u9879\u7684 status \u4e3a done\u3002

\u5b8c\u6210\u540e\u8bf7\u8f93\u51fa ===TASK_DONE==="""
        t = PromptTemplate("execute", template)
        result = t.render(desc="\u4fee\u590d\u7c7b\u578b\u9519\u8bef")
        assert "\u4fee\u590d\u7c7b\u578b\u9519\u8bef" in result
        assert "{desc}" not in result  # Placeholder MUST be replaced
        assert "==TASK_DONE==" in result

    def test_update_proposed_with_content(self):
        template = """{content}

\u8bf7\u6839\u636e\u9879\u76ee\u6700\u65b0\u72b6\u6001\u9010\u4e00\u68c0\u67e5\u6bcf\u9879"""
        # content contains YAML
        yaml_content = "- id: 1\n  description: test\n  status: proposed"
        t = PromptTemplate("update_proposed", template)
        result = t.render(content=yaml_content)
        assert "id: 1" in result
        assert "{content}" not in result


class TestChinesePlaceholders:
    """Test that Chinese character placeholder names work with the new [^{}]+ regex."""

    def test_chinese_placeholder_simple(self):
        t = PromptTemplate("test", "{项目名称}")
        result = t.render(**{"项目名称": "FTG食物主题生成器"})
        assert result == "FTG食物主题生成器"

    def test_chinese_placeholder_multiple(self):
        template = "【{项目名称}】任务：{任务描述}，预期：{预期效果}"
        t = PromptTemplate("test", template)
        result = t.render(
            **{"项目名称": "FTG", "任务描述": "添加asyncHandler", "预期效果": "消除try-catch"}
        )
        assert "FTG" in result
        assert "asyncHandler" in result
        assert "try-catch" in result
        assert "{项目名称}" not in result
        assert "{任务描述}" not in result
        assert "{预期效果}" not in result

    def test_chinese_placeholder_in_mixed_content(self):
        template = "# 提示词预览\n\n【项目名称】\n{项目名称}\n\n【任务描述】\n{任务描述}"
        t = PromptTemplate("test", template)
        result = t.render(**{"项目名称": "Game1", "任务描述": "修复类型错误"})
        assert "Game1" in result
        assert "修复类型错误" in result
        assert "{项目名称}" not in result

    def test_chinese_placeholder_unmatched_preserved(self):
        t = PromptTemplate("test", "项目: {项目名称}, 未知: {未定义字段}")
        result = t.render(**{"项目名称": "FTG"})
        assert "FTG" in result
        assert "{未定义字段}" in result  # preserved as-is

    def test_mixed_chinese_english_placeholders(self):
        template = "{项目名称}: ${project_label} — {任务描述}: ${desc}"
        t = PromptTemplate("test", template)
        result = t.render(
            **{"项目名称": "FTG", "project_label": "Food Theme Generator",
               "任务描述": "重构模块", "desc": "refactor module"}
        )
        assert "FTG" in result
        assert "Food Theme Generator" in result
        assert "重构模块" in result
        assert "refactor module" in result
        assert "{项目名称}" not in result
