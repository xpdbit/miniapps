# 系统架构

## 高层面架构（多项目视图）

```
┌──────────────────────────────────────────────────────────────┐
│                  统一管理后台 (dashboard/)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐  │
│  │ 项目管理     │  │ 用户管理     │  │ 数据看板 / 统计       │  │
│  │ project mgmt│  │ user mgmt   │  │ dashboard / stats    │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬───────────┘  │
│         │                │                     │              │
│  ┌──────┴────────────────┴─────────────────────┴──────────┐  │
│  │            Admin API (port 3001)                        │  │
│  └─────────────────────────┬───────────────────────────────┘  │
└────────────────────────────┼──────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  FTG MiniApp  │   │   Project 2   │   │   Project 3   │
│  (ftg-miniapp)│   │   (future)    │   │   (future)    │
│  Taro + React │   │               │   │               │
└───────┬───────┘   └───────────────┘   └───────────────┘
        │
        ▼
┌───────────────┐
│  FTG Server   │
│  (ftg-server) │
│  Express API  │
└───────────────┘
```

**当前状态**：仅有 FTG (Food Theme Generator) 一个子项目。dashboard 管理后台已具备项目管理框架，后续新增小程序项目即可扩展。

## 整体架构（FTG 子系统）

```
┌─────────────────────────────────────────────────────────────┐
│                     微信小程序（Taro + React）                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │  首页     │  │  设置     │  │  我的     │  │  拍照/结果   │ │
│  │  home    │  │ settings │  │ profile  │  │ camera/     │ │
│  │          │  │          │  │          │  │ result      │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘ │
│       │             │             │               │         │
│  ┌────┴─────────────┴─────────────┴───────────────┴──────┐  │
│  │                  业务服务层 (services/)                  │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │  │
│  │  │ UserSvc  │  │ ApiKeySvc│  │  DAL 层 (7个集合)      │ │  │
│  │  └──────────┘  └──────────┘  │  BaseDAL             │ │  │
│  │                               │  UserDAL / FoodDAL   │ │  │
│  │                               │  CheckinDAL / ...    │ │  │
│  │                               └──────────────────────┘ │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │  wx.cloud.callFunction()          │
└───────────────────────────┼───────────────────────────────────┘
                            │
┌───────────────────────────┼───────────────────────────────────┐
│               微信云开发 CloudBase                              │
│  ┌────────────────────────┴───────────────────────────────┐  │
│  │                   云函数层                               │  │
│  │  ┌────────────────┐  ┌──────────────┐  ┌────────────┐ │  │
│  │  │orchestrateAI   │  │foodRecognize │  │textGenerate│ │  │
│  │  │Pipeline (编排)  │  │(食物识别)     │  │(文本生成)   │ │  │
│  │  └───────┬────────┘  └──────┬───────┘  └──────┬─────┘ │  │
│  │          │                  │                  │       │  │
│  │  ┌───────┴──────────────────┴──────────────────┴─────┐ │  │
│  │  │              shared/ 共享模块                       │ │  │
│  │  │  response.ts / errorHandler.ts / logger.ts         │ │  │
│  │  └───────────────────────────────────────────────────┘ │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                   │
│  ┌────────────────────────┼───────────────────────────────┐  │
│  │               CloudBase 云服务                          │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │  │
│  │  │ 云数据库  │  │ 云存储    │  │ CloudRun (ppshituv2) │ │  │
│  │  │7个集合   │  │ 图片存储  │  │ PP-ShiTuV2 识别服务  │ │  │
│  │  └──────────┘  └──────────┘  │ 2核4GB, 1-5实例     │ │  │
│  │                               └──────────────────────┘ │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## 技术架构分层

### 前端层 (MiniAPP)

| 层级 | 目录 | 职责 |
|------|------|------|
| **页面层** | `src/pages/` | UI 渲染、用户交互、路由跳转 |
| **组件层** | `src/components/` | 可复用 UI 组件（Loading 等） |
| **服务层** | `src/services/` | 业务逻辑封装、云函数调用 |
| **DAL 层** | `src/services/db/` | 数据库 CRUD 操作封装 |
| **工具层** | `src/utils/` | 纯函数工具（Canvas合成、图片处理等） |
| **类型层** | `src/types/` | TypeScript 类型定义 |
| **常量层** | `src/constants/` | 全局常量、配置数据 |

### 后端层 (CloudBase)

| 层级 | 位置 | 职责 |
|------|------|------|
| **云函数** | `cloud-functions/` | 业务 API、身份认证、数据操作 |
| **共享模块** | `cloud-functions/shared/` | 响应格式化、错误处理、日志 |
| **AI 服务** | CloudRun | PP-ShiTuV2 食物识别（Docker部署） |

## 核心数据流

### AI 流水线状态机

用户拍照到生成主题图片的完整流程：

```
用户拍照/选择图片
        │
        ▼
  ① 图片上传至云存储
        │
        ▼
  ② 调用 orchestrateAIPipeline（编排器）
        │
        ├──► 状态: queued (0%)
        ├──► 状态: preprocessing (10%) — 图片预处理
        ├──► 状态: recognizing (30%) — 调用 foodRecognize → PP-ShiTuV2
        ├──► 状态: generating (55%) — 调用 textGenerate → 混元大模型
        ├──► 状态: composing (80%) — 前端 Canvas 2D 合成
        └──► 状态: completed (100%) 或 failed (0%)
                        │
                        ▼
  ③ 前端轮询 pipeline_status 集合获取进度
                        │
                        ▼
  ④ 合成完成后保存至 food_records + checkins
```

### 用户认证流程

```
小程序启动
    │
    ▼
wx.cloud.init() → CloudBase 免登录初始化
    │
    ▼
调用 getOpenId 云函数获取 openid
    │
    ▼
前端缓存 openid，后续所有请求自动携带
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
ftg-server 存储模板配置
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

所有 7 个实现任务已完成并部署至 ECS100。
