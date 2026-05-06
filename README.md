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
| **食物识别** | PP-ShiTuV2 (PaddleClas) |
| **部署** | Docker Compose + Nginx |

## 项目结构

```
.miniapps/
├── ftg-miniapp/          # 微信小程序 (Taro + React)
├── ftg-server/           # Express 后端 API
├── dashboard/            # 统一管理后台
├── deploy/               # 部署配置 (Docker/Nginx)
├── docs/                 # 项目文档
│   ├── ftg-miniapp/      # 小程序文档
│   ├── ftg-server/       # 后端文档
│   ├── dashboard/        # 管理后台文档
│   └── deploy/           # 部署文档
├── plan/                 # 规划文档
├── cloud-functions/      # 云函数（规划中）
└── .sisyphus/            # Agent 工作目录
```

## 快速开始

### 后端

```bash
cd ftg-server
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
cd ftg-miniapp
npm install
npm run dev:weapp
```

## 文档

详见 [docs/README.md](./docs/README.md) 获取完整文档导航。
