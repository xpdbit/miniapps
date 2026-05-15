# Game1 Server — AGENTS.md

## OVERVIEW
Express 4.21 + TypeScript 5.6 后端服务，为 Game1 挂机放置游戏提供云端存档、PVP 对战、成就系统和游戏配置管理。

## STRUCTURE
```
src/
├── app.ts              # Express 入口 — 全局中间件挂载 + 路由注册
├── config/             # 环境变量验证与配置对象 (dotenv)
├── lib/                # ELO 评分 (elo.ts) + JWT 工具 (jwt.ts)
├── middleware/         # 5 个中间件: auth/errorHandler/rateLimiter/requestLogger/validate
├── routes/             # 8 个路由模块: auth/players/save/pvp/achievements/config/admin/social
├── services/           # 10 个服务: auth/player/save/pvp/achievement/config/admin/share/event/message
├── types/              # TypeScript 类型定义
├── utils/              # Winston 日志 / 统一响应 / 错误码
└── validators/         # Zod 请求校验 Schema
```

## WHERE TO LOOK
| 关注点 | 位置 | 说明 |
|--------|------|------|
| 玩家认证 | `src/routes/auth.ts` + `src/services/auth.service.ts` | 微信登录/JWT 签发 |
| 玩家数据 | `src/routes/players.ts` + `src/services/player.service.ts` | 等级/经验/里程/转生 |
| 云端存档 | `src/routes/save.ts` + `src/services/save.service.ts` | JSON 存档 + 版本号 + checksum |
| PVP 对战 | `src/routes/pvp.ts` + `src/services/pvp.service.ts` | ELO 评分 + 赛季系统 |
| 成就系统 | `src/routes/achievements.ts` + `src/services/achievement.service.ts` | 成就解锁/进度追踪 |
| 游戏配置 | `src/routes/config.ts` + `src/services/config.service.ts` | Redis 缓存配置 |
| 管理后台 API | `src/routes/admin.ts` + `src/services/admin.service.ts` | 运营管理接口 |
| 社交分享 | `src/routes/social.ts` + `src/services/share.service.ts` | 微信订阅消息 |
| 事件/消息 | `src/services/event.service.ts` / `message.service.ts` | 事件总线 + 消息推送 |
| 数据库 | `prisma/schema.prisma` | 7 表: Player/CloudSave/PvpMatch/PvpRanking/Achievement/ShareLog/Config |
| CI | `.github/workflows/ci.yml` | Node 20 + MySQL 8.0 服务容器 |

## CONVENTIONS
- **路由路径**: 所有 API 挂载在 `/api/v1/game1` 下，路由模块内部路径不含前缀
- **中间件顺序**: helmet → cors → body-parser → rateLimiter → requestLogger → routes → 404 → errorHandler
- **速率限制**: 4 种策略 (全局/认证/严格/管理员), 通过 `rateLimiter.ts` 配置
- **响应格式**: 统一 `sendSuccess` / `sendError` 工具函数, 错误码定义在 `utils/errors.ts`
- **Zod 校验**: 请求体在路由层通过 `validate` 中间件校验
- **JWT 认证**: `auth` 中间件解析 token 并将 `req.playerId` 注入请求对象
- **ELO 评分**: 基于 `lib/elo.ts` 的 K=32 标准实现, 段位系统 Bronze→Silver→Gold→Platinum→Diamond

## ANTI-PATTERNS (新增)
- ❌ **错误日志缺失** — `src/routes/players.ts` 所有 route handler 的 catch 块只返回 `sendError`，无错误日志记录
- ❌ **无测试** — 无测试框架配置，路由/服务逻辑无覆盖

## COMMANDS
```bash
npm run dev              # tsx watch 开发模式
npm run build            # tsc 编译到 dist/
npm run start            # 生产启动 (node dist/app.js)
npm run type-check       # TypeScript 类型检查
npm run lint             # ESLint 检查
npm run db:generate      # Prisma Client 生成
npm run db:migrate       # Prisma 数据库迁移
npm run db:seed          # 种子数据填充
```
