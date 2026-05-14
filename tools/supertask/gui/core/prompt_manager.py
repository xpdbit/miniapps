# -*- coding: utf-8 -*-
"""
prompt_manager.py — 提示词模板管理器
从 state/prompts/ 目录加载 YAML 模板，支持变量替换。
彻底替代 loop_manager.py 中的硬编码 prompt 字符串。
"""

import os
import re
from string import Template
from typing import Optional

import yaml

# 匹配 {identifier} 风格的占位符（支持中英文等任意非花括号字符，不匹配 {{ 双花括号）
_CURLY_PLACEHOLDER_RE = re.compile(r'(?<!\{)\{([^{}]+)\}(?!\})')


class PromptTemplate:
    """单个提示词模板 — 封装模板文本和元数据"""

    def __init__(self, name: str, template: str, version: str = "1.0"):
        self.name = name
        self.template = template
        self.version = version

    def render(self, **kwargs) -> str:
        """使用混合占位符引擎替换变量。

        支持两种占位符格式（可混用）:
          1. string.Template 风格: ${variable_name} 或 $variable_name
          2. str.format 风格: {variable_name}（支持中文等 Unicode 字符）

        替换顺序: 先 ${var}，后 {var}，确保两种格式都能正确展开。
        未匹配的占位符保留原样（安全模式，便于调试）。

        用法:
            tmpl = PromptTemplate("explore", "探索 ${project_label} 项目")
            result = tmpl.render(project_label="FTG")

            tmpl = PromptTemplate("execute", "任务：{desc}")
            result = tmpl.render(desc="修复空catch块")
        """
        text = self.template

        # 第 1 步: string.Template 替换 (${var} 风格)
        # safe_substitute 在缺少变量时不抛异常，保留原占位符
        t = Template(text)
        text = t.safe_substitute(**kwargs)

        # 第 2 步: {var} 风格替换
        # 只替换 kwargs 中存在的键，缺失的保留原样
        def _replace_curly(match: re.Match) -> str:
            key = match.group(1)
            if key in kwargs:
                # 将值转为字符串（兼容非字符串类型的变量）
                return str(kwargs[key])
            # 未知变量保留原样
            return match.group(0)

        return _CURLY_PLACEHOLDER_RE.sub(_replace_curly, text)


