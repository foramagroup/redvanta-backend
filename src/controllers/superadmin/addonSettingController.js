import prisma from "../../config/database.js";

const parseId = (v) => Number.parseInt(v, 10);

function slugify(name) {
  return name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function mapType(settingType) {
  return settingType === "Quantity" ? "capacity" : "feature";
}

// Auto-crée ou met à jour l'Addon métier lié à un AddonSetting
async function syncAddon(tx, { addonId, name, type, price }) {
  const slug = slugify(name);
  const addonType = mapType(type);
  const parsedPrice = parseFloat(price) || 0;

  if (addonId) {
    return tx.addon.update({
      where: { id: addonId },
      data: { name, slug, price: parsedPrice, type: addonType, updatedAt: new Date() },
    });
  }

  // Upsert by slug so we never create duplicates
  const existing = await tx.addon.findUnique({ where: { slug } });
  if (existing) return existing;

  return tx.addon.create({
    data: {
      name,
      slug,
      description: "",
      price: parsedPrice,
      type: addonType,
      status: "active",
      displayOrder: 0,
    },
  });
}

export const getAddons = async (req, res) => {
  try {
    const addons = await prisma.addonSetting.findMany({
      orderBy: { createdAt: "desc" },
      include: { addon: { select: { id: true, slug: true, type: true } } },
    });
    res.json(addons);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createAddon = async (req, res) => {
  try {
    const { name, type, price, description, active } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const addon = await syncAddon(tx, { addonId: null, name, type, price });
      return tx.addonSetting.create({
        data: { name, type, price, description, active, addonId: addon.id, updatedAt: new Date() },
      });
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateAddon = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const { name, type, price, description, active } = req.body;

    const setting = await prisma.addonSetting.findUnique({ where: { id } });

    const result = await prisma.$transaction(async (tx) => {
      const addon = await syncAddon(tx, { addonId: setting?.addonId ?? null, name, type, price });
      return tx.addonSetting.update({
        where: { id },
        data: { name, type, price, description, active, addonId: addon.id, updatedAt: new Date() },
      });
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const toggleAddon = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const setting = await prisma.addonSetting.findUnique({ where: { id } });
    const updated = await prisma.addonSetting.update({
      where: { id },
      data: { active: !setting.active, updatedAt: new Date() },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
