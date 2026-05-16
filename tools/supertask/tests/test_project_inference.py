# -*- coding: utf-8 -*-
"""Test project inference from task descriptions."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import yaml
from gui.core.proposal_merger import (
    _infer_project_from_description,
    _GENERIC_LABELS,
    _build_keyword_mapping_from_projects,
    ProposalMerger,
)


class TestProjectInference:
    """Test that project names are correctly inferred from task descriptions."""

    @classmethod
    def setup_class(cls):
        config_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "..", "state", "config.yaml"
        )
        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f) or {}
        cls.projects = config.get("projects", [])

    def test_keyword_mapping(self):
        mapping = _build_keyword_mapping_from_projects(self.projects)
        assert "FTG \u98df\u7269\u4e3b\u9898\u751f\u6210\u5668" in mapping
        ftg_keywords = mapping["FTG \u98df\u7269\u4e3b\u9898\u751f\u6210\u5668"]
        assert "ftg-miniapp" in ftg_keywords or "ftg-server" in ftg_keywords
        game1_keywords = mapping["Game1 \u6302\u673a\u653e\u7f6e\u6e38\u620f"]
        assert "game1-miniapp" in game1_keywords or "game1-server" in game1_keywords

    def test_infer_tavern_task(self):
        result = _infer_project_from_description(
            "tavern-miniapp: \u4fee\u590d useSSE Hook \u5185\u5b58\u6cc4\u6f0f",
            self.projects,
        )
        assert result == "AI-Tavern \u89d2\u8272\u804a\u5929"

    def test_infer_game1_task(self):
        result = _infer_project_from_description(
            "game1-server: \u6dfb\u52a0 Zod validate \u4e2d\u95f4\u4ef6",
            self.projects,
        )
        assert result == "Game1 \u6302\u673a\u653e\u7f6e\u6e38\u620f"

    def test_infer_ftg_task(self):
        result = _infer_project_from_description(
            "ftg-miniapp: \u6e05\u7406\u7a7a catch \u5757",
            self.projects,
        )
        assert result == "FTG \u98df\u7269\u4e3b\u9898\u751f\u6210\u5668"

    def test_infer_dashboard_task(self):
        result = _infer_project_from_description(
            "dashboard: \u8fc1\u79fb\u5185\u8054\u6837\u5f0f\u4e3a CSS Modules",
            self.projects,
        )
        assert result == "Dashboard"

    def test_infer_supertask_task(self):
        result = _infer_project_from_description(
            "supertask: \u4fee\u590d prompt \u5360\u4f4d\u7b26",
            self.projects,
        )
        assert result == "supertask \u5de5\u5177"

    def test_no_match_returns_empty(self):
        result = _infer_project_from_description(
            "all-servers: \u5168\u5c40 asyncHandler \u5305\u88c5",
            self.projects,
        )
        assert result == ""

    def test_default_keywords_fallback(self):
        # Without projects config, should use defaults
        result = _infer_project_from_description(
            "tavern-miniapp: fix something",
            projects=None,
        )
        assert result == "AI-Tavern \u89d2\u8272\u804a\u5929"

    def test_generic_labels(self):
        assert "\u5168\u90e8\u9879\u76ee" in _GENERIC_LABELS
        assert "\u5168\u90e8" in _GENERIC_LABELS
        assert "" in _GENERIC_LABELS
        # Specific labels are NOT generic
        assert "FTG \u98df\u7269\u4e3b\u9898\u751f\u6210\u5668" not in _GENERIC_LABELS


class TestProposalMergerWithInference:
    """Test that ProposalMerger correctly infers project from description."""

    def test_new_task_with_generic_label_gets_inferred(self, tmp_path):
        state_dir = str(tmp_path)
        import yaml

        tasks = [
            {
                "id": 1,
                "description": "tavern-miniapp: fix SSE memory leak",
                "priority": "fix P3",
                "status": "proposed",
            }
        ]
        proposed_path = os.path.join(state_dir, "proposed_tasks.yaml")
        with open(proposed_path, "w", encoding="utf-8") as f:
            yaml.dump(tasks, f, allow_unicode=True)

        merger = ProposalMerger(state_dir)
        merger.snapshot()
        merged = merger.merge(
            project_label="\u5168\u90e8\u9879\u76ee",
            projects=[
                {
                    "label": "AI-Tavern \u89d2\u8272\u804a\u5929",
                    "name": "tavern",
                    "source_dirs": [
                        "apps/tavern-miniapp/src/",
                        "servers/tavern-server/src/",
                    ],
                }
            ],
        )
        assert len(merged) == 1
        assert merged[0].get("project") == "AI-Tavern \u89d2\u8272\u804a\u5929"

    def test_new_task_with_specific_label_keeps_it(self, tmp_path):
        state_dir = str(tmp_path)
        import yaml

        tasks = [
            {
                "id": 1,
                "description": "fix something",
                "priority": "fix P3",
                "status": "proposed",
            }
        ]
        proposed_path = os.path.join(state_dir, "proposed_tasks.yaml")
        with open(proposed_path, "w", encoding="utf-8") as f:
            yaml.dump(tasks, f, allow_unicode=True)

        merger = ProposalMerger(state_dir)
        merger.snapshot()
        merged = merger.merge(project_label="FTG \u98df\u7269\u4e3b\u9898\u751f\u6210\u5668")
        assert len(merged) == 1
        assert merged[0].get("project") == "FTG \u98df\u7269\u4e3b\u9898\u751f\u6210\u5668"
