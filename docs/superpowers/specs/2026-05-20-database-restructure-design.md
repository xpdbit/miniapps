# 数据库重构设计方案

> **状态**: 已确认  
> **日期**: 2026-05-20  
> **关联**: ULW Loop — 全流程实施

---

## 一、背景与目标

### 现状问题

| 问题 | 详情 |
|------|------|
| 表结构混乱 | 4 个数据库职责不清，`miniapps` 混存 FTG + Tavern + Dashboard 三套表 |
| Schema 重复 | 3 套 Prisma Schema 各自定义 `SharedUser`，字段不完全一致 |
| 认证孤岛 | Dashboard 用 `dashboard_admin_users`，小程序用 `shared_users`，两套体系不互通 |
| 用户权限混乱 | `remoter_user` 只被手动授权了部分表，看不到 `shared_users` / `dashboard_*` |
| 跨库引用 | `tavern-server` DATABASE_URL 指向 `miniapps` 而非 `ai_tavern` |

### 目标

1. **清晰库边界**: 每个项目独立数据库，公用数据进 `miniapps`
2. **统一用户系统**: 一套 `users` 表 + 多认证绑定（密码/微信/手机号）
3. **统一 JWT**: 所有服务共享密钥，跨项目 Token 互通
4. **Dashboard 管理员合一**: 管理员也是 `users` 的一条记录
5. **全量迁移**: 保留存量数据

---

## 二、数据库边界

```
┌─────────────────────────────────────────────────────┐
│                   MySQL 8.0 (ECS)                    │
├───────────────┬──────────────┬───────────┬──────────┤
│   miniapps    │food_theme_   │ ai_tavern │  game1   │
│   (公用库)    │ generator    │ (Tavern)  │  (不动)  │
│   5 张表      │ (FTG) 11 表  │ 13 张表   │  7 张表   │
└───────────────┴──────────────┴───────────┴──────────┘
```

### 各库职责

| 库 | 表数 | 职责 |
|---|---|---|
| `miniapps` | 5 | 用户身份、认证方式、登录会话、Dashboard 项目注册、审计日志 |
| `food_theme_generator` | 11 | FTG 全部业务表（食物记录/打卡/成就/主题/Class/流水线/收藏/APIKey/打卡统计） |
| `ai_tavern` | 13 | Tavern 全部业务表（角色卡/点赞/收藏/人设/聊天/审核/APIKey/模型/用户等级/用户扩展） |
| `game1` | 7 | 不动（players/cloud_saves/pvp_matches/pvp_rankings/achievements/share_logs/configs） |

### 跨库引用规则

- **UUID 软引用**: 所有项目表用 `user_uuid VARCHAR(36)` 引用 `miniapps.users.uuid`
- **无物理外键**: 不在 MySQL 层建跨库 FOREIGN KEY
- **应用层保证**: 注册时先建 `users` 记录，再建项目库记录；删除用户时级联清理各项目数据

---

## 三、`miniapps` 公用库

### `users` — 核心身份

```sql
CREATE TABLE users (
  id          CHAR(36)     PRIMARY KEY,
  uuid        VARCHAR(36)  NOT NULL UNIQUE,
  nickname    VARCHAR(64)  DEFAULT NULL,
  avatar_url  VARCHAR(512) DEFAULT NULL,
  role        ENUM('user','admin','super_admin') NOT NULL DEFAULT 'user',
  status      ENUM('active','disabled') NOT NULL DEFAULT 'active',
  meta        JSON         DEFAULT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_uuid (uuid),
  INDEX idx_role (role)
);
```

**关键设计**:
- `id` = 内部主键，`uuid` = 对外暴露标识（存于项目表 `user_uuid` 字段）
- `role` 区分普通用户和管理员，Dashboard 登录后据此鉴权
- 不含任何认证方式字段（密码/openid/手机号），这些在 `user_auths`

### `user_auths` — 多认证方式 (1:N)

