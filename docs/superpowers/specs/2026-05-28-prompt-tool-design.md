# prompt-tool 设计文档

> **状态**: draft → approved
> **更新**: 2026-05-28

## 概述

prompt-tool 是一个**提示词模板引擎桌面管理工具**，用于管理带变量的提示词模板，支持变量替换、简单条件分支、标签分类，渲染后一键复制到剪贴板。

## 技术栈

| 维度 | 选择 |
|------|------|
| 语言 | Python 3.10+ |
| GUI | PyQt6 + PyQt6-Fluent-Widgets |
| 存储格式 | YAML (每模板一个文件) |
| 构建 | setuptools + pyproject.toml |
| 校验 | Pydantic v2 |
| 测试 | pytest |
| 启动 | Windows `.bat` 启动器 |

## 项目骨架

```
tools/prompt-tool/
├── pyproject.toml
├── prompt-tool.bat
├── .gitignore
├── src/
│   └── prompt_tool/
│       ├── __init__.py
│       ├── __main__.py
│       ├── main.py              # argparse CLI 入口
│       ├── core/
│       │   ├── template_loader.py   # 模板文件 I/O (YAML 加载/保存/校验)
│       │   ├── template_engine.py   # 变量解析 + 条件分支解析
│       │   └── renderer.py          # 模板渲染引擎
│       └── gui/
│           ├── main.py              # QApplication 启动 + 主窗口
│           └── ui_pyqt/
│               ├── template_list.py     # 左侧模板列表面板
│               ├── form_panel.py        # 右侧变量表单
│               └── preview_panel.py     # 中间预览面板
├── tests/
│   ├── conftest.py
│   ├── test_template_loader.py
│   ├── test_template_engine.py
│   └── test_renderer.py
└── state/
```

## 模板数据模型 (YAML)

存放位置：项目根目录下的 `.prompts/` 目录，每个 `.yaml` 文件一个模板。

```yaml
name: "Code Review"
description: "Generate code review prompt"
tags: [code, review]
category: "development"

variables:
  - name: language
    label: "编程语言"
    type: text
    required: true
    default: "TypeScript"
  - name: focus
    label: "审查重点"
    type: select
    options: ["安全性", "性能", "可读性", "全面"]
    default: "全面"
  - name: with_examples
    label: "附带示例"
    type: boolean
    default: true

template: |
  请审查以下 {{language}} 代码，重点关注 {{focus}}。

  {% if with_examples %}
  请附修复示例。
  {% endif %}
```

### 变量类型

| 类型 | 表单控件 | 说明 |
|------|---------|------|
| `text` | QLineEdit | 单行文本 |
| `textarea` | QPlainTextEdit | 多行文本 |
| `select` | QComboBox | 下拉选择 |
| `boolean` | QCheckBox | 布尔开关 |
| `number` | QSpinBox | 数字输入 |

### 条件语法

- `{% if var %}` / `{% endif %}` — 变量为真时包含
- `{% if var == "val" %}` / `{% endif %}` — 变量等于指定值
- `{% if var %}` / `{% else %}` / `{% endif %}` — 条件分支
- 不支持嵌套、循环、过滤器

## 核心架构

### 数据流

```
YAML 文件
    ↓
template_loader      → Pydantic 模型校验 → TemplateSchema
    ↓
template_engine      → 解析模板 AST (提取变量节点 + 条件节点)
    ↓
GUI 表单面板         → 根据变量定义动态生成控件
    ↓ (用户填写)
renderer             → 变量替换 + 条件求值 → 纯文本
    ↓
复制到剪贴板 / 预览面板实时显示
```

### core 模块职责

| 模块 | 职责 | 无 GUI 依赖 |
|------|------|------------|
| `template_loader` | 扫描 `.prompts/` 目录，加载 YAML，Pydantic 校验，保存 | ✅ |
| `template_engine` | 解析模板字符串，提取变量引用和条件块，返回 AST | ✅ |
| `renderer` | 接收模板 AST + 用户值字典，渲染纯文本 | ✅ |

## GUI 布局

三栏布局（参考 OCE 的 Fluent-Widgets 风格）：

```
┌─────────────┬──────────────────┬─────────────┐
│  模板列表    │   实时预览面板    │  变量表单    │
│  (搜索+标签) │                  │  (自动生成)  │
│             │  渲染后的 prompt  │             │
│  📁 分类     │  纯文本，实时更新  │  language:  │
│  ├─ 开发     │                  │  [________] │
│  │ ├─ 代码审查│                 │  focus:     │
│  │ ├─ 写测试  │                 │  [▼ 全面 ]  │
│  │ └─ 写文档  │                 │  with_exs:  │
│  └─ 写作     │  [📋 复制到剪贴板] │  [✓]       │
│             │                  │             │
│  [+ 新建]    │                  │             │
└─────────────┴──────────────────┴─────────────┘
```

### 交互流程

1. 启动 → 自动扫描当前目录 `.prompts/` 加载模板列表
2. 左侧选中模板 → 右侧自动生成表单控件
3. 填写表单 → 中间预览面板实时渲染最终 prompt
4. 点击「复制到剪贴板」→ 纯文本复制
5. 「+ 新建」→ 打开模板编辑器（JSON/YAML 编辑）

### 模板编辑器

内置 YAML 编辑器（QPlainTextEdit + 语法高亮），保存时用 Pydantic 校验。

## 测试策略

| 测试 | 内容 |
|------|------|
| `test_template_loader.py` | 加载 YAML、校验失败、Pydantic 模型边界 |
| `test_template_engine.py` | 变量提取、条件解析、嵌套/多条件场景 |
| `test_renderer.py` | 变量替换、条件求值、布尔分支、转义处理 |

## 目录与文件约定

| 项目 | 规则 |
|------|------|
| `.prompts/` | 项目本地模板目录，首次保存时自动创建 |
| 模板文件名 | 小写 kebab-case，如 `code-review.yaml` |
| `state/` | 应用配置、窗口状态、最近项目列表，JSON 持久化 |

## 非功能性需求

- 模板引擎纯逻辑，不依赖 PyQt6（可独立测试和 CLI 使用）
- 错误友好：YAML 解析失败时给出具体行号
- 预览实时更新：QTimer / signal 驱动，避免卡顿

## 设计决策记录

| 决策 | 选项 | 选择原因 |
|------|------|---------|
| 存储格式 | YAML vs JSON | YAML 可读性更好，支持注释 |
| 模板位置 | 项目本地 `.prompts/` | 每种项目有独立的提示词集 |
| 条件语法 | 自定义轻量语法 vs Jinja2 | 简单够用，无额外依赖 |
| 变量类型 | 5 种基础类型 | 覆盖 90% 场景，不过度设计 |
