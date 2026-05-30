# 设计系统与 Design Tokens

> 状态: current | 来源: Specify 2024 State of Design Systems, W3C DTCG, Style Dictionary, Tokens Studio

## 概述

Design Tokens 是存储在平台无关格式中的命名设计决策变量（颜色、间距、排版等）。据 2024 年 Specify 设计系统报告，74% 的成熟设计系统已使用 Tokens 作为分发设计决策到代码的主要方法。

**核心价值**: Tokens 解决的是全平台（Web/iOS/Android/邮件）一致性问题，CSS 变量只是 Web 端的实现方式。

## 三层 Token 架构

几乎所有成熟的设计系统都采用三层架构：

```
Layer 1: Primitive Tokens（原始/基础 Token）
├── 颜色色板（--blue-50 ~ --blue-900）
├── 间距尺度（--spacing-1 ~ --spacing-24）
├── 字号梯度（--text-xs ~ --text-4xl）
└── 阴影/圆角预设
        ↓ 组件永不直接引用 Primitive

Layer 2: Semantic Tokens（语义 Token）
├── --color-brand-primary: var(--blue-500)
├── --color-surface: var(--gray-50)
├── --color-text-primary: var(--gray-900)
├── --space-inline: var(--spacing-4)
├── --radius-card: var(--radius-md)
└── --font-body: var(--font-sans)
        ↓ 组件只引用 Semantic 层

Layer 3: Component Tokens（组件 Token）
├── .btn {
│   --btn-bg: var(--color-brand-primary);
│   --btn-padding: var(--spacing-2) var(--spacing-4);
│   --btn-radius: var(--radius-md);
│ }
└── .card { ... }
```

## 命名规范

| 层级 | 模式 | 示例 |
|------|------|------|
| 原始值 | `--{category}-{hue}-{step}` | `--blue-500`, `--gray-100` |
| 语义 | `--{category}-{purpose}-{variant}` | `--color-brand-primary`, `--space-section-y` |
| 组件 | `--{component}-{property}` | `--btn-bg-hover`, `--card-radius` |

**最佳实践**:
- 使用 `--namespace-purpose-modifier` 模式
- 语义名称 > 外观名称（`--color-surface` 而不是 `--color-white`）
- 扁平命名，不要嵌套超过三级

## 主题切换机制

```
:root {
  --color-surface: #ffffff;
  --color-text-primary: #111827;
}

[data-theme="dark"] {
  --color-surface: #1f2937;
  --color-text-primary: #f9fafb;
}
```

**关键细节**:
- `color-mix()` 和 `light-dark()` 是 CSS 原生主题支持（2025+）
- `@property` 注册自定义属性才能实现平滑主题过渡
- 组件引用语义 Token → 主题切换变成 Token 重新映射 → 组件零改动

## 工具链

| 工具 | 用途 | 备注 |
|------|------|------|
| Style Dictionary (Amazon) | JSON Token → 多平台输出 | v4 支持 ESM 和异步变换 |
| Tokens Studio | Figma ↔ Git 双向同步 | 设计师在 Figma 中管理 Token |
| Theo (Salesforce) | Token 变换替代方案 | SLDS 起源项目 |

**工作流**: 设计师在 Figma 维护 Token → CI 同步到仓库 → Style Dictionary 编译 → 各平台消费。

## 常见陷阱

| 问题 | 解决方案 |
|------|----------|
| Token 命名膨胀，团队每人加一个 | 季度审计，合并重复，删除未使用 |
| 组件内重新声明 Token 覆盖了主题 | 组件不要声明全局 Token，使用组件级私有 Token |
| `var()` 未提供 fallback | 公共组件库必须提供 fallback |
| `calc()` 中变量缺少单位 | `@property` 声明语法或确保变量包含单位 |
| 过早过度 Token 化 | 从 20 个核心 Token 开始，按需添加 |

## 快速启动清单

- [ ] 建立 Primitive/Semantic/Component 三层
- [ ] Semantic Token 命名遵循 `--category-purpose-variant`
- [ ] Style Dictionary 接入 CI 流水线
- [ ] 组件只引用 Semantic Token
- [ ] 深色/浅色主题通过 Token 重映射实现
- [ ] 公共组件 `var()` 始终提供 fallback
- [ ] Token 文档与 Figma 保持同步
