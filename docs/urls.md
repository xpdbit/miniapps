# URL 引用清单

> **状态**: current
> **更新**: 2026-05-28

> 本文件记录 `.miniapps` 中所有外部 URL 引用及其使用位置。
> 按域名/类别分类，便于追踪和管理。

---

## 一、生产域名（ECS 部署）

| URL | 用途 | 使用位置 |
|-----|------|----------|
| `mnapp.top` | 主域名 — Dashboard SPA + API | `tools/deploy/nginx/nginx.conf`, `domain.config.js` |
| `ftl.mnapp.top` | 旧 FTG 子域名 → 301 重定向到 `mnapp.top` | `tools/deploy/nginx/nginx.conf` |
| `www.mnapp.top` | WWW 别名 → `mnapp.top` | `tools/deploy/nginx/nginx.conf` |
| `game1.mnapp.top` | Game1 子域名 → 301 重定向到 `mnapp.top` | `tools/deploy/nginx/nginx.conf`, `domain.config.js` |
| `47.94.108.150` | ECS 服务器 IP（已迁移至域名 `mnapp.top`） | `domain.config.js`（保留注释）, `tools/deploy/nginx/entrypoint.sh`（证书 SAN） |

### SSH 连接

| 地址 | 用途 | 使用位置 |
|------|------|----------|
| `ssh root@mnapp.top` | ECS SSH 远程管理 | `deploy_remote.bat`, `tools/deploy/scripts/deploy-dashboard.ps1`, `tools/deploy/scripts/deploy-tavern.ps1`, `docs/manual/miniapps-web-repair.md`, `docs/ops/deploy.md` |

### 生产 API 端点

| URL | 后端服务 | 说明 | 使用位置 |
|-----|----------|------|----------|
| `https://mnapp.top/` | Nginx SPA | Dashboard 主页面 | `state/verify-deploy.sh`, `state/verify-fixes.sh`, `tools/deploy/scripts/verify.sh` |
| `https://mnapp.top/api/ftl/api/v1/` | ftg-server:3000 | FTG API（旧路径，当前未部署） | 旧文档 |
| `https://mnapp.top/api/v1/ftl/` | ftg-server:3000 | FTG API（当前 nginx 返回 503） | `tools/deploy/nginx/nginx.conf`, `domain.config.js` |
| `https://mnapp.top/api/v1/ftl` | — | DevTools 测试用地址 | `deploy_remote.bat` |
| `https://mnapp.top/api/v1/game1/` | game1-server:3004 | Game1 API（当前 nginx 返回 503） | `domain.config.js`, `tools/deploy/nginx/nginx.conf` |
| `https://mnapp.top/api/tavern/` | tavern-server:3002 | Tavern API（Nginx 路由） | `tools/deploy/nginx/nginx.conf`, `tools/deploy/docker-compose.yml` |
| `https://mnapp.top/api/v1/tavern/` | tavern-server:3002 | Tavern API（另一种路径格式） | `tools/deploy/nginx/nginx.conf` |
| `https://mnapp.top/api/tavern/health` | tavern-server:3002 | Tavern 健康检查 | `state/verify-fixes.sh`, `docs/manual/miniapps-web-repair.md` |
| `https://mnapp.top/api/v1/tavern/health` | tavern-server:3002 | Tavern 健康检查（v1 路径） | `state/verify-deploy.sh` |
| `https://mnapp.top/api/v1/tavern/admin/dashboard/stats` | tavern-server:3002 | Tavern 管理统计 | `state/verify-deploy.sh` |
| `https://mnapp.top/api/admin/` | admin:3001 | Dashboard Admin API | `tools/deploy/nginx/nginx.conf`, `tools/deploy/scripts/deploy.sh` |
| `https://mnapp.top/api/v1/admin/` | admin:3001 | Dashboard Admin API（旧路径） | `tools/deploy/nginx/nginx.conf` |
| `https://mnapp.top/api/admin/tavern/dashboard/stats` | admin:3001 → tavern-server:3002 | Admin 代理统计 | `state/verify-deploy.sh` |

---

## 二、微信小程序相关

