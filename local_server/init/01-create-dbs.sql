-- =============================================================================
-- 本地开发环境初始化 — 创建 4 个独立数据库
-- 对应 4 套 Prisma Schema 各一个数据库
-- =============================================================================

-- 1. miniapps — Dashboard 公用库（users/auths/sessions/dashboard）
CREATE DATABASE IF NOT EXISTS miniapps
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 2. food_theme_generator — FTG 项目库
CREATE DATABASE IF NOT EXISTS food_theme_generator
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 3. ai_tavern — AI-Tavern 项目库
CREATE DATABASE IF NOT EXISTS ai_tavern
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 4. game1 — Game1 项目库
CREATE DATABASE IF NOT EXISTS game1
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 创建本地开发用户（如果不存在）
CREATE USER IF NOT EXISTS 'dev_user'@'%' IDENTIFIED BY 'dev_pass_123';

-- 赋予所有 4 个数据库的权限
GRANT ALL PRIVILEGES ON miniapps.* TO 'dev_user'@'%';
GRANT ALL PRIVILEGES ON food_theme_generator.* TO 'dev_user'@'%';
GRANT ALL PRIVILEGES ON ai_tavern.* TO 'dev_user'@'%';
GRANT ALL PRIVILEGES ON game1.* TO 'dev_user'@'%';

FLUSH PRIVILEGES;
