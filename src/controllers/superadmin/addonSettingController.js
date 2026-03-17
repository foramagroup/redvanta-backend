import prisma from "../../config/database.js";

export const getAddons = async (req, res) => {
  try {
    const addons = await prisma.addonSetting.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(addons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createAddon = async (req, res) => {
  try {
    const { name, type, price, description, active } = req.body;

    const addon = await prisma.addonSetting.create({
      data: {
        name,
        type,
        price,
        description,
        active,
      },
    });

    res.json(addon);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateAddon = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, price, description, active } = req.body;

    const addon = await prisma.addonSetting.update({
      where: { id: Number(id) },
      data: {
        name,
        type,
        price,
        description,
        active,
      },
    });

    res.json(addon);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const toggleAddon = async (req, res) => {
  try {
    const { id } = req.params;

    const addon = await prisma.addonSetting.findUnique({
      where: { id: Number(id) },
    });

    const updated = await prisma.addonSetting.update({
      where: { id: Number(id) },
      data: {
        active: !addon.active,
      },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

