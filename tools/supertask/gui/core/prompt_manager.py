# -*- coding: utf-8 -*-
"""
prompt_manager.py — 提示词模板管理器
从 state/prompts/ 目录加载 YAML 模板，支持变量替换。
彻底替代 loop_manager.py 中的硬编码 prompt 字符串。
"""

import os
from string import Template
from typing import Optional

import yaml


class PromptTemplate:
    """单个提示词模板 — 封装模板文本和元数据"""

    def __init__(self, name: str, template: str, version: str = "1.0"):
        self.name = name
        self.template = template
        self.version = version

    def render(self, **kwargs) -> str:
        """使用 Python string.Template 替换占位符。
        支持的占位符格式: ${variable_name}

        用法:
            tmpl = PromptTemplate("explore", "探索 ${project_label} 项目")
            result = tmpl.render(project_label="FTG")
        """
        t = Template(self.template)
        # safe_substitute 在缺少变量时不抛异常，保留原占位符（便于调试）
        return t.safe_substitute(**kwargs)


class PromptManager:
    """提示词管理器 — 从文件系统加载、缓存、渲染提示词模板"""

    # 默认模板集（当模板文件不存在时使用）
    DEFAULT_TEMPLATES = {
        "explore": PromptTemplate(
            name="探索与提议",
            version="1.0",
            template="""/ulw-loop
请探索 ${project_label}（源码目录: ${source_dirs}，忽略 ${exclude_dirs} 和 .git），
发现需要改进的领域，生成 **粗粒度** 的任务提议。

重点关注：
- 需要修复一批相关文件的问题（如：某个模块的类型错误、API 路由缺少校验）
- 可以增加的一项独立功能（如：添加数据导出功能、新增筛选条件）
- 需要重构的模块（如：将某个组件拆分为更小的子组件）

## 任务粒度指南（基于 AI Agent 工程最佳实践）
- 每项任务应可由一个 agent 会话在 20 分钟内完成（3-8 个 tool call）
- 采用垂直切片：按功能路径而非技术层次分解
- 如果任务描述超过 150 字，很可能过大，应考虑拆分
- 不要将多个独立项目的工作合并为一个任务

## 优先级分配规则
| 优先级 | 含义 | 适用场景 |
|--------|------|----------|
| fix P3 | 最高修复优先级 | 安全漏洞、数据丢失、线上崩溃 |
| fix P2 | 中等修复优先级 | 功能缺陷、用户体验受损、类型错误 |
| fix P1 | 低修复优先级 | 代码风格、轻微优化、注释缺失 |
| idea | 点子/建议 | 新功能提议、改进想法、无紧急度 |

## 输出要求
将任务列表以 YAML 格式写入 state/proposed_tasks.yaml，格式如下：
\`\`\`yaml
- id: 1
  description: 任务描述（适中粒度，3-8 个 tool call 可完成）
  priority: fix P2
  status: proposed
\`\`\`

注意：仅写入 YAML 文件，不要执行任何任务，不要修改其他文件。

## 严禁事项
- 不要输出纯文本等待消息
- 每一条文本输出之后，必须立即跟随至少一个 tool call

完成后请输出 ===TASK_DONE==="""
        ),
        "execute": PromptTemplate(
            name="执行任务",
            version="1.0",
            template="""/ulw-loop
请执行以下开发任务：

任务描述：${desc}

## 时间管理（本次超时限制约 20 分钟）
1. 如果任务很大，优先完成核心部分，非关键细节可延后
2. 每 5 分钟检查剩余时间 — 如果只剩 3 分钟，立即收尾并标记部分完成
3. 不要把时间花在过度探索上：读取 3-5 个关键文件足够理解上下文即可

## 执行步骤
1. 快速理解任务要求（Read/Grep 关键文件，不超过 30 秒）
2. 制定简要执行计划（不超过 3 步），立即开始实施
3. 执行修改，完成后验证
4. 修改 state/approved_queue.yaml 中对应项的 status 为 done
5. 若遇到无法自动完成的错误，将 status 改为 error，并在 error 字段中附加原因
6. 若需追加新任务，写入 proposed_tasks.yaml（status: proposed，待人工审批）
7. 忽略 plan 文件夹

## 后台子任务追踪标记
当你使用 task() 启动后台子任务时，请在同一行或下一行输出以下结构化标记，
以便 SuperTask 系统追踪子任务状态：

子任务启动时: [SUPERTASK:agent_start id=<task_id> type=<agent_type> preview="<简短描述>"]
子任务完成时: [SUPERTASK:agent_done id=<task_id>]
子任务失败时: [SUPERTASK:agent_error id=<task_id>]

示例:
  task(subagent_type="explore", ...)  # [SUPERTASK:agent_start id=abc123 type=explore preview="搜索认证模式"]

注意：id 使用 opencode 返回的实际 task_id。

## 后台子任务等待策略
如果你派出了后台子任务，必须用 background_output 轮询，而不是输出等待文本：
- 正确：直接调用 background_output(task_id="xxx") 检查结果
- 如果结果尚未就绪，立即做其他有用的 tool call（Read/Glob/Grep）
- 错误：输出 "waiting..."、"正在等待..." 等纯文本

## 严禁事项
- 不要输出纯文本等待消息
- 每一条文本输出之后，必须立即跟随至少一个 tool call

完成后请输出 ===TASK_DONE==="""
        ),
        "update_proposed": PromptTemplate(
            name="更新待审批列表",
            version="1.0",
            template="""/ulw-loop
以下是当前待审批任务列表：

${content}

请根据项目最新状态逐一检查每项：
- 已完成的任务标记 status: done
- 不再有效的任务标记 status: cancelled
- 需要调整描述的更新 description
- 可补充新任务（粗粒度：至少涉及多个文件或一项完整功能）

将更新后的完整列表写回 state/proposed_tasks.yaml（保持 YAML 格式）。
注意：仅更新 YAML 文件，不要执行任务。

## 严禁事项
- 不要输出纯文本等待消息
- 每一条文本输出之后，必须立即跟随至少一个 tool call

完成后请输出 ===TASK_DONE==="""
        ),
        "verify_deliverables": PromptTemplate(
            name="检查任务成果",
            version="1.0",
            template="""/ulw-loop
你是一个代码审查专家。请检查以下已完成任务的成果实现情况：

${tasks}

## 检查步骤
对每项已完成的任务：
1. 阅读任务的 description 字段，准确理解任务的原始要求
2. 在代码库中搜索任务描述涉及的模块、文件、功能或修复
3. 仔细验证该功能/修复是否已实际存在于代码库中
4. 判断实现是否完整、有无遗漏、是否存在缺陷或漏洞

## 判定标准
- 已验证通过: 任务描述的功能已完整、正确地实现在代码库中
- 需要修补: 实现不完整、有严重遗漏、存在缺陷或安全漏洞

## 修补任务要求
对于标记为"需要修补"的任务，请在 state/approved_queue.yaml 中新增修补任务项：
- description 格式: "【修补】{原任务描述摘要} — {发现的具体问题}"
- status: "pending"
- priority: "high"

修补任务直接写入 state/approved_queue.yaml，直接进入工作队列。

## 输出要求
完成后输出简短总结：检查数量 / 问题数量 / 修补任务数量

## 严禁事项
- 不要输出纯文本等待消息
- 每一条文本输出之后，必须立即跟随至少一个 tool call

然后输出 ===TASK_DONE==="""
        ),
        "finish": PromptTemplate(
            name="收尾-文档更新",
            version="1.0",
            template="""请更新项目文档：
- 更新根目录 AGENTS.md（反映最新的项目结构和代码变更）
- 更新 docs/ 中相关文件
- 忽略 plan 文件夹""",
        ),
        "resume": PromptTemplate(
            name="任务恢复",
            version="1.0",
            template="""${resume_context}
---
${original_prompt}

注意: 上述「已完成步骤」已由上次执行完成，请直接从下一个未完成步骤开始。""",
        ),
    }

    def __init__(self, prompts_dir: str):
        self.prompts_dir = prompts_dir
        self._cache: dict[str, PromptTemplate] = {}
        os.makedirs(prompts_dir, exist_ok=True)

    def get(self, name: str) -> PromptTemplate:
        """获取指定名称的提示词模板。
        优先级：文件系统 > 内置默认值

        Args:
            name: 模板名称（如 'explore', 'execute'）

        Returns:
            PromptTemplate 实例
        """
        if name not in self._cache:
            self._cache[name] = self._load(name)
        return self._cache[name]

    def render(self, name: str, **kwargs) -> str:
        """便捷方法：获取模板并渲染

        Args:
            name: 模板名称
            **kwargs: 模板变量

        Returns:
            渲染后的字符串
        """
        tmpl = self.get(name)
        return tmpl.render(**kwargs)

    def _load(self, name: str) -> PromptTemplate:
        """从文件系统加载模板，文件不存在时使用内置默认值"""
        file_path = os.path.join(self.prompts_dir, f"{name}.yaml")
        if os.path.isfile(file_path):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f) or {}
                if isinstance(data, dict) and "template" in data:
                    return PromptTemplate(
                        name=data.get("name", name),
                        template=data["template"],
                        version=str(data.get("version", "1.0")),
                    )
            except (yaml.YAMLError, OSError):
                pass  # 文件损坏，回退到默认值

        # 回退到内置默认值
        if name in self.DEFAULT_TEMPLATES:
            return self.DEFAULT_TEMPLATES[name]

        # 完全未知的模板名，返回空模板
        return PromptTemplate(name=name, template="")

    def reload(self, name: Optional[str] = None):
        """清除缓存，强制重新从文件系统加载。

        Args:
            name: 指定清除的模板名，None 表示清除全部缓存
        """
        if name:
            self._cache.pop(name, None)
        else:
            self._cache.clear()

    def list_templates(self) -> list[str]:
        """列出所有可用的模板名称（内置默认值 + 文件系统中的）"""
        names = set(self.DEFAULT_TEMPLATES.keys())
        if os.path.isdir(self.prompts_dir):
            for fname in os.listdir(self.prompts_dir):
                if fname.endswith(".yaml"):
                    names.add(fname[:-5])  # 去掉 .yaml 后缀
        return sorted(names)

    def save_defaults(self, overwrite: bool = False):
        """将所有内置默认模板写入文件系统，方便用户编辑。

        Args:
            overwrite: 是否覆盖已存在的文件
        """
        os.makedirs(self.prompts_dir, exist_ok=True)
        for name, tmpl in self.DEFAULT_TEMPLATES.items():
            file_path = os.path.join(self.prompts_dir, f"{name}.yaml")
            if os.path.isfile(file_path) and not overwrite:
                continue
            data = {
                "name": tmpl.name,
                "version": tmpl.version,
                "template": tmpl.template,
            }
            with open(file_path, "w", encoding="utf-8") as f:
                f.write("# SuperTask Prompt Template\n")
                f.write(f"# 名称: {tmpl.name}\n")
                f.write(f"# 版本: {tmpl.version}\n")
                f.write("# 支持变量替换: ${variable_name}\n")
                f.write("---\n")
                yaml.dump(
                    data, f, allow_unicode=True,
                    default_flow_style=False, sort_keys=False,
                )
