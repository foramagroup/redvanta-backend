const tpl = (platform, styleId, name, gradient, accentColor, pattern, textColor = "#ffffff") => ({
  id: `${platform}-${styleId}`,
  platform,
  name,
  gradient,
  accentColor,
  pattern,
  textColor,
});

export const PLATFORMS = [
  { id: "google", label: "Google Review", color: "#4285F4", icon: "G" },
  { id: "facebook", label: "Facebook Review", color: "#1877F2", icon: "f" },
  { id: "instagram", label: "Instagram Review", color: "#E4405F", icon: "IG" },
  { id: "tiktok", label: "TikTok Review", color: "#000000", icon: "TT" },
  { id: "tripadvisor", label: "TripAdvisor Review", color: "#34E0A1", icon: "TA" },
  { id: "booking", label: "Booking Review", color: "#003580", icon: "B" },
  { id: "airbnb", label: "Airbnb Review", color: "#FF5A5F", icon: "AB" },
  { id: "custom", label: "Custom Branding", color: "#6b7280", icon: "C" },
];

export function gradientCSS(gradient) {
  if (!Array.isArray(gradient) || gradient.length === 0) {
    return "linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)";
  }
  if (gradient.length === 2) {
    return `linear-gradient(135deg, ${gradient[0]} 0%, ${gradient[1]} 100%)`;
  }
  if (gradient.length === 3) {
    return `linear-gradient(135deg, ${gradient[0]} 0%, ${gradient[1]} 50%, ${gradient[2]} 100%)`;
  }
  return `linear-gradient(135deg, ${gradient.join(", ")})`;
}

const LEGACY_TEMPLATES = [
  tpl("google", "classic", "Google Classic", ["#4285F4", "#34A853", "#FBBC05"], "#34A853", "radial-gradient(circle at 20% 80%, rgba(255,255,255,0.1) 0%, transparent 50%)"),
  tpl("facebook", "classic", "Facebook Classic", ["#1877F2", "#42A5F5"], "#E3F2FD", "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.15) 0%, transparent 40%)"),
  tpl("instagram", "classic", "Instagram Classic", ["#833AB4", "#E4405F", "#FCAF45"], "#FCAF45", "radial-gradient(circle at 30% 70%, rgba(255,255,255,0.12) 0%, transparent 45%)"),
  tpl("tiktok", "classic", "TikTok Classic", ["#010101", "#25F4EE", "#FE2C55"], "#25F4EE", "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.03) 10px, rgba(255,255,255,0.03) 20px)"),
  tpl("custom", "classic", "Custom Classic", ["#1a1a1a", "#2d2d2d"], "#9CA3AF", "none", "#ffffff"),
];

const materialTemplates = [
  tpl("google", "material", "Material Clean", ["#FFFFFF", "#F1F5F9"], "#4285F4", "radial-gradient(circle at 70% 30%, rgba(66,133,244,0.08) 0%, transparent 50%)", "#1a1a1a"),
  tpl("facebook", "material", "Material Blue", ["#F0F4FF", "#E8EFFF"], "#1877F2", "radial-gradient(circle at 30% 70%, rgba(24,119,242,0.08) 0%, transparent 50%)", "#1a1a1a"),
  tpl("instagram", "material", "Material Glow", ["#FFF5F7", "#FFF0F5"], "#E4405F", "radial-gradient(circle at 50% 50%, rgba(228,64,95,0.06) 0%, transparent 60%)", "#1a1a1a"),
  tpl("tiktok", "material", "Material Dark", ["#1a1a1a", "#111111"], "#25F4EE", "radial-gradient(circle at 80% 20%, rgba(37,244,238,0.1) 0%, transparent 40%)"),
  tpl("tripadvisor", "material", "Material Green", ["#F0FFF4", "#E6FFED"], "#34E0A1", "radial-gradient(circle at 40% 60%, rgba(52,224,161,0.08) 0%, transparent 50%)", "#1a1a1a"),
  tpl("booking", "material", "Material Navy", ["#F0F4FF", "#E8EFFF"], "#003580", "radial-gradient(circle at 60% 40%, rgba(0,53,128,0.06) 0%, transparent 50%)", "#1a1a1a"),
  tpl("airbnb", "material", "Material Rose", ["#FFF5F5", "#FFF0F0"], "#FF5A5F", "radial-gradient(circle at 50% 50%, rgba(255,90,95,0.06) 0%, transparent 50%)", "#1a1a1a"),
  tpl("custom", "material", "Material Slate", ["#F8FAFC", "#F1F5F9"], "#64748B", "none", "#1a1a1a"),
];

