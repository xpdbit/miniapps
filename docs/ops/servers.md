# 服务器运维

> **状态**: current
> **更新**: 2026-05-24
> 合并自 `docs/server/` + `docs/server_info/`。

## ECS_100 — mnapp.top

| 项目 | 值 |
|------|-----|
| **类型** | 阿里云 ECS (共享型) |
| **系统** | Ubuntu 22.04 |
| **配置** | 2c / 2g / 3MB/s |
| **磁盘** | 40GB (系统盘) |
| **磁盘** | 40GB (系统盘) |
| **公网 IP** | 47.94.108.150 |
| **域名** | mnapp.top (已备案) |
| **SSH** | `ssh root@mnapp.top` |

## 运行容器

| 容器 | 服务 | 端口 | 资源限制 |
|------|------|------|----------|
| `docker-mysql` | MySQL 8.0.46 | 3306 (宿主机:6606) | 0.5c / 384M |
| `tavern-server` | AI-Tavern Express API | 3002 | 0.5c / 384M |
| `dashboard-api` | Dashboard Admin API (Express) | 3001 | 0.2c / 192M |
| `docker-nginx` | Nginx 反向代理 (SSL) | 80 / 443 | 0.2c / 48M |

## 部署路径

```
/opt/ftg/
├── apps/           # 应用代码 (ftg/game1/tavern)
├── dashboard/      # 管理后台
├── tools/deploy/   # 部署工具 (docker-compose + nginx + scripts)
├── prisma/         # 数据库 Schema
└── docs/           # 文档
```

## 数据库

| 数据库 | 用户 | 连接方式 |
|--------|------|----------|
| `food_theme_generator` | `ftg_user` | `mysql://ftg_user:***@mysql:3306/food_theme_generator` |
| `ai_tavern` | `ftg_user` | `mysql://ftg_user:***@mysql:3306/ai_tavern` |
| `game1` | `ftg_user` | `mysql://ftg_user:***@mysql:3306/game1` |
| `miniapps` | `ftg_user` | `mysql://ftg_user:***@mysql:3306/miniapps` |

## 运维命令

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}'    # 容器状态
docker logs -f --tail 100 dashboard-api                 # 查看日志
docker restart dashboard-api                            # 重启服务
cd /opt/ftg/tools/deploy && bash scripts/deploy.sh     # 部署更新
docker exec -it dashboard-api sh                       # 进入容器
df -h /                                                 # 磁盘空间
```

## SSL 证书

- Let's Encrypt 证书，自动续期 (certbot cron)
- 证书路径：`/opt/ftg/tools/deploy/nginx/ssl/`

## 各 Server 详细信息

| 服务 | 端口 | 源码路径 | 生产入口 |
|------|------|----------|----------|
| FTG Server | 3000 | `apps/ftg/server/` | `https://mnapp.top/api/ftl/api/v1/` |
| Game1 Server | 3004 | `apps/game1/server/` | `https://mnapp.top/api/v1/game1/` |
| Tavern Server | 3002 | `apps/tavern/server/` | `https://mnapp.top/api/tavern/` |
| Dashboard Admin | 3001(prod:3003) | `dashboard/server/` | `https://mnapp.top/api/v1/admin/` |

详见各目录 `README.md`。

---

> 最后更新: 2026-05-27
