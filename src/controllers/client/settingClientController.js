import prisma from "../../config/database.js";
export const getGlobalSettings = async (req, res) => {
  try {
    const [languages, currencies] = await Promise.all([
      prisma.language.findMany({
        where: { status: 'Active' },
      }),
      prisma.globalCurrency.findMany({
        where: { status: 'Active' },
      })
    ]);

    res.json({ languages, currencies });
  } catch (error) {
    res.status(500).json({ error: req.t("settings.fetch_error") });
  }
};