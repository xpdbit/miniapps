# 现代 CSS 布局

> 状态: current | 来源: GoogleChrome/modern-web-guidance, Smashing Magazine, MDN, Josh W. Comeau

## 布局选择决策树

```
需要排布项目？
├── 一维（行或列）→ Flexbox
│   ├── 简单导航栏 → display: flex
│   └── 需要自动换行 → flex-wrap: wrap
├── 二维（行列同时）→ Grid
│   ├── 页面整体骨架 → grid-template-areas
│   ├── 响应式卡片网格 → repeat(auto-fit, minmax(300px, 1fr))
│   └── 复杂对齐需求 → 结合 Subgrid
└── 组件需根据容器尺寸变化 → Container Queries
    └── container-type: inline-size + @container
```

## Flexbox 核心模式

```css
/* 基础行布局 */
.flex-row { display: flex; gap: 1rem; align-items: center; }

/* 自动换行网格式 */
.flex-wrap { display: flex; flex-wrap: wrap; gap: 1rem; }
.flex-wrap > * { flex: 1 1 200px; } /* 最小200px */

/* 居中 */
.center { display: flex; justify-content: center; align-items: center; }

/* 内容推送（右侧） */
.push-right { margin-inline-start: auto; }
```

**关键注意**:
- `min-width: 0` 防止 flex item 溢出（内部有长 URL/代码时）
- 使用 `gap` 而非子元素 margin
- `flex-wrap: wrap` 是防止溢出的默认选择

## CSS Grid 核心模式

```css
/* 命名区域布局 */
.page {
  display: grid;
  grid-template-areas:
    "header  header"
    "sidebar main"
    "footer  footer";
  grid-template-columns: 250px 1fr;
}

/* 响应式自动填充 */
.card-grid {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
}

/* Subgrid — 子元素对齐父轨道 */
.card {
  display: grid;
  grid-template-rows: subgrid;
  grid-row: span 3; /* 跨越父网格的3行 */
}
```

**关键注意**:
- `auto-fit` vs `auto-fill`: auto-fit 折叠空轨道，auto-fill 保留空轨道
- `fr` 单位只在 Grid 中有效
- Subgrid 解决"锯齿边"问题（卡片内部元素跨兄弟对齐）

## Container Queries（容器查询）

```css
.container {
  container-type: inline-size;
  container-name: card;
}

@container card (min-width: 400px) {
  .inner {
    display: grid;
    grid-template-columns: 200px 1fr;
  }
}

/* 更短语法 */
.card-container {
  container: card / inline-size;
}

/* 容器单位 */
.element {
  font-size: clamp(1rem, 4cqi, 2rem); /* 4% of container inline-size */
}
```

**何时使用**:
- 组件需要在不同上下文中自适应布局
- 取代大量魔数媒体查询断点
- 设计系统中的通用组件（随时可 drop-in）

## 现代 CSS 函数

```css
/* clamp — 流体排版 */
font-size: clamp(1rem, 2.5vw, 1.5rem);

/* min/max — 边界控制 */
.container { width: min(100% - 2rem, 1200px); }

/* aspect-ratio — 避免 CLS */
img, video { aspect-ratio: 16 / 9; }
```

## 排版与间距

```css
/* 流体间距 */
.section { padding-block: clamp(2rem, 5vw, 4rem); }

/* 行长度控制 */
.content { max-width: 65ch; } /* 每行最佳阅读宽度 */

/* 间距尺度 */
:root {
  --space-xs: 0.25rem;  /* 4px */
  --space-sm: 0.5rem;   /* 8px */
  --space-md: 1rem;     /* 16px */
  --space-lg: 1.5rem;   /* 24px */
  --space-xl: 2rem;     /* 32px */
  --space-2xl: 3rem;    /* 48px */
}
```

## 响应式断点推荐

| 断点 | 宽度 | 目标设备 |
|------|------|----------|
| 手机 | < 640px | 竖屏手机 |
| 平板 | 768px - 1024px | 平板竖屏/横屏 |
| 桌面 | > 1024px | 笔记本 |
| 宽屏 | > 1440px | 大屏显示器 |

**方法论**: 移动优先（Mobile First），用 `min-width` 向上构建。

## 性能注意事项

- 只使用 `transform` 和 `opacity` 做动画 —— GPU 合成，不触发重排
- `will-change` 不要滥用 —— 用完即清除
- Container queries 的 `container-type: size` 需要显式高度，否则内容会折叠
- 使用 `@supports` 检测新特性并提供 fallback
