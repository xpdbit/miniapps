> 🚫 **废弃文档** — 本文档路径结构与项目实际目录不匹配。
> 当前架构已迁移至新路径: `docs/apps/game1/server/README.md`
> 此旧文件保留作为归档参考，不再更新。

# servers/game1-server — Game1 后端 API

**挂机放置游戏 (Game1)** 的后端服务，提供云端存档、PVP 对战、成就系统和游戏配置管理。

## 技术栈

| 类别 | 技术 |
|------|------|
| 运行时 | Node.js 20 / Express 4.21 / TypeScript 5.6 |
| ORM | Prisma 5.22 (MySQL) |
| 缓存 | ioredis (Redis) |
| 认证 | JWT (jsonwebtoken) + 微信 code 登录 |
| 安全 | Helmet 8 + CORS + express-rate-limit |
| 验证 | Zod 3 |
| 日志 | Winston 3 (JSON) |
| 微信 | 订阅消息 (axios) |

## 数据库 Schema

7 张表：`game1_players`（玩家）/ `game1_cloud_saves`（存档）/ `game1_pvp_matches`（PVP）/ `game1_pvp_rankings`（排行）/ `game1_achievements`（成就）/ `game1_share_logs`（分享）/ `game1_configs`（配置）

## API 路由（挂载在 `/api/v1/game1`）

| 路由 | 端点 | 说明 |
|------|------|------|
| auth | `POST /auth/login` | 微信 code 登录 |
| auth | `GET /auth/me` | 当前玩家信息 |
| players | `GET /players/:id` | 玩家资料 |
| players | `PUT /players/:id/sync` | 同步游戏数据 |
| players | `GET /rankings` | 排行榜 |
| save | `PUT /save/:playerId` | 上传存档（1MB+版本检测） |
| save | `GET /save/:playerId` | 下载存档 |
| pvp | `POST /pvp/result` | 提交对战结果（ELO 计算） |
| pvp | `GET /pvp/leaderboard` | PVP 排行榜 |
| achievements | `POST /achievements/check` | 检查并解锁成就 |
| config | `GET /config/:key` | 获取配置（Redis 缓存） |
| admin | `GET /admin/players` | 玩家列表管理 |

## 服务层

10 个服务：auth / player / save / pvp / achievement / config / admin / share / event / message

## 核心特性

- **ELO 评分系统**: K=32，Bronze→Silver→Gold→Platinum→Diamond 段位
- **云端存档**: JSON + 版本号 + MD5 checksum
- **成就系统**: 11 个成就定义（里程/等级/PVP/轮回/登录）
- **速率限制**: 4 种策略（全局/认证/存档/PVP）
- **CI**: Node 20 + MySQL 8.0 服务容器
