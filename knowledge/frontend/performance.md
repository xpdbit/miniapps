# 前端性能优化

> 状态: current | 来源: Google CWV, Web Almanac, Sujeet Jaiswal, web.dev

## Core Web Vitals（核心指标）

| 指标 | 衡量 | Good | Needs Work | Poor |
|------|------|------|------------|------|
| LCP | 最大内容绘制——加载性能 | ≤ 2.5s | 2.5–4.0s | > 4.0s |
| INP | 交互到下一帧——响应性 | ≤ 200ms | 200–500ms | > 500ms |
| CLS | 累计布局偏移——视觉稳定性 | ≤ 0.1 | 0.1–0.25 | > 0.25 |
| TTFB | 首字节时间（诊断） | ≤ 0.8s | 0.8–1.8s | > 1.8s |

**数据**: 2025 Web Almanac 显示仅 48% 移动端网站通过 CWV。

## 优化优先级顺序

```
① TTFB（基础设施）→ ② LCP（图片/字体）→ ③ INP（JS）→ ④ CLS（布局）
```

### 第一优先级：LCP

LCP 是 62% 移动端网站失败的关键指标（最难的指标）。

| 手段 | 影响 | 说明 |
|------|------|------|
| Preload LCP 图片 | 500-1500ms | 添加 `<link rel="preload">` + `fetchpriority="high"` |
| CDN + 缓存 | 200-800ms | 边缘节点缩短 TTFB |
| 不要 lazy load 首屏图片 | 避免 LCP 恶化 | 首图用 `loading="eager"` |
| 压缩图片 (AVIF/WebP) | 显著 | 2MB JPEG → 400KB AVIF |
| 内联关键 CSS | ~14KB | 首屏所需 CSS inline，其余 defer |

```html
<!-- LCP 图片优化 -->
<img
  src="hero.avif"
  fetchpriority="high"
  width="1200"
  height="600"
  alt="Hero"
/>
```

### 第二优先级：INP

INP 于 2024 年 3 月取代 FID，衡量所有交互中最慢的那个。

| 手段 | 说明 |
|------|------|
| 拆分 Long Tasks（> 50ms） | 使用 `scheduler.yield()` 或 `setTimeout(0)` |
| 延迟第三方脚本 | 分析、广告脚本用 `defer` 或 `lazyOnload` |
| 减少重渲染范围 | React: `useMemo`, `useCallback`, `React.memo` |
| 防抖高频输入 | 搜索输入 250ms debounce |
| 大型 DOM 优化 | 虚拟列表（50+ 项目） |

```js
// 拆分长任务
async function processItems(items) {
  for (const item of items) {
    process(item);
    await new Promise(r => setTimeout(r, 0)); // 让出主线程
  }
}
```

### 第三优先级：CLS

CLS 是 81% 移动端已通过的指标，最容易修复。

| 手段 | 影响 | 说明 |
|------|------|------|
| 图片设置 width/height | CLS #1 原因 | 或 CSS `aspect-ratio` |
| 字体优化 | 消除 FOIT/FOUT | `font-display: optional` + `size-adjust` |
| 广告/嵌入预留空间 | 关键 | 容器设置 `min-height` |
| 底部注入动态内容 | 避免推送 | 不要从顶部插入 banner/cookie 通知 |
| transform 动画 | 不触发布局偏移 | 使用 `transform` 替代 `top/left/width/height` |

```css
/* 字体 CLS 修复 */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter.woff2');
  font-display: optional; /* 避免 FOIT */
  size-adjust: 100%; /* 匹配 fallback 指标 */
}
```

## 图片优化清单

```html
<!-- 完整优化模式 -->
<picture>
  <source srcset="hero.avif" type="image/avif">
  <source srcset="hero.webp" type="image/webp">
  <img
    src="hero.jpg"
    alt="Description"
    width="1200"
    height="600"
    loading="eager"
    fetchpriority="high"
    decoding="async"
  />
</picture>
```

- 使用 AVIF/WebP（通过 `<picture>` + fallback）
- 设置 `width` 和 `height` 防止 CLS
- 首屏图片 `loading="eager"` + `fetchpriority="high"`
- 非首屏 `loading="lazy"`
- 响应式 `srcset` + `sizes`

## 字体优化

| 策略 | 说明 |
|------|------|
| 自托管字体 | 避免第三方 DNS 查找延迟 |
| `font-display: optional` | 字体未加载时使用 fallback |
| `size-adjust` | 匹配 fallback 和 web font 指标 |
| Preload 关键字体 | `<link rel="preload" as="font">` |
| 子集化字体 | 只包含需要的字符 |

## JS 优化

| 策略 | 说明 |
|------|------|
| 代码分割 | 按路由拆分 |
| Tree Shaking | 移除未使用代码 |
| 第三方脚本 | 使用 `defer` 或 `async` |
| Web Worker | 将重型计算移出主线程 |
| React: `next/script` | strategy: afterInteractive / lazyOnload |

## 检查清单

### LCP
- [ ] LCP 元素图片使用 `fetchpriority="high"`
- [ ] LCP 图片不 lazy load
- [ ] 图片使用 AVIF/WebP
- [ ] 首屏关键 CSS 内联
- [ ] 服务器 TTFB < 800ms

### INP
- [ ] 没有超过 50ms 的 Long Tasks
- [ ] 第三方脚本使用 defer
- [ ] 输入事件有防抖/节流
- [ ] 大型列表已虚拟化
- [ ] 重渲染范围最小化

### CLS
- [ ] 所有图片有 width/height
- [ ] 字体使用 `font-display: optional`
- [ ] 广告/嵌入容器有 min-height
- [ ] 动态内容从底部注入
- [ ] 动画只使用 transform/opacity