class PromptManager:
    """提示词管理器 — 从文件系统加载、缓存、渲染提示词模板"""

    # 默认模板集（当模板文件不存在时使用）
    DEFAULT_TEMPLATES = {
        "explore": PromptTemplate(
            name="探索与提议",
            version="1.0",
             template="""/ulw-loop
请探索 【项目】${project_label}（源码目录: ${source_dirs}，忽略 ${exclude_dirs} 和 .git），
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
| fix P0 | 最高修复优先级 | 安全漏洞、数据丢失、线上崩溃 |
| fix P1 | 高修复优先级 | 功能缺陷、用户体验严重受损 |
| fix P2 | 中修复优先级 | 类型错误、轻微功能问题 |
| fix P3 | 低修复优先级 | 代码风格、轻微优化、注释缺失 |
| idea | 点子/建议 | 新功能提议、改进想法、无紧急度 |

## 输出要求
将任务列表以 YAML 格式写入 state/proposed_tasks.yaml，格式如下：
```yaml
- id: 1
  description: 任务描述（适中粒度，3-8 个 tool call 可完成）
  priority: fix P3
  status: proposed
  project: ${project_label}
```

注意：
- project 字段：必须根据任务涉及的文件路径/模块名推断实际归属项目。
  可用项目列表: ${project_list}
  **推断优先级**:
  1. 优先从上述项目列表中匹配（如描述含 "tavern-miniapp" → AI-Tavern 角色聊天）
  2. 如果无法从列表匹配，读取 AGENTS.md 或 docs/ 目录确认项目归属
  3. 仍然无法确定时，使用 "${project_label}" 作为兜底值
  严禁：探索全部项目时将所有任务都标记为 "全部项目" — 每条任务必须归属到具体项目。
- 不要添加 proposed_at 时间字段（时间由系统脚本自动添加）
- 仅写入新发现的任务，系统会自动合并已有任务

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
不要修改或添加 proposed_at 字段（时间由系统脚本自动管理）。

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
- priority: "fix P1"

修补任务直接写入 state/approved_queue.yaml，直接进入工作队列。

## 输出要求
完成后输出简短总结：检查数量 / 问题数量 / 修补任务数量

## 严禁事项
- 不要输出纯文本等待消息
- 每一条文本输出之后，必须立即跟随至少一个 tool call

然后输出 ===TASK_DONE==="""
        ),
        "check_fix": PromptTemplate(
            name="检查并修复",
            version="1.0",
            template="""/ulw-loop
你是一个代码质量专家。请对 ${project_label} 项目进行全面检查和自动修复：

源目录: ${source_dirs}
排除: ${exclude_dirs}

## 检查项目
1. TypeScript 类型检查 — 对每个目录运行 npm run type-check，修复所有错误
2. ESLint 检查 — 对每个目录运行 npm run lint，修复所有错误
3. 空 catch 块 — 搜索并修复所有空的 catch(e) {} 块
4. 硬编码密钥 — 搜索 .env、密码、API Key 等敏感信息
5. console.log 残留 — 将调试用的 console.log 替换为日志框架
6. as any 类型断言 — 搜索并修复所有 as any 类型断言
7. 未使用的 import — 清理未使用的 import 语句
8. Prettier 格式化 — 确保代码格式一致

## 输出要求
完成后输出简短总结：检查了多少文件 / 修复了多少问题 / 有哪些无法自动修复需要人工处理

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
        "update_task": PromptTemplate(
            name="更新任务",
            version="1.0",
            template="""/ulw-loop
你是一个项目审计专家。请重新检查当前项目状态，更新所有任务项。

## 项目当前状态

${content}

## 要求
请逐一检查每项任务，根据项目当前实际情况进行更新：
- **任务描述** — 是否准确反映了当前需要做的工作？
- **预期成果** — 是否明确可验证？补充具体的成果定义。
- **约束条件** — 是否存在技术限制、依赖关系或前置条件？
- **优先级** — 是否合理？根据当前项目情况调整。
- **状态** — 已完成的任务标记 done，不再有效的标记 cancelled，需要调整描述的更新 description。

同时根据当前代码库状态：
- 补充遗漏的任务项（粗粒度：涉及多个文件或一项完整功能）
- 合并重复的任务
- 删除不再需要的任务

将更新后的完整列表写回 state/proposed_tasks.yaml（保持 YAML 格式）。
注意：仅更新 YAML 文件，不要执行任务，不要修改其他代码文件。
不要修改或添加 proposed_at 字段（时间由系统脚本自动管理）。

## 严禁事项
- 不要输出纯文本等待消息
- 每一条文本输出之后，必须立即跟随至少一个 tool call

完成后请输出 ===TASK_DONE==="""
        ),
        "execute_batch": PromptTemplate(
            name="批量执行任务",
            version="1.0",
            template="""/ulw-loop
请按顺序执行以下 **同一项目** 的多个开发任务：

${task_list}

## 时间管理（本次超时限制约 20 分钟）
1. 按任务顺序依次执行，每完成一个立即更新 YAML
2. 每 5 分钟检查剩余时间 — 如果只剩 3 分钟，立即收尾并标记未完成任务
3. 不要把时间花在过度探索上：读取 3-5 个关键文件足够理解上下文即可

## 执行步骤
1. 快速浏览所有任务，理解整体目标（Read 关键文件，不超过 1 分钟）
2. 按顺序执行每个任务，每完成一个：
   - 修改 state/approved_queue.yaml 中对应项的 status 为 done
   - 继续下一个任务
3. 若某个任务无法自动完成，将其 status 改为 error，在 error 字段中附加原因
4. 若需追加新任务，写入 proposed_tasks.yaml（status: proposed，待人工审批）
5. 忽略 plan 文件夹

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
        "evaluate": PromptTemplate(
            name="二次评估提议",
            version="1.0",
            template="""/ulw-loop
你是一个高级代码审查专家。请对以下 AI 生成的待审批任务提议进行二次评估。

${content}

## 评估标准

对每条提议逐一评估：

### 1. 真实性验证
- 提议描述的问题是否在代码库中真实存在？
- 引用的文件路径和行号是否准确？
- 如果无法确认（如文件不存在、代码已变更），标注为"待验证"

### 2. 优先级重评
- 原优先级是否合理？请根据实际影响重新判断
- fix P0: 安全漏洞、数据丢失、线上崩溃
- fix P1: 功能缺陷、用户体验严重受损
- fix P2: 类型错误、轻微功能问题
- fix P3: 代码风格、轻微优化、注释缺失
- idea: 新功能提议

### 3. 同类合并
- 如果多条提议本质上是同一类问题（如"空 catch 块补日志"），合并为一条
- 合并后的提议描述应汇总所有涉及的文件

### 4. 修复难度预估
- 为每条保留的提议添加 estimated_effort 字段: quick(<5min) / normal(5-20min) / heavy(>20min)

## 输出要求
将评估结果写回 state/proposed_tasks.yaml：
- 移除确认为假阳性的提议
- 合并同类项（保留最高优先级的原始 ID，删除被合并项）
- 调整优先级（在原 priority 字段更新）
- 添加 verified: true/false/unknown 字段
- 添加 estimated_effort: quick/normal/heavy 字段
- 对无法验证的提议保留原样并标注 verified: unknown

注意：仅更新 YAML 文件，不要执行任何任务，不要修改代码文件。
保留原始 proposed_at 时间戳字段不变。

## 严禁事项
- 不要输出纯文本等待消息
- 每一条文本输出之后，必须立即跟随至少一个 tool call

完成后请输出 ===TASK_DONE==="""
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

    def set_inline(self, name: str, template: str, version: str = "1.0"):
        """从内存设置内联模板（覆盖文件系统模板和默认值）。

        用于 apply_config() 加载 config.yaml 中内联定义的 prompts.* 模板。

        Args:
            name: 模板名称（如 'execute', 'explore'）
            template: 模板文本
            version: 版本号
        """
        self._cache[name] = PromptTemplate(
            name=name, template=template, version=version,
        )

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
