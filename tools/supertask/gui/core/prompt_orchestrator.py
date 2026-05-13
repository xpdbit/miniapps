# -*- coding: utf-8 -*-
"""
prompt_orchestrator.py — 动态 Prompt 组装引擎
根据任务类型、可用工具和项目上下文，动态组装 agent prompt。

四组件架构:
  TaskClassifier  → 分析任务描述，判定类型
  ToolScanner     → 扫描可用 MCP servers / skills / 网络搜索能力
  ContextBuilder  → 构建项目上下文摘要
  PromptComposer  → 选择基底模板 + 注入工具配置 + 组合最终 prompt
"""

import os
import json
import re
from dataclasses import dataclass, field
from typing import Optional


# ─── 任务类型枚举 ─────────────────────────────

_TASK_TYPE_KEYWORDS = {
    "explore":  ["探索", "扫描", "检查", "分析", "遍历", "审计", "audit", "scan", "explore"],
    "fix":      ["修复", "fix", "bug", "错误", "exception", "空catch", "静默", "类型错误"],
    "refactor": ["重构", "拆分", "提取", "迁移", "统一", "refactor", "migrate", "extract"],
    "feature":  ["新增", "实现", "添加", "创建", "开发", "implement", "add", "create", "build"],
    "execute":  ["执行", "运行", "部署", "deploy", "run"],
}

_DEFAULT_TYPE = "execute"


@dataclass
class ToolContext:
    """可用工具的能力描述"""
    mcp_servers: list[str] = field(default_factory=list)
    skills: list[str] = field(default_factory=list)
    has_web_search: bool = False


@dataclass
class ProjectContext:
    """项目上下文信息"""
    name: str = ""
    root_dir: str = ""
    description: str = ""
    key_modules: list[str] = field(default_factory=list)


# ─── TaskClassifier ───────────────────────────

class TaskClassifier:
    """基于关键词匹配的任务类型分类器"""

    def classify(self, description: str) -> str:
        """返回任务类型: explore | fix | refactor | feature | execute"""
        desc_lower = description.lower()
        scores: dict[str, int] = {}

        for task_type, keywords in _TASK_TYPE_KEYWORDS.items():
            score = sum(1 for kw in keywords if kw in desc_lower)
            if score > 0:
                scores[task_type] = score

        if not scores:
            return _DEFAULT_TYPE

        return max(scores, key=scores.get)  # type: ignore[arg-type]


# ─── ToolScanner ──────────────────────────────

