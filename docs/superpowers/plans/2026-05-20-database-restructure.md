# 数据库重构实施计划

> **Agentic workers:** Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 将混乱的 4 库/3 Schema 重组为清晰的 4 库/4 Schema，统一用户系统和 JWT 认证。

**Architecture:** miniapps(5表/公用) + food_theme_generator(11表/FTG) + ai_tavern(13表/Tavern) + game1(7表/不动)。UUID 软引用跨库，Dashboard Admin API 承载 /auth/* 路由，共享 JWT_SECRET。

**Tech Stack:** MySQL 8.0, Prisma ORM, Express, React, Taro 4.x, Docker Compose, Nginx

---

## File Structure Map

```
prisma/
├── schema-miniapps.prisma              🆕 5 models
├── schema-food-theme-generator.prisma  🆕 11 models
├── schema-game1.prisma                 🆕 7 models (从旧拆)
└── schema.prisma                       🗑 删除

apps/tavern/server/prisma/
└── schema.prisma                       ✏ 13 models, 去SharedUser

dashboard/server/
├── server.ts                           ✏ 加 /auth/* 挂载
├── auth-routes.ts                      🆕 注册/登录/刷新/登出
├── admin-auth.ts                       ✏ 改用共享JWT + users表
├── admin-monitoring.ts                 ✏ Prisma client 改连 miniapps
├── dashboardRoutes.ts                  ✏ Prisma client 改连 miniapps
├── admin-food-records.ts               ✏ admin_id → user_uuid
├── admin-achievements.ts               ✏ admin_id → user_uuid
├── admin-api-keys.ts                   ✏ admin_id → user_uuid
└── routes/
    ├── game1-proxy.ts                  ➖ 不动
    └── tavern-proxy.ts                 ➖ 不动

apps/ftg/server/src/
├── app.ts                              ✏ DATABASE_URL → FTG_DATABASE_URL
├── middleware/auth.ts                   ✏ 改用共享JWT
├── lib/jwt.ts                          ✏ 验证共享JWT
├── routes/*.ts                         ✏ SharedUser → user_uuid
└── services/*.ts                       ✏ SharedUser → user_uuid

apps/tavern/server/src/
├── middleware/auth.ts                   ✏ 改用共享JWT
├── routes/*.ts                         ✏ SharedUser → user_uuid
└── services/*.ts                       ✏ SharedUser → user_uuid

dashboard/src/
├── pages/Login/index.tsx               ✏ 密码登录UI
└── stores/authStore.ts                 ✏ 调用/api/auth/login

deploy/
├── nginx/nginx.conf                    ✏ 加/api/auth/* 代理
├── docker-compose.yml                  ✏ 环境变量更新
├── deploy_commands.sh                  ✏ 4次 prisma db push
└── recover_and_deploy.sh               ✏ 同上

database/
└── migration.sql                       🆕 全量迁移脚本
```

---

### Phase 0: 数据库迁移 SQL

#### Task 0.1: 编写迁移 SQL

**Files:**
- Create: `database/migration-2026-05-20.sql`

- [ ] **Step 1: 建库建表 SQL**

```sql
-- ============================================================
-- 数据库重构迁移脚本
-- 执行方式: mysql -u root -p < migration-2026-05-20.sql
-- ⚠️ 需在停机后执行
-- ============================================================

-- 0. 创建新数据库（如已存在则跳过）
CREATE DATABASE IF NOT EXISTS food_theme_generator CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS ai_tavern CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE miniapps;

-- 1. miniapps 库 — 新建 users / user_auths / user_sessions
CREATE TABLE IF NOT EXISTS users (
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
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_auths (
  id          CHAR(36)     PRIMARY KEY,
  user_uuid   VARCHAR(36)  NOT NULL,
  auth_type   ENUM('password','wechat','phone') NOT NULL,
  credential  VARCHAR(255) NOT NULL,
  verified_at DATETIME     DEFAULT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_uuid (user_uuid),
  UNIQUE INDEX idx_type_credential (auth_type, credential)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_sessions (
  id            CHAR(36)     PRIMARY KEY,
  user_uuid     VARCHAR(36)  NOT NULL,
  refresh_token VARCHAR(255) NOT NULL UNIQUE,
  device_info   JSON         DEFAULT NULL,
  expires_at    DATETIME     NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_uuid (user_uuid),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB;

-- 修改 dashboard_audit_logs: admin_id → user_uuid (如果存在)
-- ALTER TABLE dashboard_audit_logs CHANGE admin_id user_uuid VARCHAR(36) NOT NULL;
```

- [ ] **Step 2: 迁移用户数据（shared_users → users + user_auths）**

```sql
USE miniapps;

-- 迁移 shared_users → users
INSERT INTO users (id, uuid, nickname, avatar_url, role, status, meta, created_at, updated_at)
SELECT 
  id, 
  COALESCE(uuid, id) AS uuid,
  nickname,
  avatar_url,
  CASE WHEN role = 'ADMIN' THEN 'admin' ELSE 'user' END AS role,
  CASE WHEN status = 'disabled' THEN 'disabled' ELSE 'active' END AS status,
  meta,
  created_at,
  updated_at
FROM shared_users
ON DUPLICATE KEY UPDATE uuid = VALUES(uuid);

-- 迁移 openid → user_auths (wechat)
INSERT INTO user_auths (id, user_uuid, auth_type, credential, verified_at, created_at)
SELECT 
  UUID() AS id,
  COALESCE(uuid, id) AS user_uuid,
  'wechat' AS auth_type,
  openid AS credential,
  phone_verified_at AS verified_at,
  NOW() AS created_at
FROM shared_users 
WHERE openid IS NOT NULL AND openid != '';

-- 迁移 phone → user_auths (phone)
INSERT INTO user_auths (id, user_uuid, auth_type, credential, verified_at, created_at)
SELECT 
  UUID() AS id,
  COALESCE(uuid, id) AS user_uuid,
  'phone' AS auth_type,
  phone AS credential,
  phone_verified_at AS verified_at,
  NOW() AS created_at
FROM shared_users 
WHERE phone IS NOT NULL AND phone != '';

-- 迁移 dashboard_admin_users → users + user_auths
INSERT INTO users (id, uuid, nickname, avatar_url, role, status, created_at, updated_at)
SELECT 
  id,
  CONCAT('admin-', username) AS uuid,
  username AS nickname,
  NULL AS avatar_url,
  role AS role,
  CASE WHEN status = 'disabled' THEN 'disabled' ELSE 'active' END AS status,
  created_at,
  updated_at
FROM dashboard_admin_users
ON DUPLICATE KEY UPDATE role = VALUES(role);

-- 迁移 admin password_hash → user_auths
INSERT INTO user_auths (id, user_uuid, auth_type, credential, created_at)
SELECT 
  UUID() AS id,
  CONCAT('admin-', username) AS user_uuid,
  'password' AS auth_type,
  password_hash AS credential,
  NOW() AS created_at
FROM dashboard_admin_users;
```

- [ ] **Step 3: 创建 FTG 库表并迁移数据**

```sql
USE food_theme_generator;

-- 建表 (按现有FTG表结构，user_id → user_uuid)
CREATE TABLE ftg_food_records (
  id          CHAR(36)     PRIMARY KEY,
  user_uuid   VARCHAR(36)  NOT NULL,
  food_type   ENUM('grain','vegetable','fruit','meat','seafood','dairy','nut','snack','beverage','seasoning','dish','other') NOT NULL,
  theme_id    VARCHAR(36)  DEFAULT NULL,
  is_public   BOOLEAN      DEFAULT TRUE,
  is_deleted  BOOLEAN      DEFAULT FALSE,
  deleted_at  DATETIME     DEFAULT NULL,
  data        JSON         NOT NULL,
  version     INT          DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_uuid (user_uuid),
  INDEX idx_user_created (user_uuid, created_at DESC),
  INDEX idx_food_type (food_type),
  INDEX idx_public (is_public, is_deleted, created_at DESC)
) ENGINE=InnoDB;

-- 迁移数据: user_id → user_uuid
INSERT INTO ftg_food_records (id, user_uuid, food_type, theme_id, is_public, is_deleted, deleted_at, data, version, created_at, updated_at)
SELECT id, user_id AS user_uuid, food_type, theme_id, is_public, is_deleted, deleted_at, data, version, created_at, updated_at
FROM miniapps.ftg_food_records;

-- 其余 FTG 表同理: ftg_checkins, ftg_achievements, ftg_user_achievements, ftg_themes, ftg_theme_classes, ftg_theme_usage_logs, ftg_pipeline_statuses, ftg_favorites, ftg_api_keys
-- 每张表: ① CREATE TABLE ... LIKE miniapps.xxx → ② ALTER TABLE CHANGE user_id user_uuid → ③ INSERT INTO ... SELECT

-- 新建 ftg_checkin_streaks
CREATE TABLE ftg_checkin_streaks (
  user_uuid        VARCHAR(36) NOT NULL PRIMARY KEY,
  current_streak   INT NOT NULL DEFAULT 0,
  longest_streak   INT NOT NULL DEFAULT 0,
  last_checkin_date DATE DEFAULT NULL
) ENGINE=InnoDB;
```

- [ ] **Step 4: 创建 Tavern 库表并迁移数据**

```sql
USE ai_tavern;

-- Card (creatorId → user_uuid)
CREATE TABLE Card (
  id                CHAR(36)     PRIMARY KEY,
  user_uuid         VARCHAR(36)  NOT NULL,
  name              VARCHAR(255) NOT NULL,
  description       VARCHAR(2000) DEFAULT NULL,
  avatar_url        VARCHAR(512) DEFAULT NULL,
  card_type         ENUM('CHARACTER','MECHANISM','MAP','BACKGROUND') DEFAULT 'CHARACTER',
  prompt            TEXT         DEFAULT NULL,
  scenario          TEXT         DEFAULT NULL,
  first_msg         TEXT         DEFAULT NULL,
  tags              JSON         DEFAULT NULL,
  is_official       BOOLEAN      DEFAULT FALSE,
  status            ENUM('DRAFT','PENDING','PUBLISHED','BANNED','ARCHIVED') DEFAULT 'DRAFT',
  locked            BOOLEAN      DEFAULT FALSE,
  view_count        INT          DEFAULT 0,
  chat_count        INT          DEFAULT 0,
  like_count        INT          DEFAULT 0,
  fav_count         INT          DEFAULT 0,
  card_spec         JSON         DEFAULT NULL,
  model_preference  VARCHAR(64)  DEFAULT NULL,
  temperature       FLOAT        DEFAULT NULL,
  version           INT          DEFAULT 1,
  last_published_at DATETIME     DEFAULT NULL,
  deleted_at        DATETIME     DEFAULT NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_uuid (user_uuid),
  INDEX idx_status_cardtype (status, card_type, like_count DESC),
  INDEX idx_status_cardtype_chat (status, card_type, chat_count DESC),
  INDEX idx_status_cardtype_created (status, card_type, created_at DESC),
  INDEX idx_name (name)
) ENGINE=InnoDB;

INSERT INTO Card (id, user_uuid, name, description, avatar_url, card_type, prompt, scenario, first_msg, tags, is_official, status, locked, view_count, chat_count, like_count, fav_count, card_spec, model_preference, temperature, version, last_published_at, deleted_at, created_at, updated_at)
SELECT id, creator_id AS user_uuid, name, description, avatar_url, card_type, prompt, scenario, first_msg, tags, is_official, status, locked, view_count, chat_count, like_count, fav_count, card_spec, model_preference, temperature, version, last_published_at, deleted_at, created_at, updated_at
FROM miniapps.Card;

-- CardLike (userId → user_uuid)
CREATE TABLE CardLike (...) ENGINE=InnoDB;
INSERT INTO CardLike SELECT ..., userId AS user_uuid, ... FROM miniapps.CardLike;

-- CardFav, Persona, ChatSession, ChatMessage, ModerationLog, CardRevision, ApiKey 同理
-- 每张表: CREATE + INSERT SELECT (creatorId/userId/operatorId → user_uuid)

-- UserTier → tavern_user_tiers (重构，加 daily_quota 字段)
CREATE TABLE tavern_user_tiers (
  user_uuid         VARCHAR(36) NOT NULL PRIMARY KEY,
  tier              ENUM('FREE','PAID','TESTER') NOT NULL DEFAULT 'FREE',
  level             INT NOT NULL DEFAULT 1,
  xp                INT NOT NULL DEFAULT 0,
  xp_to_next        INT NOT NULL DEFAULT 100,
  max_sessions      INT NOT NULL DEFAULT 5,
  max_characters    INT NOT NULL DEFAULT 3,
  max_personas      INT NOT NULL DEFAULT 2,
  daily_quota_max   INT NOT NULL DEFAULT 20,
  daily_quota_used  INT NOT NULL DEFAULT 0,
  permissions       JSON DEFAULT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO tavern_user_tiers (user_uuid, tier, level, xp, xp_to_next, max_sessions, max_characters, max_personas, daily_quota_max, permissions, created_at, updated_at)
SELECT userId AS user_uuid, tier, level, xp, xpToNext AS xp_to_next, maxSessions, maxCharacters, maxPersonas, maxDailyQuota AS daily_quota_max, permissions, created_at, updated_at
FROM miniapps.UserTier;

-- tavern_model_meta (直接复制，无 user 引用)
CREATE TABLE ModelMeta (...) ENGINE=InnoDB;
INSERT INTO ModelMeta SELECT * FROM miniapps.ModelMeta;

-- 🆕 tavern_user_profiles
CREATE TABLE tavern_user_profiles (
  user_uuid        VARCHAR(36) NOT NULL PRIMARY KEY,
  default_model    VARCHAR(64) DEFAULT NULL,
  default_temp     FLOAT DEFAULT NULL,
  preferred_locale VARCHAR(16) DEFAULT 'zh-CN',
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
```

- [ ] **Step 5: 验证 + 清理**

```sql
-- 行数校验
SELECT 'users' AS tbl, COUNT(*) AS cnt FROM miniapps.users
UNION ALL SELECT 'shared_users', COUNT(*) FROM miniapps.shared_users;
-- 预期: users 行数 >= shared_users 行数

-- 重命名旧表（保留回滚能力）
RENAME TABLE miniapps.shared_users TO miniapps.shared_users_old;
RENAME TABLE miniapps.dashboard_admin_users TO miniapps.dashboard_admin_users_old;
RENAME TABLE miniapps.ftg_food_records TO miniapps.ftg_food_records_old;
-- ... 其余旧表同理

-- 确认无误后 DROP
-- DROP TABLE miniapps.shared_users_old;
```

---

### Phase 1: Prisma Schema 重组 (4 套 → 4 套独立)

由于代码量大，按 Schema 分 4 个并行任务:

#### Task 1.1: schema-miniapps.prisma

**Files:**
- Create: `prisma/schema-miniapps.prisma`
- Delete: `prisma/schema.prisma` (after all 3 new schemas created)

```prisma
generator client {
  provider        = "prisma-client-js"
  binaryTargets   = ["native", "linux-musl-openssl-3.0.x", "debian-openssl-3.0.x"]
}

datasource db {
  provider = "mysql"
  url      = env("MINIAPPS_DATABASE_URL")
}

enum UserRole { user admin super_admin }
enum UserStatus { active disabled }
enum AuthType { password wechat phone }
enum ProjectStatus { active inactive }

model User {
  id         String      @id @default(uuid())
  uuid       String      @unique
  nickname   String?
  avatarUrl  String?     @map("avatar_url")
  role       UserRole    @default(user)
  status     UserStatus  @default(active)
  meta       Json?
  createdAt  DateTime    @default(now()) @map("created_at")
  updatedAt  DateTime    @updatedAt @map("updated_at")

  auths     UserAuth[]
  sessions  UserSession[]

  @@index([uuid])
  @@map("users")
}

model UserAuth {
  id         String    @id @default(uuid())
  userUuid   String    @map("user_uuid")
  authType   AuthType  @map("auth_type")
  credential String
  verifiedAt DateTime? @map("verified_at")
  createdAt  DateTime  @default(now()) @map("created_at")
  updatedAt  DateTime  @updatedAt @map("updated_at")

  user User @relation(fields: [userUuid], references: [uuid])

  @@unique([authType, credential])
  @@index([userUuid])
  @@map("user_auths")
}

model UserSession {
  id           String    @id @default(uuid())
  userUuid     String    @map("user_uuid")
  refreshToken String    @unique @map("refresh_token")
  deviceInfo   Json?     @map("device_info")
  expiresAt    DateTime  @map("expires_at")
  createdAt    DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userUuid], references: [uuid])

  @@index([userUuid])
  @@index([expiresAt])
  @@map("user_sessions")
}

model DashboardProject {
  id          String        @id @default(uuid())
  slug        String        @unique
  name        String
  apiBaseUrl  String        @map("api_base_url")
  description String?
  status      ProjectStatus @default(active)
  meta        Json?
  createdAt   DateTime      @default(now()) @map("created_at")
  updatedAt   DateTime      @updatedAt @map("updated_at")

  @@map("dashboard_projects")
}

model DashboardAuditLog {
  id         String   @id @default(uuid())
  userUuid   String   @map("user_uuid")
  action     String
  targetType String?  @map("target_type")
  targetId   String?  @map("target_id")
  details    Json?
  ipAddress  String?  @map("ip_address")
  createdAt  DateTime @default(now()) @map("created_at")

  @@index([userUuid, createdAt(sort: Desc)])
  @@index([targetType, targetId])
  @@index([createdAt(sort: Desc)])
  @@map("dashboard_audit_logs")
}
```

#### Task 1.2: schema-food-theme-generator.prisma

**Files:**
- Create: `prisma/schema-food-theme-generator.prisma`

```prisma
generator client {
  provider        = "prisma-client-js"
  binaryTargets   = ["native", "linux-musl-openssl-3.0.x", "debian-openssl-3.0.x"]
}

datasource db {
  provider = "mysql"
  url      = env("FTG_DATABASE_URL")
}

// 11 models — 所有 user_id → user_uuid，无 @relation 跨库
enum FoodType { ... }  // 同现有
enum PipelineStatus { ... }  // 同现有

model FtgFoodRecord { ... }       // user_id → user_uuid String
model FtgCheckin { ... }          // user_id → user_uuid String
model FtgAchievement { ... }      // 不变
model FtgUserAchievement { ... }  // user_id → user_uuid String
model FtgTheme { ... }            // 不变
model FtgThemeClass { ... }       // 不变
model FtgThemeUsageLog { ... }    // user_id → user_uuid String
model FtgPipelineStatus { ... }   // user_id → user_uuid String
model FtgFavorite { ... }         // user_id → user_uuid String
model FtgApiKey { ... }           // 不变
model FtgCheckinStreak { ... }    // 🆕
```

#### Task 1.3: schema-game1.prisma

**Files:**
- Create: `prisma/schema-game1.prisma` (从旧 `prisma/schema.prisma` 拆出 Game1 7 models)

#### Task 1.4: tavern schema.prisma 修改

**Files:**
- Modify: `apps/tavern/server/prisma/schema.prisma`
- 删除 `model SharedUser`，所有 `creatorId/userId` → `userUuid String`，去 `@relation`，加 `tavern_user_profiles`

---

### Phase 2: Dashboard Admin API — /auth/* 路由

#### Task 2.1: auth-routes.ts (新建)

**Files:**
- Create: `dashboard/server/auth-routes.ts`

核心端点:
- `POST /api/auth/register` — 密码注册
- `POST /api/auth/login` — 密码登录
- `POST /api/auth/wechat/login` — 微信登录
- `POST /api/auth/refresh` — 刷新 token
- `POST /api/auth/logout` — 登出
- `POST /api/auth/bind` — 追加绑定 (需登录态)

JWT 签发逻辑:
```typescript
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET!;
const ACCESS_EXPIRES = '15m';
const REFRESH_EXPIRES_DAYS = 30;

function signAccessToken(userUuid: string, role: string): string {
  return jwt.sign({ sub: userUuid, role }, JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
}

async function signRefreshToken(userUuid: string): Promise<string> {
  const token = crypto.randomBytes(64).toString('hex');
  await prisma.userSession.create({
    data: {
      userUuid,
      refreshToken: token,
      expiresAt: new Date(Date.now() + REFRESH_EXPIRES_DAYS * 86400000),
    },
  });
  return token;
}

// POST /api/auth/register
// 1. 校验 password 长度>=6
// 2. 检查 user_auths 中 credential 是否已存在
// 3. bcrypt.hash(password, 10)
// 4. 创建 users 记录 (uuid, nickname)
// 5. 创建 user_auths 记录 (type=password)
// 6. 签发 access_token + refresh_token

// POST /api/auth/login
// 1. 查 user_auths WHERE auth_type='password' AND credential=username (nickname做credential)
//    OR 查 users WHERE nickname='xxx' → 再查 user_auths WHERE user_uuid AND auth_type='password'
// 2. bcrypt.compare(password, credential)
// 3. 签发 token

// POST /api/auth/wechat/login
// 1. wx_code → 调微信API换 openid
// 2. 查 user_auths WHERE auth_type='wechat' AND credential=openid
// 3. 如不存在 → 创建 users + user_auths (自动注册)
// 4. 签发 token
```

#### Task 2.2: server.ts 修改

**Files:**
- Modify: `dashboard/server/server.ts`

```typescript
// 加 auth 路由
import { authRouter } from './auth-routes';
app.use('/api/auth', authRouter);
```

#### Task 2.3: admin-auth.ts 修改

**Files:**
- Modify: `dashboard/server/admin-auth.ts`

```typescript
// 旧: 查 dashboard_admin_users 表 + 自有JWT
// 新: 验证共享JWT
import jwt from 'jsonwebtoken';

export function adminAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = { uuid: payload.sub, role: payload.role };
    if (payload.role === 'user') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

#### Task 2.4: Prisma Client 切换

**Files:**
- Modify: `dashboard/server/dashboardRoutes.ts`, `admin-food-records.ts`, `admin-achievements.ts`, `admin-api-keys.ts`, `admin-monitoring.ts`

所有文件 `import { PrismaClient } from '@prisma/client'` → `import { PrismaClient } from '../../prisma/generated/miniapps'` (或改变生成路径)

Package.json 加 `prisma:generate`:
```json
{ "prisma:generate": "prisma generate --schema=../prisma/schema-miniapps.prisma" }
```

---

### Phase 3: FTG Server 改造

#### Task 3.1: 环境变量 + Prisma Client

**Files:**
- Modify: `apps/ftg/server/.env` — `DATABASE_URL` → `FTG_DATABASE_URL`
- Modify: `apps/ftg/server/.env.production` — 同上
- Modify: `apps/ftg/server/package.json` — `prisma:generate` 指向 `../../prisma/schema-food-theme-generator.prisma`

#### Task 3.2: 认证中间件改造

**Files:**
- Modify: `apps/ftg/server/src/middleware/auth.ts`

```typescript
// 旧: 查 shared_users + 自有JWT
// 新: 验证共享JWT
const payload = jwt.verify(token, JWT_SECRET);
req.userUuid = payload.sub;
```

#### Task 3.3: 路由/服务层 — user_id → user_uuid

**Files:**
- Modify: `apps/ftg/server/src/routes/*.ts` (所有含 SharedUser 引用的路由)
- Modify: `apps/ftg/server/src/services/*.ts` (所有含 SharedUser 引用的服务)

Prisma 查询中 `where: { user_id: ... }` → `where: { user_uuid: req.userUuid }`

---

### Phase 4: Tavern Server 改造

#### Task 4.1: 环境变量

**Files:**
- Modify: `apps/tavern/server/.env` — `DATABASE_URL` 值改为 `ai_tavern`

#### Task 4.2: 认证中间件

**Files:**
- Modify: `apps/tavern/server/src/middleware/auth.ts`

同 FTG: 改用共享 JWT，`req.userUuid = payload.sub`

#### Task 4.3: 路由/服务层

**Files:**
- Modify: `apps/tavern/server/src/routes/*.ts` — `creatorId/userId` → `userUuid`
- Modify: `apps/tavern/server/src/services/*.ts` — 同上

---

### Phase 5: Dashboard 前端 Login 改造

**Files:**
- Modify: `dashboard/src/pages/Login/index.tsx`
- Modify: `dashboard/src/stores/authStore.ts`

```typescript
// authStore — 登录改为调 /api/auth/login
async login(username: string, password: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: username, password }),
  });
  const data = await res.json();
  if (data.access_token) {
    setToken(data.access_token, data.refresh_token);
    setIsAuthenticated(true);
  }
  return data;
}
```

---

### Phase 6: 小程序客户端

**Files:**
- Modify: FTG client auth hooks — 调 `/api/auth/wechat/login`
- Modify: Tavern client auth hooks — 调 `/api/auth/wechat/login`

---

### Phase 7: 部署配置

#### Task 7.1: Nginx

**Files:**
- Modify: `deploy/nginx/nginx.conf`

```nginx
# 加认证 API 代理
location /api/auth/ {
    proxy_pass http://dashboard-api:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

#### Task 7.2: Docker Compose

**Files:**
- Modify: `deploy/docker-compose.yml`

环境变量更新:
```yaml
dashboard-api:
  environment:
    - MINIAPPS_DATABASE_URL=mysql://ftg_user:${MYSQL_PASSWORD}@mysql:3306/miniapps
    - JWT_SECRET=${JWT_SECRET}

ftg-server:
  environment:
    - FTG_DATABASE_URL=mysql://ftg_user:${MYSQL_PASSWORD}@mysql:3306/food_theme_generator
    - JWT_SECRET=${JWT_SECRET}

tavern-server:
  environment:
    - DATABASE_URL=mysql://ftg_user:${MYSQL_PASSWORD}@mysql:3306/ai_tavern
    - JWT_SECRET=${JWT_SECRET}

game1-server:
  environment:
    - GAME1_DATABASE_URL=mysql://ftg_user:${MYSQL_PASSWORD}@mysql:3306/game1
    - JWT_SECRET=${JWT_SECRET}
```

#### Task 7.3: 部署脚本

**Files:**
- Modify: `deploy_commands.sh`
- Modify: `recover_and_deploy.sh`

```bash
# 4 次 prisma db push
docker compose exec -T admin npx prisma db push --schema=../prisma/schema-miniapps.prisma --accept-data-loss
docker compose exec -T ftg-server npx prisma db push --schema=../../prisma/schema-food-theme-generator.prisma --accept-data-loss
docker compose exec -T tavern-server npx prisma db push --accept-data-loss
docker compose exec -T game1-server npx prisma db push --schema=../../prisma/schema-game1.prisma --accept-data-loss
```

---

### Phase 8: 编译验证

```bash
# 每个项目依次验证
cd dashboard && npm run type-check
cd apps/ftg/server && npm run type-check
cd apps/tavern/server && npm run type-check
cd apps/game1/server && npm run type-check
```

---

## 执行顺序

```
Phase 0 (迁移SQL) → Phase 1 (Prisma Schema) → 
Phase 2+3+4 并行 (后端) → Phase 5+6 并行 (前端) → 
Phase 7 (部署配置) → Phase 8 (编译验证)
```