const blobTemplates = [
  tpl("google", "blob", "Organic Blue", ["#4285F4", "#1A73E8"], "#FBBC05", "radial-gradient(ellipse at 20% 80%, rgba(251,188,5,0.3) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(52,168,83,0.3) 0%, transparent 50%)"),
  tpl("facebook", "blob", "Blob Ocean", ["#1877F2", "#0D47A1"], "#64B5F6", "radial-gradient(ellipse at 15% 85%, rgba(100,181,246,0.4) 0%, transparent 45%), radial-gradient(ellipse at 85% 15%, rgba(227,242,253,0.2) 0%, transparent 40%)"),
  tpl("instagram", "blob", "Liquid Gradient", ["#833AB4", "#FD1D1D", "#FCAF45"], "#FCAF45", "radial-gradient(ellipse at 25% 75%, rgba(252,175,69,0.3) 0%, transparent 50%), radial-gradient(ellipse at 75% 25%, rgba(131,58,180,0.3) 0%, transparent 50%)"),
  tpl("tiktok", "blob", "Neon Blob", ["#000000", "#111111"], "#FE2C55", "radial-gradient(ellipse at 20% 80%, rgba(37,244,238,0.4) 0%, transparent 45%), radial-gradient(ellipse at 80% 20%, rgba(254,44,85,0.4) 0%, transparent 45%)"),
  tpl("tripadvisor", "blob", "Jungle Blob", ["#00AA6C", "#007A4D"], "#B2DFDB", "radial-gradient(ellipse at 30% 70%, rgba(178,223,219,0.4) 0%, transparent 50%), radial-gradient(ellipse at 70% 30%, rgba(0,170,108,0.2) 0%, transparent 50%)"),
  tpl("booking", "blob", "Deep Sea Blob", ["#003580", "#001A40"], "#4FC3F7", "radial-gradient(ellipse at 25% 75%, rgba(79,195,247,0.35) 0%, transparent 50%), radial-gradient(ellipse at 75% 25%, rgba(0,53,128,0.3) 0%, transparent 50%)"),
  tpl("airbnb", "blob", "Coral Blob", ["#FF5A5F", "#E31C5F"], "#FFB8B8", "radial-gradient(ellipse at 20% 80%, rgba(255,184,184,0.4) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(255,90,95,0.2) 0%, transparent 50%)"),
  tpl("custom", "blob", "Charcoal Blob", ["#1a1a1a", "#0a0a0a"], "#6b7280", "radial-gradient(ellipse at 30% 70%, rgba(107,114,128,0.3) 0%, transparent 50%)"),
];

const memphisTemplates = [
  tpl("google", "memphis", "Google Fun", ["#FBBC05", "#34A853"], "#4285F4", "repeating-linear-gradient(45deg, rgba(66,133,244,0.08) 0px, rgba(66,133,244,0.08) 4px, transparent 4px, transparent 12px), repeating-linear-gradient(-45deg, rgba(234,67,53,0.08) 0px, rgba(234,67,53,0.08) 4px, transparent 4px, transparent 12px)", "#1a1a1a"),
  tpl("facebook", "memphis", "Social Pop", ["#42A5F5", "#1877F2"], "#FFC107", "repeating-linear-gradient(60deg, rgba(255,193,7,0.1) 0px, rgba(255,193,7,0.1) 3px, transparent 3px, transparent 10px)"),
  tpl("instagram", "memphis", "Insta Party", ["#FCAF45", "#E4405F", "#833AB4"], "#FFFFFF", "repeating-linear-gradient(30deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 3px, transparent 3px, transparent 8px)"),
  tpl("tiktok", "memphis", "TikTok Chaos", ["#FE2C55", "#25F4EE"], "#000000", "repeating-linear-gradient(45deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 3px, transparent 3px, transparent 10px)", "#000000"),
  tpl("tripadvisor", "memphis", "Travel Fun", ["#34E0A1", "#00AA6C"], "#FFD54F", "repeating-linear-gradient(-30deg, rgba(255,213,79,0.12) 0px, rgba(255,213,79,0.12) 3px, transparent 3px, transparent 9px)", "#1a1a1a"),
  tpl("booking", "memphis", "Booking Pop", ["#003580", "#0057B8"], "#FFD54F", "repeating-linear-gradient(45deg, rgba(255,213,79,0.1) 0px, rgba(255,213,79,0.1) 3px, transparent 3px, transparent 10px)"),
  tpl("airbnb", "memphis", "Airbnb Playful", ["#FF5A5F", "#FF385C"], "#FFC107", "repeating-linear-gradient(60deg, rgba(255,193,7,0.12) 0px, rgba(255,193,7,0.12) 3px, transparent 3px, transparent 8px)"),
  tpl("custom", "memphis", "Fun Custom", ["#6366F1", "#818CF8"], "#FDE68A", "repeating-linear-gradient(45deg, rgba(253,230,138,0.1) 0px, rgba(253,230,138,0.1) 3px, transparent 3px, transparent 10px)"),
];

