CREATE TABLE IF NOT EXISTS `automation_workflows` (
  `id`            INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `companyId`     INT UNSIGNED   NOT NULL,
  `name`          VARCHAR(255)   NOT NULL,
  `trigger`       VARCHAR(50)    NOT NULL,
  `action`        VARCHAR(20)    NOT NULL,
  `delay`         VARCHAR(30)    NOT NULL,
  `template`      TEXT           NOT NULL,
  `enabled`       TINYINT(1)     NOT NULL DEFAULT 0,
  `statSent`      INT            NOT NULL DEFAULT 0,
  `statConverted` INT            NOT NULL DEFAULT 0,
  `createdAt`     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `automation_workflows_companyId_idx` (`companyId`),
  CONSTRAINT `automation_workflows_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
