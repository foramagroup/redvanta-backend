// src/controllers/client/Filtering.controller.js
// ─────────────────────────────────────────────────────────────
// Endpoints pour la vue "Smart Feedback Filtering" (admin)
//
//   GET  /filtering/config       → config actuelle (ou defaults)
//   PUT  /filtering/config       → sauvegarder la config (upsert)

//   POST /filtering/test         → simuler le filtrage pour un rating donné
// ─────────────────────────────────────────────────────────────

import prisma from "../config/database.js";

function getCompanyId(req) {
  const id = req.user?.companyId;
  if (!id) throw Object.assign(new Error(req.t("errors.forbidden")), { status: 403 });
  return parseInt(id);
}

// ─── Valeurs par défaut (retournées si aucune config n'existe encore) ──
const DEFAULTS = {
  threshold:           4,
  redirectPlatform:    "google",
  customUrl:           null,
  assignedUserId:      null,
  autoEmailEnabled:    true,
  autoEmailAddress:    null,
  autoResponseMessage:
    "Thank you for your feedback. We take every comment seriously and will address your concerns within 24 hours. Your experience matters to us.",
};

// ─── Format réponse config ────────────────────────────────────
function formatConfig(cfg, company) {
  // Résoudre l'URL de redirection effective selon la plateforme choisie
  const resolvedRedirectUrl =
    cfg.redirectPlatform === "google"
      ? (company?.googleLink || company?.googleReviewUrl || null)
      : cfg.redirectPlatform === "facebook"
      ? (company?.facebookLink || null)
      : cfg.customUrl || null;

  return {
    id:                  cfg.id   ?? null,
    threshold:           cfg.threshold,
    redirectPlatform:    cfg.redirectPlatform,
    customUrl:           cfg.customUrl,
    resolvedRedirectUrl,                      // URL finale utilisée par la carte NFC
    assignedUserId:      cfg.assignedUserId,
    assignedUser:        cfg.assignedUser
      ? { id: cfg.assignedUser.id, name: cfg.assignedUser.name, email: cfg.assignedUser.email }
      : null,
    autoEmailEnabled:    cfg.autoEmailEnabled,
    autoEmailAddress:    cfg.autoEmailAddress,
    autoResponseMessage: cfg.autoResponseMessage,
    // Rappel des plateformes disponibles depuis la company
    availablePlatforms: {
      google:   !!(company?.googleLink || company?.googleReviewUrl),
      facebook: !!company?.facebookLink,
      custom:   true,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/filtering/config
// Retourne la config existante, ou les valeurs par défaut
// ─────────────────────────────────────────────────────────────
export const getFilteringConfig = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);

    const [config, company] = await Promise.all([
      prisma.feedbackFilteringConfig.findUnique({
        where:   { companyId },
        include: {
          assignedUser: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.company.findUnique({
        where:  { id: companyId },
        select: { googleLink: true, googleReviewUrl: true, facebookLink: true, email: true },
      }),
    ]);

    if (!config) {
      // Aucune config enregistrée → renvoyer les defaults
      return res.json({
        success: true,
        data: formatConfig(
          { ...DEFAULTS, assignedUser: null },
          company
        ),
      });
    }

    res.json({ success: true, data: formatConfig(config, company) });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/admin/filtering/config
// Crée ou met à jour la config (upsert)
//
// Body :
//   threshold           Int (1–5)
//   redirectPlatform    "google" | "facebook" | "custom"
//   customUrl           String? (si redirectPlatform = custom)
//   assignedUserId      Int?
//   autoEmailEnabled    Boolean
//   autoEmailAddress    String?
//   autoResponseMessage String?
// ─────────────────────────────────────────────────────────────
export const saveFilteringConfig = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const {
      threshold,
      redirectPlatform,
      customUrl,
      assignedUserId,
      autoEmailEnabled,
      autoEmailAddress,
      autoResponseMessage,
    } = req.body;

    // ── Validation ────────────────────────────────────────────
    const parsedThreshold = parseInt(threshold);
    if (isNaN(parsedThreshold) || parsedThreshold < 1 || parsedThreshold > 5) {
      return res.status(422).json({
        success: false,
        error:   req.t("admin.filtering.invalid_threshold"),
      });
    }

    const validPlatforms = ["google", "facebook", "custom"];
    if (redirectPlatform && !validPlatforms.includes(redirectPlatform)) {
      return res.status(422).json({
        success: false,
        error:   req.t("admin.filtering.invalid_platform"),
      });
    }

    if (redirectPlatform === "custom" && !customUrl?.trim()) {
      return res.status(422).json({
        success: false,
        error:   req.t("admin.filtering.custom_url_required"),
      });
    }

    // Vérifier que l'utilisateur assigné appartient bien à la company
    if (assignedUserId) {
      const member = await prisma.userCompany.findFirst({
        where: { userId: parseInt(assignedUserId), companyId },
      });
      if (!member) {
        return res.status(422).json({
          success: false,
          error:   req.t("admin.filtering.assigned_user_not_member"),
        });
      }
    }

    // ── Upsert ────────────────────────────────────────────────
    const data = {
      threshold:           parsedThreshold,
      redirectPlatform:    redirectPlatform   ?? DEFAULTS.redirectPlatform,
      customUrl:           redirectPlatform === "custom" ? (customUrl?.trim() || null) : null,
      assignedUserId:      assignedUserId     ? parseInt(assignedUserId) : null,
      autoEmailEnabled:    autoEmailEnabled   !== undefined ? Boolean(autoEmailEnabled) : DEFAULTS.autoEmailEnabled,
      autoEmailAddress:    autoEmailAddress?.trim()    || null,
      autoResponseMessage: autoResponseMessage?.trim() || null,
    };

    const config = await prisma.feedbackFilteringConfig.upsert({
      where:  { companyId },
      create: { companyId, ...data },
      update: data,
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    });

    const company = await prisma.company.findUnique({
      where:  { id: companyId },
      select: { googleLink: true, googleReviewUrl: true, facebookLink: true, email: true },
    });

    console.log(`[filtering] Config sauvegardée pour company #${companyId} — threshold=${parsedThreshold}`);

    res.json({ success: true, data: formatConfig(config, company) });
  } catch (e) {
    next(e);
  }
};


// ─────────────────────────────────────────────────────────────
// POST /api/admin/filtering/test
// Simule le comportement du filtrage pour un rating donné.
// Utilisé par le bouton "Test Filtering" de la vue.
//
// Body : { rating: Int (1–5) }
// ─────────────────────────────────────────────────────────────
export const testFiltering = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const rating    = parseInt(req.body.rating);

    if (isNaN(rating) || rating < 1 || rating > 5) {
      return res.status(422).json({
        success: false,
        error:   req.t("admin.filtering.invalid_rating"),
      });
    }

    // Récupérer config + company en parallèle
    const [config, company] = await Promise.all([
      prisma.feedbackFilteringConfig.findUnique({
        where: { companyId },
      }),
      prisma.company.findUnique({
        where:  { id: companyId },
        select: { googleLink: true, googleReviewUrl: true, facebookLink: true, customReviewLink: true },
      }),
    ]);

    const threshold       = config?.threshold        ?? DEFAULTS.threshold;
    const redirectPlatform = config?.redirectPlatform ?? DEFAULTS.redirectPlatform;

    // Résoudre l'URL de destination selon la plateforme
    const redirectUrl =
      redirectPlatform === "google"
        ? (company?.googleLink || company?.googleReviewUrl || null)
        : redirectPlatform === "facebook"
        ? (company?.facebookLink || null)
        : (config?.customUrl || company?.customReviewLink || null);

    const isPublic  = rating >= threshold;
    const isPrivate = !isPublic;

    res.json({
      success: true,
      data: {
        rating,
        threshold,
        // Chemin emprunté
        route: isPublic ? "public" : "private",
        // Détails du chemin public
        public: isPublic
          ? {
              platform:    redirectPlatform,
              redirectUrl,
              message:     req.t("admin.filtering.test_public_message", { rating, threshold, platform: redirectPlatform }),
            }
          : null,
        // Détails du chemin privé
        private: isPrivate
          ? {
              showForm:            true,
              autoResponseMessage: config?.autoResponseMessage ?? DEFAULTS.autoResponseMessage,
              notifyEmail:         config?.autoEmailEnabled    ?? DEFAULTS.autoEmailEnabled
                ? (config?.autoEmailAddress ?? null)
                : null,
              assignedUserId:      config?.assignedUserId ?? null,
              message:             req.t("admin.filtering.test_private_message", { rating, threshold }),
            }
          : null,
      },
    });
  } catch (e) {
    next(e);
  }
};
