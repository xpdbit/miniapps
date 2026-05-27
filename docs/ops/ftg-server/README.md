# FTG Server — 运维信息

> **状态**: current（原位于 `docs/server/ftg-server/`）
> **更新**: 2026-05-24

> 此文档从运维视角描述 FTG 后端服务器的配置信息。
> 开发者文档详见 [apps/ftg/server/](../../apps/ftg/server/README.md)。

## 基础信息

| 项目 | 值 |
|------|-----|
| 服务名称 | FTG Server |
| 源码路径 | `apps/ftg/server/` |
| 端口 | 3000（容器内部/开发） |
| 生产入口 | `https://mnapp.top/api/ftl/api/v1/` |
| Docker 容器名 | `server`（`deploy/docker-compose.yml`） |
| 健康检查 | `GET /health` |

## 环境变量

| 变量 | 说明 | 来源 |
|------|------|------|
| `DATABASE_URL` | MySQL 连接串 | `.env` / Docker 环境 |
| `REDIS_URL` | Redis 连接串 | `.env` / Docker 环境 |
| `JWT_SECRET` | JWT 签名密钥 | `.env` |
| `ALI_OSS_*` | 阿里云 OSS 配置 | `.env` |
| `DASHSCOPE_API_KEY` | 通义千问 API Key | `.env` |

## Docker

- Dockerfile: `apps/ftg/server/Dockerfile`
- 多阶段构建：node:20-alpine builder → dist runner
- 非 root 用户 `appuser`，配置 HEALTHCHECK

## 依赖服务

| 服务 | 连接方式 |
|------|----------|
| MySQL 8.0 | `mysql://user:pass@mysql:3306/miniapps` |
| Redis 7 | `redis://redis:6379` |
| PP-ShiTuV2 | `http://ppshituv2:5000` |
| DashScope | `https://dashscope.aliyuncs.com` |

## CI/CD

- CI: `.github/workflows/ci.yml` — lint → type-check → build → docker
- Deploy: `.github/workflows/deploy.yml` — Docker build + push

---

> 最后更新: 2026-05-27
