-- ============================================================
-- Blog — migration initiale
-- Tables : blog_categories, blog_category_translations,
--          blog_tags, blog_tag_translations,
--          blog_articles, blog_article_translations,
--          blog_article_tags, blog_article_previous_slugs
-- ============================================================

-- ── Catégories ───────────────────────────────────────────────

CREATE TABLE `blog_categories` (
  `id`           VARCHAR(191) NOT NULL,
  `slug`         VARCHAR(255) NOT NULL,
  `displayOrder` INT          NOT NULL DEFAULT 0,
  `createdAt`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`    DATETIME(3)  NOT NULL,

  UNIQUE INDEX `blog_categories_slug_key` (`slug`),
  INDEX         `blog_categories_slug_idx` (`slug`),
  INDEX         `blog_categories_displayOrder_idx` (`displayOrder`),
  PRIMARY KEY   (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `blog_category_translations` (
  `id`          INT          NOT NULL AUTO_INCREMENT,
  `categoryId`  VARCHAR(191) NOT NULL,
  `lang`        VARCHAR(10)  NOT NULL,
  `name`        VARCHAR(255) NOT NULL,
  `description` TEXT         NULL,
  `slug`        VARCHAR(255) NOT NULL,
  `metaTitle`   VARCHAR(255) NULL,
  `metaDesc`    VARCHAR(500) NULL,
  `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)  NOT NULL,

  UNIQUE INDEX `blog_cat_tr_category_lang_key` (`categoryId`, `lang`),
  UNIQUE INDEX `blog_cat_tr_lang_slug_key` (`lang`, `slug`),
  INDEX         `blog_cat_tr_slug_idx` (`slug`),
  PRIMARY KEY   (`id`),
  CONSTRAINT `fk_blog_cat_tr_category`
    FOREIGN KEY (`categoryId`) REFERENCES `blog_categories` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Tags ─────────────────────────────────────────────────────

CREATE TABLE `blog_tags` (
  `id`        VARCHAR(191) NOT NULL,
  `slug`      VARCHAR(255) NOT NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)  NOT NULL,

  UNIQUE INDEX `blog_tags_slug_key` (`slug`),
  INDEX        `blog_tags_slug_idx` (`slug`),
  PRIMARY KEY  (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `blog_tag_translations` (
  `id`        INT          NOT NULL AUTO_INCREMENT,
  `tagId`     VARCHAR(191) NOT NULL,
  `lang`      VARCHAR(10)  NOT NULL,
  `name`      VARCHAR(255) NOT NULL,
  `slug`      VARCHAR(255) NOT NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)  NOT NULL,

  UNIQUE INDEX `blog_tag_tr_tag_lang_key` (`tagId`, `lang`),
  UNIQUE INDEX `blog_tag_tr_lang_slug_key` (`lang`, `slug`),
  INDEX        `blog_tag_tr_slug_idx` (`slug`),
  PRIMARY KEY  (`id`),
  CONSTRAINT `fk_blog_tag_tr_tag`
    FOREIGN KEY (`tagId`) REFERENCES `blog_tags` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Articles ─────────────────────────────────────────────────

CREATE TABLE `blog_articles` (
  `id`          VARCHAR(191) NOT NULL,
  `slug`        VARCHAR(255) NOT NULL,
  `image`       VARCHAR(500) NULL,
  `author`      VARCHAR(255) NULL,
  `date`        VARCHAR(50)  NULL,
  `readTime`    VARCHAR(50)  NULL,
  `published`   TINYINT(1)   NOT NULL DEFAULT 0,
  `publishedAt` DATETIME(3)  NULL,
  `categoryId`  VARCHAR(191) NULL,
  `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)  NOT NULL,

  UNIQUE INDEX `blog_articles_slug_key` (`slug`),
  INDEX         `blog_articles_categoryId_idx` (`categoryId`),
  INDEX         `blog_articles_published_idx` (`published`),
  INDEX         `blog_articles_slug_idx` (`slug`),
  INDEX         `blog_articles_updatedAt_idx` (`updatedAt`),
  PRIMARY KEY   (`id`),
  CONSTRAINT `fk_blog_article_category`
    FOREIGN KEY (`categoryId`) REFERENCES `blog_categories` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `blog_article_translations` (
  `id`              INT          NOT NULL AUTO_INCREMENT,
  `articleId`       VARCHAR(191) NOT NULL,
  `lang`            VARCHAR(10)  NOT NULL,
  `slug`            VARCHAR(255) NOT NULL,
  `title`           VARCHAR(255) NOT NULL,
  `excerpt`         TEXT         NULL,
  `content`         LONGTEXT     NULL,
  `metaTitle`       VARCHAR(255) NULL,
  `metaDescription` VARCHAR(500) NULL,
  `createdAt`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`       DATETIME(3)  NOT NULL,

  UNIQUE INDEX `blog_art_tr_article_lang_key` (`articleId`, `lang`),
  UNIQUE INDEX `blog_art_tr_lang_slug_key` (`lang`, `slug`),
  INDEX         `blog_art_tr_slug_idx` (`slug`),
  PRIMARY KEY   (`id`),
  CONSTRAINT `fk_blog_art_tr_article`
    FOREIGN KEY (`articleId`) REFERENCES `blog_articles` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Pivot articles ↔ tags ────────────────────────────────────

CREATE TABLE `blog_article_tags` (
  `articleId` VARCHAR(191) NOT NULL,
  `tagId`     VARCHAR(191) NOT NULL,

  PRIMARY KEY (`articleId`, `tagId`),
  CONSTRAINT `fk_bat_article`
    FOREIGN KEY (`articleId`) REFERENCES `blog_articles` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_bat_tag`
    FOREIGN KEY (`tagId`) REFERENCES `blog_tags` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Previous slugs (pour redirects 301) ─────────────────────

CREATE TABLE `blog_article_previous_slugs` (
  `id`        INT          NOT NULL AUTO_INCREMENT,
  `articleId` VARCHAR(191) NOT NULL,
  `slug`      VARCHAR(255) NOT NULL,
  `lang`      VARCHAR(10)  NOT NULL DEFAULT '',
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `blog_prev_slug_slug_lang_key` (`slug`, `lang`),
  INDEX        `blog_prev_slug_slug_idx` (`slug`),
  PRIMARY KEY  (`id`),
  CONSTRAINT `fk_blog_prev_slug_article`
    FOREIGN KEY (`articleId`) REFERENCES `blog_articles` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
