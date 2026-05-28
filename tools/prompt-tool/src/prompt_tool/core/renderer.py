# -*- coding: utf-8 -*-
"""Render prompt template AST nodes into final text."""
from __future__ import annotations

from typing import Any

from prompt_tool.core.template_engine import AstNode, TextNode, VariableNode, IfNode


class RenderError(Exception):
    pass


def render(nodes: list[AstNode], values: dict[str, Any]) -> str:
    """Render a list of AST nodes with the given variable values."""
    parts: list[str] = []
    for node in nodes:
        if isinstance(node, TextNode):
            parts.append(node.text)
        elif isinstance(node, VariableNode):
            val = values.get(node.name, "")
            parts.append(str(val) if val is not None else "")
        elif isinstance(node, IfNode):
            val = values.get(node.variable)
            if node.expected_value is not None:
                condition = str(val) == node.expected_value
            else:
                condition = bool(val)
            if condition:
                parts.append(render(node.then_branch, values))
            elif node.else_branch is not None:
                parts.append(render(node.else_branch, values))
    return "".join(parts)
