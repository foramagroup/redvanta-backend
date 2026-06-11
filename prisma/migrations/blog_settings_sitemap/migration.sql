-- ============================================================
-- Blog — Settings + Sitemap
-- Tables : blog_settings
-- Données : robots.txt defaults par env + sitemap_base_url
-- ============================================================

CREATE TABLE IF NOT EXISTS `blog_settings` (
  `key`       VARCHAR(100) NOT NULL,
  `value`     LONGTEXT     NULL,
  `updatedAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Valeurs par défaut ────────────────────────────────────────

INSERT IGNORE INTO `blog_settings` (`key`, `value`, `updatedAt`) VALUES
(
  'robots_dev',
  '# DEV — block all crawlers\nUser-agent: *\nDisallow: /\n',
  NOW(3)
),
(
  'robots_preview',
  '# PREVIEW — block all crawlers (do not index staging)\nUser-agent: *\nDisallow: /\n',
  NOW(3)
),
(
  'robots_prod',
  '# PROD — allow indexing of all public content, block admin only.\nUser-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /admin/\n\nSitemap: /sitemap.xml\n',
  NOW(3)
),
(
  'sitemap_base_url',
  '',
  NOW(3)
),
(
  'sitemap_last_build',
  NULL,
  NOW(3)
);
