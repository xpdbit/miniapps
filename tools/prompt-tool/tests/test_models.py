# -*- coding: utf-8 -*-
"""Tests for core data models."""
import pytest
from pydantic import ValidationError
from prompt_tool.core.models import VariableDef, TemplateSchema


class TestVariableDef:
    def test_minimal(self) -> None:
        v = VariableDef(name="lang", label="语言")
        assert v.name == "lang"
        assert v.label == "语言"
        assert v.type == "text"
        assert v.required is False
        assert v.default is None
        assert v.options is None

    def test_invalid_type(self) -> None:
        with pytest.raises(ValidationError):
            VariableDef(name="x", label="X", type="invalid")

    def test_select_without_options(self) -> None:
        with pytest.raises(ValidationError):
            VariableDef(name="x", label="X", type="select")

    def test_select_with_options(self) -> None:
        v = VariableDef(name="x", label="X", type="select", options=["a", "b"])
        assert v.options == ["a", "b"]

    def test_default_bool(self) -> None:
        v = VariableDef(name="flag", label="Flag", type="boolean", default=True)
        assert v.default is True

    def test_default_number(self) -> None:
        v = VariableDef(name="n", label="N", type="number", default=5)
        assert v.default == 5

    def test_required_flag(self) -> None:
        v = VariableDef(name="x", label="X", required=True)
        assert v.required is True


class TestTemplateSchema:
    SAMPLE = {
        "name": "Test",
        "description": "A test template",
        "tags": ["test"],
        "category": "dev",
        "variables": [
            {"name": "lang", "label": "Language", "type": "text"},
            {"name": "focus", "label": "Focus", "type": "select",
             "options": ["a", "b"]},
        ],
        "template": "Hello {{lang}} focus on {{focus}}",
    }

    def test_minimal(self) -> None:
        t = TemplateSchema(name="Minimal", template="Hello")
        assert t.name == "Minimal"
        assert t.template == "Hello"
        assert t.variables == []
        assert t.tags == []
        assert t.category == ""

    def test_full(self) -> None:
        t = TemplateSchema(**self.SAMPLE)
        assert len(t.variables) == 2
        assert t.variables[0].name == "lang"

    def test_missing_name(self) -> None:
        with pytest.raises(ValidationError):
            TemplateSchema(template="Hello")  # type: ignore[call-arg]

    def test_missing_template(self) -> None:
        with pytest.raises(ValidationError):
            TemplateSchema(name="Test")  # type: ignore[call-arg]
