# Taro H5 CSS 陷阱

> 状态: current | 更新: 2026-05-29

## `taro-view-core` + `width: 100%` + `padding` 导致溢出

### 问题描述

Taro H5 中，`<View>` 组件编译为 Web Components 自定义元素 `<taro-view-core>`。默认 `box-sizing` 为 `content-box`。

当对一个 `<View>` 同时设置：
```css
taro-view-core {
  width: 100% !important;
  padding: var(--spacing-lg) var(--spacing-xl) !important;  /* 例如 desktop: 36px 48px */
}
```

实际渲染宽度为 `100% + padding-left + padding-right`，导致水平溢出屏幕。

### 复现条件

- Taro H5 环境
- `<View>` 元素上同时有 `width: 100%`（或 `width: 100% !important`）和水平方向 `padding`
- 未显式设置 `box-sizing: border-box`

### 修复方式

在 `width: 100%` + `padding` 的规则中添加 `box-sizing: border-box`：

```css
.page-profile {
  box-sizing: border-box !important;
}
```

**注意**：不要对全局 `taro-view-core` 设置 `border-box`，因为可能影响其他依赖 `content-box` 的元素。按类修复更安全。

### 检查清单

- [ ] 桌面端 media query 中 `width: 100% !important` + `padding` 组合都要加 `box-sizing: border-box`
- [ ] 小程序端不受影响（小程序 view 默认 box-sizing 不同）
- [ ] 如果使用 `box-sizing: inherit` 全局重置，需确保 `taro-view-core` 能正确继承
