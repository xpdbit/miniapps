# -*- coding: utf-8 -*-
"""Pydantic models for prompt template schema."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


VariableType = Literal["text", "textarea", "select", "boolean", "number"]


class VariableDef(BaseModel):
    name: str
    label: str
    type: VariableType = "text"
    required: bool = False
    default: Any = None
    options: list[str] | None = None

    @model_validator(mode="after")
    def validate_select_options(self) -> "VariableDef":
        if self.type == "select" and not self.options:
            raise ValueError("select type requires options list")
        return self


class TemplateSchema(BaseModel):
    name: str
    description: str = ""
    tags: list[str] = Field(default_factory=list)
    category: str = ""
    variables: list[VariableDef] = Field(default_factory=list)
    template: str
