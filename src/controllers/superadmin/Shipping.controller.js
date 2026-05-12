// src/controllers/superadmin/Shipping.controller.js
// Superadmin — gestion des règles de livraison et calcul du coût d'expédition
//
// Endpoints:
//   GET    /superadmin/shipping/rules               → listRules
//   POST   /superadmin/shipping/rules               → createRule
//   PUT    /superadmin/shipping/rules/:id           → updateRule
//   DELETE /superadmin/shipping/rules/:id           → deleteRule
//   PATCH  /superadmin/shipping/rules/:id/toggle    → toggleRule
//   GET    /superadmin/shipping/settings            → getSettings
//   PUT    /superadmin/shipping/settings            → updateSettings
//   POST   /superadmin/shipping/calculate           → calculateShipping

import prisma from "../../config/database.js";

// ─── Helpers ─────────────────────────────────────────────────

function formatRule(r) {
  return {
    id:              r.id,
    name:            r.name,
    active:          r.active,
    priority:        r.priority,
    country:         r.country,
    state:           r.state  ?? "",
    city:            r.city   ?? "",
    type:            r.type,
    flatCost:        r.flatCost        ?? 0,
    freeMinTotal:    r.freeMinTotal    ?? 0,
    weightBaseCost:  r.weightBaseCost  ?? 0,
    weightCostPerKg: r.weightCostPerKg ?? 0,
    priceTiers:      r.priceTiers    ?? [],
    quantityTiers:   r.quantityTiers ?? [],
    minTotal:        r.minTotal  ?? null,
    maxTotal:        r.maxTotal  ?? null,
    minWeight:       r.minWeight ?? null,
    maxWeight:       r.maxWeight ?? null,
    createdAt:       r.createdAt,
    updatedAt:       r.updatedAt,
  };
}

function ruleFields(body) {
  const {
    name, active, priority, country, state, city, type,
    flatCost, freeMinTotal, weightBaseCost, weightCostPerKg,
    priceTiers, quantityTiers, minTotal, maxTotal, minWeight, maxWeight,
  } = body;
  return {
    ...(name         !== undefined && { name: String(name).slice(0, 100) }),
    ...(active       !== undefined && { active: Boolean(active) }),
    ...(priority     !== undefined && { priority: parseInt(priority) || 10 }),
    ...(country      !== undefined && { country: String(country || "*").slice(0, 100) }),
    ...(state        !== undefined && { state:   state   ? String(state).slice(0, 100)  : null }),
    ...(city         !== undefined && { city:    city    ? String(city).slice(0, 100)   : null }),
    ...(type         !== undefined && { type:    String(type).slice(0, 20) }),
    ...(flatCost        !== undefined && { flatCost:        flatCost        !== null ? parseFloat(flatCost)        : null }),
    ...(freeMinTotal    !== undefined && { freeMinTotal:    freeMinTotal    !== null ? parseFloat(freeMinTotal)    : null }),
    ...(weightBaseCost  !== undefined && { weightBaseCost:  weightBaseCost  !== null ? parseFloat(weightBaseCost)  : null }),
    ...(weightCostPerKg !== undefined && { weightCostPerKg: weightCostPerKg !== null ? parseFloat(weightCostPerKg) : null }),
    ...(priceTiers    !== undefined && { priceTiers:    Array.isArray(priceTiers)    ? priceTiers    : [] }),
    ...(quantityTiers !== undefined && { quantityTiers: Array.isArray(quantityTiers) ? quantityTiers : [] }),
    ...(minTotal  !== undefined && { minTotal:  minTotal  !== null ? parseFloat(minTotal)  : null }),
    ...(maxTotal  !== undefined && { maxTotal:  maxTotal  !== null ? parseFloat(maxTotal)  : null }),
    ...(minWeight !== undefined && { minWeight: minWeight !== null ? parseFloat(minWeight) : null }),
    ...(maxWeight !== undefined && { maxWeight: maxWeight !== null ? parseFloat(maxWeight) : null }),
  };
}

// ─── Shipping engine (mirrors ShippingContext logic) ──────────

const eq = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

function matchLevelFor(rule, input) {
  if (rule.country !== "*") {
    if (!input.country || !eq(rule.country, input.country)) return null;
  }
  if (rule.state && rule.state.trim() !== "") {
    if (!input.state || !eq(rule.state, input.state)) return null;
  }
  if (rule.city && rule.city.trim() !== "") {
    if (!input.city || !eq(rule.city, input.city)) return null;
  }
  if (rule.city  && rule.city.trim()  !== "") return "city";
  if (rule.state && rule.state.trim() !== "") return "state";
  if (rule.country !== "*") return "country";
  return "global";
}

const LEVEL_RANK  = { city: 4, state: 3, country: 2, global: 1, fallback: 0 };
const LEVEL_LABEL = {
  city:     "City match",
  state:    "State / region match",
  country:  "Country match",
  global:   "Global rule",
  fallback: "Default fallback",
};

