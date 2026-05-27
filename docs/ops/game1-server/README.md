# Game1 Server — 运维信息

> **状态**: current（原位于 `docs/server/game1-server/`）
> **更新**: 2026-05-24

> 此文档从运维视角描述 Game1 后端服务器的配置信息。
> 开发者文档详见 [apps/game1/server/](../../apps/game1/server/README.md)。

## 基础信息

| 项目 | 值 |
|------|-----|
| 服务名称 | Game1 Server |
| 源码路径 | `apps/game1/server/` |
| 端口 | 3004（容器内部/开发） |
| 生产入口 | `https://mnapp.top/api/v1/game1/` |
| Docker 容器名 | `game1-server`（`deploy/docker-compose.yml`） |

## 环境变量

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | MySQL 连接串 |
| `REDIS_URL` | Redis 连接串 |
| `JWT_SECRET` | JWT 签名密钥 |
| `WX_APP_ID` | 微信小程序 AppID |
| `WX_APP_SECRET` | 微信小程序 AppSecret |

## Docker

- Dockerfile: `apps/game1/server/Dockerfile`
- 构建方式：tsc 编译 → Node.js 运行

## 依赖服务

| 服务 | 连接方式 |
|------|----------|
| MySQL 8.0 | `mysql://user:pass@mysql:3306/miniapps` |
| Redis 7 | `redis://redis:6379` |

## CI/CD

- CI: `.github/workflows/ci.yml` — Node 20 + MySQL 服务容器

---

> 最后更新: 2026-05-27
