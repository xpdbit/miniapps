# 前端动效与动画

> 状态: current | 来源: NN/g, Google Material Motion, MDN, impeccable/motion-design

## 核心原则

1. **动效必须有意义** — 传达因果关系、空间关系、层次关系
2. **不要装饰性动效** — 每个动画都应当回答"这个变化是怎么发生的"
3. **尊重用户偏好** — 必须支持 `prefers-reduced-motion`
4. **性能优先** — 只用 `transform` 和 `opacity`

## 持续时间标准

| 类型 | 时长 | 示例 |
|------|------|------|
| 即时反馈 | 100–150ms | 按钮按下、开关切换、颜色变化 |
| 状态变化 | 200–300ms | 菜单展开、Tooltip、Hover 状态 |
| 布局变化 | 300–500ms | Accordion、Modal、Drawer |
| 入场动画 | 500–800ms | 页面加载、Hero 渐入 |

**黄金规则**: 退场动画 ≈ 入场时长的 75%（让界面感觉更响应）。

## 缓动函数

```css
/* 推荐默认值 — 不要使用默认 ease */
--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);  /* 推荐默认 */
--ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);  /* 更明显 */
--ease-in-expo: cubic-bezier(0.7, 0, 0.84, 0);     /* 元素离开 */
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);     /* 来回切换 */
```

| 类型 | 适用场景 | CSS |
|------|----------|-----|
| ease-out | 元素进入 | `cubic-bezier(0.16, 1, 0.3, 1)` |
| ease-in | 元素离开 | `cubic-bezier(0.7, 0, 0.84, 0)` |
| ease-in-out | 状态切换 | `cubic-bezier(0.65, 0, 0.35, 1)` |

**避坑**: 不要使用 `bounce` 和 `elastic` 曲线——2015 年流行但现在看起来业余。

## 性能规则

```css
/* ✅ 正确：只使用 transform 和 opacity */
.element {
  transition: transform 200ms ease, opacity 200ms ease;
}

/* ❌ 错误：触发重排 */
.element {
  transition: width 200ms ease, height 200ms ease;
}
```

| 属性 | 性能 | 说明 |
|------|------|------|
| `transform` | GPU 合成 | 移动、缩放、旋转 |
| `opacity` | GPU 合成 | 淡入淡出 |
| `width`, `height`, `top`, `left` | 触发重排 | 绝不要直接动画 |

**动画高度/展开**: 使用 `grid-template-rows: 0fr → 1fr` 而非 `height: 0 → auto`。

## Stagger（交错动画）

```css
/* 用 CSS 自定义属性实现 */
.item {
  animation: fadeIn 300ms ease-out both;
  animation-delay: calc(var(--i, 0) * 50ms);
}
```

```html
<div style="--i: 0"></div>
<div style="--i: 1"></div>
<div style="--i: 2"></div>
```

**上限**: 总交错时长 ≤ 500ms（10 个 item × 50ms）。

## 无障碍处理

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**注意**: 功能型动画（进度条、加载指示器）应在减少动效模式下保留，只是减速而非完全禁用。

## 感知性能

| 策略 | 说明 |
|------|------|
| 预判启动 | 加载同时立即开始过渡（skeleton UI） |
| 乐观更新 | 先更新 UI，失败再回滚（点赞、收藏） |
| 渐进加载 | 内容逐步出现，不等全部就绪 |
| 80ms 阈值 | < 80ms 用户感觉不到延迟 |

## 动效语义（高级）

好的动效系统应建立"动效语法"——每种动画类型有明确的语义含义：

| 语义 | 缓动类型 | 含义 |
|------|----------|------|
| 响应 | ease-out | 界面在响应用户操作 |
| 发起 | ease-in | 界面主动开始某个动作 |
| 揭示 | fade + translate | 从空间位置显示出新内容 |

## 工具选择

| 场景 | 推荐方式 |
|------|----------|
| Hover/Focus 等状态切换 | CSS transition |
| 循环/多步动画 | CSS `@keyframes` |
| 交互响应（点击、拖拽） | CSS transition |
| 需要动态或物理模拟 | JS (WAAPI/GSAP) |
| 页面间过渡 | View Transitions API |

## 检查清单

- [ ] 动效时长控制在 150-500ms
- [ ] 只使用 `transform` 和 `opacity`
- [ ] 缓动函数使用自定义 `cubic-bezier`
- [ ] 支持 `prefers-reduced-motion`
- [ ] 退场比入场快
- [ ] 没有任何"为动效而动效"的装饰性动画
- [ ] 页面入场总交错时间 ≤ 500ms
- [ ] 动效在低端设备上保持 60fps
