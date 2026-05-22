-- ============================================================
-- Migration: add_user_tier_and_model_meta
-- 新增 UserTier 用户等级表 + ModelMeta AI 模型元表
-- ============================================================

-- CreateTable: UserTier
CREATE TABLE `UserTier` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `tier` ENUM('FREE', 'PAID', 'TESTER') NOT NULL DEFAULT 'FREE',
    `level` INTEGER NOT NULL DEFAULT 1,
    `maxDailyQuota` INTEGER NOT NULL DEFAULT 20,
    `maxSessions` INTEGER NOT NULL DEFAULT 5,
    `maxCharacters` INTEGER NOT NULL DEFAULT 3,
    `maxPersonas` INTEGER NOT NULL DEFAULT 2,
    `xp` INTEGER NOT NULL DEFAULT 0,
    `xpToNext` INTEGER NOT NULL DEFAULT 100,
    `permissions` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `UserTier_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: ModelMeta
CREATE TABLE `ModelMeta` (
    `modelId` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `icon` VARCHAR(191) NULL,
    `minTier` ENUM('FREE', 'PAID', 'TESTER') NOT NULL DEFAULT 'FREE',
    `minLevel` INTEGER NOT NULL DEFAULT 1,
    `quotaCost` INTEGER NOT NULL DEFAULT 1,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `ModelMeta_minTier_sortOrder_idx`(`minTier`, `sortOrder`),
    PRIMARY KEY (`modelId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: UserTier → shared_users
ALTER TABLE `UserTier` ADD CONSTRAINT `UserTier_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `shared_users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