const geometricTemplates = [
  tpl("google", "geometric", "Google Grid", ["#FFFFFF", "#F8F9FA"], "#4285F4", "linear-gradient(0deg, rgba(66,133,244,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(66,133,244,0.05) 1px, transparent 1px)", "#1a1a1a"),
  tpl("facebook", "geometric", "Corporate Blue", ["#E8EFFF", "#F0F4FF"], "#1877F2", "linear-gradient(0deg, rgba(24,119,242,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(24,119,242,0.06) 1px, transparent 1px)", "#1a1a1a"),
  tpl("instagram", "geometric", "Insta Grid", ["#2D2D2D", "#1a1a1a"], "#E4405F", "linear-gradient(0deg, rgba(228,64,95,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(228,64,95,0.08) 1px, transparent 1px)"),
  tpl("tiktok", "geometric", "TikTok Grid", ["#0a0a0a", "#000000"], "#25F4EE", "linear-gradient(0deg, rgba(37,244,238,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(37,244,238,0.06) 1px, transparent 1px)"),
  tpl("tripadvisor", "geometric", "Travel Grid", ["#F0FFF4", "#E6FFED"], "#00AA6C", "linear-gradient(0deg, rgba(0,170,108,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,170,108,0.06) 1px, transparent 1px)", "#1a1a1a"),
  tpl("booking", "geometric", "Booking Grid", ["#001A40", "#003580"], "#4FC3F7", "linear-gradient(0deg, rgba(79,195,247,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(79,195,247,0.06) 1px, transparent 1px)"),
  tpl("airbnb", "geometric", "Airbnb Structure", ["#FFF5F5", "#FFFFFF"], "#FF5A5F", "linear-gradient(0deg, rgba(255,90,95,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,90,95,0.05) 1px, transparent 1px)", "#1a1a1a"),
  tpl("custom", "geometric", "Corporate Grid", ["#F8FAFC", "#FFFFFF"], "#334155", "linear-gradient(0deg, rgba(51,65,85,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(51,65,85,0.05) 1px, transparent 1px)", "#1a1a1a"),
];

const polygonTemplates = [
  tpl("google", "polygon", "Google Mesh", ["#4285F4", "#1A73E8", "#0D47A1"], "#FBBC05", "linear-gradient(60deg, rgba(251,188,5,0.1) 25%, transparent 25%), linear-gradient(-60deg, rgba(52,168,83,0.1) 25%, transparent 25%)"),
  tpl("facebook", "polygon", "Blue Mesh", ["#1877F2", "#0D47A1", "#003580"], "#64B5F6", "linear-gradient(60deg, rgba(100,181,246,0.12) 25%, transparent 25%), linear-gradient(-60deg, rgba(24,119,242,0.08) 25%, transparent 25%)"),
  tpl("instagram", "polygon", "Prism Gradient", ["#833AB4", "#C13584", "#E4405F"], "#FCAF45", "linear-gradient(60deg, rgba(252,175,69,0.12) 25%, transparent 25%), linear-gradient(-60deg, rgba(131,58,180,0.1) 25%, transparent 25%)"),
  tpl("tiktok", "polygon", "Tech Mesh", ["#000000", "#1a1a1a", "#111111"], "#25F4EE", "linear-gradient(60deg, rgba(37,244,238,0.08) 25%, transparent 25%), linear-gradient(-60deg, rgba(254,44,85,0.08) 25%, transparent 25%)"),
  tpl("tripadvisor", "polygon", "Nature Mesh", ["#00AA6C", "#008C57", "#006B3F"], "#B2DFDB", "linear-gradient(60deg, rgba(178,223,219,0.15) 25%, transparent 25%), linear-gradient(-60deg, rgba(0,170,108,0.1) 25%, transparent 25%)"),
  tpl("booking", "polygon", "Navy Mesh", ["#003580", "#002A66", "#001A40"], "#4FC3F7", "linear-gradient(60deg, rgba(79,195,247,0.1) 25%, transparent 25%), linear-gradient(-60deg, rgba(0,53,128,0.08) 25%, transparent 25%)"),
  tpl("airbnb", "polygon", "Warm Mesh", ["#FF5A5F", "#E31C5F", "#C41E3A"], "#FFB8B8", "linear-gradient(60deg, rgba(255,184,184,0.15) 25%, transparent 25%), linear-gradient(-60deg, rgba(255,90,95,0.1) 25%, transparent 25%)"),
  tpl("custom", "polygon", "Slate Mesh", ["#334155", "#1E293B", "#0F172A"], "#94A3B8", "linear-gradient(60deg, rgba(148,163,184,0.08) 25%, transparent 25%), linear-gradient(-60deg, rgba(51,65,85,0.06) 25%, transparent 25%)"),
];