class ToolScanner:
    """扫描环境中的可用工具和 MCP servers"""

    def __init__(self, project_root: str):
        self.project_root = project_root

    def scan(self) -> ToolContext:
        """扫描并返回可用工具上下文"""
        return ToolContext(
            mcp_servers=self._scan_mcp(),
            skills=self._scan_skills(),
            has_web_search=self._check_web_search(),
        )

    def _scan_mcp(self) -> list[str]:
        """扫描 MCP server 配置"""
        servers: list[str] = []
        # 检查常见 MCP 配置位置
        mcp_configs = [
            os.path.join(self.project_root, ".opencode", "mcp.json"),
            os.path.join(self.project_root, ".mcp.json"),
        ]
        for cfg_path in mcp_configs:
            if os.path.isfile(cfg_path):
                try:
                    with open(cfg_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    if isinstance(data, dict):
                        servers.extend(data.get("mcpServers", {}).keys())
                    elif isinstance(data, list):
                        servers.extend(data)
                except (json.JSONDecodeError, OSError):
                    pass

        # 检查环境变量 MCP_CONFIG_PATH
        env_config = os.environ.get("MCP_CONFIG_PATH", "")
        if env_config and os.path.isfile(env_config):
            servers.append(f"env:{os.path.basename(env_config)}")

        return servers

    def _scan_skills(self) -> list[str]:
        """扫描已安装的 agent 技能"""
        skills: list[str] = []
        # 常见技能目录
        skill_dirs = [
            os.path.join(self.project_root, ".agents", "skills"),
            os.path.join(os.path.expanduser("~"), ".agents", "skills"),
        ]
        for skills_dir in skill_dirs:
            if os.path.isdir(skills_dir):
                for entry in os.listdir(skills_dir):
                    skill_path = os.path.join(skills_dir, entry, "SKILL.md")
                    if os.path.isfile(skill_path):
                        skills.append(entry)

        return skills

    def _check_web_search(self) -> bool:
        """检查是否有 web 搜索能力"""
        # opencode 通过 web_search 工具提供搜索能力，始终假设可用
        return True


# ─── ContextBuilder ───────────────────────────

class ContextBuilder:
    """构建项目上下文摘要"""

    def __init__(self, project_root: str):
        self.project_root = project_root

    def build(self, task: dict, max_chars: int = 1500) -> str:
        """构建任务执行所需的项目上下文"""
        parts: list[str] = []

        # 1. 项目基础信息
        parts.append(f"项目根目录: {self.project_root}")

        # 2. 读取 AGENTS.md 摘要（如果存在）
        agents_md = os.path.join(self.project_root, "AGENTS.md")
        if os.path.isfile(agents_md):
            try:
                with open(agents_md, "r", encoding="utf-8") as f:
                    content = f.read()
                # 提取结构概览（只取前 500 字的关键信息）
                overview = self._extract_overview(content)
                if overview:
                    parts.append(f"\n项目结构概览:\n{overview}")
            except OSError:
                pass

        # 3. 任务相关上下文
        desc = task.get("description", "")
        if desc:
            parts.append(f"\n任务: {desc[:200]}")

        context = "\n".join(parts)
        if len(context) > max_chars:
            context = context[:max_chars] + "\n...(上下文已截断)"
        return context

    @staticmethod
    def _extract_overview(content: str) -> str:
        """从 AGENTS.md 提取结构概览"""
        # 查找 STRUCTURE 部分的代码块
        structure_match = re.search(
            r'##\s*STRUCTURE\s*\n(.*?)(?=\n##|\Z)',
            content, re.DOTALL | re.IGNORECASE,
        )
        if structure_match:
            return structure_match.group(1).strip()[:500]

        # 回退：提取 OVERVIEW 部分
        overview_match = re.search(
            r'##\s*OVERVIEW\s*\n(.*?)(?=\n##|\Z)',
            content, re.DOTALL | re.IGNORECASE,
        )
        if overview_match:
            return overview_match.group(1).strip()[:500]

        # 取前 500 字
        return content[:500]


# ─── PromptComposer ───────────────────────────

class PromptComposer:
    """组装最终 prompt：基底模板 + 工具上下文 + 项目上下文"""

    def compose(self, task_type: str, task: dict,
                tool_context: ToolContext, project_context: str,
                tool_prefs: dict[str, list[str]] | None = None,
                max_tool_chars: int = 800) -> str:
        """组合 prompt"""
        parts: list[str] = []

        # 1. 任务描述
        desc = task.get("description", "")
        parts.append(f"任务: {desc}\n")

        # 2. 工具上下文
        tool_section = self._build_tool_section(task_type, tool_context, tool_prefs)
        if tool_section:
            parts.append(tool_section)

        # 3. 项目上下文
        if project_context:
            parts.append(f"## 项目上下文\n{project_context}\n")

        # 4. 执行指令
        parts.append(self._build_action_directive(task_type))

        prompt = "\n".join(parts)
        if len(prompt) > max_tool_chars + 3000:
            prompt = prompt[:max_tool_chars + 3000] + "\n...(prompt 已截断)"

        return prompt

    def _build_tool_section(self, task_type: str, tool_context: ToolContext,
                            tool_prefs: dict[str, list[str]] | None = None) -> str:
        """构建工具可用性声明"""
        lines: list[str] = []
        lines.append("## 可用工具")

        # MCP servers
        if tool_context.mcp_servers:
            lines.append(f"- MCP Servers: {', '.join(tool_context.mcp_servers)}")

        # Skills
        if tool_context.skills:
            lines.append(f"- 已安装技能: {', '.join(tool_context.skills)}")

        # Web search
        if tool_context.has_web_search:
            lines.append("- Web 搜索: 可用（使用 web_search 工具查找文档和示例）")

        # 推荐技能（基于任务类型）
        if tool_prefs and task_type in tool_prefs:
            recommended = tool_prefs[task_type]
            available = [s for s in recommended
                         if s in tool_context.skills or s in _BUILTIN_SKILLS]
            if available:
                lines.append(f"- 推荐使用: {', '.join(available)}")

        if len(lines) == 1:
            return ""  # 只有标题没有内容

        lines.append("")
        return "\n".join(lines)

    def _build_action_directive(self, task_type: str) -> str:
        """构建基于任务类型的执行指令"""
        directives = {
            "explore": (
                "## 执行指令\n"
                "请使用 explore/librarian agent 全面探索项目，生成改进提议。\n"
                "完成后输出 ===TASK_DONE==="
            ),
            "fix": (
                "## 执行指令\n"
                "请修复问题，遵循最小改动原则。不要重构无关代码。\n"
                "修复后验证 lint 和 type-check。\n"
                "完成后输出 ===TASK_DONE==="
            ),
            "refactor": (
                "## 执行指令\n"
                "请按计划重构，保持向后兼容。每步验证一次。\n"
                "完成后输出 ===TASK_DONE==="
            ),
            "feature": (
                "## 执行指令\n"
                "请按规格实现功能，遵循项目现有模式。\n"
                "完成后输出 ===TASK_DONE==="
            ),
            "execute": (
                "## 执行指令\n"
                "请执行上述任务，遇到问题自行判断解决。\n"
                "完成后输出 ===TASK_DONE==="
            ),
        }
        return directives.get(task_type, directives["execute"])


# ─── 内置技能列表（无需文件系统中的 SKILL.md 即可使用） ──

_BUILTIN_SKILLS = frozenset({
    "systematic-debugging",
    "brainstorming",
    "dispatching-parallel-agents",
    "using-git-worktrees",
    "ui-ux-pro-max",
    "game-numerical-design",
    "verification-before-completion",
})


# ─── PromptOrchestrator（统一入口） ───────────

class PromptOrchestrator:
    """动态 Prompt 组装引擎 — 组合四组件对外提供统一接口"""

    def __init__(self, project_root: str):
        self.classifier = TaskClassifier()
        self.scanner = ToolScanner(project_root)
        self.builder = ContextBuilder(project_root)
        self.composer = PromptComposer()

    def compose(self, task: dict,
                tool_prefs: dict[str, list[str]] | None = None,
                project_context_max_chars: int = 1500,
                tool_context_max_chars: int = 800) -> str:
        """一站式 prompt 组装

        Args:
            task: 任务字典（需含 description 字段）
            tool_prefs: 任务类型 → 推荐工具列表的映射
            project_context_max_chars: 项目上下文最大字符数
            tool_context_max_chars: 工具上下文最大字符数

        Returns:
            组装好的完整 prompt 字符串
        """
        # 1. 分类
        task_type = self.classifier.classify(task.get("description", ""))

        # 2. 扫描
        tool_context = self.scanner.scan()

        # 3. 构建上下文
        project_context = self.builder.build(task, max_chars=project_context_max_chars)

        # 4. 组合
        return self.composer.compose(
            task_type=task_type,
            task=task,
            tool_context=tool_context,
            project_context=project_context,
            tool_prefs=tool_prefs,
            max_tool_chars=tool_context_max_chars,
        )

    def get_task_type(self, task: dict) -> str:
        """便捷方法：获取任务类型"""
        return self.classifier.classify(task.get("description", ""))
