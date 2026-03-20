import prisma from "../../config/database.js";

export const getShopProduct = async (req, res) => {
  try {
   
    const product = await prisma.product.findFirst({
      where: { active: true },
      include: {
        translations: true,
        packageTiers: {
          orderBy: {
            qty: 'asc' 
          }
        }
      }
    });

    if (!product) {
      return res.status(404).json({ message: "Produit non trouvé" });
    }

    const bundles = product.packageTiers.map(tier => {
      const basePrice = product.packageTiers[0].price;
      const regularTotal = basePrice * tier.qty;
      const savings = regularTotal - tier.price;

      return {
        id: tier.id,
        qty: tier.qty,
        label: tier.qty === 1 ? "1 Card" : `${tier.qty} Cards`,
        price: tier.price,
        savingsUsd: savings > 0 ? Math.round(savings) : 0
      };
    });

    res.json({
      productId: product.id,
      image: product.image,
      bundles: bundles
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors de la récupération du produit" });
  }
};