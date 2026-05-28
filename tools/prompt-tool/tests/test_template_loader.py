# -*- coding: utf-8 -*-
"""Tests for template_loader."""
import pytest
from pathlib import Path
from prompt_tool.core.models import TemplateSchema
from prompt_tool.core.template_loader import (
    load_template,
    load_all_templates,
    template_path_for,
    TemplateLoadError,
)


class TestLoadTemplate:
    def test_load_valid(self, prompts_dir: Path) -> None:
        t = load_template(str(prompts_dir / "review.yaml"))
        assert isinstance(t, TemplateSchema)
        assert t.name == "Code Review"
        assert len(t.variables) == 1

    def test_load_invalid_yaml(self, prompts_dir: Path) -> None:
        path = str(prompts_dir / "broken.yaml")
        with pytest.raises(TemplateLoadError, match="YAML"):
            load_template(path)

    def test_load_invalid_schema(self, prompts_dir: Path) -> None:
        path = str(prompts_dir / "review.yaml")
        prompts_dir.joinpath("bad.yaml").write_text("name: 12345\ntemplate: hi")
        with pytest.raises(TemplateLoadError, match="validation"):
            load_template(str(prompts_dir / "bad.yaml"))


class TestLoadAllTemplates:
    def test_loads_yaml_only(self, prompts_dir: Path) -> None:
        templates = load_all_templates(str(prompts_dir))
        file_names = [t["filename"] for t in templates]
        assert "review.yaml" in file_names
        assert len(templates) == 1  # broken.yaml skipped due to parse error

    def test_empty_dir(self, empty_prompts_dir: Path) -> None:
        templates = load_all_templates(str(empty_prompts_dir))
        assert templates == []

    def test_directory_not_found(self) -> None:
        templates = load_all_templates("/nonexistent/.prompts")
        assert templates == []


class TestTemplatePathFor:
    def test_basic(self, prompts_dir: Path) -> None:
        path = template_path_for(str(prompts_dir), "review")
        assert path == str(prompts_dir / "review.yaml")

    def test_nonexistent(self, prompts_dir: Path) -> None:
        path = template_path_for(str(prompts_dir), "nonexistent")
        assert path == str(prompts_dir / "nonexistent.yaml")
