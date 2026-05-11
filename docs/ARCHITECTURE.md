# 系统架构

## 高层面架构（多项目视图）

```
┌──────────────────────────────────────────────────────────────────┐
│                    统一管理后台 (dashboard/)                        │
│  ┌───────────┐  ┌───────────┐  ┌───────┐  ┌───────┐  ┌──────┐  │
│  │ 项目管理   │  │ 用户管理   │  │ FTG   │  │ Game1 │  │Tavern│  │
│  └─────┬─────┘  └─────┬─────┘  └──┬────┘  └──┬────┘  └──┬───┘  │
│        │               │          │          │          │       │
│  ┌─────┴───────────────┴──────────┴──────────┴──────────┴───┐  │
│  │              Admin API (port 3001)                        │  │
│  └─────────────────────────┬────────────────────────────────┘  │
└────────────────────────────┼───────────────────────────────────┘
                             │
     ┌───────────────────────┼───────────────────────┐
     ▼                       ▼                       ▼
┌────────────┐      ┌────────────┐         ┌──────────────┐
│ FTG MiniApp│      │Game1 MiniApp│        │ AI-Tavern    │
│ (ftg-miniapp)│     │(game1-miniapp)│       │ (暂无小程序)  │
│ Taro + React│      │ Taro+React │         │              │
└──────┬─────┘      └──────┬─────┘         └──────┬───────┘
       │                   │                       │
       ▼                   ▼                       ▼
┌────────────┐      ┌────────────┐         ┌──────────────┐
│ FTG Server │      │Game1 Server│         │Tavern Server  │
│ ftg-server │      │game1-server│         │tavern-server  │
│ Express API│      │ Express API│         │ Express API   │
│ port 3000  │      │ port 3001  │         │ port 3002     │
└────────────┘      └────────────┘         └──────────────┘
```

**当前状态**：3 个子项目并进。FTG 已成熟部署至 ECS；Game1（小程序前端 + Express 后端）开发中；AI-Tavern（仅后端 API）开发中。dashboard 管理后台统一管理所有项目。

## 当前架构（FTG 子系统 — REST API）

```
┌─────────────────────────────────────────────────────────────┐
│                  WeChat MiniApp (Taro + React)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │  Home    │  │ Settings │  │ Profile  │  │ Camera/     │ │
│  │  (home)  │  │(settings)│  │(profile) │  │ Result      │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘ │
│       │             │             │               │         │
│  ┌────┴─────────────┴─────────────┴───────────────┴──────┐  │
│  │              Service Layer (services/)                  │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │  │
│  │  │ AuthSvc  │  │HttpClient│  │  ...Service modules   │ │  │
│  │  │(JWT)     │  │(Taro.req)│  │  (user/record/checkin)│ │  │
│  │  └──────────┘  └──────────┘  └──────────────────────┘ │  │
│  │                         │                               │  │
│  │              Zustand Stores (7 stores)                  │  │
│  └─────────────────────────┬───────────────────────────────┘  │
│                           │  HTTP GET/POST (JWT Bearer)       │
└───────────────────────────┼───────────────────────────────────┘
                            │
┌───────────────────────────┼───────────────────────────────────┐
│              servers/ftg-server (Express + TypeScript)         │
│  ┌──────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Auth │  │ Middleware│  │ Routes   │  │ Services         │  │
│  │ JWT  │  │ auth/    │  │ (16 mods)│  │ (recognition/    │  │
│  │      │  │ admin/   │  │          │  │  theme-render/..)│  │
│  └──┬───┘  └──────────┘  └────┬─────┘  └────────┬─────────┘  │
│     │                          │                  │            │
│     └──────────────────────────┼──────────────────┘            │
│                                │                               │
│  ┌─────────────────────────────┼───────────────────────────┐   │
│  │                   Prisma ORM + MySQL 8.0                │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │   │
│  │  │ Users    │  │FoodRecord│  │ Themes   │  │ Classes │ │   │
│  │  │ Checkins │  │Achieve-  │  │ ApiKeys  │  │  ... (14│ │   │
│  │  │          │  │ments     │  │          │  │   total)│ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────┘ │   │
│  └────────────────────────────────────────────────────────┘   │
│                         │                                      │
│  ┌──────────────────────┼───────────────────────────────────┐  │
│  │          External Services                                │  │
│  │  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐   │  │
│  │  │PP-ShiTuV2│  │ 通义千问      │  │ Redis 7 Cache    │   │  │
│  │  │(Docker)  │  │ (DashScope)  │  │ (session/rate)   │   │  │
│  │  └──────────┘  └──────────────┘  └──────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## 技术架构分层

### 前端层 (MiniAPP)

| 层级 | 目录 | 职责 |
|------|------|------|
| **页面层** | `src/pages/` | UI 渲染、用户交互、路由跳转 |
| **组件层** | `src/components/` | 可复用 UI 组件 (18 SVG icons, charts) |
| **服务层** | `src/services/` | HTTP client, auth, business logic |
| **状态层** | `src/stores/` | Zustand stores (auth, UI state) |
| **工具层** | `src/utils/` | 纯函数工具（Canvas合成、图片处理等） |
| **类型层** | `src/types/` | TypeScript 类型定义 |
| **常量层** | `src/constants/` | 全局常量、配置数据 |

### 后端层 (REST API)

| 层级 | 位置 | 职责 |
|------|------|------|
| **API 路由** | `servers/ftg-server/src/routes/` | 16 个路由模块 (RESTful) |
| **服务层** | `servers/ftg-server/src/services/` | 业务逻辑 (theme-render/class/recognition) |
| **中间件** | `servers/ftg-server/src/middleware/` | JWT 认证、RBAC 权限 |
| **ORM** | Prisma (MySQL 8.0) | 数据库访问 (14 表) |
| **外部 AI** | PP-ShiTuV2 (Docker) | 食物识别服务 |
| **外部 AI** | DashScope (通义千问) | 文本生成 |

## 核心数据流

### AI 流水线 (current REST API version)

```
User takes/selects photo
        │
        ▼
  ① Upload → POST /upload → returns filename
        │
        ▼
  ② Recognize → POST /recognition/recognize → sends image path
        │                        ┌──────────────────┐
        ├─→ servers/ftg-server   │ PP-ShiTuV2 Docker│
        │   proxies request ────→│ (port 5000)      │
        │   ← returns result     │ food name/type/  │
        │                        │ calories         │
        │                        └──────────────────┘
        │
        ▼
  ③ Generate → calls DashScope AI (通义千问) for themed description
        │
        ▼
  ④ Render → POST /theme-render/render → markup template + CSS classes
        │
        ▼
  ⑤ Save → POST /food-records → persisted to MySQL via Prisma
