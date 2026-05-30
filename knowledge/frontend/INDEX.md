# 前端 UI/UX 知识库

> 状态: current | 更新: 2026-05-29
> 来源: 综合 web 搜索、开源项目研究、行业指南

本知识库汇集现代前端 UI/UX 的核心实践、设计模式和架构决策。涵盖设计系统、布局、组件、动画、无障碍、性能等领域。

## 快速导航

| 领域 | 文件 | 适合谁 |
|------|------|--------|
| 设计系统与 Token | [design-tokens.md](./design-tokens.md) | 架构师、设计系统维护者 |
| 现代 CSS 布局 | [layout-css.md](./layout-css.md) | 前端开发者 |
| 组件设计模式 | [component-patterns.md](./component-patterns.md) | 所有前端开发者 |
| 动效与动画 | [motion-animation.md](./motion-animation.md) | UI 开发者、动效设计师 |
| 无障碍 | [accessibility.md](./accessibility.md) | 所有开发者 |
| UX 状态管理 | [ux-states.md](./ux-states.md) | 前端开发者 |
| 前端性能 | [performance.md](./performance.md) | 性能工程师 |
| CSS 架构 | [css-architecture.md](./css-architecture.md) | 架构师、CSS 维护者 |
| Taro H5 CSS 陷阱 | [taro-h5-css.md](./taro-h5-css.md) | Taro 前端开发者 |

## 核心原则

1. **语义化 Token > 硬编码值** — 颜色、间距、字体全部通过 Token 系统管理
2. **组件优先于页面** — 设计组件时假设它可在任意上下文中复用
3. **无障碍不是功能，是基线** — WCAG 2.2 AA 是最低标准
4. **交互相应必须在 200ms 内** — 用户感知的"即时感"阈值
5. **动效必须有意义** — 没有"为了动效而动效"，每个动画都在传达因果关系
6. **Loading/Error/Empty/Success 四个状态缺一不可** — 不处理空状态 = 产品未完成
7. **布局选择先想维度** — 一维用 Flexbox，二维用 Grid，组件适配用 Container Queries
8. **性能是体验的一部分** — LCP < 2.5s, INP < 200ms, CLS < 0.1

## 参考来源

- [WCAG 2.2 W3C 规范](https://www.w3.org/TR/WCAG22/)
- [Material Design 3](https://m3.material.io/)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Google Core Web Vitals](https://web.dev/vitals/)
- [CSS Spec 规范](https://www.w3.org/Style/CSS/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [Smashing Magazine](https://www.smashingmagazine.com/)
- [NN/g Nielsen Norman Group](https://www.nngroup.com/)
