# 🍝 个人小程序工坊

基于 **Taro 4.x + React 18 + TypeScript** 的个人小程序集合，通过统一管理后台集中管理多个项目。

当前子项目：**食物主题生成器 (Food Theme Generator)** — AI 识别食物并生成个性化主题图片，**AI-Tavern** — 角色聊天应用，**Game1** — 挂机放置游戏。

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端框架** | Taro 4.x + React 18 + TypeScript |
| **后端 API** | Express + TypeScript + Prisma ORM |
| **管理后台** | React 19 + Vite + Ant Design |
| **数据库** | MySQL 8.0 + Redis 7 |
| **AI 识别 (FTG)** | PP-ShiTuV2 (PaddleClas) 独立容器 |
| **AI 文本 (Tavern)** | 通义千问 (DashScope) + 多模型 |
| **主题渲染 (FTG)** | Markup 模板 + CSS Class 系统 |
| **部署** | Docker Compose + Nginx (ECS) |

## 核心功能

| 项目 | 功能 | 说明 |
|------|------|------|
| **FTG** | 食物识别 | PP-ShiTuV2 AI 识别 → 返回食物名称、类别、热量 |
| **FTG** | 主题模板 | Markup 模板 + CSS Class 系统渲染食物卡片 |
| **FTG** | 位置打卡 | 记录美食打卡位置，GPS + IP 定位 |
| **FTG** | 成就系统 | 基于打卡次数、记录数等条件的成就解锁 |
| **FTG** | 统计面板 | 饮食数据可视化、打卡统计 |
| **Tavern** | 角色市场 | 角色卡浏览/搜索/标签/轮播 |
| **Tavern** | SSE 流式聊天 | EventSource 流式对话，多模型切换 |
| **Tavern** | 角色创建 | 自定义角色卡编辑与发布 |
| **Tavern** | 人设管理 | 自定义人设配置 |
| **通用** | 管理后台 | 统一管理所有项目的用户/数据/配置 |
| **通用** | 部署 | Docker Compose + Nginx 一键部署到 ECS |

## 项目结构

```
.miniapps/
├── apps/
│   ├── ftg/              # FTG 项目
│   │   ├── client/    # Taro 4.x 跨平台客户端
│   │   └── server/      # Express 后端 API
│   ├── game1/            # Game1 项目
│   │   ├── client/    # Taro 跨平台客户端
│   │   └── server/      # Express 后端 API
│   └── tavern/           # AI-Tavern 项目
│       ├── client/    # Taro 4.x 跨平台客户端
│       └── server/      # Express 后端 API
├── dashboard/            # 统一管理后台
├── deploy/               # 部署配置 (Docker/Nginx)
├── docs/                 # 项目文档
├── plan/                 # 规划文档
├── prisma/               # 统一 Prisma Schema
└── tools/                # 开发工具
```

## 快速开始

### 后端

```bash
cd apps/ftg/server
npm install
npm run dev
```

### 管理后台

```bash
cd dashboard
npm install
npm run dev
```

### 小程序

```bash
# FTG 食物主题生成器 (WeChat)
cd apps/ftg/client
npm install
npm run dev:weapp

# FTG H5 开发
cd apps/ftg/client
npm run dev:h5

# AI-Tavern 角色聊天 (WeChat)
cd apps/tavern/client
npm install
npm run dev:weapp

# AI-Tavern H5 开发
cd apps/tavern/client
npm run dev:h5
```

## 文档

详见 [docs/README.md](./docs/README.md) 获取完整文档导航。