```

### 用户认证流程 (current)

```
MiniApp launches
    │
    ▼
Check cached JWT token in storage
    │
    ├── token exists → GET /auth/me → validate → show UI
    │
    └── no token → wx.login() → get code
                      │
                      ▼
                  POST /auth/login { code }
                      │
                      ▼
                  servers/ftg-server exchanges code via WeChat API
                      │
                      ▼
                  Returns { token, user }
                      │
                      ▼
                  Store token locally, set user state
```

## 路由与导航

### TabBar 导航（3个 Tab）

| Tab | 路径 | 说明 |
|-----|------|------|
| 🏠 首页 | `pages/home/index` | 主要功能入口 |
| ⚙️ 设置 | `pages/settings/index` | 主题偏好、API配置 |
| 👤 我的 | `pages/profile/index` | 个人中心 |

### 完整路由表

| 路径 | 页面 | TabBar |
|------|------|--------|
| `pages/home/index` | 首页 | ✅ |
| `pages/settings/index` | 设置 | ✅ |
| `pages/profile/index` | 个人中心 | ✅ |
| `pages/camera/index` | 拍照页 | ❌ |
| `pages/result/index` | 结果展示页 | ❌ |
| `pages/record/index` | 打卡记录列表 | ❌ |
| `pages/record/detail/index` | 打卡详情 | ❌ |
| `pages/history/index` | 历史记录 | ❌ |
| `pages/stats/index` | 统计数据 | ❌ |
| `pages/achievements/index` | 成就页 | ❌ |
| `pages/checkin/index` | 打卡页 | ❌ |
| `pages/gallery/index` | 美食图鉴 | ❌ |
| `pages/privacy/index` | 隐私政策 | ❌ |

## 权限声明

| 权限 | 用途 |
|------|------|
| `scope.camera` | 拍摄食物照片 |
| `scope.userLocation` | 记录打卡位置 (GPS) |
| `requiredPrivateInfos` | `getLocation`, `chooseLocation` |

## 主题模板系统 (v2)

> 取代旧的 Canvas 2D 合成引擎。使用 HTML-like 标记模板 + CSS Class 系统。

### 架构

```
Dashboard 创建模板 + Class
        │
        ▼
servers/ftg-server 存储模板配置
        │
        ├── theme.service.ts       — 主题 CRUD + 使用统计
        ├── theme-class.service.ts  — Class CRUD + CSS 白名单校验
        └── theme-render.service.ts — 模板渲染引擎
                │
                ▼
API 输出渲染后的 HTML/CSS
        │
        ├── MiniApp RichText 渲染 (mode=miniapp, class→inline)
        └── H5 完整 HTML (mode=h5, <style> + class)
```

### 模板语法

```html
<div class="item-card">
  <div class="item-name">{{foodName}}</div>
  <div class="item-desc">{{foodDescription}}</div>
  <div class="item-calories">{{calories}} 大卡</div>
</div>
```

| 语法 | 说明 |
|------|------|
| `{{variable}}` | 变量替换 |
| `{{#if var}}...{{/if}}` | 条件渲染 |
| `{{#each list}}...{{/each}}` | 循环渲染 |
| `class="name"` | 引用 Class 定义 |
| `style="..."` | 内联样式（覆盖 class） |

### Class 系统

- **官方 Class**: Dashboard Class 管理页面创建，CSS 属性白名单校验
- **社区 Class**: 预留 `category=community`，支持第三方扩展
- **CSS 白名单**: 65+ 安全 CSS 属性（布局、字体、颜色等），禁止 `position:fixed`、`!important` 等

### 旧版兼容

`config_json` 字段保留在新主题模型中，用于旧版 Canvas 主题的前向兼容。

## 主题系统重构依赖链 (2026-05-05)

```
T1(Prisma Schema扩展) — 新增 ThemeClass/ThemeUsageLog 表 + Theme 字段
    │
    ├──► T2(Class 系统服务) — CRUD + CSS 白名单校验
    │         │
    │         └──► T3(模板渲染引擎) — 变量/条件/循环 + class展开
    │                    │
    │                    ├──► T4(Dashboard Class管理) — Table + Modal + 实时预览
    │                    │
    │                    └──► T5(Dashboard 主题编辑器) — 模板编辑器 + class选择器 + 预览
    │                               │
    │                               └──► T6(MiniApp 主题渲染) — API 主题列表 + RichText
    │                                          │
    │                                          └──► T7(使用统计 + 短链接) — 计数 + by-short 路由
    │
    └──► 旧版 configJson 保留兼容
```

所有 7 个实现任务已完成并部署至 ECS。
