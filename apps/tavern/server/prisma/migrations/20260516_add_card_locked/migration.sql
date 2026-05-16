-- 为 CharacterCard 表添加 locked 字段
-- 锁定后卡片不可删除，用于保护官方重要卡片
ALTER TABLE `CharacterCard` ADD COLUMN `locked` BOOLEAN NOT NULL DEFAULT false;
