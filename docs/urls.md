# URL 引用清单

> 本文件记录 `.miniapps` 中所有外部 URL 引用及其使用位置。
> 按域名/类别分类，便于追踪和管理。

---

## 一、生产域名（ECS 部署）

| URL | 用途 | 使用位置 |
|-----|------|----------|
| `mnapp.top` | 主域名 — Dashboard SPA + FTG API + Admin API | `deploy/nginx/nginx.conf`, `domain.config.js` |
| `ftl.mnapp.top` | 旧 FTG 子域名 → 301 重定向到 `mnapp.top` | `deploy/nginx/nginx.conf` |
| `www.mnapp.top` | WWW 别名 → `mnapp.top` | `deploy/nginx/nginx.conf` |
| `game1.mnapp.top` | Game1 前台 SPA | `domain.config.js`, `deploy/nginx/nginx.conf` |
| `47.94.108.150` | ECS 服务器 IP（已迁移至域名 `mnapp.top`） | `domain.config.js`（保留注释） |

### 生产 API 端点

| URL | 后端服务 | 说明 |
|-----|----------|------|
| `https://mnapp.top/api/ftl/api/v1/` | ftg-server:3000 | FTG API |
| `https://mnapp.top/api/ftl/health` | ftg-server:3000 | FTG 健康检查 |
| `https://mnapp.top/api/ftl/recognition/*` | ppshituv2:5000 | 识别服务代理 |
| `https://mnapp.top/api/v1/game1/` | game1-server:3001 | Game1 API |
| `https://mnapp.top/game1/health` | game1-server:3001 | Game1 健康检查 |
| `https://mnapp.top/api/tavern/` | tavern-server:3002 | Tavern API |
| `https://mnapp.top/api/v1/admin/` | ftg-admin:3001 | Admin API |
| `https://mnapp.top/phpmyadmin/` | phpmyadmin | MySQL 管理 |

---

## 二、微信小程序相关

| URL | 用途 | 使用位置 |
|-----|------|----------|
| `https://mp.weixin.qq.com` | 微信公众平台（AppSecret、合法域名） | 部署脚本 |
| `https://developers.weixin.qq.com/...` | 微信开发者工具下载 | DEVELOPMEMT.md |
| `https://mnapp.top` | 小程序 request/uploadFile 合法域名 | 部署脚本 |

---

## 三、外部服务

| URL | 用途 | 使用位置 |
|-----|------|----------|
| `https://docs.docker.com/get-docker/` | Docker 安装文档 | docker-start.sh |
| `https://opencode.ai/zen/go/v1` | OpenCode AI API endpoint | tavern-server .env |
| `https://get.acme.sh` | acme.sh SSL 证书工具 | setup-ssl.sh |
| `http://ip-api.com` | IP 地理定位服务 | API.md 注释 |
| `https://your-*.example.com` | 占位符端点 | .env.production |

---

## 四、本地开发

| URL | 用途 | 使用位置 |
|-----|------|----------|
| `http://localhost:3000` | FTG Server 本地开发 | `apps/ftg/server/.env` |
| `http://localhost:5173` | Vite 开发服务器（CORS） | `apps/game1/server/.env` |
| `http://localhost:5000` | PP-ShiTuV2 本地 | docker-start.sh |
| `http://localhost:9090` | Prometheus（监控栈） | docker-compose.monitoring.yml |
| `http://localhost:3001` | Grafana（监控栈） | docker-compose.monitoring.yml |

---

## 五、Docker 内部网络

| URL | 用途 | 使用位置 |
|-----|------|----------|
| `http://ppshituv2:5000` | Docker 内部识别服务 | `deploy/docker-compose.yml` |
| `http://phpmyadmin:80/` | Docker 内部 phpMyAdmin | `deploy/nginx/nginx.conf` |
| `mysql://...@mysql:3306/...` | MySQL 数据库连接 | `deploy/docker-compose.yml` |
| `redis://redis:6379` | Redis 缓存连接 | `deploy/docker-compose.yml` |
| `http://ftg-server:3000` | Nginx→FTG Server 代理 | nginx.conf |
| `http://admin:3001` | Dashboard Nginx→Admin API | deploy/nginx/nginx.conf (upstream dashboard_admin) |

---

## 六、CI/CD（GitHub Actions）

| Action | 用途 |
|--------|------|
| `actions/checkout@v4` | 代码检出 |
| `actions/setup-node@v4` | Node.js 环境配置 |
| `docker/setup-buildx-action@v3` | Docker Buildx |
| `docker/build-push-action@v6` | Docker 构建推送 |
| `docker/login-action@v3` | 容器仓库登录 |
| `docker/metadata-action@v5` | Docker 标签元数据 |
| `actions/upload-artifact@v4` | 构建产物上传 |

---

## 七、SSL 证书

| URL | 用途 | 使用位置 |
|-----|------|----------|
| `https://get.acme.sh` | acme.sh 安装 | setup-ssl.sh |
| `http://mnapp.top/.well-known/acme-challenge/` | ACME HTTP-01 验证 | setup-ssl.sh |

---

## 八、domain.config.js 动态 URL

| 项目 | 开发环境 | 生产环境 |
|------|----------|----------|
| FTG | `https://mnapp.top/api/ftl/api/v1` | `https://mnapp.top/api/ftl/api/v1` |
| Game1 | `https://mnapp.top/api/v1/game1` | `https://mnapp.top/api/v1/game1` |
| Tavern | `https://mnapp.top/api/tavern/api/v1` | `https://mnapp.top/api/tavern/api/v1` |

CORS 白名单：`mnapp.top`, `ftl.mnapp.top`, `game1.mnapp.top`

---

> 最后更新: 2026-05-18
> 修改: 从 url 文件转为 urls.md 格式，精简冗余引用
