# deploy — 部署配置

Docker Compose + Nginx 一键部署到 ECS。

## 架构

```
Nginx (80/443)
├── Dashboard SPA       (静态资源)
├── API /api/v1/*       → ftg-server
├── 识别 /recognition/*  → PP-ShiTuV2
└── 管理后台 API         → Admin API (3001)
```

## 容器编排

| 容器 | 说明 |
|------|------|
| `mysql` | MySQL 8.0 数据库 |
| `redis` | Redis 7 缓存 |
| `ppshituv2` | PP-ShiTuV2 食物识别 |
| `server` | Express 后端 API |
| `admin` | Dashboard Admin API |
| `nginx` | 反向代理 + 静态资源 |

## 部署命令

```bash
bash deploy/scripts/deploy.sh   # 一键构建+部署
bash deploy/scripts/verify.sh   # 健康检查
```
