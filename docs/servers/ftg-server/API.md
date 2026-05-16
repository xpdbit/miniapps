> 🚫 **废弃文档** — 路径已迁移。当前架构移至新路径: `docs/apps/ftg/server/API.md`，此旧文件不再更新。

# servers/ftg-server — API 参考

所有 API 挂载于 `/api/v1` 前缀（生产环境通过 Nginx 重写为 `/api/ftl/api/v1`）。

## 认证

所有端点在 `Authorization: Bearer <token>` 头中携带 JWT token（除登录和健康检查外）。

## 路由表

### 认证

| 方法 | 端点 | 说明 | 认证 |
|------|------|------|------|
| POST | `/auth/login` | 微信 code 登录，返回 JWT | ❌ |
| GET | `/auth/me` | 当前用户信息 | ✅ |

### 用户

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/users/:id` | 用户资料 |
| PUT | `/users/:id` | 更新用户信息 |
| GET | `/leaderboard` | 排行榜 |

### 食物记录

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/food-records` | 创建记录 |
| GET | `/food-records/:id` | 记录详情 |
| GET | `/food-records/user/:userId` | 用户记录列表 |
| DELETE | `/food-records/:id` | 删除记录 |

### 打卡

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/checkins` | 位置打卡 |
| GET | `/checkins/user/:userId` | 用户打卡记录 |
| GET | `/checkins/stats/streak` | 连续打卡天数 |

### 数据统计

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/stats/summary` | 数据汇总 |
| GET | `/stats/calendar` | 日历热力图 |
| GET | `/stats/distribution` | 分类分布 |

### 成就

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/achievements` | 成就列表 |
| POST | `/achievements/check` | 检查并解锁成就 |

### 主题

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/themes` | 主题列表 |
| GET | `/themes/:id` | 主题详情 |
| POST | `/themes` | 创建主题 |
| PUT | `/themes/:id` | 更新主题 |

### Theme Class（CSS Class 管理）

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/theme-classes` | 列表（白名单） |
| POST | `/theme-classes` | 创建 Class |
| PUT | `/theme-classes/:id` | 更新 Class |
| DELETE | `/theme-classes/:id` | 删除 Class |

### 主题渲染

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/theme-render/render` | Markup 模板 → HTML/CSS |
| GET | `/theme-render/preview/:id` | 预览渲染结果 |

### 使用统计

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/theme-usage/log` | 记录使用 |
| GET | `/theme-usage/stats` | 使用统计 + 短链接 |

### 识别服务

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/recognition/recognize` | PP-ShiTuV2 代理识别 |

### 文件上传

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/upload` | 文件上传 (multer) |
| GET | `/upload/uploads/:filename` | 获取上传文件 |

### 健康检查

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/health` | 服务健康检查 |

### 管理接口

| 方法 | 端点 | 说明 | 权限 |
|------|------|------|------|
| GET | `/admin/users` | 用户列表 | admin |
| GET | `/admin/records` | 记录数据 | admin |

### API 密钥

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api-keys` | 创建密钥 |
| GET | `/api-keys` | 密钥列表 |
| DELETE | `/api-keys/:id` | 删除密钥 |

### 定位

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/location/ip` | IP 定位 |

---

## 服务层

| 服务 | 职责 |
|------|------|
| Auth Service | JWT 生成/验证 + 微信 code 交换 |
| User Service | 用户管理 + 排行榜 |
| Food Record Service | 食物记录 CRUD + 分页 |
| Checkin Service | 打卡 + 连续天数计算 |
| Achievement Service | 成就解锁条件判断 |
| Theme Service | 主题 CRUD + 使用统计 |
| Theme Class Service | CSS Class CRUD + 白名单校验 |
| Theme Render Service | Markup 模板 → HTML/CSS 渲染 |
| Recognition Service | PP-ShiTuV2 HTTP 客户端 |
| Pipeline Service | AI 识别流水线编排 |
| Text Generation Service | DashScope AI 文本生成 |
| Share Service | 分享卡片生成 |
| Favorite Service | 收藏记录管理 |
| ApiKey Service | API 密钥管理 |
| Location Service | IP 定位服务 |

---

## 中间件

| 中间件 | 用途 |
|--------|------|
| Auth | JWT 验证，注入 `req.user` |
| AdminGuard | RBAC 管理员权限检查 |
| RateLimit | 按路由的速率限制 |
| Upload | Multer 文件上传配置 |

---

## 外部服务

| 服务 | 协议 | 用途 |
|------|------|------|
| PP-ShiTuV2 (Docker) | HTTP API (port 5000) | 食物识别 |
| DashScope (通义千问) | HTTP API | AI 文本生成 |
| Redis 7 | TCP (port 6379) | 缓存 / 会话 |
| WeChat API | HTTPS | code 换 session_key / openid |

---

> 最后更新: 2026-05-13
> 修改: 首次创建本文档，从 README.md 提取 API 定义