| URL | 用途 | 使用位置 |
|-----|------|----------|
| `https://mp.weixin.qq.com` | 微信公众平台（AppSecret、合法域名配置） | `tools/deploy/scripts/deploy_commands.sh` |
| `https://api.weixin.qq.com/sns/jscode2session` | 微信登录 code2session 接口 | `plan/tasks/*/s06-auth-authz.md`, `plan/tasks/*/at03-auth-wechat.md`, `plan/tasks/*/s04-auth-wechat-login.md` |
| `https://api.weixin.qq.com/cgi-bin/token` | 微信全局 access_token 获取 | `plan/tasks/*/s11-social-message.md` |
| `https://api.weixin.qq.com/cgi-bin/message/subscribe/send` | 微信订阅消息推送 | `plan/tasks/*/s11-social-message.md` |
| `https://developers.weixin.qq.com/...` | 微信开发者工具下载 | `DEVELOPMENT.md` |
| `https://mnapp.top` | 小程序 request/uploadFile 合法域名 | `tools/deploy/scripts/deploy_commands.sh` |

---

## 三、外部服务

### AI Provider API 端点

| URL | Provider | 说明 | 使用位置 |
|-----|----------|------|----------|
| `https://dashscope.aliyuncs.com` | 通义千问 (DashScope) | 阿里云 AI 服务 | `docs/ops/ftg-server/README.md`, `docs/ops/tavern-server/README.md`, `plan/tasks/*/s09-ai-text-generation.md`, `plan/tasks/*/m05-textgen.md` |
| `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | DashScope | 阿里云 OpenAI 兼容模式 | `docs/apps/tavern/client/README.md` |
| `https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation` | DashScope | 原生通义千问 API | `plan/tasks/*/s09-ai-text-generation.md`, `plan/tasks/*/at07-ai-chat-engine.md` |
| `https://api.openai.com` | OpenAI | ChatGPT/GPT-4 | `docs/apps/tavern/client/README.md`, `plan/tasks/*/at07-ai-chat-engine.md` |
| `https://api.deepseek.com` | DeepSeek | DeepSeek V3/R1 | `docs/apps/tavern/client/README.md`, `plan/test/tavern/README.md`, `plan/tasks/*/at07-ai-chat-engine.md` |
| `https://api.anthropic.com` | Anthropic | Claude 系列 | `docs/apps/tavern/client/README.md` |
| `https://generativelanguage.googleapis.com` | Google | Gemini 系列 | `docs/apps/tavern/client/README.md` |
| `https://open.bigmodel.cn` | 智谱 (BigModel) | GLM/ChatGLM | `docs/apps/tavern/client/README.md` |
| `https://api.moonshot.cn` | 月之暗面 (Moonshot) | Kimi 系列 | `docs/apps/tavern/client/README.md` |
| `https://api.minimaxi.com` | MiniMax | abab 系列（旧端点） | `docs/apps/tavern/client/README.md` |
| `https://api.minimax.io` | MiniMax | abab 系列（新端点） | `plan/reports/2026-05-21-tavern-minimax-fix.md` |
| `https://openrouter.ai` | OpenRouter | 聚合多模型路由 | `docs/apps/tavern/client/README.md`, `plan/tasks/*/at07-ai-chat-engine.md` |
| `https://opencode.ai/zen/go/v1` | OpenCode Go | DeepSeek / MiniMax 免费模型 | `apps/tavern/server/.env`, `tools/deploy/.env.example`, `plan/reports/ai-generation-flow.md` |
| `https://opencode.ai/zen/go/v1/chat/completions` | OpenCode Go | LLM API 端点 | `plan/reports/ai-generation-flow.md` |

### 开发工具 / 资源

