-- CreateTable
CREATE TABLE `platform_settings` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform_name` VARCHAR(150) NOT NULL,
    `default_email_sender` VARCHAR(150) NOT NULL,
    `sms_setting_id` INTEGER UNSIGNED NULL,
    `rate_limit` INTEGER NOT NULL DEFAULT 60,
    `is_maintenance` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `platform_settings_sms_setting_id_idx`(`sms_setting_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlanSetting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `price` INTEGER NOT NULL,
    `annual` INTEGER NOT NULL,
    `apiLimit` VARCHAR(191) NOT NULL,
    `smsLimit` VARCHAR(191) NOT NULL,
    `locationLimit` INTEGER NOT NULL,
    `trialDays` INTEGER NOT NULL,
    `trialFeatures` JSON NOT NULL,
    `features` JSON NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sms_regions` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sms_suppliers` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sms_settings` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `supplier_id` INTEGER UNSIGNED NOT NULL,
    `region_id` INTEGER UNSIGNED NOT NULL,
    `api_key` VARCHAR(255) NULL,
    `auth_token` VARCHAR(255) NULL,
    `phone_number` VARCHAR(50) NULL,
    `set_default` BOOLEAN NULL DEFAULT false,
    `status` BOOLEAN NULL DEFAULT true,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_sms_region`(`region_id`),
    INDEX `fk_sms_supplier`(`supplier_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `platform_settings` ADD CONSTRAINT `platform_settings_sms_setting_id_fkey` FOREIGN KEY (`sms_setting_id`) REFERENCES `sms_settings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sms_settings` ADD CONSTRAINT `fk_sms_region` FOREIGN KEY (`region_id`) REFERENCES `sms_regions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sms_settings` ADD CONSTRAINT `fk_sms_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `sms_suppliers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
