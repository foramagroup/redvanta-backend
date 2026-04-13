import { ALL_CARD_TEMPLATES,  } from "../data/cardTemplates.js";

/**
 * Configuration des instructions par défaut par plateforme
 */
const PLATFORM_DEFAULT_INSTRUCTIONS = {
  google: { 
    frontLine1: "Approach your phone to the card", 
    frontLine2: "Tap to leave a Google review", 
    backLine1: "Scan the QR code with your camera", 
    backLine2: "Write a review on our Google Maps page" 
  },
  facebook: { 
    frontLine1: "Tap your phone on the card", 
    frontLine2: "Leave us a Facebook recommendation", 
    backLine1: "Scan to visit our Facebook page", 
    backLine2: "Share your experience with a review" 
  },
  instagram: { 
    frontLine1: "Tap your phone on the card", 
    frontLine2: "Follow us on Instagram", 
    backLine1: "Scan to visit our Instagram profile", 
    backLine2: "Tag us in your photos and stories" 
  },
  tiktok: { 
    frontLine1: "Tap your phone on the card", 
    frontLine2: "Follow us on TikTok", 
    backLine1: "Scan to visit our TikTok profile", 
    backLine2: "Watch our latest videos and follow" 
  },
  tripadvisor: { 
    frontLine1: "Tap your phone on the card", 
    frontLine2: "Share your travel experience", 
    backLine1: "Scan to visit our TripAdvisor page", 
    backLine2: "Help other travellers by leaving a review" 
  },
  booking: { 
    frontLine1: "Tap your phone on the card", 
    frontLine2: "Rate your stay on Booking.com", 
    backLine1: "Scan to visit our Booking.com listing", 
    backLine2: "Share your guest experience with a review" 
  },
  airbnb: { 
    frontLine1: "Tap your phone on the card", 
    frontLine2: "Review your Airbnb experience", 
    backLine1: "Scan to visit our Airbnb listing", 
    backLine2: "Help future guests by sharing your stay" 
  },
  custom: { 
    frontLine1: "Tap your phone on the card", 
    frontLine2: "Visit our website", 
    backLine1: "Scan the QR code with your camera", 
    backLine2: "Discover more about our services" 
  },
};
/**
 * Depuis cardSettings du produit + ALL_CARD_TEMPLATES,
 * construit les champs visuels par défaut pour le Design.
 * * @param {Object} cardSettings - Le JSON stocké dans le produit
 * @param {Array} allTemplates - La liste complète des templates (ALL_CARD_TEMPLATES)
 */
export function resolveDesignDefaults(cardSettings) {
  // ↑ Supprimer le paramètre allTemplates — on utilise directement ALL_CARD_TEMPLATES
  
  const platform          = cardSettings?.reviewPlatform    ?? "google";
  const defaultTemplateId = cardSettings?.defaultTemplateId ?? null;
  const layouts           = cardSettings?.layouts           ?? ["landscape"];
  
  const orientation = layouts.includes("portrait") && !layouts.includes("landscape")
    ? "portrait"
    : "landscape";

  // ✅ ALL_CARD_TEMPLATES utilisé directement ici
  const tpl = defaultTemplateId
    ? ALL_CARD_TEMPLATES.find((t) => t.id === defaultTemplateId)
    : ALL_CARD_TEMPLATES.find((t) => t.platform === platform);

  if (!tpl) {
    const instr = PLATFORM_DEFAULT_INSTRUCTIONS[platform] ?? PLATFORM_DEFAULT_INSTRUCTIONS.google;
    return {
      platform,
      orientation,
      frontInstruction1: instr.frontLine1,
      frontInstruction2: instr.frontLine2,
      backInstruction1:  instr.backLine1,
      backInstruction2:  instr.backLine2,
    };
  }

  const gradient1 = Array.isArray(tpl.gradient) ? tpl.gradient[0] : "#0D0D0D";
  const gradient2 = Array.isArray(tpl.gradient) ? tpl.gradient[tpl.gradient.length - 1] : "#1A1A1A";
  const instr     = PLATFORM_DEFAULT_INSTRUCTIONS[platform] ?? PLATFORM_DEFAULT_INSTRUCTIONS.google;

  return {
    platform,
    orientation,
    templateName:      tpl.id,
    colorMode:         "template",
    gradient1,
    gradient2,
    textColor:         tpl.textColor   ?? "#FFFFFF",
    accentColor:       tpl.accentColor ?? "#E10600",
    accentBand1:       tpl.accentColor ?? "#E10600",
    accentBand2:       tpl.accentColor ?? "#E10600",
    bandPosition:      "bottom",
    frontBandHeight:   22,
    backBandHeight:    12,
    frontInstruction1: instr.frontLine1,
    frontInstruction2: instr.frontLine2,
    backInstruction1:  instr.backLine1,
    backInstruction2:  instr.backLine2,
  };
}

export function productNeedsDesign(product) {
  const cs = product.cardSettings;
  if (!cs) return false;
  const platform = typeof cs === "string"
    ? JSON.parse(cs).reviewPlatform
    : cs.reviewPlatform;
  return Boolean(platform);
}