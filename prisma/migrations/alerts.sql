CREATE TABLE IF NOT EXISTS `alert_settings` (
  `id`            INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `companyId`     INT UNSIGNED   NOT NULL,
  `negativeAlert` TINYINT(1)     NOT NULL DEFAULT 1,
  `reviewAlert`   TINYINT(1)     NOT NULL DEFAULT 1,
  `weeklySummary` VARCHAR(20)    NOT NULL DEFAULT 'monday',
  `emailNotif`    VARCHAR(255)   NULL,
  `slackUrl`      VARCHAR(500)   NULL,
  `createdAt`     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `alert_settings_companyId_key` (`companyId`),
  CONSTRAINT `alert_settings_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `alert_notifications` (
  `id`        INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `companyId` INT UNSIGNED   NOT NULL,
  `type`      VARCHAR(30)    NOT NULL,
  `title`     VARCHAR(255)   NOT NULL,
  `message`   TEXT           NOT NULL,
  `read`      TINYINT(1)     NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `alert_notifications_companyId_idx` (`companyId`),
  CONSTRAINT `alert_notifications_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
