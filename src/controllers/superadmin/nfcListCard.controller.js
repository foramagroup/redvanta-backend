import prisma from "../../config/database.js";
import { assignTagToCard } from "../../services/nfc.service.js";

    // ─── STATS POUR LES BADGES DU HAUT ────────────────────────────
    export const getCardsStats = async (req, res, next) => {
        try {
            const [total, assigned, active] = await Promise.all([
            prisma.nFCCard.count(),
            prisma.nFCCard.count({ where: { tagId: { not: null } } }),
            prisma.nFCCard.count({ where: { active: true } }),
            ]);

            res.json({
            success: true,
            data: {
                total,
                assigned,
                unassigned: total - assigned,
                active,
            },
            });
        } catch (e) { next(e); }
    };

    // ─── LISTE DES CARTES AVEC FILTRES ET RECHERCHE ───────────────
    export const listCards = async (req, res, next) => {
        try {
            const { filter, search, page = "1", limit = "20" } = req.query;

            const where = {};

            // Filtre d'assignation
            if (filter === "assigned") where.tagId = { not: null };
            if (filter === "unassigned") where.tagId = null;

            // Recherche globale
            if (search) {
                where.OR = [
                    { uid: { contains: search } },
                    { locationName: { contains: search } },
                    { user: { name: { contains: search } } },
                ];
            }

            const pageNum = Math.max(1, parseInt(page));
            const take = Math.min(100, parseInt(limit));
            const skip = (pageNum - 1) * take;

            const [cards, total] = await Promise.all([
            prisma.nFCCard.findMany({
                where,
                include: {
                user: { select: { name: true } },
                tag: { select: { id: true, tagSerial: true } },
                design: { select: { businessName: true } },
                orderItem: {
                    include: {
                    product: {
                        include: {
                        translations: {
                            take: 1,
                            where: { langId: 1 } 
                        }
                        }
                    }
                    }
                }
                },
                orderBy: { createdAt: "desc" },
                skip,
                take,
            }),
            prisma.nFCCard.count({ where }),
            ]);

            // Formatage pour le frontend (Next.js attend ces clés précises)
            const formattedCards = cards.map((c) => ({
            id: c.id,
            uid: c.uid,
            userName: c.user?.name || "N/A",
            locationName: c.locationName || "N/A",
            designName: c.design?.businessName || "Standard Design",
            productName: c.orderItem?.product?.translations[0]?.title || "Classic NFC Card",
            active: c.active,
            tagId: c.tagId,
            tagSerial: c.tag?.tagSerial || null,
            payload: c.payload,
            createdAt: c.createdAt.toISOString().split("T")[0],
            }));

            res.json({
            success: true,
            data: formattedCards,
            meta: { 
                total, 
                page: pageNum, 
                limit: take,
                pages: Math.ceil(total / take) 
            },
            });
        } catch (e) { next(e); }
    };

    // ─── ASSIGNATION (Action du bouton Link2) ────────────────────
    export const handleAssign = async (req, res, next) => {
        try {
            const { cardId, tagId } = req.body;

            if (!cardId || !tagId) {
            return res.status(422).json({ success: false, error: "IDs requis" });
            }
            // Utilisation de ton service existant
            await assignTagToCard(parseInt(cardId), parseInt(tagId));
            
            res.json({ success: true, message: "Assignation réussie" });
        } catch (e) {
            res.status(400).json({ success: false, error: e.message });
        }
    };

    // ─── DÉSASSIGNATION (Action du bouton Unlink) ────────────────
    export const handleUnassign = async (req, res, next) => {
        try {
            const { cardId } = req.params;

            const card = await prisma.nFCCard.findUnique({
            where: { id: parseInt(cardId) },
            select: { tagId: true }
            });

            if (!card?.tagId) {
            return res.status(404).json({ success: false, error: "Aucun tag lié" });
            }

            // Libération du tag (NEW) et retrait du lien sur la carte
            await prisma.$transaction([
            prisma.nFCCard.update({
                where: { id: parseInt(cardId) },
                data: { tagId: null }
            }),
            prisma.nFCTag.update({
                where: { id: card.tagId },
                data: { status: "NEW" }
            })
            ]);

            res.json({ success: true, message: "Tag désassigné et remis en stock" });
        } catch (e) { next(e); }
    };