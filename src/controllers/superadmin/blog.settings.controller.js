// ═══════════════════════════════════════════════════════════
// src/controllers/superadmin/blog.settings.controller.js
// Paramètres blog : robots.txt (dev/preview/prod), base URL,
// et timestamp du dernier build de sitemap — superadmin
// ═══════════════════════════════════════════════════════════

import prisma from "../../config/database.js";

// ── Constantes ────────────────────────────────────────────────

const VALID_ENVS = ["dev", "preview", "prod"];

const DEFAULT_ROBOTS = {
  dev:     "# DEV — block all crawlers\nUser-agent: *\nDisallow: /\n",
  preview: "# PREVIEW — block all crawlers (do not index staging)\nUser-agent: *\nDisallow: /\n",
  prod:    "# PROD — allow indexing of all public content, block admin only.\nUser-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /admin/\n\nSitemap: /sitemap.xml\n",
};

// ── Helper : lire toutes les settings en un seul appel ────────

async function loadSettings() {
  const rows = await prisma.blogSetting.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
}

function buildSettingsDto(map) {
  return {
    robots: {
      dev:     map.robots_dev     ?? DEFAULT_ROBOTS.dev,
      preview: map.robots_preview ?? DEFAULT_ROBOTS.preview,
      prod:    map.robots_prod    ?? DEFAULT_ROBOTS.prod,
    },
    baseUrl:          map.sitemap_base_url  ?? "",
    sitemapLastBuild: map.sitemap_last_build || null,
  };
}

// ── GET /api/superadmin/blog/settings ────────────────────────
export const getSettings = async (req, res, next) => {
  try {
    const map = await loadSettings();
    res.json({ success: true, data: buildSettingsDto(map) });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/superadmin/blog/robots/:env ─────────────────────
// Body: { content: string }
export const updateRobotsEnv = async (req, res, next) => {
  try {
    const { env } = req.params;
    if (!VALID_ENVS.includes(env)) {
      return res.status(422).json({ success: false, error: `Unknown env "${env}". Use dev, preview or prod.` });
    }

    const content = typeof req.body.content === "string" ? req.body.content : "";

    await prisma.blogSetting.upsert({
      where:  { key: `robots_${env}` },
      update: { value: content },
      create: { key: `robots_${env}`, value: content },
    });

    res.json({ success: true, data: { env, content } });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/superadmin/blog/robots/:env ──────────────────
// Remet le contenu robots.txt par défaut pour l'env donné
export const resetRobotsEnv = async (req, res, next) => {
  try {
    const { env } = req.params;
    if (!VALID_ENVS.includes(env)) {
      return res.status(422).json({ success: false, error: `Unknown env "${env}".` });
    }

    const content = DEFAULT_ROBOTS[env];
    await prisma.blogSetting.upsert({
      where:  { key: `robots_${env}` },
      update: { value: content },
      create: { key: `robots_${env}`, value: content },
    });

    res.json({ success: true, data: { env, content } });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/superadmin/blog/settings/base-url ─────────────
// Body: { url: string }
export const updateBaseUrl = async (req, res, next) => {
  try {
    const url = (req.body.url ?? "").toString().trim().replace(/\/$/, "");

    await prisma.blogSetting.upsert({
      where:  { key: "sitemap_base_url" },
      update: { value: url },
      create: { key: "sitemap_base_url", value: url },
    });

    res.json({ success: true, data: { baseUrl: url } });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/superadmin/blog/settings/sitemap-built ─────────
// Enregistre le timestamp de génération du sitemap
export const markSitemapBuilt = async (req, res, next) => {
  try {
    const iso = new Date().toISOString();

    await prisma.blogSetting.upsert({
      where:  { key: "sitemap_last_build" },
      update: { value: iso },
      create: { key: "sitemap_last_build", value: iso },
    });

    res.json({ success: true, data: { sitemapLastBuild: iso } });
  } catch (err) {
    next(err);
  }
};
