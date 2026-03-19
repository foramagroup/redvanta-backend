import prisma from "../../config/database.js";

const featureFlagModel = prisma.featureFlag;

export const getFeatureFlags = async (req, res) => {
  try {
    const flags = await featureFlagModel.findMany({
      orderBy: { name: "asc" }
    });
    res.json(flags);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const toggleFeatureFlag = async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    const flag = await featureFlagModel.update({
      where: { id: Number(id) },
      data: {
        enabled,
        updatedAt: new Date(),
      }
    });
    res.json(flag);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }

};
