// src/controllers/client/widget.controller.js
// ─────────────────────────────────────────────────────────────
// Routes publiques appelées par widget.js (token-based, pas de JWT)
//
// GET  /api/client/widgets/:widgetId?token=TOKEN&locale=fr
//      → retourne config + i18n + googleReviewUrl
//
// POST /api/client/widget-reviews
//      → soumet un avis ou feedback (rating >= seuil → Review; < seuil → Feedback)
//
// POST /api/client/widgets/event
//      → tracker view/open pour les analytics
// ─────────────────────────────────────────────────────────────

import prisma from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";

// Locales supportées par widget.js
const SUPPORTED_LOCALES = ["en", "fr", "es", "de", "ro", "ru", "ar", "zh"];

function resolveLocale(raw) {
  if (!raw) return "en";
  // format "auto:en" → on prend après ":"
  const locale = raw.startsWith("auto:") ? raw.slice(5) : raw;
  const lang   = locale.split("-")[0].toLowerCase();
  return SUPPORTED_LOCALES.includes(lang) ? lang : "en";
}

// Traductions i18n inline pour widget.js (minimalistes)
const I18N = {
  en: {
    title:       "Share your experience",
    subtitle:    "How would you rate us?",
    name_label:  "Your name",
    email_label: "Your email",
    comment_label: "Tell us more (optional)",
    submit:      "Send",
    thanks:      "Thank you!",
    thanks_public:  "Your review helps others. Click below to post it on Google.",
    thanks_private: "Your feedback has been received. We will contact you shortly.",
    google_btn:  "Post on Google",
    rating_low:  "Not satisfied",
    rating_high: "Very satisfied",
    powered_by:  "Powered by Opinoor",
  },
  fr: {
    title:       "Partagez votre expérience",
    subtitle:    "Comment évaluez-vous notre service ?",
    name_label:  "Votre nom",
    email_label: "Votre e-mail",
    comment_label: "Dites-nous en plus (optionnel)",
    submit:      "Envoyer",
    thanks:      "Merci !",
    thanks_public:  "Votre avis aide les autres. Cliquez ci-dessous pour le publier sur Google.",
    thanks_private: "Votre retour a été reçu. Nous vous contacterons rapidement.",
    google_btn:  "Publier sur Google",
    rating_low:  "Pas satisfait",
    rating_high: "Très satisfait",
    powered_by:  "Propulsé par Opinoor",
  },
  es: {
    title:       "Comparte tu experiencia",
    subtitle:    "¿Cómo nos valorarías?",
    name_label:  "Tu nombre",
    email_label: "Tu correo",
    comment_label: "Cuéntanos más (opcional)",
    submit:      "Enviar",
    thanks:      "¡Gracias!",
    thanks_public:  "Tu reseña ayuda a otros. Haz clic abajo para publicarla en Google.",
    thanks_private: "Tus comentarios han sido recibidos. Te contactaremos pronto.",
    google_btn:  "Publicar en Google",
    rating_low:  "No satisfecho",
    rating_high: "Muy satisfecho",
    powered_by:  "Desarrollado por Opinoor",
  },
  de: {
    title:       "Teilen Sie Ihre Erfahrung",
    subtitle:    "Wie würden Sie uns bewerten?",
    name_label:  "Ihr Name",
    email_label: "Ihre E-Mail",
    comment_label: "Erzählen Sie uns mehr (optional)",
    submit:      "Senden",
    thanks:      "Danke!",
    thanks_public:  "Ihre Bewertung hilft anderen. Klicken Sie unten, um sie auf Google zu veröffentlichen.",
    thanks_private: "Ihr Feedback wurde empfangen. Wir werden Sie bald kontaktieren.",
    google_btn:  "Auf Google veröffentlichen",
    rating_low:  "Nicht zufrieden",
    rating_high: "Sehr zufrieden",
    powered_by:  "Unterstützt von Opinoor",
  },
  ro: {
    title:       "Împărtășește experiența ta",
    subtitle:    "Cum ne-ai evalua?",
    name_label:  "Numele tău",
    email_label: "E-mailul tău",
    comment_label: "Spune-ne mai mult (opțional)",
    submit:      "Trimite",
    thanks:      "Mulțumim!",
    thanks_public:  "Recenzia ta îi ajută pe alții. Apasă mai jos pentru a o posta pe Google.",
    thanks_private: "Feedback-ul a fost primit. Te vom contacta în curând.",
    google_btn:  "Postează pe Google",
    rating_low:  "Nesatisfăcut",
    rating_high: "Foarte satisfăcut",
    powered_by:  "Alimentat de Opinoor",
  },
  ru: {
    title:       "Поделитесь своим опытом",
    subtitle:    "Как вы бы оценили нас?",
    name_label:  "Ваше имя",
    email_label: "Ваш email",
    comment_label: "Расскажите подробнее (необязательно)",
    submit:      "Отправить",
    thanks:      "Спасибо!",
    thanks_public:  "Ваш отзыв помогает другим. Нажмите ниже, чтобы опубликовать его в Google.",
    thanks_private: "Ваш отзыв получен. Мы свяжемся с вами в ближайшее время.",
    google_btn:  "Опубликовать в Google",
    rating_low:  "Не удовлетворён",
    rating_high: "Очень удовлетворён",
    powered_by:  "Работает на Opinoor",
  },
  ar: {
    title:       "شاركنا تجربتك",
    subtitle:    "كيف تقيّمنا؟",
    name_label:  "اسمك",
    email_label: "بريدك الإلكتروني",
    comment_label: "أخبرنا أكثر (اختياري)",
    submit:      "إرسال",
    thanks:      "شكراً لك!",
    thanks_public:  "مراجعتك تساعد الآخرين. انقر أدناه لنشرها على Google.",
    thanks_private: "تم استلام ملاحظاتك. سنتواصل معك قريباً.",
    google_btn:  "نشر على Google",
    rating_low:  "غير راضٍ",
    rating_high: "راضٍ جداً",
    powered_by:  "مدعوم من Opinoor",
  },
  zh: {
    title:       "分享您的体验",
    subtitle:    "您如何评价我们？",
    name_label:  "您的姓名",
    email_label: "您的邮箱",
    comment_label: "告诉我们更多（可选）",
    submit:      "提交",
    thanks:      "感谢您！",
    thanks_public:  "您的评论对其他人很有帮助。点击下方在Google上发布。",
    thanks_private: "您的反馈已收到。我们将很快与您联系。",
    google_btn:  "在Google上发布",
    rating_low:  "不满意",
    rating_high: "非常满意",
    powered_by:  "由 Opinoor 提供支持",
  },
};

