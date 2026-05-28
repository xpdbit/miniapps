# -*- coding: utf-8 -*-
"""Load/save prompt template YAML files."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import TypedDict

import yaml
from pydantic import ValidationError

from prompt_tool.core.models import TemplateSchema

logger = logging.getLogger(__name__)


class TemplateLoadError(Exception):
    pass


class TemplateLoadResult(TypedDict):
    filename: str
    path: str
    schema: TemplateSchema


def load_template(path: str) -> TemplateSchema:
    """Load a single template YAML file and return validated TemplateSchema."""
    p = Path(path)
    try:
        raw = yaml.safe_load(p.read_text(encoding="utf-8"))
    except yaml.YAMLError as e:
        raise TemplateLoadError(f"YAML parse error in {path}: {e}") from e
    if not isinstance(raw, dict):
        raise TemplateLoadError(f"Expected dict in {path}, got {type(raw).__name__}")
    try:
        return TemplateSchema(**raw)
    except ValidationError as e:
        raise TemplateLoadError(f"Validation error in {path}: {e}") from e


def load_all_templates(prompts_dir: str) -> list[TemplateLoadResult]:
    """Load all valid .yaml/.yml templates from directory. Returns list of TemplateLoadResult."""
    d = Path(prompts_dir)
    if not d.is_dir():
        return []
    results: list[TemplateLoadResult] = []
    for f in sorted(d.iterdir()):
        if f.suffix not in (".yaml", ".yml"):
            continue
        try:
            schema = load_template(str(f))
            results.append({"filename": f.name, "path": str(f), "schema": schema})
        except TemplateLoadError as e:
            logger.warning("Skipping %s: %s", f.name, e)
    return results


def template_path_for(prompts_dir: str, name: str) -> str:
    """Get the file path for a template name (adds .yaml extension)."""
    return str(Path(prompts_dir) / f"{name}.yaml")
