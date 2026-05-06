# ftg-server — Express 后端 API

**食物主题生成器 (FTG)** 的后端服务，提供 RESTful API。

## 技术栈

- **Runtime**: Node.js + TypeScript
- **框架**: Express
- **ORM**: Prisma (MySQL)
- **缓存**: Redis

## 核心功能

- 用户认证 (微信登录 / JWT)
- 食物记录 CRUD
- 主题模板系统 (Markup + CSS Class 渲染)
- 成就系统
- 位置打卡
- AI 识别服务编排

## 目录结构

```
ftg-server/src/
├── routes/           # API 路由 (15 模块)
├── services/         # 业务逻辑层
├── middleware/       # 中间件 (认证/权限)
├── utils/           # 工具函数
└── types/           # 类型定义
```

## 接口文档

详见 [ftg-miniapp API](../ftg-miniapp/API.md)（小程序端调用后端 API 的参考）。
