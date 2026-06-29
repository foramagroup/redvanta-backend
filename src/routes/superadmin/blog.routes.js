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

import {
  listHubs,
  getHub,
  createHub,
  updateHub,
  toggleHubPublish,
  deleteHub,
} from "../../controllers/superadmin/blog.hubs.controller.js";

import { getBlogAnalytics }                       from "../../controllers/superadmin/blog.analytics.controller.js";
import { generateBlogContent, generateBlogBulk }  from "../../controllers/superadmin/blog.ai.controller.js";
import { getRedirectMap }    from "../../controllers/superadmin/blog.redirects.controller.js";
import { getSitemap }        from "../../controllers/superadmin/blog.sitemap.controller.js";
import { getDashboardStats } from "../../controllers/superadmin/blog.dashboard.controller.js";

import {
  listClusters, getCluster, createCluster, updateCluster, deleteCluster,
} from "../../controllers/superadmin/blog.clusters.controller.js";

import {
  listKeywords, searchKeywords, getKeyword, createKeyword, updateKeyword, deleteKeyword,
} from "../../controllers/superadmin/blog.keywords.controller.js";

import {
  listPromptTemplates, getPromptTemplate, createPromptTemplate,
  updatePromptTemplate, togglePromptTemplate, deletePromptTemplate,
} from "../../controllers/superadmin/blog.prompt-templates.controller.js";

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

// ─── Hubs (pillar pages) ──────────────────────────────────────
router.get    ("/hubs",                     listHubs);
router.post   ("/hubs",                     createHub);
router.get    ("/hubs/:id",                 getHub);
router.put    ("/hubs/:id",                 updateHub);
router.patch  ("/hubs/:id/publish",         toggleHubPublish);
router.delete ("/hubs/:id",                 deleteHub);

// ─── Clusters ────────────────────────────────────────────────
router.get    ("/clusters",                 listClusters);
router.post   ("/clusters",                 createCluster);
router.get    ("/clusters/:id",             getCluster);
router.put    ("/clusters/:id",             updateCluster);
router.delete ("/clusters/:id",             deleteCluster);

// ─── Keywords ────────────────────────────────────────────────
router.get    ("/keywords",                 listKeywords);
router.get    ("/keywords/search",          searchKeywords);
router.post   ("/keywords",                 createKeyword);
router.get    ("/keywords/:id",             getKeyword);
router.put    ("/keywords/:id",             updateKeyword);
router.delete ("/keywords/:id",             deleteKeyword);

// ─── Prompt Templates ────────────────────────────────────────
router.get    ("/prompt-templates",                    listPromptTemplates);
router.post   ("/prompt-templates",                    createPromptTemplate);
router.get    ("/prompt-templates/:id",                getPromptTemplate);
router.put    ("/prompt-templates/:id",                updatePromptTemplate);
router.patch  ("/prompt-templates/:id/toggle",         togglePromptTemplate);
router.delete ("/prompt-templates/:id",                deletePromptTemplate);

// ─── AI content generation ────────────────────────────────────
router.post   ("/ai/generate",              generateBlogContent);
router.post   ("/ai/generate-bulk",         generateBlogBulk);

// ─── Analytics ────────────────────────────────────────────────
router.get    ("/analytics",                getBlogAnalytics);

// ─── Dashboard stats ──────────────────────────────────────────
router.get    ("/dashboard",                getDashboardStats);

// ─── Redirect map ─────────────────────────────────────────────
router.get    ("/redirects",                getRedirectMap);

// ─── Sitemap (JSON ou XML via ?format=xml) ────────────────────
router.get    ("/sitemap",                  getSitemap);

export default router;
