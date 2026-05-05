# 🍔 个人小程序工坊 (Personal Mini-App Workshop)

基于 **Taro 4.x + React 18 + TypeScript** 的个人小程序集合，通过统一管理后台集中管理多个项目。

当前项目：**食物主题生成器 (Food Theme Generator)** — AI 识别食物并生成个性化主题图片。

## 🎯 项目定位

个人项目工坊 — 统一 dashboard 集中管理多个微信小程序（个人项目，不接外包）。

当前子项目 — **食物主题生成器 (FTG)**：
用户拍摄食物照片 → AI 识别食物种类、估算热量 → 生成游戏风格主题图片（饥荒、星露谷物语、塞尔达等）→ 记录饮食、位置打卡、社交分享。

## 🛠️ 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端框架** | Taro 4.x + React 18 + TypeScript | 跨端小程序框架 |
| **样式方案** | Sass (.scss) 模块化样式 | |
| **后端 API** | Express + TypeScript + Prisma ORM | RESTful API 服务 (端口 3000) |
| **数据库** | MySQL 8.0 (容器化) + Redis 7 (缓存) | Prisma 统一 ORM |
| **管理后台** | React 19 + Vite + Ant Design | 双进程: Vite前端(5173) + Admin API(3001) |
| **食物识别** | PP-ShiTuV2 (PaddleClas) | Python 微服务容器 |
| **AI 文本** | 通义千问 (DashScope) | 游戏化描述生成 |
| **主题渲染** | Markup 模板 + CSS Class 系统 | 替换旧版 Canvas 2D 合成 |
| **部署** | Docker Compose + Nginx (ECS 100) | 6 个容器统一编排 |

## 📁 项目结构

```
.miniapps/
├── ftg-miniapp/                   # 微信小程序主项目 (Taro + React)
│   ├── src/pages/                 # 12 个页面
│   ├── src/services/              # 云函数 + HTTP API 服务
│   ├── cloudfunctions/            # 云函数（逐步迁移至 ftg-server）
│   └── config/                    # Taro 构建配置
├── ftg-server/                    # Express 后端 API
│   ├── src/routes/                # 15 个 RESTful 路由模块
│   ├── src/services/              # 业务逻辑层 (含主题模板引擎)
│   ├── prisma/                    # Schema + 迁移
│   └── .github/workflows/         # CI/CD
├── dashboard/                     # 统一管理后台 (一管多)
│   ├── src/pages/                 # 15 个页面 (含 ThemeClasses)
│   ├── server/                    # Admin API
│   └── prisma/                    # 管理后台 Schema
├── deploy/                        # Docker/Nginx 部署配置
├── docs/                          # 项目文档
└── plan/                          # 项目规划文档
```

## 🚀 快速开始

### 服务端

```bash
# 1. 启动服务端
cd ftg-server
npm install
npm run dev              # tsx watch 开发 (端口 env.PORT)

# 2. 启动 Dashboard（另一个终端）
cd dashboard
npm install
npm run dev              # Vite 开发 (5173端口)
# Dashboard Admin API 需单独启动：
# tsx server/server.ts   (端口 3001)
```

### 小程序

```bash
cd ftg-miniapp
npm install
npm run dev:weapp        # Taro 开发模式
# 在微信开发者工具中打开 ftg-miniapp 目录
```

## 🎮 核心功能

| 功能 | 说明 |
|------|------|
| **食物识别** | PP-ShiTuV2 AI 识别 → 返回食物名称、类别、热量 |
| **主题模板** | Markup 模板 + CSS Class 系统渲染食物卡片 |
| **位置打卡** | 记录美食打卡位置，GPS + IP 定位 |
| **成就系统** | 基于打卡次数、记录数等条件的成就解锁 |
| **统计面板** | 饮食数据可视化、打卡统计 |
| **管理后台** | 统一管理用户/食物记录/主题/Class/密钥 |
| **部署** | Docker Compose + Nginx 一键部署到 ECS |

## 📋 更多文档

- [ARCHITECTURE.md](./ARCHITECTURE.md) — 系统架构与数据流
- [API.md](./API.md) — 云函数 API 参考
- [DATABASE.md](./DATABASE.md) — 数据库设计
- [DEVELOPMENT.md](./DEVELOPMENT.md) — 开发指南与规范
- [plan/](../plan/) — 项目规划文档