| URL | 用途 | 使用位置 |
|-----|------|----------|
| `https://docs.docker.com/get-docker/` | Docker 安装文档 | `apps/ftg/server/scripts/docker-start.sh` |
| `https://www.docker.com/products/docker-desktop/` | Docker Desktop 下载 | `tools/local_server/dev_console.py` |
| `https://aka.ms/terminal` | Windows Terminal 下载 | `tools/local_server/dev_console.py` |
| `https://get.acme.sh` | acme.sh SSL 证书工具 | `tools/deploy/scripts/setup-ssl.sh` |
| `http://ip-api.com` | IP 地理定位服务（服务端） | `docs/apps/ftg/server/API.md` |
| `https://apis.map.qq.com/ws/location/v1/ip` | 腾讯地图 IP 定位（微信小程序端） | `apps/ftg/client/src/constants/apiEndpoints.ts` |
| `https://apis.map.qq.com/ws/geocoder/v1` | 腾讯地图反向地理编码 | `apps/ftg/client/src/utils/location/locationService.ts` |
| `https://ipwho.cn/json` | ipwho 备用 IP 定位（H5 环境 fallback） | `apps/ftg/client/src/utils/location/locationService.ts` |
| `https://docs.cloudbase.net/run/` | CloudBase CloudRun 文档 | `plan/tasks/*/t04-ai-food-recognition.md` |

### GitHub 仓库引用

| URL | 用途 | 使用位置 |
|-----|------|----------|
| `https://github.com/PaddlePaddle/PaddleClas/blob/release/2.6/docs/zh_CN/models/PP-ShiTu/README.md` | PP-ShiTuV2 文档 | `plan/tasks/*/t04-ai-food-recognition.md` |
| `https://github.com/PaddlePaddle/PaddleClas/blob/release/2.6/docs/zh_CN/deployment/PP-ShiTu/paddle_serving.md` | Paddle Serving 部署 | `plan/tasks/*/t04-ai-food-recognition.md` |
| `https://github.com/songquanpeng/one-api` | One API 开源项目 | `apps/tavern/server/prisma/seed-models.ts` |

### 占位符 / 示例 URL

| URL | 用途 | 使用位置 |
|-----|------|----------|
| `https://your-domain.com/api/v1/game1` | 占位 — Game1 生产地址示例 | `plan/tasks/*/g12b-http-auth.md` |
| `https://your-domain.com/api/v1/health` | 占位 — 健康检查示例 | `plan/tasks/*/at20-deployment.md` |
| `https://admin.example.com` | 占位 — CORS 示例 | `plan/tasks/*/s15-nginx-proxy.md` |
| `https://ftg.example.com/theme/zelda-kitchen` | 占位 — 分享链接示例 | `plan/tasks/*/t07-usage-tracking.md` |
| `https://your-*.example.com` | 占位 — 环境变量示例 | `.env.production` |

---

## 四、本地开发

### 本地 Server 端口

| URL / 端口 | 服务 | 使用位置 |
|-----------|------|----------|
| `http://localhost:3000` | FTG Server | `domain.config.js`, `apps/ftg/server/scripts/docker-start.sh`, `.opencode/start-services.ps1`, `docs/manual/miniapps-web-repair.md` |
| `http://localhost:3000/api/v1` | FTG API 基础路径 | `domain.config.js`, `dashboard/.env` (VITE_API_BASE_URL) |
| `http://localhost:3000/health` | FTG 健康检查 | `apps/ftg/server/scripts/docker-start.sh`, `docs/manual/miniapps-web-repair.md` |
| `http://localhost:3001` | Dashboard Admin API / Grafana（监控栈） | `domain.config.js`, `vite.config.ts` (proxy), `tools/deploy/nginx/nginx.conf`, `apps/ftg/server/docker-compose.monitoring.yml` |
| `http://localhost:3002` | Tavern Server | `domain.config.js`, `vite.config.ts` (proxy), `.opencode/start-services.ps1`, `docs/manual/miniapps-web-repair.md` |
| `http://localhost:3002/health` | Tavern 健康检查 | `.opencode/start-services.ps1` |
| `http://localhost:3002/api/v1` | Tavern API 基础路径 | `dashboard/.env` (TAVERN_API_URL) |
| `http://localhost:3004` | Game1 Server | `domain.config.js`, `vite.config.ts` (proxy), `.opencode/start-services.ps1` |
| `http://localhost:3004/api/v1/game1` | Game1 API 基础路径 | `dashboard/.env` (GAME1_API_URL) |
| `http://localhost:3004/health` | Game1 健康检查 | `.opencode/start-services.ps1` |
| `http://localhost:5173` | Dashboard Vite 前端 | `domain.config.js`, `.opencode/start-services.ps1`, `docs/manual/miniapps-web-repair.md`, `docs/manual/dashboard-test-repair.md` |
| `http://localhost:5174` | Tavern H5 Web（Vite） | `apps/tavern/client/playwright.config.ts`, `apps/tavern/client/e2e/desktop-verification.spec.ts` |
| `http://localhost:5000` | PP-ShiTuV2 本地（Docker 内部） | `apps/ftg/server/scripts/docker-start.sh` |
| `http://localhost:9090` | Prometheus（监控栈） | `apps/ftg/server/docker-compose.monitoring.yml` |

