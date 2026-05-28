# -*- coding: utf-8 -*-
"""Parse prompt templates into an AST (variable nodes + condition blocks)."""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class TextNode:
    text: str


@dataclass
class VariableNode:
    name: str


@dataclass
class IfNode:
    variable: str
    expected_value: Optional[str]  # None = truthy check
    then_branch: List["AstNode"]
    else_branch: Optional[List["AstNode"]]


AstNode = TextNode | VariableNode | IfNode


_VAR_RE = re.compile(r"\{\{(\w+)\}\}")
_TAG_RE = re.compile(r"\{%\s*(\w+)\s*(.*?)\s*%\}")


def parse_template(template: str) -> list[AstNode]:
    """Parse a template string into a list of AST nodes."""
    return _parse_blocks(template.strip(), is_top_level=True)[0]


def _parse_blocks(text: str, is_top_level: bool = False) -> tuple[list[AstNode], str]:
    """Parse blocks from text, return (nodes, remainder)."""
    nodes: list[AstNode] = []
    remaining = text

    while remaining:
        tag_match = _TAG_RE.search(remaining)
        if tag_match:
            before = remaining[:tag_match.start()]
            if before:
                nodes.extend(_parse_variables(before))
            tag_name = tag_match.group(1)
            tag_args = tag_match.group(2).strip()
            remainder_after_tag = remaining[tag_match.end():]

            if tag_name == "if":
                inner_nodes, after_block = _parse_if_block(tag_args, remainder_after_tag)
                nodes.append(inner_nodes)
                remaining = after_block
            elif tag_name == "endif":
                if is_top_level:
                    raise ValueError("unexpected {% endif %} without matching {% if %}")
                return nodes, remaining[tag_match.start():]
            elif tag_name == "else":
                if is_top_level:
                    raise ValueError("unexpected {% else %} without matching {% if %}")
                return nodes, remaining[tag_match.start():]
            else:
                raise ValueError(f"unknown tag: {tag_name}")
        else:
            nodes.extend(_parse_variables(remaining))
            break

    return nodes, ""


def _parse_variables(text: str) -> list[AstNode]:
    """Parse variable references {{var}} in text."""
    if not text:
        return []
    nodes: list[AstNode] = []
    pos = 0
    for m in _VAR_RE.finditer(text):
        if m.start() > pos:
            nodes.append(TextNode(text=text[pos:m.start()]))
        nodes.append(VariableNode(name=m.group(1)))
        pos = m.end()
    if pos < len(text):
        nodes.append(TextNode(text=text[pos:]))
    return nodes


def _parse_if_block(variable_expr: str, body: str) -> tuple[IfNode, str]:
    """Parse an {% if ... %} block. Returns (IfNode, remaining text after endif)."""
    eq_match = re.match(r'(\w+)\s*==\s*"([^"]*)"', variable_expr)
    if eq_match:
        var_name = eq_match.group(1)
        expected = eq_match.group(2)
    else:
        var_name = variable_expr.strip()
        expected = None

    then_nodes, after_then = _parse_blocks(body)

    tm = _TAG_RE.search(after_then)
    tag_name = ""
    if tm is not None and tm.start() == 0:
        tag_name = tm.group(1)

    else_nodes = None
    if tag_name == "else":
        assert tm is not None
        after_else = after_then[tm.end():]
        else_nodes, after_block = _parse_blocks(after_else)
        em = _TAG_RE.search(after_block)
        if em is not None and em.group(1) == "endif" and em.start() == 0:
            remaining = after_block[em.end():]
        else:
            raise ValueError("unclosed if block: missing {% endif %}")
    elif tag_name == "endif":
        assert tm is not None
        remaining = after_then[tm.end():]
    else:
        raise ValueError("unclosed if block: missing {% endif %}")

    return IfNode(variable=var_name, expected_value=expected,
                  then_branch=then_nodes, else_branch=else_nodes), remaining


def extract_variable_names(template: str) -> set[str]:
    """Extract all variable names from a template string."""
    names: set[str] = set()
    nodes = parse_template(template)
    stack = list(nodes)
    while stack:
        node = stack.pop()
        if isinstance(node, VariableNode):
            names.add(node.name)
        elif isinstance(node, IfNode):
            names.add(node.variable)
            if node.then_branch:
                stack.extend(node.then_branch)
            if node.else_branch:
                stack.extend(node.else_branch)
    return names
