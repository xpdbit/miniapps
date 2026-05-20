-- Add base_url column to ApiKey table for custom API base URL
ALTER TABLE `ApiKey` ADD COLUMN `base_url` VARCHAR(255) DEFAULT NULL AFTER `key_value`;
