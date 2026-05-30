# 前端组件设计模式

> 状态: current | 来源: Frontend Patterns, Atomic Design, Vercel Academy, Feature-Sliced Design

## 组件架构层次

### 经典 Atomic Design（原子设计）

| 层级 | 职责 | 示例 | 状态 |
|------|------|------|------|
| Atoms（原子） | 纯展示、单一职责 | BaseButton, BaseInput, Icon | 无状态 |
| Molecules（分子） | 原子组合 + 最小逻辑 | SearchBar, LoginForm, Tooltip | 少量状态 |
| Organisms（有机体） | 自包含复杂组件 | Header, ProductCard, NavigationMenu | 可包含逻辑 |
| Templates（模板） | 页面内容结构 | DefaultLayout, DashboardLayout | 抽象占位 |
| Pages（页面） | 数据获取 + 组合 | HomePage, UserProfile | 数据源 |

### 容器/展示分离模式

```
Container（容器层）
├── 管理数据获取（API calls）
├── 管理状态逻辑
├── 传递 props 给子组件
└── 通常与路由绑定

Presentational（展示层）
├── 只负责渲染
├── 接收 props，触发 events
├── 不依赖外部状态
└── 纯 UI 组件，高度可复用
```

**什么时候使用**: 适合较大团队、设计系统、需要跨项目复用的组件库。

## 组件 API 设计

| 消费者需求 | 推荐方式 | 示例 |
|-----------|----------|------|
| 配置外观/行为 | Props | `variant`, `size`, `disabled` |
| 注入自定义内容 | Slots | Card 的 header/body/footer |
| 控制渲染 + 访问内部状态 | Render Props | 自定义列表项渲染 |
| 关联元素的协调 | Compound Components | Tabs + TabList + TabPanel |
| 响应用户交互 | Event Callbacks | `onClick`, `onChange` |
| 有时受控/有时非受控 | Controlled/Uncontrolled | 表单输入 |

### Compound Components（复合组件）

```tsx
// 通过 Context 隐式共享状态
<Accordion>
  <Accordion.Item>
    <Accordion.Header>Title</Accordion.Header>
    <Accordion.Panel>Content</Accordion.Panel>
  </Accordion.Item>
</Accordion>
```

**适用场景**: 复杂组件（Tabs, Menu, Select, Combobox, Dialog, Accordion）。

**关键模式**: 父组件通过 Context 提供共享状态，子组件通过 Context 访问。

### 受控/非受控模式

- 非受控模式: 组件内部管理状态，消费者无需关心
- 受控模式: 消费者通过 props 控制状态
- 推荐: 同时支持两种模式（如 `<input>` 的 `value` + `defaultValue`）

## 组件通信原则

```
Props down, Events up
    ↓               ↑
父组件 → Props → 子组件
子组件 → Events → 父组件
```

**跨层级通信**: 使用 Context / Provide-Inject，但注意：
- 避免过宽 Context 触发大量重渲染
- 拆分 Context 为细粒度 Provider
- 高频变化的状态单独 Context

## 组件组织架构

### Feature-Sliced Design (FSD)

```
src/
├── app/          — 应用初始化、全局 provider
├── pages/        — 路由级别页面组合
├── widgets/      — 复合 UI 块（页面 section）
├── features/     — 用户交互和业务用例
├── entities/     — 核心业务模型
└── shared/       — 可复用工具和 UI 原语
```

**核心规则**: 上层可依赖下层，下层绝不能依赖上层。

### 另一种分层模式

```
Primitives（基础）→ 设计系统原子组件
├── Blocks（业务组件）→ 组合 Primitives + 业务逻辑
├── Widgets（页面 Section）→ 组合 Blocks
├── Registries（组件映射）→ 路由 ↔ 组件
└── Pages（页面）→ 最终组装
```

## 组件可复用性 6 个层级

| 层级 | 方式 | 示例 |
|------|------|------|
| 1. Templating | 模板复用 | 相同结构不同数据 |
| 2. Configuration | Props 配置变体 | `variant="primary"` |
| 3. Adaptability | 插槽实现灵活布局 | `<slot>` |
| 4. Inversion | 反向控制（Scoped Slot） | 列表项渲染由消费者决定 |
| 5. Extension | 扩展点 | 布局中可覆盖特定区域 |
| 6. Nesting | 嵌套组合 | Slot 中再嵌套 Slot |

## 反模式

| 反模式 | 说明 | 替代 |
|--------|------|------|
| 巨型组件 | 超过 200-300 行 | 拆分为子组件 |
| 过多 Props | 组件有 10+ props | 用 Compound Components 或 Slots |
| Prop Drilling | A → B → C → D 传 props | 用 Context 或状态管理 |
| 组件混入数据层 | 组件内直接 fetch API | 分离 Container/Presentational |
| CSS 外部边距 | 组件声明 margin | 父组件控制间距（`gap`） |

## 快速检查清单

- [ ] 组件功能是否单一（Single Responsibility）
- [ ] 是否支持受控/非受控两种模式（如适用）
- [ ] Props 是否有默认值
- [ ] 是否处理了 loading/error/empty 状态
- [ ] 无障碍属性是否正确（ARIA roles, keyboard nav）
- [ ] 是否有清晰的 TypeScript 类型定义
- [ ] 是否遵循单向数据流
