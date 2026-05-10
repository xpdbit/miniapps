# 🍔 个人小程序工坊

基于 **Taro 4.x + React 18 + TypeScript** 的个人小程序集合，通过统一管理后台集中管理多个项目。

当前子项目：**食物主题生成器 (Food Theme Generator)** — AI 识别食物并生成个性化主题图片。

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端框架** | Taro 4.x + React 18 + TypeScript |
| **后端 API** | Express + TypeScript + Prisma ORM |
| **管理后台** | React 19 + Vite + Ant Design |
| **数据库** | MySQL 8.0 + Redis 7 |
| **食物识别** | PP-ShiTuV2 (PaddleClas) 独立容器 |
| **AI 文本** | 通义千问 (DashScope) |
| **主题渲染** | Markup 模板 + CSS Class 系统 |
| **部署** | Docker Compose + Nginx (ECS) |

## 核心功能

| 功能 | 说明 |
|------|------|
| **食物识别** | PP-ShiTuV2 AI 识别 → 返回食物名称、类别、热量 |
| **主题模板** | Markup 模板 + CSS Class 系统渲染食物卡片 |
| **位置打卡** | 记录美食打卡位置，GPS + IP 定位 |
| **成就系统** | 基于打卡次数、记录数等条件的成就解锁 |
| **统计面板** | 饮食数据可视化、打卡统计 |
| **管理后台** | 统一管理用户/食物记录/主题/Class/密钥 |
| **部署** | Docker Compose + Nginx 一键部署到 ECS |

## 项目结构

```
.miniapps/
├── apps/
│   ├── ftg-miniapp/      # 微信小程序 (Taro + React)
│   └── game1-miniapp/    # Game1 挂机放置游戏
├── servers/
│   └── ftg-server/       # Express 后端 API
├── dashboard/            # 统一管理后台
├── deploy/               # 部署配置 (Docker/Nginx)
├── docs/                 # 项目文档
│   ├── apps/ftg-miniapp/ # 小程序文档
│   ├── servers/ftg-server/ # 后端文档
│   ├── dashboard/        # 管理后台文档
│   └── deploy/           # 部署文档
├── plan/                 # 规划文档
├── cloud-functions/      # 云函数（规划中）
└── .sisyphus/            # Agent 工作目录
```

## 快速开始

### 后端

```bash
cd servers/ftg-server
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
cd apps/ftg-miniapp
npm install
npm run dev:weapp
```

## 文档

详见 [docs/README.md](./docs/README.md) 获取完整文档导航。