### Vite Dev Server 代理目标（`dashboard/vite.config.ts`）

| 代理规则 | 目标 | 说明 |
|---------|------|------|
| `/api/admin` | `http://localhost:3001` | Admin API 代理（3001） |
| `/api/auth` | `http://localhost:3001` | 统一认证 API（3001） |
| `/api/tavern` | `http://localhost:3002` | Tavern API 代理（rewrite /api/tavern → /api） |
| `/api/v1/game1` | `http://localhost:3004` | Game1 API 代理 |
| `/api` | `http://localhost:3000` | 通用 API 代理（兜底，放最后） |

### 本地数据库连接字符串

| 连接串 | 数据库 | 使用位置 |
|--------|--------|----------|
| `mysql://dev_user:dev_pass_123@localhost:3307/miniapps` | miniapps（Dashboard） | `dashboard/.env` (MINIAPPS_DATABASE_URL) |
| `mysql://dev_user:dev_pass_123@localhost:3307/food_theme_generator` | food_theme_generator (FTG) | `dashboard/.env` (FTG_DATABASE_URL) |
| `mysql://dev_user:dev_pass_123@localhost:3306/ai_tavern` | ai_tavern (Tavern) | `apps/tavern/server/.env` (DATABASE_URL) |
| `redis://localhost:6379` | Redis 缓存 | `apps/tavern/server/.env` (REDIS_URL) |

### 本地 Docker 基础设施

| 服务 | 端口（宿主机） | 内部端口 |
|------|---------------|---------|
| MySQL 8.0 | 3307 | 3306 |
| Redis 7 | 6379 | 6379 |

---

## 五、Docker 内部网络（`tools/deploy/docker-compose.yml`）

| URL | 用途 |
|-----|------|
| `http://tavern-server:3002` | Nginx upstream → Tavern Server |
| `http://admin:3001` | Nginx upstream → Dashboard Admin API（compose 服务名 `admin`） |
| `http://dashboard_admin` | Nginx upstream 名称（指向 `admin:3001`） |
| `http://tavern_server` | Nginx upstream 名称（指向 `tavern-server:3002`） |
| `mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@mysql:3306/ai_tavern?connection_limit=10&pool_timeout=10` | Tavern → MySQL（内部网络） |
| `mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@mysql:3306/food_theme_generator?connection_limit=4&pool_timeout=10` | Dashboard Admin → MySQL |

### Docker 内部脚本测试端点

| URL | 脚本 | 用途 |
|-----|------|------|
| `http://tavern-server:3002/health` | `state/test-endpoints.sh`, `state/test-apis.sh` | 容器内直连验证 |
| `http://tavern-server:3002/v1/characters` | `state/test-endpoints.sh`, `state/test-apis.sh` | 角色 API 直连 |
| `http://tavern-server:3002/api/v1/characters` | `state/test-apis.sh` | 角色 API（api/v1 路径） |
| `http://tavern-server:3002/v1/admin/dashboard/stats` | `state/test-endpoints.sh`, `state/test-apis.sh` | dashboard stats |
| `http://tavern-server:3002/api/v1/admin/dashboard/stats` | `state/test-apis.sh` | dashboard stats（api/v1） |
| `http://tavern-server:3002/v1/admin/model-stats` | `state/test-endpoints.sh` | model-stats |
| `http://dashboard-api:3001/api/admin/tavern/characters` | `state/test-endpoints.sh`, `state/test-apis.sh`, `state/fix-proxy.sh`, `state/final-deploy-test.sh`, `state/update-admin-token.sh` | Admin 代理角色接口 |
| `http://dashboard-api:3001/api/admin/tavern/dashboard/stats` | 同上 + `state/verify-deploy.sh` | Admin 代理统计接口 |