const luxuryTemplates = [
  tpl("google", "luxury", "Google Elegance", ["#FFFFFF", "#FAFAFA"], "#D4AF37", "none", "#1a1a1a"),
  tpl("facebook", "luxury", "Blue Prestige", ["#FAFBFF", "#F5F7FF"], "#1877F2", "none", "#1a1a1a"),
  tpl("instagram", "luxury", "Rose Gold", ["#FFF8F0", "#FFF5EB"], "#B76E79", "none", "#1a1a1a"),
  tpl("tiktok", "luxury", "Noir Luxury", ["#0a0a0a", "#111111"], "#D4AF37", "none"),
  tpl("tripadvisor", "luxury", "Jade Luxury", ["#F5FFFA", "#F0FFF4"], "#D4AF37", "none", "#1a1a1a"),
  tpl("booking", "luxury", "Navy Prestige", ["#0A1628", "#0F1F3D"], "#D4AF37", "none"),
  tpl("airbnb", "luxury", "Blush Elegance", ["#FFF5F5", "#FFFAFA"], "#D4AF37", "none", "#1a1a1a"),
  tpl("custom", "luxury", "Ivory Luxury", ["#FFFEF7", "#FFF8E1"], "#D4AF37", "none", "#1a1a1a"),
];

const neonTemplates = [
  tpl("google", "neon", "Neon Google", ["#0a0a0a", "#111111"], "#4285F4", "radial-gradient(circle at 50% 50%, rgba(66,133,244,0.15) 0%, transparent 60%)"),
  tpl("facebook", "neon", "Neon Social", ["#0a0a0a", "#0D0D1A"], "#1877F2", "radial-gradient(circle at 50% 50%, rgba(24,119,242,0.2) 0%, transparent 55%)"),
  tpl("instagram", "neon", "Neon Insta", ["#0a0a0a", "#1a0a1a"], "#E4405F", "radial-gradient(circle at 30% 70%, rgba(228,64,95,0.2) 0%, transparent 50%), radial-gradient(circle at 70% 30%, rgba(252,175,69,0.15) 0%, transparent 50%)"),
  tpl("tiktok", "neon", "Neon TikTok", ["#000000", "#050505"], "#25F4EE", "radial-gradient(circle at 30% 70%, rgba(37,244,238,0.25) 0%, transparent 45%), radial-gradient(circle at 70% 30%, rgba(254,44,85,0.25) 0%, transparent 45%)"),
  tpl("tripadvisor", "neon", "Neon Travel", ["#0a0a0a", "#0a1a10"], "#34E0A1", "radial-gradient(circle at 50% 50%, rgba(52,224,161,0.2) 0%, transparent 55%)"),
  tpl("booking", "neon", "Neon Booking", ["#000510", "#000A1F"], "#4FC3F7", "radial-gradient(circle at 50% 50%, rgba(79,195,247,0.2) 0%, transparent 55%)"),
  tpl("airbnb", "neon", "Neon Host", ["#0a0505", "#100808"], "#FF5A5F", "radial-gradient(circle at 50% 50%, rgba(255,90,95,0.2) 0%, transparent 55%)"),
  tpl("custom", "neon", "Neon Custom", ["#000000", "#0a0a0a"], "#818CF8", "radial-gradient(circle at 50% 50%, rgba(129,140,248,0.2) 0%, transparent 55%)"),
];

