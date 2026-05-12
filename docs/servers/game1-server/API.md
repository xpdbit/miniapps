# servers/game1-server — API 参考

所有 API 挂载于 `/api/v1/game1` 前缀（生产环境通过 Nginx 代理）。

## 认证

所有端点在 `Authorization: Bearer <token>` 头中携带 JWT token（除登录外）。

## 路由表

### 认证

| 方法 | 端点 | 说明 | 认证 |
|------|------|------|------|
| POST | `/auth/login` | 微信 code 登录，返回 JWT | ❌ |
| GET | `/auth/me` | 当前玩家信息 | ✅ |

### 玩家

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/players/:id` | 玩家资料 |
| PUT | `/players/:id/sync` | 同步游戏数据 |
| GET | `/players/rankings` | 排行榜 |

### 云端存档

| 方法 | 端点 | 说明 |
|------|------|------|
| PUT | `/save/:playerId` | 上传存档（1MB+ 版本检测 + MD5 checksum） |
| GET | `/save/:playerId` | 下载存档 |

### PVP 对战

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/pvp/result` | 提交对战结果（ELO 计算，K=32） |
| GET | `/pvp/leaderboard` | PVP 排行榜（段位：Bronze→Silver→Gold→Platinum→Diamond） |

### 成就

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/achievements/check` | 检查并解锁成就（11 个成就定义） |

### 配置

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/config/:key` | 获取游戏配置（Redis 缓存） |

### 管理

| 方法 | 端点 | 说明 | 权限 |
|------|------|------|------|
| GET | `/admin/players` | 玩家列表管理 | admin |
| GET | `/admin/stats` | 运营数据统计 | admin |

### 社交

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/social/share` | 分享记录 |

---

## 服务层（10 个服务）

| 服务 | 职责 |
|------|------|
| Auth | JWT 生成/验证 + 微信 code 交换 |
| Player | 玩家资料 CRUD + 同步 |
| Save | 云端存档（版本 + checksum 校验） |
| PVP | ELO 评分 + 段位计算 |
| Achievement | 成就条件判定 |
| Config | Redis 缓存配置 |
| Admin | 管理后台接口 |
| Share | 分享日志 |
| Event | 游戏事件记录 |
| Message | 微信订阅消息 |

---

## 核心特性

- **ELO 评分系统**: K=32，5 段位（Bronze→Silver→Gold→Platinum→Diamond）
- **云端存档**: JSON + 版本号 + MD5 checksum，拒绝损坏数据
- **速率限制**: 4 种策略 — 全局（100/min）/ 认证 / 存档 / PVP
- **请求校验**: Zod 3 Schema 验证所有输入
- **CI**: Node 20 + MySQL 8.0 服务容器，lint → type-check → build

---

> 最后更新: 2026-05-13
> 修改: 首次创建本文档
