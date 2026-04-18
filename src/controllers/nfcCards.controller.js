// src/controllers/admin/nfcCards.controller.js

import prisma from "../config/database.js";

/**
 * GET /api/admin/nfc-cards
 * Liste toutes les cartes NFC de la company avec filtres
 */
export const listNfcCards = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: "Aucune company active",
        code: "NO_COMPANY"
      });
    }

    const {
      search,
      status,
      locationId,
      assigned, // "true" | "false" | undefined
      page = 1,
      limit = 50
    } = req.query;

    const where = { companyId: parseInt(companyId) };

    // Filtre par statut
    if (status && status !== "all") {
      if (status === "assigned") {
        where.locationId = { not: null };
      } else if (status === "unassigned") {
        where.locationId = null;
      } else {
        where.status = status;
      }
    }

    // Filtre assigned/unassigned
    if (assigned === "true") {
      where.locationId = { not: null };
    } else if (assigned === "false") {
      where.locationId = null;
    }

    // Filtre par location
    if (locationId) {
      where.locationId = parseInt(locationId);
    }

    // Recherche textuelle
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      where.OR = [
        { uid: { contains: searchTerm, mode: "insensitive" } },
        { locationName: { contains: searchTerm, mode: "insensitive" } },
        { tag: { tagSerial: { contains: searchTerm, mode: "insensitive" } } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [cards, total] = await Promise.all([
      prisma.nFCCard.findMany({
        where,
        include: {
          tag: true,
          location: {
            select: {
                id: true,
                name: true,
                address: true, // ✅ Ajouté
                city: true,    // ✅ Ajouté
                googlePlaceId: true
            }
            },
          design: {
            select: {
              id: true,
              templateName: true,
              cardModel: true,
              orientation: true
            }
          },
          orderItem: {
            select: {
              id: true,
              order: {
                select: {
                  id: true,
                  orderNumber: true
                }
              },
              product: {
                select: {
                  id: true,
                  translations: {
                    take: 1,
                    select: { title: true }
                  }
                }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit)
      }),
      prisma.nFCCard.count({ where })
    ]);

    // Stats globales
    const stats = await prisma.nFCCard.groupBy({
      by: ["status"],
      where: { companyId: parseInt(companyId) },
      _count: true
    });

    const statsMap = stats.reduce((acc, s) => {
      acc[s.status] = s._count;
      return acc;
    }, {});

    const totalCards = await prisma.nFCCard.count({
      where: { companyId: parseInt(companyId) }
    });

    const activeCards = await prisma.nFCCard.count({
      where: { companyId: parseInt(companyId), status: "ACTIVE" }
    });

    const assignedCards = await prisma.nFCCard.count({
      where: { companyId: parseInt(companyId), locationId: { not: null } }
    });

    const unassignedCards = await prisma.nFCCard.count({
      where: { companyId: parseInt(companyId), locationId: null }
    });

    return res.json({
      success: true,
      data: {
        cards: cards.map(formatNfcCard),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        },
        stats: {
          total: totalCards,
          active: activeCards,
          assigned: assignedCards,
          unassigned: unassignedCards,
          byStatus: statsMap
        }
      }
    });
  } catch (error) {
    console.error("Error listing NFC cards:", error);
    next(error);
  }
};

/**
 * GET /api/admin/nfc-cards/:id
 * Détails d'une carte NFC
 */
export const getNfcCard = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.companyId;

    const card = await prisma.nFCCard.findFirst({
      where: {
        id: parseInt(id),
        companyId: parseInt(companyId)
      },
      include: {
        tag: true,
        location: true,
        design: true,
        company: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        orderItem: {
          include: {
            order: true,
            product: {
              include: {
                translations: { take: 1 }
              }
            }
          }
        },
        scans: {
          take: 10,
          orderBy: { scannedAt: "desc" },
          select: {
            id: true,
            scannedAt: true,
            ipAddress: true,
            userAgent: true,
            redirected: true
          }
        }
      }
    });

    if (!card) {
      return res.status(404).json({
        success: false,
        error: "Carte introuvable",
        code: "CARD_NOT_FOUND"
      });
    }

    return res.json({
      success: true,
      data: formatNfcCardDetailed(card)
    });
  } catch (error) {
    console.error("Error getting NFC card:", error);
    next(error);
  }
};