```sql
CREATE TABLE user_auths (
  id          CHAR(36)     PRIMARY KEY,
  user_uuid   VARCHAR(36)  NOT NULL,
  auth_type   ENUM('password','wechat','phone') NOT NULL,
  credential  VARCHAR(255) NOT NULL,
  verified_at DATETIME     DEFAULT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_uuid (user_uuid),
  UNIQUE INDEX idx_type_credential (auth_type, credential)
);
```

**示例数据**:

| user_uuid | auth_type | credential |
|-----------|-----------|------------|
| `u-aaa` | `wechat` | `oxxx_openid_1` |
| `u-aaa` | `password` | `$2b$10$xxxxx` |
| `u-bbb` | `password` | `$2b$10$yyyyy` |
| `u-bbb` | `phone` | `13800138000` |

### `user_sessions` — 登录会话

```sql
CREATE TABLE user_sessions (
  id            CHAR(36)     PRIMARY KEY,
  user_uuid     VARCHAR(36)  NOT NULL,
  refresh_token VARCHAR(255) NOT NULL UNIQUE,
  device_info   JSON         DEFAULT NULL,
  expires_at    DATETIME     NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_uuid (user_uuid),
  INDEX idx_expires (expires_at)
);
```

### `dashboard_projects` + `dashboard_audit_logs`

保持不变，沿用当前结构。`audit_logs` 的 `admin_id` 字段改为 `user_uuid`。

### miniapps 库汇总

| 表 | 说明 | 与旧结构关系 |
|---|---|---|
| `users` | 核心身份 + 管理员合一 | 🆕 替代 `shared_users` + `dashboard_admin_users` |
| `user_auths` | 多认证绑定 | 🆕 替代内嵌的 openid/phone |
| `user_sessions` | 登录态 | 🆕 |
| `dashboard_projects` | 项目注册 | ➖ 不变 |
| `dashboard_audit_logs` | 审计日志 | ✏ `admin_id` → `user_uuid` |

---

## 四、`food_theme_generator` 库 (FTG)

### 表清单 (11 张)

| 表 | 说明 | 变化 |
|---|---|---|
| `ftg_food_records` | 食物记录 | ✏ `user_id` → `user_uuid` |
| `ftg_checkins` | 打卡记录 | ✏ `user_id` → `user_uuid` |
| `ftg_achievements` | 成就定义 | ➖ 不变（无 user 引用） |
| `ftg_user_achievements` | 用户成就关联 | ✏ `user_id` → `user_uuid` |
| `ftg_themes` | 主题定义 | ➖ 不变 |
| `ftg_theme_classes` | CSS Class 定义 | ➖ 不变 |
| `ftg_theme_usage_logs` | 主题使用日志 | ✏ `user_id` → `user_uuid` |
| `ftg_pipeline_statuses` | AI 流水线状态 | ✏ `user_id` → `user_uuid` |
| `ftg_favorites` | 收藏 | ✏ `user_id` → `user_uuid` |
| `ftg_api_keys` | FTG 服务 API 密钥 | ➖ 不变（无 user 引用） |
| `ftg_checkin_streaks` | 🆕 打卡连续天数 | 新增 |

### 关键字段变更

```sql
-- 旧
user_id VARCHAR(36) NOT NULL  -- Prisma: @relation → SharedUser

-- 新
user_uuid VARCHAR(36) NOT NULL  -- → miniapps.users.uuid, 无 @relation
INDEX idx_user_uuid (user_uuid)
```

### `ftg_checkin_streaks` (新增)

```sql
CREATE TABLE ftg_checkin_streaks (
  user_uuid       VARCHAR(36) NOT NULL PRIMARY KEY,
  current_streak  INT         NOT NULL DEFAULT 0,
  longest_streak  INT         NOT NULL DEFAULT 0,
  last_checkin_date DATE      DEFAULT NULL
);
```

---

## 五、`ai_tavern` 库 (Tavern)

### 表清单 (13 张)

