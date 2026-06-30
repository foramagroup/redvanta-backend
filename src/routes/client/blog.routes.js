// ═══════════════════════════════════════════════════════════
// src/routes/client/blog.routes.js
// Routes blog publiques — aucune auth requise
// ═══════════════════════════════════════════════════════════

import express from "express";
import {
  listPublicArticles,
  listPublicCategories,
  listPublicTags,
  listPublicHubs,
  getPublicHub,
  listPublicClusters,
  getPublicCluster,
  trackPageview,
} from "../../controllers/client/blog.controller.js";

const router = express.Router();

// Public — aucun middleware d'auth
router.get  ("/articles",             listPublicArticles);
router.get  ("/categories",           listPublicCategories);
router.get  ("/tags",                 listPublicTags);
router.get  ("/hubs",                 listPublicHubs);
router.get  ("/hubs/:slug",           getPublicHub);
router.get  ("/clusters",             listPublicClusters);
router.get  ("/clusters/:slug",       getPublicCluster);
router.post ("/articles/:id/view",    trackPageview);

export default router;