/**
 * PATCH /api/admin/nfc-cards/:id/assign
 * Assigner une carte à une location
 */
export const assignCardToLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { locationId } = req.body;
    const companyId = req.user?.companyId;

    if (!locationId) {
      return res.status(400).json({
        success: false,
        error: "locationId requis",
        code: "MISSING_LOCATION_ID"
      });
    }

    // Vérifier que la carte appartient à la company
    const card = await prisma.nFCCard.findFirst({
      where: {
        id: parseInt(id),
        companyId: parseInt(companyId)
      }
    });

    if (!card) {
      return res.status(404).json({
        success: false,
        error: "Carte introuvable",
        code: "CARD_NOT_FOUND"
      });
    }

    // Vérifier que la location appartient à la company
    const location = await prisma.location.findFirst({
      where: {
        id: parseInt(locationId),
        companyId: parseInt(companyId)
      }
    });

    if (!location) {
      return res.status(404).json({
        success: false,
        error: "Location introuvable",
        code: "LOCATION_NOT_FOUND"
      });
    }

    // Mettre à jour la carte
    const updatedCard = await prisma.nFCCard.update({
      where: { id: parseInt(id) },
      data: {
        locationId: location.id,
        locationName: location.name,
        locationAddress: location.address,
        googlePlaceId: location.googlePlaceId,
        googleReviewUrl: location.googleReviewUrl
      },
      include: {
        location: true,
        tag: true,
        design: {
          select: {
            id: true,
            templateName: true,
            cardModel: true
          }
        }
      }
    });

    return res.json({
      success: true,
      message: `Carte assignée à "${location.name}"`,
      data: formatNfcCard(updatedCard)
    });
  } catch (error) {
    console.error("Error assigning card to location:", error);
    next(error);
  }
};

/**
 * PATCH /api/admin/nfc-cards/:id/unassign
 * Retirer l'assignation d'une carte
 */
export const unassignCardFromLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.companyId;

    const card = await prisma.nFCCard.findFirst({
      where: {
        id: parseInt(id),
        companyId: parseInt(companyId)
      }
    });

    if (!card) {
      return res.status(404).json({
        success: false,
        error: "Carte introuvable",
        code: "CARD_NOT_FOUND"
      });
    }

    if (!card.locationId) {
      return res.status(400).json({
        success: false,
        error: "Cette carte n'est assignée à aucune location",
        code: "NOT_ASSIGNED"
      });
    }

    const updatedCard = await prisma.nFCCard.update({
      where: { id: parseInt(id) },
      data: {
        locationId: null,
        locationName: null,
        locationAddress: null,
        googlePlaceId: null,
        googleReviewUrl: null
      },
      include: {
        tag: true,
        design: {
          select: {
            id: true,
            templateName: true,
            cardModel: true
          }
        }
      }
    });

    return res.json({
      success: true,
      message: "Carte désassignée avec succès",
      data: formatNfcCard(updatedCard)
    });
  } catch (error) {
    console.error("Error unassigning card:", error);
    next(error);
  }
};

/**
 * PATCH /api/admin/nfc-cards/:id/status
 * Changer le statut d'une carte
 */
export const updateCardStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const companyId = req.user?.companyId;

    const validStatuses = [
      "NOT_PROGRAMMED",
      "PRINTED",
      "SHIPPED",
      "DELIVERED",
      "ACTIVE",
      "DISABLED"
    ];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Statut invalide",
        code: "INVALID_STATUS",
        validStatuses
      });
    }

    const card = await prisma.nFCCard.findFirst({
      where: {
        id: parseInt(id),
        companyId: parseInt(companyId)
      }
    });

    if (!card) {
      return res.status(404).json({
        success: false,
        error: "Carte introuvable",
        code: "CARD_NOT_FOUND"
      });
    }

    const updateData = { status };

    // Si le statut passe à DELIVERED, activer la carte
    if (status === "DELIVERED" && !card.active) {
      updateData.active = true;
      updateData.activatedAt = new Date();
    }

    // Si le statut passe à DISABLED, désactiver la carte
    if (status === "DISABLED") {
      updateData.active = false;
    }

    const updatedCard = await prisma.nFCCard.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        tag: true,
        location: true,
        design: {
          select: {
            id: true,
            templateName: true,
            cardModel: true
          }
        }
      }
    });

    return res.json({
      success: true,
      message: `Statut mis à jour: ${status}`,
      data: formatNfcCard(updatedCard)
    });
  } catch (error) {
    console.error("Error updating card status:", error);
    next(error);
  }
};

