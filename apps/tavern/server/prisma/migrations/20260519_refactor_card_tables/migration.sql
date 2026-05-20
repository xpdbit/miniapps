-- ============================================================
-- 卡片表重构：移除 Character 前缀 + 列变更
-- 原表名: CharacterCard / CharacterCardFav / CharacterCardLike 等
-- 新表名: Card / CardFav / CardLike 等
-- 列变更: +prompt, -personality, -example_dialogs, -lore, -system_prompt, -nsfw
-- 执行前请备份数据库！
-- ============================================================

-- ─── 1. 重命名主表 ────────────────────────────────────────────

-- 尝试重命名 CharacterCard → Card（如果存在）
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables 
  WHERE table_schema = DATABASE() AND table_name = 'CharacterCard');

SET @sql_rename_card = IF(@table_exists > 0,
  'RENAME TABLE `CharacterCard` TO `Card`',
  'SELECT "Table CharacterCard not found, skipped" AS info');
PREPARE stmt FROM @sql_rename_card;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 尝试重命名 CharacterCardFav → CardFav
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables 
  WHERE table_schema = DATABASE() AND table_name = 'CharacterCardFav');

SET @sql_rename_fav = IF(@table_exists > 0,
  'RENAME TABLE `CharacterCardFav` TO `CardFav`',
  'SELECT "Table CharacterCardFav not found, skipped" AS info');
PREPARE stmt FROM @sql_rename_fav;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 尝试重命名 CharacterCardLike → CardLike
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables 
  WHERE table_schema = DATABASE() AND table_name = 'CharacterCardLike');

SET @sql_rename_like = IF(@table_exists > 0,
  'RENAME TABLE `CharacterCardLike` TO `CardLike`',
  'SELECT "Table CharacterCardLike not found, skipped" AS info');
PREPARE stmt FROM @sql_rename_like;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 尝试重命名 CharacterChatSession → ChatSession
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables 
  WHERE table_schema = DATABASE() AND table_name = 'CharacterChatSession');

SET @sql_rename_chat = IF(@table_exists > 0,
  'RENAME TABLE `CharacterChatSession` TO `ChatSession`',
  'SELECT "Table CharacterChatSession not found, skipped" AS info');
PREPARE stmt FROM @sql_rename_chat;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 尝试重命名 CharacterChatMessage → ChatMessage
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables 
  WHERE table_schema = DATABASE() AND table_name = 'CharacterChatMessage');

SET @sql_rename_msg = IF(@table_exists > 0,
  'RENAME TABLE `CharacterChatMessage` TO `ChatMessage`',
  'SELECT "Table CharacterChatMessage not found, skipped" AS info');
PREPARE stmt FROM @sql_rename_msg;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ─── 2. 列变更：Card 表 ────────────────────────────────────────

-- 2a. 新增 prompt 列（合并原 personality + lore + systemPrompt + exampleDialogs）
-- 先检查列是否存在再添加
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = DATABASE() AND table_name = 'Card' AND column_name = 'prompt');

SET @sql_add_prompt = IF(@col_exists = 0,
  'ALTER TABLE `Card` ADD COLUMN `prompt` TEXT NULL AFTER `card_type`',
  'SELECT "Column prompt already exists, skipped" AS info');
PREPARE stmt FROM @sql_add_prompt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2b. 删除旧列（personality, example_dialogs, lore, system_prompt, nsfw）
-- 使用动态 SQL 避免列不存在时报错
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = DATABASE() AND table_name = 'Card' AND column_name = 'personality');
SET @sql_drop = IF(@col_exists > 0, 'ALTER TABLE `Card` DROP COLUMN `personality`', 'SELECT "skip personality" AS info');
PREPARE stmt FROM @sql_drop; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = DATABASE() AND table_name = 'Card' AND column_name = 'example_dialogs');
SET @sql_drop = IF(@col_exists > 0, 'ALTER TABLE `Card` DROP COLUMN `example_dialogs`', 'SELECT "skip example_dialogs" AS info');
PREPARE stmt FROM @sql_drop; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = DATABASE() AND table_name = 'Card' AND column_name = 'lore');
SET @sql_drop = IF(@col_exists > 0, 'ALTER TABLE `Card` DROP COLUMN `lore`', 'SELECT "skip lore" AS info');
PREPARE stmt FROM @sql_drop; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = DATABASE() AND table_name = 'Card' AND column_name = 'system_prompt');
SET @sql_drop = IF(@col_exists > 0, 'ALTER TABLE `Card` DROP COLUMN `system_prompt`', 'SELECT "skip system_prompt" AS info');
PREPARE stmt FROM @sql_drop; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = DATABASE() AND table_name = 'Card' AND column_name = 'nsfw');
SET @sql_drop = IF(@col_exists > 0, 'ALTER TABLE `Card` DROP COLUMN `nsfw`', 'SELECT "skip nsfw" AS info');
PREPARE stmt FROM @sql_drop; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── 3. 验证 ──────────────────────────────────────────────────
SELECT 'Migration completed. New table structure:' AS info;
SHOW COLUMNS FROM `Card`;
