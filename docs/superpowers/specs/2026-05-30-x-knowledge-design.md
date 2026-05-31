# /x-knowledge 命令设计

> 状态: draft | 更新: 2026-05-30

## 概述

`/x-knowledge` 是一个 OpenCode 快捷命令，用于在规划或实现前快速检索 `knowledge/` 知识库中的相关内容并加载到上下文，帮助 agent 基于项目既有约定和最佳实践做出更准确的决策。

## 动机

项目 `AGENTS.md` 已经声明"优先采用知识库中的信息"，但实际使用中 agent 不会主动去读 `knowledge/`。需要一个显式触发机制，让用户在需要时一键加载相关知识。

## 需求

1. **手动触发**: 用户主动输入 `/x-knowledge <查询>` 来获取知识
2. **自动匹配**: 根据查询内容在 `knowledge/` 中搜索相关文件
3. **信息提取**: 只提取与查询直接相关的内容，不全文转储
4. **上下文友好**: 通过子 agent 完成搜索和提取，主 agent 仅接收摘要
5. **可扩展**: 知识库增长后架构不需要大改

## 设计方案

### 文件结构

```
~/.agents/skills/x-knowledge/
└── SKILL.md          # 命令注册 + 流程定义（单文件）
```

### Frontmatter

```yaml
---
name: x-knowledge
description: 在规划或实现前，快速检索 knowledge/ 知识库中与任务相关的内容并加载到上下文。输入 '/x-knowledge <查询>' 即可触发。
compatibility: opencode
---
```

### 使用方式

```
/x-knowledge <查询>
```

- 查询参数跟在命令名后
- 无参数时展示 `knowledge/INDEX.md` 并提示补充

### 执行流程（四步）

```
Step 1 — 主 agent 解析命令
  ├─ 提取查询文本
  └─ 空查询 → 展示 INDEX.md + 提示

Step 2 — explore agent（后台）搜索相关文件
  ├─ task(subagent_type="explore", run_in_background=true)
  ├─ 在 knowledge/ 中搜索与查询相关的文件
  └─ 返回：文件路径 + 相关性说明

Step 3 — deep agent（串行）精读并提取信息
  ├─ task(category="deep")
  ├─ 读取 Step 2 返回的文件
  ├─ 只提取与用户问题直接相关的内容
  └─ 输出结构化摘要（知识点 + 来源文件）

Step 4 — 主 agent 合成回答
  ├─ 告知「已加载 X 条相关知识」
  └─ 用知识直接回答用户问题
```

### 搜索策略

| 层级 | 方式 | 说明 |
|------|------|------|
| 文件发现 | grep 全文匹配 | explore agent 在 knowledge/ 中搜索查询关键词 |
| 排序 | 文件名 > 内容匹配 | 文件名匹配优先，其次内容匹配度 |
| 上限 | 3-5 个文件 | 防止上下文膨胀 |
| 回退 | 展示 INDEX.md | 无匹配时让用户手动选择领域 |

### 边界情况

| 场景 | 行为 |
|------|------|
| 无查询参数 | 展示 knowledge/INDEX.md，提示补充查询 |
| 无匹配结果 | 告知用户并展示知识库结构 |
| knowledge/ 不存在 | 报错提示知识库为空 |
| 查询太宽泛 | explore 命中大量文件，deep agent 按优先级截取 |
| 文件内容过大 | deep agent 只提取相关段落，不转储全文 |
| 知识库目录多级 | explore agent 递归搜索 |

### 限制

- 只搜索 `knowledge/` 目录，不搜索 `docs/`、`plan/` 等其他文档
- 知识质量取决于维护
- 过时的内容可能导致不准确回答

## 与现有体系的关系

- 与 `/mp-automator`、`/find-skills` 等命令同级（同目录 `~/.agents/skills/`）
- 与 superpowers 流程独立，不自动触发
- 补充 AGENTS.md 中"优先采用知识库"的声明

## 未来扩展

- **知识库增长后**: explore → deep 两步法天然支持更大规模
- **多级索引**: knowledge/INDEX.md 能力增强后，搜索流程可直接利用
- **自动触发**: 可考虑集成到 superpowers brainstorming/writing-plans 流程中