function conditionsMatch(rule, input) {
  if (rule.minTotal  !== null && rule.minTotal  !== undefined && input.cartTotal    < rule.minTotal)  return false;
  if (rule.maxTotal  !== null && rule.maxTotal  !== undefined && input.cartTotal    > rule.maxTotal)  return false;
  if (rule.minWeight !== null && rule.minWeight !== undefined && input.totalWeight  < rule.minWeight) return false;
  if (rule.maxWeight !== null && rule.maxWeight !== undefined && input.totalWeight  > rule.maxWeight) return false;
  return true;
}

function computeRuleCost(rule, input) {
  switch (rule.type) {
    case "flat": {
      const cost = Number(rule.flatCost ?? 0);
      return { cost, freeApplied: false, breakdown: [{ label: "Flat rate", value: cost }] };
    }
    case "free": {
      const threshold = Number(rule.freeMinTotal ?? 0);
      if (input.cartTotal >= threshold) {
        return {
          cost: 0,
          freeApplied: true,
          breakdown: [
            { label: "Cart total",      value: input.cartTotal },
            { label: "Free threshold",  value: threshold },
            { label: "Result",          value: "FREE" },
          ],
        };
      }
      return { cost: null, freeApplied: false, breakdown: [] };
    }
    case "weight": {
      const base  = Number(rule.weightBaseCost  ?? 0);
      const perKg = Number(rule.weightCostPerKg ?? 0);
      const cost  = base + perKg * input.totalWeight;
      return {
        cost,
        freeApplied: false,
        breakdown: [
          { label: "Base cost",   value: base },
          { label: "Per-kg cost", value: `${perKg} x ${input.totalWeight} kg` },
          { label: "Total",       value: cost },
        ],
      };
    }
    case "price": {
      const tiers = Array.isArray(rule.priceTiers) ? rule.priceTiers : [];
      const tier  = tiers.find(
        (t) => input.cartTotal >= Number(t.minTotal) &&
               (t.maxTotal === null || t.maxTotal === undefined || input.cartTotal <= Number(t.maxTotal))
      );
      if (!tier) return { cost: null, freeApplied: false, breakdown: [] };
      const cost = Number(tier.cost);
      return {
        cost,
        freeApplied: cost === 0,
        breakdown: [
          { label: "Cart total",    value: input.cartTotal },
          { label: "Matched tier",  value: `${tier.minTotal} - ${tier.maxTotal ?? "∞"}` },
          { label: "Tier cost",     value: cost === 0 ? "FREE" : cost },
        ],
      };
    }
    case "quantity": {
      const tiers = Array.isArray(rule.quantityTiers) ? rule.quantityTiers : [];
      const tier  = tiers.find(
        (t) => input.itemCount >= Number(t.minQty) &&
               (t.maxQty === null || t.maxQty === undefined || input.itemCount <= Number(t.maxQty))
      );
      if (!tier) return { cost: null, freeApplied: false, breakdown: [] };
      const cost = Number(tier.cost);
      return {
        cost,
        freeApplied: cost === 0,
        breakdown: [
          { label: "Item count",    value: input.itemCount },
          { label: "Matched tier",  value: `${tier.minQty} - ${tier.maxQty ?? "∞"} items` },
          { label: "Tier cost",     value: cost === 0 ? "FREE" : cost },
        ],
      };
    }
    default:
      return { cost: null, freeApplied: false, breakdown: [] };
  }
}

export function resolveShipping(rules, fallbackCost, input) {
  const {
    cartTotal   = 0,
    totalWeight = 0,
    itemCount   = 0,
    country     = "",
    state       = "",
    city        = "",
  } = input;

  const inp = { cartTotal: Number(cartTotal), totalWeight: Number(totalWeight), itemCount: Number(itemCount), country, state, city };

  const candidates = rules
    .filter((r) => r.active)
    .filter((r) => conditionsMatch(r, inp))
    .map((r) => {
      const level = matchLevelFor(r, inp);
      if (!level) return null;
      const info = computeRuleCost(r, inp);
      if (info.cost === null) return null;
      return { rule: r, level, ...info };
    })
    .filter(Boolean);

  if (candidates.length === 0) {
    return {
      cost:                fallbackCost,
      ruleName:            "Default Fallback",
      ruleId:              null,
      isFallback:          true,
      matchLevel:          "fallback",
      matchLevelLabel:     LEVEL_LABEL.fallback,
      freeShippingApplied: false,
      breakdown:           [{ label: "Fallback fee", value: fallbackCost }],
    };
  }

  candidates.sort((a, b) => {
    if (b.rule.priority !== a.rule.priority) return b.rule.priority - a.rule.priority;
    return LEVEL_RANK[b.level] - LEVEL_RANK[a.level];
  });

  const best = candidates[0];
  return {
    cost:                best.cost,
    ruleName:            best.rule.name,
    ruleId:              best.rule.id,
    isFallback:          false,
    matchLevel:          best.level,
    matchLevelLabel:     LEVEL_LABEL[best.level],
    freeShippingApplied: best.freeApplied,
    breakdown:           best.breakdown,
  };
}

async function getOrCreateSettings() {
  let settings = await prisma.platformSetting.findFirst();
  if (!settings) {
    settings = await prisma.platformSetting.create({ data: {} });
  }
  return settings;
}