| 表 | 说明 | 变化 |
|---|---|---|
| `tavern_cards` | 角色卡 | ✏ `creatorId` → `user_uuid` |
| `tavern_card_likes` | 点赞 | ✏ `userId` → `user_uuid` |
| `tavern_card_favs` | 收藏 | ✏ `userId` → `user_uuid` |
| `tavern_card_revisions` | 版本历史 | ➖ 不变 |
| `tavern_personas` | 用户人设 | ✏ `userId` → `user_uuid` |
| `tavern_chat_sessions` | 聊天会话 | ✏ `userId` → `user_uuid` |
| `tavern_chat_messages` | 聊天消息 | ➖ 不变（无 user 引用） |
| `tavern_moderation_logs` | 审核日志 | ✏ `operatorId` → `user_uuid` |
| `tavern_api_keys` | 用户 API Key | ✏ `userId` → `user_uuid` |
| `tavern_model_meta` | AI 模型元数据 | ➖ 不变 |
| `tavern_user_tiers` | 用户等级/配额 | ✏ 重构：加入 `daily_quota_max` / `daily_quota_used` |
| `tavern_user_profiles` | 🆕 用户偏好 | 新增 |

### `tavern_user_tiers` (重构)

```sql
CREATE TABLE tavern_user_tiers (
  user_uuid        VARCHAR(36) NOT NULL PRIMARY KEY,
  tier             ENUM('FREE','PAID','TESTER') NOT NULL DEFAULT 'FREE',
  level            INT NOT NULL DEFAULT 1,
  xp               INT NOT NULL DEFAULT 0,
  xp_to_next       INT NOT NULL DEFAULT 100,
  max_sessions     INT NOT NULL DEFAULT 5,
  max_characters   INT NOT NULL DEFAULT 3,
  max_personas     INT NOT NULL DEFAULT 2,
  daily_quota_max  INT NOT NULL DEFAULT 20,    -- 🆕 每日配额上限
  daily_quota_used INT NOT NULL DEFAULT 0,     -- 🆕 当日已用
  permissions      JSON DEFAULT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

- 每日配额计数器 0 点由定时任务重置 (`UPDATE ... SET daily_quota_used = 0`)
- 不单独建 `tavern_user_usage_daily` 表

### `tavern_user_profiles` (新增)

```sql
CREATE TABLE tavern_user_profiles (
  user_uuid        VARCHAR(36) NOT NULL PRIMARY KEY,
  default_model    VARCHAR(64) DEFAULT NULL,
  default_temp     FLOAT DEFAULT NULL,
  preferred_locale VARCHAR(16) DEFAULT 'zh-CN',
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## 六、Prisma Schema 重组

从 3 套拆为 4 套，每库独立 Schema：

```
prisma/
├── schema-miniapps.prisma              # → miniapps 库 (5 models)
├── schema-food-theme-generator.prisma  # → food_theme_generator 库 (11 models)
├── schema-game1.prisma                 # → game1 库 (7 models, 不动)

apps/tavern/server/prisma/
└── schema.prisma                       # → ai_tavern 库 (13 models)
```

### 各 Schema datasource

```prisma
// schema-miniapps.prisma
datasource db {
  provider = "mysql"
  url      = env("MINIAPPS_DATABASE_URL")
}

// schema-food-theme-generator.prisma
datasource db {
  provider = "mysql"
  url      = env("FTG_DATABASE_URL")
}

// schema-game1.prisma
datasource db {
  provider = "mysql"
  url      = env("GAME1_DATABASE_URL")
}

// apps/tavern/server/prisma/schema.prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")  // → ai_tavern 库
}
```

### 关键规则

- **所有 Schema 不定义跨库 model**: 项目 Schema 不含 `User` model，`user_uuid` 声明为 `String`（无 `@relation`）
- **Dashboard 只用 `schema-miniapps.prisma`**: 查项目数据走 Admin API 代理
- **`binaryTargets` 统一**: `["native", "linux-musl-openssl-3.0.x", "debian-openssl-3.0.x"]`

---

## 七、认证系统

### 架构

```
                    ┌─────────────────────┐
                    │   miniapps.users     │
                    │   miniapps.user_auths │
                    │   miniapps.user_sessions │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
     │  FTG Server  │  │Tavern Server│  │  Dashboard   │
     │  验证 JWT     │  │ 验证 JWT     │  │ 验证 JWT     │
     │ 查 user_uuid  │  │ 查 user_uuid │  │ 查 user+role  │
     └─────────────┘  └─────────────┘  └─────────────┘
```

- **JWT_SECRET 全局共享**: 所有服务用同一个密钥签发和验证
- **access_token**: 短期 15min，payload: `{ sub: user_uuid, role: user_role }`
- **refresh_token**: 长期 30d，存 `user_sessions` 表
- **认证 API**: 统一由 Dashboard Admin API (端口 3001) 承载，Nginx 代理 `/api/auth/*` → `dashboard-api:3001`

### 注册路径

```
POST /api/auth/register          # 账号密码注册
POST /api/auth/wechat/register   # 微信一键注册 (wx_code → openid)
POST /api/auth/phone/register    # 手机号注册 (phone + code)
POST /api/auth/bind              # 追加绑定 (需登录态)
```

### 登录路径

```
POST /api/auth/login             # 账号密码登录
POST /api/auth/wechat/login      # 微信登录
POST /api/auth/phone/login       # 手机号登录
POST /api/auth/refresh           # 刷新 access_token
POST /api/auth/logout            # 登出 (清除 session)
```

### Dashboard 管理员登录

与普通用户同一条通道：

```
POST /api/auth/login
Body: { credential: "admin", password: "Admin123!" }
→ user_auths(type=password) 找到记录
→ users.role = "super_admin"
→ JWT payload: { sub: "user_uuid", role: "super_admin" }
```

不再有独立的 `dashboard_admin_users` 表。

### Tavern 接入

Tavern Server 改造认证中间件：

```typescript
// 旧: 查 shared_users 表 + 自有 JWT
// 新: 验证共享 JWT，读 payload.sub 得到 user_uuid
const payload = jwt.verify(token, JWT_SECRET);
req.user_uuid = payload.sub;
```

Tavern 的配额/Tier 由 Tavern Server 自己查 `ai_tavern.tavern_user_tiers`，不依赖 JWT payload。

### 定时任务：配额重置

Dashboard Admin API 增加 cron (0:00 AM):

```sql
UPDATE ai_tavern.tavern_user_tiers SET daily_quota_used = 0;
```

---

## 八、数据迁移

### 迁移映射

| 旧位置 | 新位置 | 操作 |
|--------|--------|------|
| `miniapps.shared_users` | `miniapps.users` + `miniapps.user_auths` | 拆分 |
| `miniapps.dashboard_admin_users` | `miniapps.users` + `miniapps.user_auths` | 合并 |
| `miniapps.ftg_*` (10 tables) | `food_theme_generator.ftg_*` | 跨库复制 + `user_id`→`user_uuid` |
| `miniapps.Card*` / `Chat*` / `Persona` / `ModerationLog` / `ApiKey` / `UserTier` (12 tables) | `ai_tavern.tavern_*` | 跨库复制 + creatorId/userId → user_uuid |
| `miniapps.CardRevision` / `ModelMeta` | `ai_tavern.*` | 跨库复制（无 user 引用，结构不变） |

### 迁移步骤

1. **停机** — `docker compose down`
2. **建新库** — `CREATE DATABASE food_theme_generator` / `ai_tavern`（如不存在）
3. **建新表** — 在 4 个库里建所有表（不含旧表）
4. **迁移用户** — `shared_users` → `users` + `user_auths`
5. **迁移管理员** — `dashboard_admin_users` → `users` + `user_auths`
6. **迁移业务数据** — `INSERT INTO ... SELECT ... FROM` 跨库复制
7. **重命名旧表** — `RENAME TABLE xxx TO xxx_old`（保留回滚能力）
8. **验证** — 行数比对 + 抽样检查
9. **DROP 旧表** — 确认无误后删除

预估停机时间: 10-15 分钟

### 回滚策略

所有旧表先 `RENAME TO xxx_old`，验证通过后再 DROP。出问题恢复旧表名即可。

---

## 九、需要修改的文件清单

### Prisma Schema

| 文件 | 操作 |
|------|------|
| `prisma/schema-miniapps.prisma` | 🆕 新建 (5 models) |
| `prisma/schema-food-theme-generator.prisma` | 🆕 新建 (11 models) |
| `prisma/schema-game1.prisma` | 🆕 从旧 `prisma/schema.prisma` 拆出 |
| `prisma/schema.prisma` | 🗑 删除（已拆分为 3 个） |
| `apps/tavern/server/prisma/schema.prisma` | ✏ 修改 (13 models, 去 SharedUser) |

### 后端代码

| 项目 | 文件 | 改动 |
|------|------|------|
| Dashboard API | `dashboard/server/server.ts` | 加 `/auth/*` 路由挂载 |
| Dashboard API | `dashboard/server/auth-routes.ts` | 🆕 认证全套路由 |
| Dashboard API | `dashboard/server/admin-auth.ts` | ✏ 改用共享 JWT + `users` 表 |
| Dashboard API | `dashboard/server/dashboardRoutes.ts` | ✏ Prisma Client 改为 `schema-miniapps` |
| Dashboard API | `dashboard/server/admin-*.ts` | ✏ `admin_id` → `user_uuid` |
| FTG Server | 路由层 / service 层 | ✏ `DATABASE_URL` → `FTG_DATABASE_URL`, SharedUser → user_uuid |
| FTG Server | 中间件 (auth) | ✏ 改用共享 JWT |
| Tavern Server | `src/middleware/auth.ts` | ✏ 验证共享 JWT |
| Tavern Server | 路由层 / service 层 | ✏ `DATABASE_URL` → `ai_tavern`, SharedUser → user_uuid |
| Game1 Server | — | ➖ 不动 |

### 前端代码

| 项目 | 文件 | 改动 |
|------|------|------|
| Dashboard | `src/pages/Login/` | ✏ 支持密码登录 + 错误提示 |
| Dashboard | `src/stores/authStore.ts` | ✏ 认证流程改为 `/api/auth/login` |
| FTG 小程序 | `src/hooks/useAuth.ts` 等 | ✏ 登录调 `/api/auth/wechat/login` |
| Tavern 小程序 | `src/hooks/useAuth.ts` 等 | ✏ 登录调 `/api/auth/*` |

### 部署配置

| 文件 | 改动 |
|------|------|
| `deploy/nginx/nginx.conf` | ✏ 加 `/api/auth/*` → `dashboard-api:3001` |
| `deploy/docker-compose.yml` | ✏ 环境变量: `MINIAPPS_DATABASE_URL` / `FTG_DATABASE_URL` / `GAME1_DATABASE_URL` |
| `deploy_commands.sh` | ✏ 改为 4 次 `prisma db push` (每库一次) |
| `recover_and_deploy.sh` | ✏ 同上 |

### 环境变量变更

| 服务 | 旧变量 | 新变量 |
|------|--------|--------|
| Dashboard API | `DATABASE_URL` | `MINIAPPS_DATABASE_URL` |
| FTG Server | `DATABASE_URL` | `FTG_DATABASE_URL` |
| Tavern Server | `DATABASE_URL` | 不变 (值改为 `ai_tavern`) |
| Game1 Server | `DATABASE_URL` | `GAME1_DATABASE_URL` |
| 全部服务 | — | 🆕 `JWT_SECRET` (必须一致) |

---

## 十、部署顺序

```
1.  git push (所有代码改动)
2.  ssh root@mnapp.top
3.  停机: cd /opt/ftg/deploy && docker compose down
4.  执行迁移 SQL
5.  重构部署目录中的 Prisma Schema 文件
6.  docker compose up -d --build (重建所有镜像)
7.  验证: curl http://localhost/api/auth/login + 各健康检查
8.  小程序重新编译 + 上传微信审核
```

---

## 十一、待定 / 后续扩展

| 项目 | 说明 |
|------|------|
| 手机验证码 | 当前设计保留了 `phone` auth_type，但验证码发送服务需后续接入 |
| 邮箱绑定 | `user_auths` 易于扩展 `auth_type='email'` |
| 密码修改 / 找回 | 后续添加 |
| OAuth 第三方登录 | `user_auths` 可扩展 `auth_type='google'` 等 |
| Game1 用户系统 | 当前 game1 不动，后续如需统一认证，同理接入 |
