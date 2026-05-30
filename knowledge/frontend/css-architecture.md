# CSS 架构与方法论

> 状态: current | 来源: GoogleChrome/modern-web-guidance, BEM, OOCSS, SMACSS, CSS Layers

## 现代 CSS 架构策略对比

| 策略 | 年份 | 方式 | 作用域 | 运行时成本 | 最佳场景 |
|------|------|------|--------|-----------|----------|
| BEM | 2010 | 命名规范 | 约定 | 零 | 大团队、设计系统 |
| SMACSS | 2011 | 分类组织 | 约定 | 零 | 大型站点 |
| OOCSS | 2009 | 结构/皮肤分离 | 约定 | 零 | 可复用 UI 框架 |
| CSS Modules | 2015 | 构建时作用域 | 自动 | 零 | React/Vue 组件 |
| CSS-in-JS | 2015 | 运行时 JS 样式 | 自动 | 小 | 动态主题 |
| Tailwind CSS | 2017 | 工具类优先 | 设计内建 | 零 | 快速开发 |
| Vanilla Extract | 2021 | TypeScript 类型化 CSS | 自动 | 零 | 类型安全大型项目 |
| CSS Layers | 2022 | 原生级联控制 | 原生 | 零 | 管理级联 |

## BEM（Block Element Modifier）

```
.block {}                    /* 独立组件 */
.block__element {}           /* 组件内元素 */
.block--modifier {}          /* 组件变体 */
.block__element--modifier {} /* 元素变体 */

/* 示例 */
.card {}
.card__title {}
.card--featured {}
.card__title--large {}
```

### BEM 核心规则

| 规则 | 说明 |
|------|------|
| Block 独立存在 | `.card` 可在任何地方使用 |
| Element 必须属于 Block | `.card__title` 不能脱离 `.card` 使用 |
| Element 不嵌套 > 1 层 | ❌ `.card__wrapper__title` → ✅ `.card__title` |
| Modifier 不能独立存在 | `class="card--featured"` 必须伴随 `class="card"` |
| 使用 `__` 和 `--` | 避免与单一连字符命名冲突 |

## SMACSS（Scalable and Modular Architecture for CSS）

| 分类 | 用途 | 命名约定 | 示例 |
|------|------|----------|------|
| Base | 默认和重置 | 元素选择器 | `html`, `body`, `h1`, `a` |
| Layout | 页面级结构 | `.l-` 前缀 | `.l-header`, `.l-sidebar` |
| Module | 可复用组件 | 描述性名称 | `.card`, `.modal` |
| State | UI 状态 | `.is-` 前缀 | `.is-active`, `.is-hidden` |
| Theme | 视觉变体 | `.theme-` 前缀 | `.theme-dark` |

## OOCSS（Object-Oriented CSS）

两个核心原则：

1. **结构 vs 皮肤分离**
   ```css
   /* 结构 */
   .btn { display: inline-flex; padding: 0.5em 1em; border-radius: 4px; }
   /* 皮肤 */
   .btn-primary { background: blue; color: white; }
   .btn-secondary { background: gray; color: black; }
   ```

2. **容器 vs 内容分离**
   - 避免后代选择器（`.sidebar h2`）
   - 直接用 class 描述内容（`.sidebar-title`）

## CSS Layers（推荐方案）

```css
@layer reset, base, theme, components, utilities;

@layer reset {
  * { margin: 0; padding: 0; box-sizing: border-box; }
}

@layer base {
  body { font-family: system-ui; line-height: 1.5; }
}

@layer components {
  .card { padding: 1rem; border-radius: 8px; }
}

@layer utilities {
  .mt-4 { margin-top: 1rem; }
}
```

**优势**: 用标准化的方式控制级联优先级，无需 `!important` 或依赖 BEM 降低特异性。

## 现代 CSS 最佳实践

### 特异性管理

```css
/* 使用 :where() 降低特异性 */
:where(.card) { padding: 1rem; }  /* 特异性 (0,0,0) */
.card { padding: 1rem; }          /* 特异性 (0,1,0) */

/* 使用 @scope 控制作用域 */
@scope (.card) {
  :scope { padding: 1rem; }
  .title { font-weight: bold; }
}
```

### 文件组织

```
styles/
├── reset.css         /* 基础重置 */
├── tokens.css        /* CSS 自定义属性 token */
├── base.css          /* 基础元素样式 */
├── layout.css        /* 页面布局 */
├── components/       /* 组件样式 */
│   ├── button.css
│   ├── card.css
│   └── modal.css
└── utilities.css    /* 工具类 */
```

### 避免

```css
/* ❌ 不要用 */
!important                   /* 除 utility 外禁止 */
#id-selector                 /* ID 选择器用于跳转定位，不要用于样式 */
element-selector-in-component /* .card p 当 .card 内出现 <p> 子组件时会出问题 */
deep-nesting                 /* 嵌套不要超过 3 层 */
```

### 推荐

```css
/* ✅ 推荐 */
@layer                       /* 级联层管理优先级 */
:where()                     /* 零特异性选择器 */
@scope                       /* 成分作用域 */
CSS custom properties        /* 设计 token */
class-selectors              /* 组件永远用 class */
```

## CSS 架构选择指南

| 场景 | 推荐方案 |
|------|----------|
| 设计系统/组件库 | BEM 命名 + CSS Layers |
| React/Vue/组件化项目 | CSS Modules 或 Vanilla Extract |
| 快速原型 | Tailwind CSS |
| 团队需要明确规范 | SMACSS 文件结构 + BEM 命名 |
| 动态主题需求 | CSS-in-JS 或 CSS 自定义属性 |
| 大型企业项目 | @layer + CSS Modules + CSS 自定义属性 |
