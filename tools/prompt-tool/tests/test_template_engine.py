# -*- coding: utf-8 -*-
"""Tests for template_engine."""
import pytest
from prompt_tool.core.template_engine import (
    parse_template,
    extract_variable_names,
    TextNode,
    VariableNode,
    IfNode,
)


class TestParseTemplate:
    def test_plain_text(self) -> None:
        nodes = parse_template("Hello world")
        assert nodes == [TextNode(text="Hello world")]

    def test_single_variable(self) -> None:
        nodes = parse_template("Hello {{name}}")
        assert nodes == [TextNode(text="Hello "), VariableNode(name="name")]

    def test_multiple_variables(self) -> None:
        nodes = parse_template("{{a}} and {{b}}")
        assert nodes == [
            VariableNode(name="a"),
            TextNode(text=" and "),
            VariableNode(name="b"),
        ]

    def test_variable_at_start_and_end(self) -> None:
        nodes = parse_template("{{x}} middle {{y}}")
        assert nodes == [
            VariableNode(name="x"),
            TextNode(text=" middle "),
            VariableNode(name="y"),
        ]

    def test_simple_if(self) -> None:
        nodes = parse_template("A{% if flag %}B{% endif %}C")
        assert nodes == [
            TextNode(text="A"),
            IfNode(variable="flag", expected_value=None,
                   then_branch=[TextNode(text="B")], else_branch=None),
            TextNode(text="C"),
        ]

    def test_if_else(self) -> None:
        nodes = parse_template("{% if x %}T{% else %}F{% endif %}")
        assert nodes == [
            IfNode(variable="x", expected_value=None,
                   then_branch=[TextNode(text="T")],
                   else_branch=[TextNode(text="F")]),
        ]

    def test_if_equals(self) -> None:
        nodes = parse_template('{% if x == "val" %}yes{% endif %}')
        assert nodes == [
            IfNode(variable="x", expected_value="val",
                   then_branch=[TextNode(text="yes")], else_branch=None),
        ]

    def test_nested_variables_in_branches(self) -> None:
        nodes = parse_template("{% if flag %}{{x}}{% else %}{{y}}{% endif %}")
        assert nodes == [
            IfNode(variable="flag", expected_value=None,
                   then_branch=[VariableNode(name="x")],
                   else_branch=[VariableNode(name="y")]),
        ]

    def test_unclosed_if(self) -> None:
        with pytest.raises(ValueError, match="unclosed"):
            parse_template("{% if x %}no endif")

    def test_unopened_endif(self) -> None:
        with pytest.raises(ValueError, match="unexpected"):
            parse_template("{% endif %}")

    def test_unknown_tag(self) -> None:
        with pytest.raises(ValueError, match="unknown tag"):
            parse_template("{% for x in list %}...{% endfor %}")


class TestExtractVariableNames:
    def test_plain(self) -> None:
        assert extract_variable_names("Hello") == set()

    def test_simple(self) -> None:
        assert extract_variable_names("{{a}} and {{b}}") == {"a", "b"}

    def test_nested_in_if(self) -> None:
        names = extract_variable_names("{% if f %}{{x}}{% else %}{{y}}{% endif %}")
        assert names == {"f", "x", "y"}
