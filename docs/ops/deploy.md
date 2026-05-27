# 部署指南

> **状态**: current
> **更新**: 2026-05-27
> ECS_100 (2c/2g/3MB/s) — mnapp.top

## 瓶颈说明

ECS_100 带宽仅 **3MB/s**，Docker 构建涉及两次大规模下载：

| 阶段 | 大小 | 耗时 |
|------|------|------|
| `apt-get update` | ~9MB | 3-6 分钟 |
| `npm install` | ~80MB | 30-45 秒（已缓存则跳过） |

## 部署方案

### 方案 A: `docker cp` 热更新（推荐 · 纯代码变更）

**适用**: 仅修改 `.ts` 源文件，无 npm 依赖变更。耗时 <30 秒。

```bash
# 本地 → 服务器
scp apps/tavern/server/src/services/*.ts root@mnapp.top:/opt/ftg/apps/tavern/server/src/services/

# 服务器: 注入容器 + 重启
ssh root@mnapp.top "
  docker cp /opt/ftg/apps/tavern/server/src/services/model-discovery.service.ts tavern-server:/app/src/services/
  docker cp /opt/ftg/apps/tavern/server/src/services/ai-proxy.service.ts tavern-server:/app/src/services/
  docker restart tavern-server
"
```

> **注意**: `docker compose down/up` 会重建容器丢失注入，届时需重新执行或改用方案 B。

### 方案 B: `docker compose build` 完整重建

**适用**: npm 依赖变更、Dockerfile 变更、首次部署。耗时 8-15 分钟。

```bash
git push origin main
ssh root@mnapp.top "cd /opt/ftg && git pull"

# 后台构建（避免 SSH 超时）
ssh root@mnapp.top "
  cd /opt/ftg/deploy
  nohup docker compose --env-file .env up -d --build tavern-server > /tmp/build-tavern.log 2>&1 &
"
```

### 方案 C: 本地构建 + 推送镜像

**适用**: 频繁构建、网络极差、多服务同时更新。

```bash
# 本地构建
docker build -t deploy-tavern-server:latest -f apps/tavern/server/Dockerfile apps/tavern/server/
docker save deploy-tavern-server:latest | gzip > tavern-server.tar.gz
scp tavern-server.tar.gz root@mnapp.top:/tmp/

# 服务器加载
ssh root@mnapp.top "
  docker load < /tmp/tavern-server.tar.gz
  cd /opt/ftg/deploy
  docker compose --env-file .env up -d tavern-server
"
```

## 构建加速

```bash
# 清理重复进程
ssh root@mnapp.top "pkill -f 'docker compose'"

# 替换 apt 源（建议纳入 Dockerfile）
# RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources
```

## 部署检查清单

- [ ] `docker ps --filter name=tavern-server`
- [ ] `curl -s -o /dev/null -w '%{http_code}' http://localhost/api/tavern/health` → 200
- [ ] `docker logs --tail 20 tavern-server | grep -i error`
- [ ] `curl -s -o /dev/null -w '%{http_code}' https://mnapp.top/api/tavern/health` → 200

---

> 最后更新: 2026-05-27
