-- ============================================================
-- Migration: Merge scenario + firstMsg into prompt
-- 
-- 1. 将现有 scenario 和 firstMsg 内容合并到 prompt 字段
-- 2. 删除 scenario 和 first_msg 列
-- ============================================================

-- Step 1: 合并 scenario 到 prompt
UPDATE `Card`
SET `prompt` = CONCAT(
    COALESCE(`prompt`, ''),
    '\n\n【场景设定】',
    `scenario`
)
WHERE `scenario` IS NOT NULL AND `scenario` != '';

-- Step 2: 合并 firstMsg 到 prompt
UPDATE `Card`
SET `prompt` = CONCAT(
    COALESCE(`prompt`, ''),
    '\n\n【开场白】',
    `first_msg`
)
WHERE `first_msg` IS NOT NULL AND `first_msg` != '';

-- Step 3: 删除旧列
ALTER TABLE `Card`
  DROP COLUMN `scenario`,
  DROP COLUMN `first_msg`;
