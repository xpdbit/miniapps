# Tavern 桌面端重设计

> **状态**: approved
> **日期**: 2026-05-28
> **范围**: AI 酒馆 H5 桌面端（>= 1024px）侧边栏 + 卡片 + 搜索控件 + 布局

---

## 一、改动概览

| # | 改动 | 文件 | 类型 |
|---|------|------|------|
| 1 | 侧边栏重构 | `DesktopSidebar/index.tsx` + `.scss` | 结构+视觉+功能 |
| 2 | 卡片加头像 | `CharacterCard/index.tsx` + `.scss` | 功能增强 |
| 3 | 搜索控件美化 | `pages/market/index.tsx` + `.scss` | 视觉+文案 |
| 4 | 去掉 content padding | `app.scss` | 布局修正 |

---

## 二、侧边栏重构

### 2.1 当前结构 vs 新结构

```
  当前                              新
┌─────────────────┐           ┌──────────────────┐
│ ● AI 酒馆        │           │ ● AI 酒馆         │
│ 🔍 搜索角色...   │  ← 删除   │                  │
│ [主菜单|游戏中]  │           │ ┌主菜单─┬─游戏中┐ │  ← pill 风格独立区块
│ 酒馆 · 开始 · 我的│          │ └───────┴───────┘ │
│ 工具             │  ← 删除   │                  │
│  我的角色        │           │ ▼ 导航（可折叠）  │  ← 分组标题 + 折叠箭头
│  创建角色        │           │  酒馆             │
│  人设管理        │           │  开始             │
│  角色归档        │           │  我的             │
│  游戏设置        │           │                  │
│                 │           │ ⚡ 最近聊天        │  ← 新增分组
│ ? 未登录         │           │  幸存者·林峰      │
│ 🌓 主题切换      │           │  神秘人·X         │
│ AI 酒馆 v1.0.0  │           │                  │
└─────────────────┘           │ ? 用户名 · 已登录  │
                               │ 🌓 暗色模式        │
                               │ AI 酒馆 v1.0.0   │
                               └──────────────────┘
```

### 2.2 删除项

| 删除 | 理由 |
|------|------|
| 搜索框（含搜索逻辑、样式） | 与 market 页内搜索功能重叠 |
| "工具"分组全部 5 项 | 低频操作，收敛到 profile 页 |
| `TAVERN_NAV` / `GAME_NAV` / `SECONDARY_NAV` 常量 | 简化结构后不再需要多组导航 |

### 2.3 新模式切换器

- 从导航 section header 移出，独立为 Logo 下方顶层区块
- 样式：圆角 pill 容器，两段式切换按钮
- 尺寸：高度 36px，padding 2px
- 激活段：金色背景 `#C49A6C` + 白色文字
- 非激活段：透明背景 + 次级文字色
- 切换过渡：背景色 200ms ease

### 2.4 主导航分组（可折叠）

- 分组标题：文字 `导航` + 右侧 `▾` 箭头
- 默认展开，点击标题切换折叠
- 折叠时：箭头旋转 90°（`▸`），导航项隐藏
- 过渡：`max-height` + `opacity`，300ms ease
- 折叠状态持久化到 `localStorage`（key: `tavern_sidebar_nav_collapsed`）
- 导航项取决于 `gameMode`：酒馆(酒馆/开始/我的) / 游戏(通信/通讯录/发现/我的)

### 2.5 最近聊天（新分组，可折叠）

- 数据源：`chatStore` 的会话列表 `sessions`
- 显示最近 5 个会话，按 `updatedAt` 倒序
- 每条：32px 圆形头像（角色首字 + 渐变色底）+ 角色名（截断 8 字）+ 最后消息时间
- 点击跳转到 `pages/chat/index` 对应会话
- 会话数 <= 1 时自动隐藏整个分组
- 分组标题：`最近` + 折叠箭头
- 折叠状态持久化（key: `tavern_sidebar_chats_collapsed`）

### 2.6 角标系统

- `NavItem` 接口新增 `badge?: number` 字段
- 角标样式：红色圆点（1-99）或 `99+`，导航项标签右侧
- 尺寸：`min-width: 18px, height: 18px, font-size: 11px`
- 背景色：`var(--color-error)`（当前 `#E5534B`）
- 首版不接入实时数据，预留接口供后续使用

### 2.7 激活指示器

- 激活项左侧 2px 金色竖线 + 浅色背景
- 竖线颜色：`#C49A6C`（`var(--color-primary)`）
- 背景：`rgba(196, 154, 108, 0.08)` 亮色 / `rgba(196, 154, 108, 0.12)` 暗色
- 圆角：`var(--radius-sm)` (6px)
- 过渡：背景色 150ms ease

### 2.8 视觉间距系统

