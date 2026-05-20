-- ============================================================
-- 数据库重构迁移脚本
-- 目标: 将混乱的4库结构重组为 miniapps/food_theme_generator/ai_tavern/game1
-- 执行: mysql -u root -p < migration-2026-05-20.sql
-- ⚠️ 需停机后执行，预计 5-10 分钟
-- ============================================================

-- ─── STEP 0: 建新库 ────────────────────────────────────────
CREATE DATABASE IF NOT EXISTS food_theme_generator CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS ai_tavern CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE miniapps;

-- ─── STEP 1: miniapps 公用库 — 新建表 ─────────────────────

-- 1a. users (替代 shared_users + dashboard_admin_users)
CREATE TABLE IF NOT EXISTS users (
  id          CHAR(36)     NOT NULL,
  uuid        VARCHAR(36)  NOT NULL,
  nickname    VARCHAR(64)  DEFAULT NULL,
  avatar_url  VARCHAR(512) DEFAULT NULL,
  role        ENUM('user','admin','super_admin') NOT NULL DEFAULT 'user',
  status      ENUM('active','disabled') NOT NULL DEFAULT 'active',
  meta        JSON         DEFAULT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_uuid (uuid),
  KEY idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1b. user_auths (多认证方式: password / wechat / phone)
CREATE TABLE IF NOT EXISTS user_auths (
  id          CHAR(36)     NOT NULL,
  user_uuid   VARCHAR(36)  NOT NULL,
  auth_type   ENUM('password','wechat','phone') NOT NULL,
  credential  VARCHAR(255) NOT NULL,
  verified_at DATETIME     DEFAULT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_type_credential (auth_type, credential),
  KEY idx_user_uuid (user_uuid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1c. user_sessions (登录会话, refresh_token 持久化)
CREATE TABLE IF NOT EXISTS user_sessions (
  id            CHAR(36)     NOT NULL,
  user_uuid     VARCHAR(36)  NOT NULL,
  refresh_token VARCHAR(255) NOT NULL,
  device_info   JSON         DEFAULT NULL,
  expires_at    DATETIME     NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_refresh_token (refresh_token),
  KEY idx_user_uuid (user_uuid),
  KEY idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── STEP 2: 迁移用户数据 ─────────────────────────────────

-- 2a. shared_users → users
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

-- 2b. dashboard_admin_users → users
INSERT INTO users (id, uuid, nickname, avatar_url, role, status, created_at, updated_at)
SELECT 
  id,
  CONCAT('admin-', COALESCE(username, id)) AS uuid,
  COALESCE(username, 'admin') AS nickname,
  NULL AS avatar_url,
  role AS role,
  CASE WHEN status = 'disabled' THEN 'disabled' ELSE 'active' END AS status,
  created_at,
  updated_at
FROM dashboard_admin_users
ON DUPLICATE KEY UPDATE role = VALUES(role);

-- 2c. shared_users.openid → user_auths (wechat)
INSERT INTO user_auths (id, user_uuid, auth_type, credential, verified_at, created_at)
SELECT 
  UUID() AS id,
  COALESCE(uuid, id) AS user_uuid,
  'wechat' AS auth_type,
  openid AS credential,
  phone_verified_at AS verified_at,
  NOW() AS created_at
FROM shared_users 
WHERE openid IS NOT NULL AND openid != ''
ON DUPLICATE KEY UPDATE user_uuid = VALUES(user_uuid);

-- 2d. shared_users.phone → user_auths (phone)
INSERT INTO user_auths (id, user_uuid, auth_type, credential, verified_at, created_at)
SELECT 
  UUID() AS id,
  COALESCE(uuid, id) AS user_uuid,
  'phone' AS auth_type,
  phone AS credential,
  phone_verified_at AS verified_at,
  NOW() AS created_at
FROM shared_users 
WHERE phone IS NOT NULL AND phone != ''
ON DUPLICATE KEY UPDATE user_uuid = VALUES(user_uuid);

-- 2e. dashboard_admin_users.password_hash → user_auths (password)
INSERT INTO user_auths (id, user_uuid, auth_type, credential, created_at)
SELECT 
  UUID() AS id,
  CONCAT('admin-', COALESCE(username, id)) AS user_uuid,
  'password' AS auth_type,
  password_hash AS credential,
  NOW() AS created_at
FROM dashboard_admin_users
ON DUPLICATE KEY UPDATE user_uuid = VALUES(user_uuid);

-- ─── STEP 3: food_theme_generator 库 — 建表 + 迁移 ────────

USE food_theme_generator;

-- 3a. ftg_food_records
CREATE TABLE IF NOT EXISTS ftg_food_records (
  id          CHAR(36)     NOT NULL,
  user_uuid   VARCHAR(36)  NOT NULL,
  food_type   ENUM('grain','vegetable','fruit','meat','seafood','dairy','nut','snack','beverage','seasoning','dish','other') NOT NULL,
  theme_id    VARCHAR(36)  DEFAULT NULL,
  is_public   TINYINT(1)   DEFAULT 1,
  is_deleted  TINYINT(1)   DEFAULT 0,
  deleted_at  DATETIME     DEFAULT NULL,
  data        JSON         NOT NULL,
  version     INT          DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_uuid (user_uuid),
  KEY idx_user_created (user_uuid, created_at),
  KEY idx_food_type (food_type),
  KEY idx_public (is_public, is_deleted, created_at),
  KEY idx_theme_id (theme_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ftg_food_records (id, user_uuid, food_type, theme_id, is_public, is_deleted, deleted_at, data, version, created_at, updated_at)
SELECT id, user_id AS user_uuid, food_type, theme_id, is_public, is_deleted, deleted_at, data, version, created_at, updated_at
FROM miniapps.ftg_food_records;

-- 3b. ftg_checkins
CREATE TABLE IF NOT EXISTS ftg_checkins (
  id              CHAR(36) NOT NULL,
  user_uuid       VARCHAR(36) NOT NULL,
  food_record_id  CHAR(36) NOT NULL,
  location_name   VARCHAR(255) DEFAULT NULL,
  latitude        DOUBLE DEFAULT NULL,
  longitude       DOUBLE DEFAULT NULL,
  checkin_date    DATE NOT NULL,
  streak_count    INT DEFAULT 0,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_food_record (food_record_id),
  KEY idx_user_date (user_uuid, checkin_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ftg_checkins (id, user_uuid, food_record_id, location_name, latitude, longitude, checkin_date, streak_count, created_at)
SELECT id, user_id AS user_uuid, food_record_id, location_name, latitude, longitude, checkin_date, streak_count, created_at
FROM miniapps.ftg_checkins;

-- 3c. ftg_achievements (成就定义, 无 user 引用)
CREATE TABLE IF NOT EXISTS ftg_achievements (
  id               CHAR(36) NOT NULL,
  achievement_id   VARCHAR(64) NOT NULL,
  name             VARCHAR(128) NOT NULL,
  description      VARCHAR(512) DEFAULT NULL,
  icon_url         VARCHAR(512) DEFAULT NULL,
  condition_type   VARCHAR(64) NOT NULL,
  condition_value  INT NOT NULL,
  condition_param  VARCHAR(64) DEFAULT NULL,
  theme_id         VARCHAR(36) DEFAULT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_achievement_id (achievement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ftg_achievements SELECT * FROM miniapps.ftg_achievements;

-- 3d. ftg_user_achievements
CREATE TABLE IF NOT EXISTS ftg_user_achievements (
  id              CHAR(36) NOT NULL,
  user_uuid       VARCHAR(36) NOT NULL,
  achievement_id  VARCHAR(64) NOT NULL,
  unlocked_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  progress        INT DEFAULT 0,
  is_unlocked     TINYINT(1) DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY idx_user_achievement (user_uuid, achievement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ftg_user_achievements (id, user_uuid, achievement_id, unlocked_at, progress, is_unlocked)
SELECT id, user_id AS user_uuid, achievement_id, unlocked_at, progress, is_unlocked
FROM miniapps.ftg_user_achievements;

-- 3e. ftg_themes
CREATE TABLE IF NOT EXISTS ftg_themes LIKE miniapps.ftg_themes;
INSERT INTO ftg_themes SELECT * FROM miniapps.ftg_themes;

-- 3f. ftg_theme_classes
CREATE TABLE IF NOT EXISTS ftg_theme_classes LIKE miniapps.ftg_theme_classes;
INSERT INTO ftg_theme_classes SELECT * FROM miniapps.ftg_theme_classes;

-- 3g. ftg_theme_usage_logs
CREATE TABLE IF NOT EXISTS ftg_theme_usage_logs (
  id          CHAR(36) NOT NULL,
  theme_id    VARCHAR(36) NOT NULL,
  record_id   VARCHAR(36) NOT NULL,
  user_uuid   VARCHAR(36) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_theme_record (theme_id, record_id),
  KEY idx_theme_created (theme_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ftg_theme_usage_logs (id, theme_id, record_id, user_uuid, created_at)
SELECT id, theme_id, record_id, user_id AS user_uuid, created_at
FROM miniapps.ftg_theme_usage_logs;

-- 3h. ftg_pipeline_statuses
CREATE TABLE IF NOT EXISTS ftg_pipeline_statuses (
  id           CHAR(36) NOT NULL,
  user_uuid    VARCHAR(36) NOT NULL,
  pipeline_id  VARCHAR(36) NOT NULL,
  status       ENUM('pending','recognizing','recognized','generating','composing','completed','failed') DEFAULT 'pending',
  progress     INT DEFAULT 0,
  image_url    VARCHAR(512) DEFAULT NULL,
  theme_id     VARCHAR(36) DEFAULT NULL,
  data         JSON DEFAULT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_pipeline_id (pipeline_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ftg_pipeline_statuses (id, user_uuid, pipeline_id, status, progress, image_url, theme_id, data, created_at, updated_at)
SELECT id, user_id AS user_uuid, pipeline_id, status, progress, image_url, theme_id, data, created_at, updated_at
FROM miniapps.ftg_pipeline_statuses;

-- 3i. ftg_favorites
CREATE TABLE IF NOT EXISTS ftg_favorites (
  id          CHAR(36) NOT NULL,
  user_uuid   VARCHAR(36) NOT NULL,
  record_id   CHAR(36) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_user_record (user_uuid, record_id),
  KEY idx_user_created (user_uuid, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ftg_favorites (id, user_uuid, record_id, created_at)
SELECT id, user_id AS user_uuid, record_id, created_at
FROM miniapps.ftg_favorites;

-- 3j. ftg_api_keys (无 user 引用)
CREATE TABLE IF NOT EXISTS ftg_api_keys LIKE miniapps.ftg_api_keys;
INSERT INTO ftg_api_keys SELECT * FROM miniapps.ftg_api_keys;

-- 3k. ftg_checkin_streaks (🆕 打卡连续天数统计)
CREATE TABLE IF NOT EXISTS ftg_checkin_streaks (
  user_uuid        VARCHAR(36) NOT NULL,
  current_streak   INT NOT NULL DEFAULT 0,
  longest_streak   INT NOT NULL DEFAULT 0,
  last_checkin_date DATE DEFAULT NULL,
  PRIMARY KEY (user_uuid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── STEP 4: ai_tavern 库 — 建表 + 迁移 ────────────────────

USE ai_tavern;

-- 4a. Card (角色卡, creator_id → user_uuid)
CREATE TABLE IF NOT EXISTS Card (
  id                CHAR(36) NOT NULL,
  user_uuid         VARCHAR(36) NOT NULL,
  name              VARCHAR(255) NOT NULL,
  description       VARCHAR(2000) DEFAULT NULL,
  avatar_url        VARCHAR(512) DEFAULT NULL,
  card_type         ENUM('CHARACTER','MECHANISM','MAP','BACKGROUND') DEFAULT 'CHARACTER',
  prompt            TEXT DEFAULT NULL,
  scenario          TEXT DEFAULT NULL,
  first_msg         TEXT DEFAULT NULL,
  tags              JSON DEFAULT NULL,
  is_official       TINYINT(1) DEFAULT 0,
  status            ENUM('DRAFT','PENDING','PUBLISHED','BANNED','ARCHIVED') DEFAULT 'DRAFT',
  locked            TINYINT(1) DEFAULT 0,
  view_count        INT DEFAULT 0,
  chat_count        INT DEFAULT 0,
  like_count        INT DEFAULT 0,
  fav_count         INT DEFAULT 0,
  card_spec         JSON DEFAULT NULL,
  model_preference  VARCHAR(64) DEFAULT NULL,
  temperature       FLOAT DEFAULT NULL,
  version           INT DEFAULT 1,
  last_published_at DATETIME DEFAULT NULL,
  deleted_at        DATETIME DEFAULT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_uuid (user_uuid),
  KEY idx_user_status_type (user_uuid, status, card_type),
  KEY idx_status_type_likes (status, card_type, like_count),
  KEY idx_status_type_chats (status, card_type, chat_count),
  KEY idx_status_type_created (status, card_type, created_at),
  KEY idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO Card (id, user_uuid, name, description, avatar_url, card_type, prompt, scenario, first_msg, tags, is_official, status, locked, view_count, chat_count, like_count, fav_count, card_spec, model_preference, temperature, version, last_published_at, deleted_at, created_at, updated_at)
SELECT id, creator_id AS user_uuid, name, description, avatar_url, card_type, prompt, scenario, first_msg, tags, is_official, status, locked, view_count, chat_count, like_count, fav_count, card_spec, model_preference, temperature, version, last_published_at, deleted_at, created_at, updated_at
FROM miniapps.Card;

-- 4b. CardLike
CREATE TABLE IF NOT EXISTS CardLike (
  id          CHAR(36) NOT NULL,
  card_id     CHAR(36) NOT NULL,
  user_uuid   VARCHAR(36) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_card_user (card_id, user_uuid),
  KEY idx_card_created (card_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO CardLike (id, card_id, user_uuid, created_at)
SELECT id, card_id, user_id AS user_uuid, created_at
FROM miniapps.CardLike;

-- 4c. CardFav
CREATE TABLE IF NOT EXISTS CardFav (
  id          CHAR(36) NOT NULL,
  card_id     CHAR(36) NOT NULL,
  user_uuid   VARCHAR(36) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_card_user (card_id, user_uuid),
  KEY idx_user_created (user_uuid, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO CardFav (id, card_id, user_uuid, created_at)
SELECT id, card_id, user_id AS user_uuid, created_at
FROM miniapps.CardFav;

-- 4d. Persona
CREATE TABLE IF NOT EXISTS Persona (
  id           CHAR(36) NOT NULL,
  user_uuid    VARCHAR(36) NOT NULL,
  name         VARCHAR(128) NOT NULL,
  description  TEXT DEFAULT NULL,
  avatar_url   VARCHAR(512) DEFAULT NULL,
  personality  TEXT DEFAULT NULL,
  scenario     TEXT DEFAULT NULL,
  lore         TEXT DEFAULT NULL,
  is_default   TINYINT(1) DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_uuid (user_uuid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO Persona (id, user_uuid, name, description, avatar_url, personality, scenario, lore, is_default, created_at, updated_at)
SELECT id, user_id AS user_uuid, name, description, avatar_url, personality, scenario, lore, is_default, created_at, updated_at
FROM miniapps.Persona;

-- 4e. ChatSession
CREATE TABLE IF NOT EXISTS ChatSession (
  id              CHAR(36) NOT NULL,
  user_uuid       VARCHAR(36) NOT NULL,
  card_id         CHAR(36) NOT NULL,
  persona_id      CHAR(36) DEFAULT NULL,
  title           VARCHAR(255) DEFAULT NULL,
  model_key       VARCHAR(64) DEFAULT NULL,
  temperature     FLOAT DEFAULT NULL,
  config          JSON DEFAULT NULL,
  message_count   INT DEFAULT 0,
  token_count     INT DEFAULT 0,
  pinned          TINYINT(1) DEFAULT 0,
  last_message_at DATETIME DEFAULT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_lastmsg (user_uuid, last_message_at),
  KEY idx_user_pinned (user_uuid, pinned, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ChatSession (id, user_uuid, card_id, persona_id, title, model_key, temperature, config, message_count, token_count, pinned, last_message_at, created_at, updated_at)
SELECT id, user_id AS user_uuid, card_id, persona_id, title, model_key, temperature, config, message_count, token_count, pinned, last_message_at, created_at, updated_at
FROM miniapps.ChatSession;

-- 4f. ChatMessage (无 user 引用)
CREATE TABLE IF NOT EXISTS ChatMessage LIKE miniapps.ChatMessage;
INSERT INTO ChatMessage SELECT * FROM miniapps.ChatMessage;

-- 4g. ModerationLog
CREATE TABLE IF NOT EXISTS ModerationLog (
  id           CHAR(36) NOT NULL,
  target_type  VARCHAR(64) NOT NULL,
  target_id    CHAR(36) NOT NULL,
  action       VARCHAR(64) NOT NULL,
  reason       VARCHAR(512) DEFAULT NULL,
  user_uuid    VARCHAR(36) DEFAULT NULL,
  meta         JSON DEFAULT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_target (target_type, target_id),
  KEY idx_operator (user_uuid, created_at),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ModerationLog (id, target_type, target_id, action, reason, user_uuid, meta, created_at)
SELECT id, target_type, target_id, action, reason, operator_id AS user_uuid, meta, created_at
FROM miniapps.ModerationLog;

-- 4h. CardRevision (无 user 引用)
CREATE TABLE IF NOT EXISTS CardRevision LIKE miniapps.CardRevision;
INSERT INTO CardRevision SELECT * FROM miniapps.CardRevision;

-- 4i. ApiKey
CREATE TABLE IF NOT EXISTS ApiKey (
  id           CHAR(36) NOT NULL,
  user_uuid    VARCHAR(36) NOT NULL,
  provider     VARCHAR(64) NOT NULL,
  key_value    TEXT NOT NULL,
  base_url     TEXT DEFAULT NULL,
  is_active    TINYINT(1) DEFAULT 1,
  last_used_at DATETIME DEFAULT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_user_provider (user_uuid, provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ApiKey (id, user_uuid, provider, key_value, base_url, is_active, last_used_at, created_at, updated_at)
SELECT id, user_id AS user_uuid, provider, key_value, base_url, is_active, last_used_at, created_at, updated_at
FROM miniapps.ApiKey;

-- 4j. ModelMeta (无 user 引用)
CREATE TABLE IF NOT EXISTS ModelMeta LIKE miniapps.ModelMeta;
INSERT INTO ModelMeta SELECT * FROM miniapps.ModelMeta;

-- 4k. tavern_user_tiers (重构 UserTier, 加 daily_quota 计数器)
CREATE TABLE IF NOT EXISTS tavern_user_tiers (
  user_uuid         VARCHAR(36) NOT NULL,
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
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_uuid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tavern_user_tiers (user_uuid, tier, level, xp, xp_to_next, max_sessions, max_characters, max_personas, daily_quota_max, daily_quota_used, permissions, created_at, updated_at)
SELECT 
  user_id AS user_uuid, tier, level, xp, xpToNext AS xp_to_next, 
  maxSessions, maxCharacters, maxPersonas,
  maxDailyQuota AS daily_quota_max, usedQuota AS daily_quota_used,
  permissions, created_at, updated_at
FROM miniapps.UserTier;

-- 4l. tavern_user_profiles (🆕 用户偏好)
CREATE TABLE IF NOT EXISTS tavern_user_profiles (
  user_uuid        VARCHAR(36) NOT NULL,
  default_model    VARCHAR(64) DEFAULT NULL,
  default_temp     FLOAT DEFAULT NULL,
  preferred_locale VARCHAR(16) DEFAULT 'zh-CN',
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_uuid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── STEP 5: 验证 ──────────────────────────────────────────

SELECT '=== 行数校验 ===' AS info;

SELECT 'miniapps.users' AS tbl, COUNT(*) AS cnt FROM miniapps.users
UNION ALL SELECT 'miniapps.user_auths', COUNT(*) FROM miniapps.user_auths
UNION ALL SELECT 'miniapps.user_sessions', COUNT(*) FROM miniapps.user_sessions;

SELECT 'food_theme_generator.ftg_food_records' AS tbl, COUNT(*) AS cnt FROM food_theme_generator.ftg_food_records
UNION ALL SELECT 'food_theme_generator.ftg_checkins', COUNT(*) FROM food_theme_generator.ftg_checkins
UNION ALL SELECT 'food_theme_generator.ftg_themes', COUNT(*) FROM food_theme_generator.ftg_themes;

SELECT 'ai_tavern.Card' AS tbl, COUNT(*) AS cnt FROM ai_tavern.Card
UNION ALL SELECT 'ai_tavern.ChatSession', COUNT(*) FROM ai_tavern.ChatSession
UNION ALL SELECT 'ai_tavern.ChatMessage', COUNT(*) FROM ai_tavern.ChatMessage
UNION ALL SELECT 'ai_tavern.tavern_user_tiers', COUNT(*) FROM ai_tavern.tavern_user_tiers;

-- ─── STEP 6: 重命名旧表（手动执行） ─────────────────────────
-- ⚠️ 验证通过后执行以下语句:

-- USE miniapps;
-- RENAME TABLE shared_users TO shared_users_old;
-- RENAME TABLE dashboard_admin_users TO dashboard_admin_users_old;
-- RENAME TABLE ftg_food_records TO ftg_food_records_old;
-- RENAME TABLE ftg_checkins TO ftg_checkins_old;
-- RENAME TABLE ftg_achievements TO ftg_achievements_old;
-- RENAME TABLE ftg_user_achievements TO ftg_user_achievements_old;
-- RENAME TABLE ftg_themes TO ftg_themes_old;
-- RENAME TABLE ftg_theme_classes TO ftg_theme_classes_old;
-- RENAME TABLE ftg_theme_usage_logs TO ftg_theme_usage_logs_old;
-- RENAME TABLE ftg_pipeline_statuses TO ftg_pipeline_statuses_old;
-- RENAME TABLE ftg_favorites TO ftg_favorites_old;
-- RENAME TABLE ftg_api_keys TO ftg_api_keys_old;
-- RENAME TABLE Card TO Card_old;
-- RENAME TABLE CardLike TO CardLike_old;
-- RENAME TABLE CardFav TO CardFav_old;
-- RENAME TABLE Persona TO Persona_old;
-- RENAME TABLE ChatSession TO ChatSession_old;
-- RENAME TABLE ChatMessage TO ChatMessage_old;
-- RENAME TABLE ModerationLog TO ModerationLog_old;
-- RENAME TABLE CardRevision TO CardRevision_old;
-- RENAME TABLE ApiKey TO ApiKey_old;
-- RENAME TABLE ModelMeta TO ModelMeta_old;
-- RENAME TABLE UserTier TO UserTier_old;