### Nginx 内部代理端点（`tools/deploy/nginx/nginx.conf`）

| Location | Upstream | 说明 |
|----------|----------|------|
| `^~ /api/admin/` | `http://dashboard_admin` | Admin API 代理（HTTP + HTTPS） |
| `^~ /api/v1/admin/` | `http://dashboard_admin` | Admin API 代理（v1 路径） |
| `^~ /api/tavern/` | `http://tavern_server/` | Tavern API 代理 |
| `^~ /api/v1/tavern/` | `http://tavern_server/` | Tavern API 代理（v1 路径） |
| `^~ /api/v1/ftl/` | — | FTG API（当前返回 503） |
| `^~ /api/v1/game1/` | — | Game1 API（当前返回 503） |

---

## 六、监控栈（`apps/ftg/server/docker-compose.monitoring.yml`）

| URL | 服务 | 说明 |
|-----|------|------|
| `http://localhost:9090` | Prometheus | 指标存储，主机 9090 → 容器 9090 |
| `http://localhost:3001` | Grafana | 可视化面板（端口 3001 避免与 FTG Server 3000 冲突） |
| `http://host.docker.internal:3000` | FTG Server | Prometheus 抓取目标（macOS/Windows Docker Desktop） |
| `http://prometheus:9090` | Prometheus | Grafana 数据源 URL（Docker 内部网络） |

---

## 七、SSL 证书

| URL | 用途 | 使用位置 |
|-----|------|----------|
| `https://get.acme.sh` | acme.sh 安装 | `tools/deploy/scripts/setup-ssl.sh` |
| `http://mnapp.top/.well-known/acme-challenge/` | ACME HTTP-01 验证 | `tools/deploy/nginx/nginx.conf` |
| `certbot certonly —preferred-challenges dns —authenticator dns-aliyun` | DNS-01 验证 | `tools/deploy/scripts/setup-ssl.sh` |

### 自签名证书 SAN 条目（`tools/deploy/nginx/entrypoint.sh`）

```
DNS:mnapp.top, DNS:*.mnapp.top, DNS:ftl.mnapp.top, DNS:game1.mnapp.top, DNS:www.mnapp.top, IP:47.94.108.150
```

---

## 八、CORS 白名单

| 来源 | 环境 | 定义位置 |
|------|------|----------|
| `https://mnapp.top` | 生产 | `domain.config.js`, `tools/deploy/.env.example` (CORS_ORIGINS) |
| `https://ftl.mnapp.top` | 生产 | `domain.config.js` |
| `https://game1.mnapp.top` | 生产 | `domain.config.js` |
| `http://localhost:3000` | 本地 | `domain.config.js`, `apps/tavern/server/.env` (CORS_ORIGIN) |
| `http://localhost:3001` | 本地 | `domain.config.js` |
| `http://localhost:3002` | 本地 | `domain.config.js` |
| `http://localhost:3004` | 本地 | `domain.config.js`, `apps/tavern/server/.env` |
| `http://localhost:5173` | 本地 | `domain.config.js`, `apps/tavern/server/.env` |
| `http://localhost:5174` | 本地 | `apps/tavern/server/.env` |

---

## 九、domain.config.js 动态 URL

| 项目 | 开发环境（DevTools） | 生产环境（真机调试/上线） |
|------|---------------------|--------------------------|
| FTG | `http://localhost:3000/api/v1` | `https://mnapp.top/api/v1/ftl` |
| Game1 | `http://localhost:3004/api/v1/game1` | `https://mnapp.top/api/v1/game1` |
| Tavern | `http://localhost:3002/api/v1/tavern` | `https://mnapp.top/api/v1/tavern` |

切换环境命令：

```bash
npm run dev:weapp           # 自动用 localhost（默认）
npm run dev:weapp:remote    # 用 mnapp.top（真机调试）
npm run build:weapp:prod    # 用 mnapp.top（生产构建）
```

---

> 最后更新: 2026-05-31
> 修改: 修复 local_server/dev_console.py 引用路径 → tools/local_server/dev_console.py
