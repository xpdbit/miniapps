# /x-knowledge 实现计划

> **For agentic workers:** 单文件创建，直接执行即可。

**Goal:** 创建 `/x-knowledge` 快捷命令的 SKILL.md，支持按查询搜索 `knowledge/` 并加载相关内容。

**Architecture:** 单 SKILL.md 文件，通过 frontmatter 注册为 OpenCode 命令，instructions 定义主 agent 编排 explore → deep 子 agent 的流程。

**Tech Stack:** OpenCode Skill (SKILL.md)

---

### Task 1: 创建 SKILL.md

**Files:**
- Create: `C:\Users\xpdoh\.agents\skills\x-knowledge\SKILL.md`

- [ ] **Step 1: 创建 SKILL.md**

写入 frontmatter + 完整 instructions，涵盖：
- 命令注册 (`/x-knowledge`)
- 使用方式说明
- 四步执行流程（解析 → explore 搜索 → deep 提取 → 合成回答）
- 边界情况处理

- [ ] **Step 2: 验证文件存在**

运行：`Test-Path -LiteralPath "C:\Users\xpdoh\.agents\skills\x-knowledge\SKILL.md"`
期望：True

- [ ] **Step 3: 验证 frontmatter 正确**

确认 name 字段为 `x-knowledge`，compatibility 为 `opencode`。