const glassTemplates = [
  tpl("google", "glass", "Google Glass", ["#E8F0FE", "#D2E3FC"], "#4285F4", "linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.1) 100%)", "#1a1a1a"),
  tpl("facebook", "glass", "Social Glass", ["#D6E4FF", "#C2D6FF"], "#1877F2", "linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.1) 100%)", "#1a1a1a"),
  tpl("instagram", "glass", "Insta Glass", ["#FFE0E6", "#FFD1DC"], "#E4405F", "linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.1) 100%)", "#1a1a1a"),
  tpl("tiktok", "glass", "Dark Glass", ["#1a1a2e", "#16213e"], "#25F4EE", "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)"),
  tpl("tripadvisor", "glass", "Travel Glass", ["#D5F5E3", "#C8F7DC"], "#00AA6C", "linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.1) 100%)", "#1a1a1a"),
  tpl("booking", "glass", "Booking Glass", ["#D6E4FF", "#C2D6FF"], "#003580", "linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.1) 100%)", "#1a1a1a"),
  tpl("airbnb", "glass", "Host Glass", ["#FFE0E0", "#FFD5D5"], "#FF5A5F", "linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.1) 100%)", "#1a1a1a"),
  tpl("custom", "glass", "Frost Glass", ["#E2E8F0", "#CBD5E1"], "#475569", "linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.15) 100%)", "#1a1a1a"),
];

const layeredTemplates = [
  tpl("google", "layered", "Google Layers", ["#4285F4", "#3367D6"], "#FBBC05", "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 40%, transparent 40%), linear-gradient(225deg, rgba(251,188,5,0.1) 0%, transparent 30%)"),
  tpl("facebook", "layered", "Blue Layers", ["#1877F2", "#145DBF"], "#64B5F6", "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 40%, transparent 40%), linear-gradient(225deg, rgba(100,181,246,0.1) 0%, transparent 30%)"),
  tpl("instagram", "layered", "Insta Layers", ["#C13584", "#833AB4"], "#FCAF45", "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 40%, transparent 40%), linear-gradient(225deg, rgba(252,175,69,0.15) 0%, transparent 30%)"),
  tpl("tiktok", "layered", "TikTok Depth", ["#111111", "#000000"], "#FE2C55", "linear-gradient(135deg, rgba(37,244,238,0.08) 0%, transparent 40%), linear-gradient(225deg, rgba(254,44,85,0.1) 0%, transparent 30%)"),
  tpl("tripadvisor", "layered", "Travel Depth", ["#00AA6C", "#008C57"], "#B2DFDB", "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 40%, transparent 40%), linear-gradient(225deg, rgba(178,223,219,0.12) 0%, transparent 30%)"),
  tpl("booking", "layered", "Booking Depth", ["#003580", "#002A66"], "#4FC3F7", "linear-gradient(135deg, rgba(79,195,247,0.1) 0%, transparent 40%), linear-gradient(225deg, rgba(0,53,128,0.08) 0%, transparent 30%)"),
  tpl("airbnb", "layered", "Host Layers", ["#FF5A5F", "#E31C5F"], "#FFB8B8", "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 40%, transparent 40%), linear-gradient(225deg, rgba(255,184,184,0.12) 0%, transparent 30%)"),
  tpl("custom", "layered", "Custom Depth", ["#1E293B", "#0F172A"], "#94A3B8", "linear-gradient(135deg, rgba(148,163,184,0.08) 0%, transparent 40%), linear-gradient(225deg, rgba(51,65,85,0.06) 0%, transparent 30%)"),
];

export const ALL_CARD_TEMPLATES = [
  ...LEGACY_TEMPLATES,
  ...materialTemplates,
  ...blobTemplates,
  ...memphisTemplates,
  ...geometricTemplates,
  ...polygonTemplates,
  ...luxuryTemplates,
  ...neonTemplates,
  ...glassTemplates,
  ...layeredTemplates,
];

export function getTemplatesForPlatform(platform) {
  return ALL_CARD_TEMPLATES.filter((template) => template.platform === platform);
}

export function getTemplateById(id) {
  return ALL_CARD_TEMPLATES.find((template) => template.id === id);
}

export const STYLE_NAMES = [
  "Classic",
  "Material Clean",
  "Abstract Organic Blobs",
  "Memphis Playful",
  "Geometric Corporate",
  "Polygon Mesh",
  "Minimal Luxury",
  "Neon / Glow",
  "Glassmorphism",
  "Layered Depth",
];
