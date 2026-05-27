# Tavern Server — 运维信息

> **状态**: current（原位于 `docs/server/tavern-server/`）
> **更新**: 2026-05-24

> 此文档从运维视角描述 AI-Tavern 后端服务器的配置信息。
> 开发者文档详见 [apps/tavern/server/](../../apps/tavern/server/README.md)。

## 基础信息

| 项目 | 值 |
|------|-----|
| 服务名称 | Tavern Server |
| 源码路径 | `apps/tavern/server/` |
| 端口 | 3002（容器内部/开发） |
| 生产入口 | `https://mnapp.top/api/tavern/` |
| Docker 容器名 | `tavern-server`（`deploy/docker-compose.yml`） |

## 环境变量

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | MySQL 连接串 |
| `REDIS_URL` | Redis 连接串 |
| `JWT_SECRET` | JWT 签名密钥 |
| `DASHSCOPE_API_KEY` | 通义千问 API Key（免费额度） |
| `OPENCODE_API_KEY` | OpenCode Go API Key（免费额度） |

## Docker

- Dockerfile: `apps/tavern/server/Dockerfile`
- 构建方式：tsc 编译 → Node.js 运行

## 依赖服务

| 服务 | 连接方式 |
|------|----------|
| MySQL 8.0 | `mysql://user:pass@mysql:3306/miniapps` |
| Redis 7 | `redis://redis:6379` |
| DashScope | `https://dashscope.aliyuncs.com` |
| OpenAI / DeepSeek / OpenRouter | 用户自配 API Key |

## CI/CD

- CI: `.github/workflows/ci.yml` — **注意：路径过滤器存在错误，使用 `servers/tavern-server/**` 而非 `apps/tavern/server/**`**

---

> 最后更新: 2026-05-27