// ─── GET /superadmin/shipping/rules ──────────────────────────

export const listRules = async (req, res, next) => {
  try {
    const rules = await prisma.shippingRule.findMany({
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
    res.json({ success: true, data: rules.map(formatRule) });
  } catch (e) { next(e); }
};

// ─── POST /superadmin/shipping/rules ─────────────────────────

export const createRule = async (req, res, next) => {
  try {
    const { name, type } = req.body;
    if (!name?.trim()) {
      return res.status(422).json({ success: false, error: "Rule name is required" });
    }
    const VALID_TYPES = ["flat", "free", "weight", "price", "quantity"];
    if (!VALID_TYPES.includes(type)) {
      return res.status(422).json({ success: false, error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` });
    }

    const data = { ...ruleFields(req.body), name: String(name).trim(), type };
    const rule = await prisma.shippingRule.create({ data });
    res.status(201).json({ success: true, data: formatRule(rule) });
  } catch (e) { next(e); }
};

// ─── PUT /superadmin/shipping/rules/:id ──────────────────────

export const updateRule = async (req, res, next) => {
  try {
    const id  = parseInt(req.params.id);
    const rule = await prisma.shippingRule.findUnique({ where: { id } });
    if (!rule) return res.status(404).json({ success: false, error: "Shipping rule not found" });

    const updated = await prisma.shippingRule.update({
      where: { id },
      data:  ruleFields(req.body),
    });
    res.json({ success: true, data: formatRule(updated) });
  } catch (e) { next(e); }
};

// ─── DELETE /superadmin/shipping/rules/:id ───────────────────

export const deleteRule = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const rule = await prisma.shippingRule.findUnique({ where: { id } });
    if (!rule) return res.status(404).json({ success: false, error: "Shipping rule not found" });

    await prisma.shippingRule.delete({ where: { id } });
    res.json({ success: true, message: "Rule deleted" });
  } catch (e) { next(e); }
};

// ─── PATCH /superadmin/shipping/rules/:id/toggle ─────────────

export const toggleRule = async (req, res, next) => {
  try {
    const id   = parseInt(req.params.id);
    const rule = await prisma.shippingRule.findUnique({ where: { id } });
    if (!rule) return res.status(404).json({ success: false, error: "Shipping rule not found" });

    const updated = await prisma.shippingRule.update({
      where: { id },
      data:  { active: !rule.active },
    });
    res.json({ success: true, data: formatRule(updated) });
  } catch (e) { next(e); }
};

// ─── GET /superadmin/shipping/settings ───────────────────────

export const getSettings = async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings();
    res.json({
      success: true,
      data: {
        fallbackCost: Number(settings.shippingFallbackCost ?? 14.99),
      },
    });
  } catch (e) { next(e); }
};

// ─── PUT /superadmin/shipping/settings ───────────────────────

export const updateSettings = async (req, res, next) => {
  try {
    const { fallbackCost } = req.body;
    if (fallbackCost === undefined || isNaN(parseFloat(fallbackCost))) {
      return res.status(422).json({ success: false, error: "fallbackCost is required and must be a number" });
    }

    const settings = await getOrCreateSettings();
    const updated  = await prisma.platformSetting.update({
      where: { id: settings.id },
      data:  { shippingFallbackCost: parseFloat(fallbackCost) },
    });

    res.json({
      success: true,
      data: { fallbackCost: Number(updated.shippingFallbackCost) },
    });
  } catch (e) { next(e); }
};

// ─── POST /superadmin/shipping/calculate ─────────────────────
// Calcule le coût d'expédition côté serveur (utilisé au checkout).
// Body: { cartTotal, totalWeight, itemCount, country, state?, city? }

export const calculateShipping = async (req, res, next) => {
  try {
    const { cartTotal, totalWeight, itemCount, country, state, city } = req.body;

    if (cartTotal === undefined || totalWeight === undefined) {
      return res.status(422).json({ success: false, error: "cartTotal and totalWeight are required" });
    }

    const [rules, settings] = await Promise.all([
      prisma.shippingRule.findMany({ where: { active: true }, orderBy: { priority: "desc" } }),
      getOrCreateSettings(),
    ]);

    const fallbackCost = Number(settings.shippingFallbackCost ?? 14.99);
    const result = resolveShipping(rules, fallbackCost, { cartTotal, totalWeight, itemCount, country, state, city });

    res.json({ success: true, data: result });
  } catch (e) { next(e); }
};

// ─── GET /superadmin/shipping/all ────────────────────────────
// Récupère règles + fallbackCost en un seul appel (bootstrap page)

export const getAll = async (req, res, next) => {
  try {
    const [rules, settings] = await Promise.all([
      prisma.shippingRule.findMany({ orderBy: [{ priority: "desc" }, { createdAt: "asc" }] }),
      getOrCreateSettings(),
    ]);

    res.json({
      success: true,
      data: {
        rules:        rules.map(formatRule),
        fallbackCost: Number(settings.shippingFallbackCost ?? 14.99),
      },
    });
  } catch (e) { next(e); }
};
