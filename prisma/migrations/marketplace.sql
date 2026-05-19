CREATE TABLE IF NOT EXISTS `marketplace_integrations` (
  `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(100)  NOT NULL,
  `description` TEXT          NOT NULL,
  `category`    VARCHAR(50)   NOT NULL,
  `logoUrl`     VARCHAR(500)  NULL,
  `active`      TINYINT(1)    NOT NULL DEFAULT 1,
  `sortOrder`   INT           NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `company_integrations` (
  `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `companyId`     INT UNSIGNED  NOT NULL,
  `integrationId` INT UNSIGNED  NOT NULL,
  `status`        VARCHAR(20)   NOT NULL DEFAULT 'connected',
  `apiKey`        VARCHAR(500)  NULL,
  `apiSecret`     VARCHAR(500)  NULL,
  `connectedAt`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `company_integrations_companyId_integrationId_key` (`companyId`, `integrationId`),
  INDEX `company_integrations_companyId_idx` (`companyId`),
  CONSTRAINT `ci_company_fkey`      FOREIGN KEY (`companyId`)     REFERENCES `companies` (`id`)                  ON DELETE CASCADE,
  CONSTRAINT `ci_integration_fkey`  FOREIGN KEY (`integrationId`) REFERENCES `marketplace_integrations` (`id`)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `company_webhooks` (
  `id`        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `companyId` INT UNSIGNED  NOT NULL,
  `token`     VARCHAR(64)   NOT NULL,
  `active`    TINYINT(1)    NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `company_webhooks_companyId_key` (`companyId`),
  UNIQUE KEY `company_webhooks_token_key` (`token`),
  CONSTRAINT `cw_company_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed des intégrations du catalogue
INSERT IGNORE INTO `marketplace_integrations` (`name`, `description`, `category`, `sortOrder`) VALUES
  ('Square',      'Sync customer data from Square POS transactions.',           'POS Systems',    1),
  ('Clover',      'Integrate with Clover point-of-sale systems.',               'POS Systems',    2),
  ('Toast POS',   'Connect restaurant POS data for automated requests.',        'POS Systems',    3),
  ('HubSpot',     'Bi-directional sync with HubSpot CRM contacts.',            'CRM',            1),
  ('Salesforce',  'Enterprise CRM integration with custom field mapping.',      'CRM',            2),
  ('Zoho CRM',    'Import contacts and track review interactions.',             'CRM',            3),
  ('Shopify',     'Post-purchase review request automation.',                   'E-commerce',     1),
  ('WooCommerce', 'WordPress e-commerce order sync.',                           'E-commerce',     2),
  ('Zapier',      'Connect 5,000+ apps with custom workflows.',                 'Automation',     1),
  ('Make',        'Advanced automation scenarios with visual builder.',         'Automation',     2),
  ('Twilio',      'Send SMS review requests via Twilio.',                       'Communication',  1),
  ('SendGrid',    'Email-based review request delivery.',                       'Communication',  2),
  ('Slack',       'Real-time review notifications in Slack channels.',          'Communication',  3);
