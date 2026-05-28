# -*- coding: utf-8 -*-
"""Tests for renderer."""
import pytest
from prompt_tool.core.template_engine import parse_template
from prompt_tool.core.renderer import render, RenderError


class TestRender:
    def test_plain_text(self) -> None:
        result = render(parse_template("Hello"), {})
        assert result == "Hello"

    def test_variable_substitution(self) -> None:
        result = render(parse_template("Hi {{name}}"), {"name": "Alice"})
        assert result == "Hi Alice"

    def test_multiple_variables(self) -> None:
        result = render(
            parse_template("{{a}} and {{b}}"),
            {"a": "X", "b": "Y"},
        )
        assert result == "X and Y"

    def test_missing_variable_fills_empty(self) -> None:
        result = render(parse_template("Hi {{name}}"), {})
        assert result == "Hi "

    def test_if_true(self) -> None:
        result = render(
            parse_template("A{% if flag %}B{% endif %}C"),
            {"flag": True},
        )
        assert result == "ABC"

    def test_if_false(self) -> None:
        result = render(
            parse_template("A{% if flag %}B{% endif %}C"),
            {"flag": False},
        )
        assert result == "AC"

    def test_if_else_true(self) -> None:
        result = render(
            parse_template("{% if x %}T{% else %}F{% endif %}"),
            {"x": True},
        )
        assert result == "T"

    def test_if_else_false(self) -> None:
        result = render(
            parse_template("{% if x %}T{% else %}F{% endif %}"),
            {"x": False},
        )
        assert result == "F"

    def test_if_equals_match(self) -> None:
        result = render(
            parse_template('{% if role == "admin" %}Admin{% endif %}'),
            {"role": "admin"},
        )
        assert result == "Admin"

    def test_if_equals_no_match(self) -> None:
        result = render(
            parse_template('{% if role == "admin" %}Admin{% endif %}'),
            {"role": "user"},
        )
        assert result == ""

    def test_empty_string_is_falsy(self) -> None:
        result = render(
            parse_template("{% if name %}Hello{% endif %}"),
            {"name": ""},
        )
        assert result == ""

    def test_zero_is_falsy(self) -> None:
        result = render(
            parse_template("{% if count %}has{% endif %}"),
            {"count": 0},
        )
        assert result == ""

    def test_nonzero_is_truthy(self) -> None:
        result = render(
            parse_template("{% if count %}has{% endif %}"),
            {"count": 5},
        )
        assert result == "has"

    def test_nested_condition(self) -> None:
        result = render(
            parse_template("{% if a %}{% if b %}both{% endif %}{% endif %}"),
            {"a": True, "b": True},
        )
        assert result == "both"

    def test_nested_condition_not_met(self) -> None:
        result = render(
            parse_template("{% if a %}{% if b %}both{% endif %}{% endif %}"),
            {"a": True, "b": False},
        )
        assert result == ""