/**
 * DELETE /api/admin/nfc-cards/:id
 * Supprimer une carte (soft delete = désactiver)
 */
export const deleteNfcCard = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.companyId;

    const card = await prisma.nFCCard.findFirst({
      where: {
        id: parseInt(id),
        companyId: parseInt(companyId)
      }
    });

    if (!card) {
      return res.status(404).json({
        success: false,
        error: "Carte introuvable",
        code: "CARD_NOT_FOUND"
      });
    }

    // Soft delete: mettre le statut à DISABLED et active à false
    await prisma.nFCCard.update({
      where: { id: parseInt(id) },
      data: {
        status: "DISABLED",
        active: false
      }
    });

    return res.json({
      success: true,
      message: "Carte désactivée avec succès"
    });
  } catch (error) {
    console.error("Error deleting card:", error);
    next(error);
  }
};


/**
 * GET /api/admin/nfc-cards/locations/available
 * Récupérer les locations disponibles pour assignation
 */
export const getAvailableLocations = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: "Aucune company active",
        code: "NO_COMPANY"
      });
    }

    const locations = await prisma.location.findMany({
      where: {
        companyId: parseInt(companyId),
        active: true
      },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        postal: true,
        country: true,
        phone: true,
        email: true,
        googlePlaceId: true,
        googleReviewUrl: true,
        googleMapsUrl: true,
        googleRating: true,
        googleReviewCount: true,
        cardCount: true,
        active: true,
        createdAt: true
      },
      orderBy: [
        { active: 'desc' },
        { name: 'asc' }
      ]
    });

    return res.json({
      success: true,
      data: {
        locations,
        total: locations.length
      }
    });
  } catch (error) {
    console.error("Error getting available locations:", error);
    next(error);
  }
};

// ─── Helper Functions ─────────────────────────────────────────

function formatNfcCard(card) {
  return {
    id: card.id,
    uid: card.uid,
    tagSerial: card.tag?.tagSerial || null,
    chipType: card.tag?.chipType || null,
    status: card.status,
    active: card.active,
    used: card.used,
    
    // Design info
    design: card.design ? {
      id: card.design.id,
      templateName: card.design.templateName,
      cardModel: card.design.cardModel,
      orientation: card.design.orientation
    } : null,

    // Product info
    product: card.orderItem?.product ? {
      id: card.orderItem.product.id,
      name: card.orderItem.product.translations?.[0]?.title || "Unknown Product"
    } : null,

    // Location info
    location: card.location ? {
      id: card.location.id,
      name: card.location.name,
      address: card.location.address,
      googlePlaceId: card.location.googlePlaceId
    } : null,

    // Analytics
    scanCount: card.scanCount,
    googleRedirectCount: card.googleRedirectCount,
    lastScannedAt: card.lastScannedAt,

    // Dates
    generatedAt: card.generatedAt,
    activatedAt: card.activatedAt,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt
  };
}

function formatNfcCardDetailed(card) {
  return {
    ...formatNfcCard(card),
    // Infos complètes
    payload: card.payload,
    qrCodeUrl: card.qrCodeUrl,
    googlePlaceId: card.googlePlaceId,
    googleReviewUrl: card.googleReviewUrl,
    locationName: card.locationName,
    locationAddress: card.locationAddress,

    // Company
    company: card.company ? {
      id: card.company.id,
      name: card.company.name,
      email: card.company.email
    } : null,

    // User
    user: card.user ? {
      id: card.user.id,
      name: card.user.name,
      email: card.user.email
    } : null,

    // Order
    order: card.orderItem?.order ? {
      id: card.orderItem.order.id,
      orderNumber: card.orderItem.order.orderNumber
    } : null,

    // Recent scans
    recentScans: card.scans?.map(scan => ({
      id: scan.id,
      scannedAt: scan.scannedAt,
      ipAddress: scan.ipAddress,
      userAgent: scan.userAgent,
      redirected: scan.redirected
    })) || []
  };
}