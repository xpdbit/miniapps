# deploy — 部署配置

Docker Compose + Nginx 一键部署到 ECS。

## 域名架构

| 域名 | 用途 | 说明 |
|------|------|------|
| `mnapp.top` | **统一入口** | Dashboard SPA + FTG API (`/api/ftl/`) + Admin API |
| `ftl.mnapp.top` | 兼容旧链接 | 重定向到 mnapp.top |
| `game1.mnapp.top` | Game1 | 挂机放置游戏 |
| `tavern.mnapp.top` | AI-Tavern | 角色聊天（预留） |

## 架构

```
DNS: *.mnapp.top → 47.94.108.150 (ECS)
                          │
                     Nginx (80/443)
                     │
                     mnapp.top
                     ├── /                     → Dashboard SPA (静态文件)
                     ├── /api/ftl/api/v1/*    → server:3000/api/v1/*
                     ├── /api/ftl/health      → server:3000/health
                     ├── /api/ftl/uploads/*   → server:3000/uploads/*
                     ├── /api/ftl/recognition/* → ppshituv2:5000
                     ├── /dashboard           → Admin dashboard
                     ├── /api/game1/*         → game1-server:3001 (反向代理)
                     └── /api/tavern/*        → tavern-server:3002 (反向代理)

                     game1.mnapp.top
                     └── /                     → Game1 SPA（占位）

                     tavern.mnapp.top
                     └── /                     → Tavern SPA（预留）
```
DNS: *.mnapp.top → 47.94.108.150 (ECS)
                         │
                    Nginx (80/443)
                    │
                    mnapp.top
                    ├── /                     → Dashboard SPA
                    ├── /api/ftl/api/v1/*    → server:3000/api/v1/*
                    ├── /api/ftl/health      → server:3000/health
                    ├── /api/ftl/uploads/*   → server:3000/uploads/*
                    ├── /api/ftl/recognition/* → ppshituv2:5000
                    ├── /api/v1/game1/*      → game1-server:3001
                    ├── /api/tavern/*         → tavern-server:3002
                    ├── /api/v1/admin/*      → ftg-admin:3001（管理后台）
                    ├── /assets/*            → 静态资源（长期缓存）
                    └── /dashboard           → Admin dashboard

                    game1.mnapp.top
                    └── /                     → Game1 SPA（占位）
```

### URL 映射规则

| 旧路径（api.ftl.mnapp.top） | 新路径（mnapp.top） | 后端服务 |
|------|------|------|
| `https://api.ftl.mnapp.top/api/v1/auth/login` | `https://mnapp.top/api/ftl/api/v1/auth/login` | ftg-server:3000 |
| `https://api.ftl.mnapp.top/health` | `https://mnapp.top/api/ftl/health` | ftg-server:3000 |
| `https://api.ftl.mnapp.top/uploads/xxx` | `https://mnapp.top/api/ftl/uploads/xxx` | ftg-server:3000 |
| `https://api.ftl.mnapp.top/recognition/xxx` | `https://mnapp.top/api/ftl/recognition/xxx` | ppshituv2:5000 |
| — | `https://mnapp.top/api/game1/*` | game1-server:3001 |
| — | `https://mnapp.top/api/tavern/*` | tavern-server:3002 |

Nginx 会自动将 `/api/ftl/` 前缀重写为 `/` 后转发，后端无需任何改动。

## 容器编排

| 容器 | 说明 |
|------|------|
| `mysql` | MySQL 8.0 数据库 |
| `redis` | Redis 7 缓存 |
| `ppshituv2` | PP-ShiTuV2 食物识别 |
| `server` | FTG Express 后端 API (port 3000) |
| `game1-server` | Game1 Express 后端 API (port 3001) |
| `tavern-server` | AI-Tavern Express 后端 API (port 3002) |
| `admin` | Dashboard Admin API (port 3001) |
| `tavern-server` | AI-Tavern Express 后端 API (port 3002) |
| `nginx` | 反向代理 + 静态资源 |

## 部署命令

```bash
bash deploy/scripts/deploy.sh          # 一键构建+部署
bash deploy/scripts/verify.sh          # 健康检查
bash deploy/scripts/verify.sh http://localhost  # 本地验证

# SSL 证书配置（首次部署后执行）
bash deploy/scripts/setup-ssl.sh       # Let's Encrypt 证书
```

## 首次部署流程

```bash
# 1. 配置 .env
cp deploy/.env.example deploy/.env
# 编辑 deploy/.env 填入真实值

# 2. 构建 + 部署
bash deploy/scripts/deploy.sh

# 3. 等待 DNS 解析生效（可能需要 10 分钟 ~ 24 小时）
dig mnapp.top

# 4. 配置 SSL 证书
bash deploy/scripts/setup-ssl.sh

# 5. 验证
bash deploy/scripts/verify.sh
curl https://mnapp.top/api/ftl/health
```

## SSL 证书

Nginx 容器内置 certbot，支持 Let's Encrypt 自动续期。

- **DNS-01 验证**（推荐）：`setup-ssl.sh` 使用 acme.sh + 阿里云 DNS API，无需开放 80 端口
- **HTTP-01 验证**：备用方案，需要 80 端口可访问
- **自动续期**：acme.sh 每日自动检查续期

## CORS 配置

`deploy/.env` 中的 `CORS_ORIGINS` 控制后端 API 允许的跨域来源。
添加新域名时同时更新：
1. `deploy/.env` — 生产环境 CORS
2. `deploy/.env.example` — 环境变量模板
3. `servers/ftg-server/src/config/env.ts` — 开发环境默认值

## 微信小程序配置

在小程序管理后台（mp.weixin.qq.com）中配置：

| 配置项 | 值 |
|--------|------|
| request合法域名 | `https://mnapp.top` |
| uploadFile合法域名 | `https://mnapp.top` |
| downloadFile合法域名 | `https://mnapp.top` |
