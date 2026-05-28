# -*- coding: utf-8 -*-
"""pytest shared fixtures."""
import tempfile
from pathlib import Path
from typing import Generator

import pytest


@pytest.fixture
def prompts_dir() -> Generator[Path, None, None]:
    """Create a temporary .prompts/ directory with sample templates."""
    with tempfile.TemporaryDirectory() as tmpdir:
        d = Path(tmpdir) / ".prompts"
        d.mkdir()
        # Valid template
        (d / "review.yaml").write_text(
            "name: Code Review\n"
            "description: Review code\n"
            "template: 'Review {{lang}} code'\n"
            "variables:\n"
            "  - name: lang\n"
            "    label: Language\n"
            "    type: text\n"
        )
        # Invalid YAML
        (d / "broken.yaml").write_text("name: Broken\ninvalid_yaml: [\n")
        yield d


@pytest.fixture
def empty_prompts_dir() -> Generator[Path, None, None]:
    """Create an empty .prompts/ directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        d = Path(tmpdir) / ".prompts"
        d.mkdir()
        yield d