| 区域 | 间距 |
|------|------|
| Logo → 模式切换 | 16px |
| 模式切换 → 导航分组 | 12px |
| 分组之间 | 8px |
| 分组标题 → 首项 | 6px |
| 导航项之间 | 2px |
| 导航 → 最近聊天 | 自动（spacer） |
| 最近聊天 → 用户区 | flex spacer |

### 2.9 用户区保留不变

- 头像（首字）+ 昵称 + 状态 + 右箭头
- 主题切换行
- 版本号
- 无结构改动

---

## 三、卡片加头像

### 3.1 当前状态

- `CharacterCard` 接口定义了 `avatar?: string | null` 字段
- 组件渲染时**未使用** `avatar`。卡片纯文字：名字 + 描述 + 左侧竖线
- 卡片比例 `aspect-ratio: 5/3`（桌面端 `4/3`）

### 3.2 新设计

```
┌──────────────┐
│ ●  幸存者·林峰 │  ← 40px 圆形头像 + 名字并排
│   前特种部队... │  ← 描述文字（保持现有）
│   ♥ 1.2k ✦ 3k │  ← 统计行（保持现有）
└──────────────┘
```

- 头像：40px 圆形，左侧显示，与名字同行
- 有 `avatar` URL 时：`<Image>` 渲染图片，`border-radius: 50%`，`object-fit: cover`
- 无 `avatar` 时：首字 + 渐变色底（参考现有 profile 页头像风格）
  - 背景色：从名字 hash 映射到 6 种渐变色之一
  - 文字：白色，`font-size: 16px`，`font-weight: 600`
- card-body 布局改为横向 flex：头像 + 文字列

### 3.3 渐变色映射

```typescript
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
]

function getAvatarGradient(name: string): string {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length]
}
```

### 3.4 compact 模式保持不变

compact 模式下不显示头像（保持当前纯文字行为）。

---

## 四、搜索控件美化

### 4.1 文案

- placeholder: `"搜索角色..."` → `"搜索卡片..."`

### 4.2 新增清除按钮

- 搜索框右侧加 `×` 清除按钮
- 仅在有输入内容时显示（`searchQuery.length > 0`）
- 点击清空输入并重新聚焦
- 图标：`Icon name='close' size={18}` 或内联 SVG
- 过渡：opacity 150ms，显示/隐藏

### 4.3 视觉增强

- 清除按钮使用项目 `<Icon name='close'>` 组件
- 聚焦时：边框颜色过渡到 `var(--color-primary)`，光晕由 `3px` 加宽到 `4px`
- 输入框高度：桌面端 42px → 44px（Touch target 更好，视觉更舒适）
- placeholder 颜色从 `var(--color-text-placeholder)` 微调加深，提升可读性

---

## 五、去掉 content padding

### 5.1 改动

`app.scss` 第 231 行：

```diff
- .desktop-app-content { flex: 1; min-width: 0; display: flex; flex-direction: column;
-   max-width: 1200px; margin: 0 auto; padding: 0 32px; overflow-y: auto; scroll-behavior: smooth; }
+ .desktop-app-content { flex: 1; min-width: 0; display: flex; flex-direction: column;
+   max-width: 1200px; margin: 0 auto; overflow-y: auto; scroll-behavior: smooth; }
```

### 5.2 影响分析

| 页面 | 影响 |
|------|------|
| market | ✅ 无影响 — 自有 `max-width: 1100px; margin: 0 auto` |
| chat, profile, archive, creator, persona 等 | ✅ 无影响 — 各有独立 `max-width` 约束 |
| 游戏模式页 (chats/contacts/discover) | ✅ 无影响 — 自有 `max-width: 900px; margin` |

现有各页面已通过自身样式控制宽度，父级 padding 是冗余约束。移除后不影响任何页面布局。

---

## 六、不涉及的文件

| 文件 | 原因 |
|------|------|
| `app.ts` | 布局结构不变，`desktop-app-layout` + `desktop-app-content` 保持 |
| `custom-tab-bar/` | 桌面端已隐藏，不受影响 |
| `WebNavBar/` | 桌面端已隐藏 |
| 其他 pages | 仅 market 页搜索控件微调，其余不动 |
| `stores/` | 最近聊天数据来自现有 `chatStore.sessions`，无需新增 store |

---

## 七、验证清单

- [ ] 桌面端（>=1024px）侧边栏正确显示新结构
- [ ] 模式切换 pill 正常工作，酒馆/游戏模式导航正确切换
- [ ] 导航分组折叠/展开动画流畅
- [ ] 最近聊天正确显示（有数据时），正确隐藏（<=1 条时）
- [ ] 卡片头像正确渲染（有图/无图/compact 三种情况）
- [ ] 搜索"搜索卡片..."文案正确，清除按钮正常
- [ ] `.desktop-app-content` 无 padding，各页面布局正常
- [ ] 暗色模式所有改动正常
- [ ] 移动端（<1024px）所有改动不影响
- [ ] TypeScript 类型检查通过
- [ ] LSP diagnostics 清洁