// ─────────────────────────────────────────────────────────────
// GET /api/client/widgets/:widgetId?token=TOKEN&locale=fr
// Appelé par widget.js au chargement
// ─────────────────────────────────────────────────────────────
export const getWidgetConfig = async (req, res, next) => {
  try {
    const { widgetId }  = req.params;
    const { token, locale: rawLocale } = req.query;

    if (!token) {
      return res.status(400).json({ success: false, error: "Token manquant." });
    }

    const id = parseInt(widgetId);
    if (isNaN(id)) {
      return res.status(404).json({ success: false, error: "Widget introuvable." });
    }

    const widget = await prisma.reviewWidget.findFirst({
      where: { id, token },
      include: {
        company: {
          select: {
            id:             true,
            primaryColor:   true,
            googleReviewUrl: true,
            googleLink:     true,
            filteringConfig: {
              select: { threshold: true, redirectPlatform: true, customUrl: true },
            },
          },
        },
      },
    });

    if (!widget) {
      return res.status(404).json({ success: false, error: "Widget introuvable ou token invalide." });
    }

    if (widget.status !== "active") {
      return res.status(403).json({ success: false, error: "Ce widget est désactivé." });
    }

    const locale         = resolveLocale(rawLocale);
    const i18n           = I18N[locale] ?? I18N["en"];
    const threshold      = widget.company.filteringConfig?.threshold ?? 4;
    const googleReviewUrl = widget.company.googleLink ?? widget.company.googleReviewUrl ?? null;

    // Incrémenter viewsCount de façon non-bloquante
    prisma.reviewWidget.update({
      where: { id: widget.id },
      data:  { viewsCount: { increment: 1 } },
    }).catch(() => {});

    res.json({
      success: true,
      data: {
        config: {
          ...(widget.config ?? {}),
          type:        widget.type,
          widgetId:    widget.id,
          primaryColor: widget.config?.primary ?? widget.company.primaryColor,
        },
        i18n,
        threshold,
        googleReviewUrl,
      },
    });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/client/widget-reviews
// Payload: { widgetId, token, rating, name?, email?, comment?, locale?, page?, referrer? }
// ─────────────────────────────────────────────────────────────
export const submitWidgetReview = async (req, res, next) => {
  try {
    const {
      widgetId: rawWidgetId,
      token,
      rating: rawRating,
      name,
      email,
      comment,
      locale: rawLocale = "en",
      page,
      referrer,
    } = req.body;

    const widgetId = parseInt(rawWidgetId);
    const rating   = parseInt(rawRating);

    if (isNaN(widgetId) || !token) {
      return res.status(400).json({ success: false, error: "widgetId et token sont requis." });
    }
    if (isNaN(rating) || rating < 1 || rating > 5) {
      return res.status(422).json({ success: false, error: "La note doit être entre 1 et 5." });
    }

    const widget = await prisma.reviewWidget.findFirst({
      where: { id: widgetId, token },
      include: {
        company: {
          select: {
            id:              true,
            googleReviewUrl: true,
            googleLink:      true,
            email:           true,
            filteringConfig: {
              select: {
                threshold:           true,
                redirectPlatform:    true,
                customUrl:           true,
                autoEmailEnabled:    true,
                autoEmailAddress:    true,
                autoResponseMessage: true,
              },
            },
          },
        },
      },
    });

    if (!widget) {
      return res.status(404).json({ success: false, error: "Widget introuvable ou token invalide." });
    }
    if (widget.status !== "active") {
      return res.status(403).json({ success: false, error: "Ce widget est désactivé." });
    }

    const companyId   = widget.companyId;
    const threshold   = widget.company.filteringConfig?.threshold ?? 4;
    const isPublic    = rating >= threshold;
    const locale      = resolveLocale(rawLocale);
    const ipAddress   = (req.ip ?? req.connection?.remoteAddress ?? "").replace("::ffff:", "");
    const userAgent   = req.headers["user-agent"]?.slice(0, 500) ?? null;

    let linkedReviewId = null;

    // ── Chemin positif : créer une Review dans la table reviews ──
    if (isPublic) {
      const review = await prisma.review.create({
        data: {
          id:         uuidv4(),
          companyId,
          rating,
          authorName: name?.trim()    || null,
          email:      email?.trim()   || null,
          comment:    comment?.trim() || null,
          source:     "widget",
          status:     "pending",
        },
      });
      linkedReviewId = review.id;
    }

    // ── Chemin négatif : enregistré dans widget_submissions uniquement ──
    // (pas de Feedback NFC car cardUid est requis dans ce modèle)

    // ── Enregistrer la soumission pour analytics ─────────────────
    await prisma.widgetSubmission.create({
      data: {
        widgetId,
        companyId,
        rating,
        name:           name?.trim()    || null,
        email:          email?.trim()   || null,
        comment:        comment?.trim() || null,
        locale,
        page:           page?.slice(0, 500)     || null,
        referrer:       referrer?.slice(0, 500) || null,
        ipAddress:      ipAddress || null,
        userAgent,
        isPublic,
        linkedReviewId,
      },
    });

    // Incrémenter submissionsCount de façon non-bloquante
    prisma.reviewWidget.update({
      where: { id: widgetId },
      data:  { submissionsCount: { increment: 1 } },
    }).catch(() => {});

    // Résoudre l'URL de redirection Google
    const googleReviewUrl = widget.company.googleLink ?? widget.company.googleReviewUrl ?? null;

    res.json({
      success: true,
      data: {
        isPublic,
        googleReviewUrl: isPublic ? googleReviewUrl : null,
      },
    });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/client/widgets/event
// Payload: { widgetId, token, type: "view"|"open", locale?, page?, sessionId? }
// ─────────────────────────────────────────────────────────────
export const trackWidgetEvent = async (req, res, next) => {
  try {
    const { widgetId: rawWidgetId, token, type, locale: rawLocale, page, sessionId } = req.body;

    const widgetId = parseInt(rawWidgetId);
    if (isNaN(widgetId) || !token || !["view", "open"].includes(type)) {
      return res.status(400).json({ success: false, error: "Paramètres invalides." });
    }

    const widget = await prisma.reviewWidget.findFirst({
      where: { id: widgetId, token },
      select: { id: true, companyId: true, status: true },
    });

    if (!widget || widget.status !== "active") {
      return res.status(404).json({ success: false });
    }

    const ipAddress = (req.ip ?? req.connection?.remoteAddress ?? "").replace("::ffff:", "");

    await prisma.widgetEvent.create({
      data: {
        widgetId: widget.id,
        companyId: widget.companyId,
        type,
        locale:    resolveLocale(rawLocale),
        page:      page?.slice(0, 500) || null,
        sessionId: sessionId?.slice(0, 64) || null,
        ipAddress: ipAddress || null,
      },
    });

    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};
