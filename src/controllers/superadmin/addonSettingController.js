import prisma from "../../config/database.js";

const addonSettingModel = prisma.addonSetting;

const parseId = (value) => Number.parseInt(value, 10);

export const getAddons = async (req, res) => {
  try {
    const addons = await addonSettingModel.findMany({
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

    const addon = await addonSettingModel.create({
      data: {
        name,
        type,
        price,
        description,
        active,
        updatedAt: new Date(),
      },
    });

    res.json(addon);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateAddon = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const { name, type, price, description, active } = req.body;

    const addon = await addonSettingModel.update({
      where: { id },
      data: {
        name,
        type,
        price,
        description,
        active,
        updatedAt: new Date(),
      },
    });

    res.json(addon);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const toggleAddon = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    const addon = await addonSettingModel.findUnique({
      where: { id },
    });

    const updated = await addonSettingModel.update({
      where: { id },
      data: {
        active: !addon.active,
        updatedAt: new Date(),
      },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

