// ═══════════════════════════════════════════════════════════
// src/routes/superadmin/blog.routes.js
// Routes Blog (Articles · Categories · Tags · Settings ·
//              Redirects · Sitemap) — superadmin
// ═══════════════════════════════════════════════════════════

import express from "express";

import {
  listArticles,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
  togglePublish,
  bulkArticles,
} from "../../controllers/superadmin/blog.articles.controller.js";

import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from "../../controllers/superadmin/blog.categories.controller.js";

import {
  listTags,
  getTag,
  createTag,
  updateTag,
  deleteTag,
} from "../../controllers/superadmin/blog.tags.controller.js";

import {
  getSettings,
  updateRobotsEnv,
  resetRobotsEnv,
  updateBaseUrl,
  markSitemapBuilt,
} from "../../controllers/superadmin/blog.settings.controller.js";

import { getRedirectMap }    from "../../controllers/superadmin/blog.redirects.controller.js";
import { getSitemap }        from "../../controllers/superadmin/blog.sitemap.controller.js";
import { getDashboardStats } from "../../controllers/superadmin/blog.dashboard.controller.js";

import {
  authenticateSuperAdmin,
  requireSuperAdmin,
} from "../../middleware/auth.middleware.js";

const router = express.Router();

// Toutes les routes nécessitent superadmin authentifié
router.use(authenticateSuperAdmin, requireSuperAdmin);

// ─── Articles ────────────────────────────────────────────────
router.get    ("/articles",                 listArticles);
router.post   ("/articles",                 createArticle);
router.post   ("/articles/bulk",            bulkArticles);
router.get    ("/articles/:id",             getArticle);
router.put    ("/articles/:id",             updateArticle);
router.patch  ("/articles/:id/publish",     togglePublish);
router.delete ("/articles/:id",             deleteArticle);

// ─── Categories ──────────────────────────────────────────────
router.get    ("/categories",               listCategories);
router.post   ("/categories",               createCategory);
router.post   ("/categories/reorder",       reorderCategories);
router.get    ("/categories/:id",           getCategory);
router.put    ("/categories/:id",           updateCategory);
router.delete ("/categories/:id",           deleteCategory);

// ─── Tags ────────────────────────────────────────────────────
router.get    ("/tags",                     listTags);
router.post   ("/tags",                     createTag);
router.get    ("/tags/:id",                 getTag);
router.put    ("/tags/:id",                 updateTag);
router.delete ("/tags/:id",                 deleteTag);

// ─── Settings (robots.txt + base URL + sitemap build time) ───
router.get    ("/settings",                 getSettings);
router.patch  ("/settings/base-url",        updateBaseUrl);
router.post   ("/settings/sitemap-built",   markSitemapBuilt);
router.put    ("/robots/:env",              updateRobotsEnv);
router.delete ("/robots/:env",              resetRobotsEnv);

// ─── Dashboard stats ──────────────────────────────────────────
router.get    ("/dashboard",                getDashboardStats);

// ─── Redirect map ─────────────────────────────────────────────
router.get    ("/redirects",                getRedirectMap);

// ─── Sitemap (JSON ou XML via ?format=xml) ────────────────────
router.get    ("/sitemap",                  getSitemap);

export default router;
