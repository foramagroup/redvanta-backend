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
    res.status(500).json({ error: "Erreur lors de la récupération des réglages" });
  }
};