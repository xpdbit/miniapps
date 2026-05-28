# -*- coding: utf-8 -*-
"""Integration smoke test for the full core pipeline."""
import tempfile
from pathlib import Path

from prompt_tool.core.models import TemplateSchema
from prompt_tool.core.template_loader import load_template, save_template, load_all_templates
from prompt_tool.core.template_engine import parse_template, extract_variable_names
from prompt_tool.core.renderer import render


def test_full_pipeline_roundtrip() -> None:
    """YAML → save → load → parse → render → text."""
    with tempfile.TemporaryDirectory() as tmpdir:
        prompts = Path(tmpdir) / ".prompts"
        prompts.mkdir()

        # Create a template with all features
        schema = TemplateSchema(
            name="Full Test",
            description="Integration test with all features",
            tags=["test", "integration"],
            category="testing",
            variables=[
                {"name": "lang", "label": "Language", "type": "text",
                 "required": True, "default": "Python"},
                {"name": "level", "label": "Level", "type": "select",
                 "options": ["beginner", "expert"], "default": "expert"},
                {"name": "examples", "label": "Include examples",
                 "type": "boolean", "default": True},
            ],
            template=(
                "Write {{lang}} code for {{level}}.\n"
                "{% if examples %}Include examples.{% endif %}\n"
                "{% if level == \"expert\" %}Assume deep knowledge.{% endif %}"
            ),
        )

        # Save
        save_template(str(prompts / "full.yaml"), schema)

        # Load all
        all_templates = load_all_templates(str(prompts))
        assert len(all_templates) == 1

        # Load single
        loaded = load_template(str(prompts / "full.yaml"))
        assert loaded.name == "Full Test"
        assert len(loaded.variables) == 3

        # Parse
        nodes = parse_template(loaded.template)
        names = extract_variable_names(loaded.template)
        assert "lang" in names
        assert "level" in names
        assert "examples" in names

        # Render
        result = render(nodes, {"lang": "Rust", "level": "expert", "examples": True})
        assert "Rust" in result
        assert "Include examples" in result
        assert "Assume deep knowledge" in result

        # Render without examples
        result2 = render(nodes, {"lang": "Go", "level": "beginner", "examples": False})
        assert "Go" in result2
        assert "Include examples" not in result2
        assert "Assume deep knowledge" not in result2
