# Game1 Server

> **状态**: current
> **更新**: 2026-05-24

Game1 挂机放置游戏的后端 API 服务，基于 Express + TypeScript 构建。

## 技术栈

| 类别 | 选型 |
|------|------|
| 运行时 | Node.js 20 + TypeScript 5.6 |
| 框架 | Express 4.21 |
| ORM | Prisma 6 (MySQL 8.0) |
| 缓存 | ioredis 5.4 (Redis 7) |
| 认证 | JWT (jsonwebtoken) |
| 校验 | Zod 3.23 |
| 日志 | Winston 3.15 |
| 安全 | Helmet 8 + CORS + express-rate-limit 7.4 |
| 评分 | ELO 算法 (K=32) |

## 数据库

7 张表定义在 `prisma/schema.prisma`：

| 表 | 说明 |
|----|------|
| `game1_players` | 玩家账号、等级、经验、金币、转生次数 |
| `game1_cloud_saves` | 云端存档 (JSON + 版本号 + checksum) |
| `game1_pvp_matches` | PVP 对战记录 (ELO 变化、战报) |
| `game1_pvp_rankings` | 排行榜 (ELO 评分、段位、赛季) |
| `game1_achievements` | 成就解锁记录 (进度追踪) |
| `game1_share_logs` | 社交分享记录 |
| `game1_configs` | 游戏配置 (KV 结构, 版本控制) |

## 项目结构

```
src/
├── app.ts           # Express 入口
├── config/          # 环境变量
├── lib/             # ELO + JWT 工具
├── middleware/      # auth / errorHandler / rateLimiter / requestLogger / validate
├── routes/          # auth / players / save / pvp / achievements / config / admin / social
├── services/        # 11 个业务服务
├── types/           # TS 类型定义
├── utils/           # 响应 / 日志 / 错误码
└── validators/      # Zod Schema
```

中间件顺序: `helmet → cors → body-parser → rateLimiter → requestLogger → routes → 404 → errorHandler`

所有 API 挂载在 `/api/v1/game1` 下。

## API 概览

| 路由 | 说明 |
|------|------|
| `POST /auth/login` | 微信登录 / JWT 签发 |
| `GET /auth/me` | 当前玩家信息 |
| `PUT /players/:id` | 更新玩家数据 |
| `PUT /save/:playerId` | 上传云端存档 |
| `GET /save/:playerId` | 拉取云端存档 |
| `POST /pvp/result` | 提交对战结果 (ELO 评分) |
| `GET /pvp/leaderboard` | PVP 排行榜 (段位) |
| `POST /achievements/check` | 检测成就解锁 |
| `GET /config/:key` | 获取游戏配置 (Redis) |
| `GET /admin/dashboard` | 运营面板 |

## 快速开始

```bash
npm install                  # 安装依赖
npm run db:generate          # 生成 Prisma Client
npm run db:migrate           # 数据库迁移
npm run dev                  # tsx watch 热重载开发
npm run build && npm start   # 生产构建与启动
```

| 命令 | 说明 |
|------|------|
| `npm run dev` | tsx watch 热重载开发 |
| `npm run build` | tsc 编译到 dist/ |
| `npm run type-check` | TS 类型检查 |
| `npm run lint` | ESLint 检查 |
| `npm run db:migrate` | 数据库迁移 |
| `npm run db:seed` | 种子数据填充 |
