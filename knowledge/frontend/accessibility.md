# 前端无障碍

> 状态: current | 来源: WCAG 2.2, WAI-ARIA 1.2, Section508.gov, Apple HIG, MD

## 标准基线

| 标准 | 版本 | 等级 | 说明 |
|------|------|------|------|
| WCAG 2.2 | 2024-12 正式推荐 | AA（最低目标） | 4 原则 12 条指南 86 个成功标准 |
| WAI-ARIA 1.2 | 当前稳定版 | — | 角色、状态、属性规范 |
| EN 301 549 | EU 标准 | — | 欧洲无障碍法案 |
| 无障碍设计 | — | — | Apple HIG / MD 平台指南 |

## POUR 四大原则

### 1. Perceivable（可感知）
| 标准 | 要求 |
|------|------|
| 1.1 文本替代 | 所有非文本内容提供替代文本 |
| 1.4.3 颜色对比度 | 普通文本 ≥ 4.5:1，大文本 ≥ 3:1 |
| 1.4.1 颜色非唯一 | 不使用颜色作为唯一传达信息方式 |
| 1.4.10 响应式 | 内容可在不丢失信息情况下重排 |

### 2. Operable（可操作）
| 标准 | 要求 |
|------|------|
| 2.1.1 键盘 | 全部功能可通过键盘操作 |
| 2.4.7 焦点可见 | 焦点指示器始终可见 |
| 2.5.8 目标尺寸 | 交互目标 ≥ 24×24px（新） |
| 2.4.11 焦点不遮挡 | 聚焦元素不被其他内容遮挡（新） |

### 3. Understandable（可理解）
| 标准 | 要求 |
|------|------|
| 3.2.6 一致帮助 | 帮助机制在所有页面位置一致（新） |
| 3.3.7 避免重复输入 | 多步骤中已填写信息自动填充（新） |
| 3.3.8 无障碍认证 | 认证不要求认知功能测试（复制粘贴、密码管理器）（新） |

### 4. Robust（健壮）
| 标准 | 要求 |
|------|------|
| 4.1.2 名称/角色/值 | 所有 UI 组件名称、角色、值可程序化确定 |
| 4.1.3 状态消息 | 状态消息通过 ARIA 通知 AT |

## 开发者最佳实践

### 语义 HTML（最高 ROI）
```html
<!-- ✅ 正确 -->
<nav aria-label="Main navigation">...</nav>
<main>
  <h1>Page Title</h1>
  <section aria-labelledby="section-heading">
    <h2 id="section-heading">Section</h2>
  </section>
</main>
<footer role="contentinfo">...</footer>

<!-- ❌ 错误 -->
<div class="nav">...</div>
<div class="main">
  <div class="title">Page Title</div>
</div>
```

### 键盘导航
```css
/* 清晰的焦点样式 */
:focus-visible {
  outline: 2px solid var(--color-brand);
  outline-offset: 2px;
}
```

### 颜色对比度
- 文本 ≥ 4.5:1 (AA) 或 7:1 (AAA)
- 大文本 ≥ 3:1
- UI 组件/图形 ≥ 3:1
- 使用 oklch() 颜色空间更容易达到对比度要求

### ARIA 使用原则
```
第一条规则：能用原生 HTML 语义，就不用 ARIA。
```
```html
<!-- ✅ 正确：原生 button -->
<button aria-label="Close" onclick="...">✕</button>

<!-- ❌ 错误：需要额外 ARIA -->
<div role="button" tabindex="0" onclick="...">✕</div>
```

### 常见 ARIA 模式
| 模式 | ARIA |
|------|------|
| 导航 | `role="navigation"` 或 `<nav>` |
| 弹窗 | `role="dialog"`, `aria-modal="true"` |
| 错误提示 | `role="alert"`, `aria-live="assertive"` |
| 实时区域 | `aria-live="polite"` |
| 选项卡 | `role="tablist"`, `role="tab"`, `role="tabpanel"` |
| 进度 | `role="progressbar"`, `aria-valuenow` |

## 测试策略

| 测试类型 | 工具 | 覆盖率 |
|----------|------|--------|
| 自动化扫描 | axe-core, Lighthouse, WAVE | ~30-40% 问题 |
| 键盘测试 | 手动 Tab/Shift+Tab/Enter/Arrow | 所有交互 |
| 屏幕阅读器 | NVDA/VoiceOver/JAWS | 完整用户流 |
| 对比度检查 | WebAIM Contrast Checker | 所有颜色对 |
| CI 集成 | axe-core, AccessLint | PR 级别 |

## WCAG 2.2 新增（重点）

| 标准 | 级别 | 核心要求 |
|------|------|----------|
| 2.4.11 焦点不遮挡 | AA | 聚焦元素不可被固定内容完全遮挡 |
| 2.5.7 拖拽替代 | AA | 拖拽功能必须有点击替代方式 |
| 2.5.8 目标尺寸 | AA | 交互目标 ≥ 24×24px |
| 3.2.6 一致帮助 | A | 帮助机制位置一致 |
| 3.3.7 避免重复输入 | A | 已输入信息自动填充 |
| 3.3.8 无障碍认证 | AA | 提供非认知方式的认证方法 |

## 检查清单

### HTML
- [ ] 使用语义标签（`<nav>`, `<main>`, `<section>`, etc.）
- [ ] 页面只有一个 `<h1>`
- [ ] 标题层级不跳跃（h1→h2→h3）
- [ ] 所有 `<img>` 有 `alt` 属性（装饰性图片用 `alt=""`）
- [ ] `<html>` 设置正确的 `lang` 属性

### 交互
- [ ] 所有操作可通过键盘完成
- [ ] `tabindex` 不使用 > 0 的值
- [ ] 焦点指示器 `:focus-visible` 清晰可见
- [ ] 弹窗关闭后焦点返回触发元素
- [ ] 触摸目标 ≥ 44×44px

### 视觉
- [ ] 文本对比度 ≥ 4.5:1
- [ ] 不使用颜色作为唯一信息指示
- [ ] 文本可缩放到 200% 不丢失内容
- [ ] 支持 `prefers-reduced-motion`

### ARIA
- [ ] 优先使用原生 HTML 语义
- [ ] 图标按钮有 `aria-label`
- [ ] 动态内容更新有 `aria-live`
- [ ] 表单错误有 `aria-describedby`
- [ ] 自定义控件有正确的 role/state
