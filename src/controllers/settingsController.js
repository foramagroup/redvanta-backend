import prisma from "../config/database.js";

export const getSettings = async (req, res) => {
    try {
        const company = await prisma.company.findUnique({
            where: { id: req.user.companyId },
            include: { subscription: true }
        });
        res.json(company);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


export const updateGeneral = async (req, res) => {
    const { name, businessName, vat, trade, email, phone, country, address } = req.body;
    try {
        const updated = await prisma.company.update({
            where: { id: req.user.companyId },
            data: { name, businessName, vatNumber: vat, tradeNumber: trade, email, phone, country, address }
        });
        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};


export const updateBranding = async (req, res) => {
    const { primaryColor, logoScale, logoUrl } = req.body;
    try {
        const updated = await prisma.company.update({
            where: { id: req.user.companyId },
            data: { primaryColor, logoScale, logoUrl }
        });
        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};


export const updateSecurity = async (req, res) => {
    const { newPassword, twoFactor } = req.body;
    // Note: Logique de hashage de mot de passe nécessaire ici pour l'utilisateur
    try {
        await prisma.user.update({
            where: { id: req.user.id },
            data: { 
                ...(newPassword && { password: await hash(newPassword) }),
                twoFactorEnabled: twoFactor 
            }
        });
        res.json({ success: true, message: "Security settings updated" });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};


export const uploadLogo = async (req, res) => {
    try {
        // Si Multer n'a pas trouvé de fichier (ou erreur de filtre)
        if (!req.file) {
            return res.status(400).json({ error: "Fichier invalide ou manquant." });
        }

        const logoUrl = `/uploads/logos/${req.file.filename}`;

        // Mettre à jour en BDD avec Prisma
        await prisma.company.update({
            where: { id: req.user.companyId },
            data: { logoUrl: logoUrl }
        });

        res.status(200).json({
            success: true,
            url: logoUrl,
            message: "Logo téléchargé avec succès !"
        });
    } catch (error) {
        res.status(500).json({ error: "Erreur serveur lors de l'upload." });
    }
};


// model product {
//   id               String             @id @db.Char(36)
//   locationId       String?
//   name             String
//   slug             String             @unique(map: "Product_slug_key")
//   description      String?
//   price            Float
//   category         String?
//   image            String?
//   stripePriceId    String?
//   currency         String             @default("EUR")
//   subscription     Boolean            @default(false)
//   stripeProductId  String?
//   upsellPriceCents Int?
//   upsellEnabled    Boolean            @default(false)
//   stock            Int?
//   visible          Boolean            @default(true)
//   createdAt        DateTime           @default(now())
//   updatedAt        DateTime           @default(now())
//   bundleproduct    bundleproduct[]
//   nfctag           nfctag[]
//   orderitem        orderitem[]
//   locations        Location?          @relation(fields: [locationId], references: [id], map: "Product_locationId_fkey")
//   crossSoldBy      ProductCrossSell[] @relation("CrossSellInverse")
//   crossSell        ProductCrossSell[] @relation("CrossSell")
//   tags             ProductTag[]
//   upsellLinks      ProductUpsell[]    @relation("Upsell")
//   upsoldBy         ProductUpsell[]    @relation("UpsellInverse")
//   productdesign    productdesign[]
//   upsell           upsell[]

//   @@index([locationId], map: "Product_locationId_fkey")
// }


// model productdesign {
//   id        Int     @id @default(autoincrement())
//   productId String
//   designId  String
//   design    design  @relation(fields: [designId], references: [id], map: "ProductDesign_designId_fkey")
//   product   product @relation(fields: [productId], references: [id], map: "ProductDesign_productId_fkey")

//   @@unique([productId, designId], map: "ProductDesign_productId_designId_key")
//   @@index([designId], map: "ProductDesign_designId_fkey")
// }

// model ProductCrossSell {
//   productId    String
//   crossSellId  String
//   crossSelling product @relation("CrossSellInverse", fields: [crossSellId], references: [id])
//   product      product @relation("CrossSell", fields: [productId], references: [id])

//   @@id([productId, crossSellId])
//   @@index([crossSellId], map: "product_cross_sells_crossSellId_fkey")
//   @@map("product_cross_sells")
// }

// model ProductUpsell {
//   productId String
//   upsellId  String
//   product   product @relation("Upsell", fields: [productId], references: [id])
//   upsell    product @relation("UpsellInverse", fields: [upsellId], references: [id])

//   @@id([productId, upsellId])
//   @@index([upsellId], map: "product_upsells_upsellId_fkey")
//   @@map("product_upsells")
// }
// model ProductTag {
//   productId String
//   tagId     String
//   product   product @relation(fields: [productId], references: [id])
//   tag       tag     @relation(fields: [tagId], references: [id])

//   @@id([productId, tagId])
//   @@index([tagId], map: "product_tags_tagId_fkey")
//   @@map("product_tags")
// }