import prisma from "../config/database.js";

/**
 * Helper - Récupère l'ID de la company active
 */
function getCompanyId(req) {
  const id = req.user?.companyId;
  if (!id) throw Object.assign(new Error("Aucune company active"), { status: 403 });
  return parseInt(id);
}

/**
 * GET /api/admin/analytics/events
 * Récupère les événements analytics pour la company active
 */
export const getAnalyticsEvents = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const {
      type,
      status,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;

    // Construire les filtres
    const where = {
      companyId
    };

    // Filtre par type d'événement
    if (type && type !== 'All') {
      where.type = type;
    }

    // Filtre par recherche (cardUid, ipAddress, location)
    if (search && search.trim()) {
      where.OR = [
        { cardUid: { contains: search } },
        { ipAddress: { contains: search } },
        { city: { contains: search } },
        { country: { contains: search } }
      ];
    }

    // Filtre par date
    if (startDate || endDate) {
      where.occurredAt = {};
      if (startDate) {
        where.occurredAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.occurredAt.lte = end;
      }
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Récupérer les événements
    const [events, total] = await Promise.all([
      prisma.analyticsEvent.findMany({
        where,
        include: {
          card: {
            select: {
              uid: true,
              locationName: true,
              locationAddress: true
            }
          }
        },
        orderBy: { occurredAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.analyticsEvent.count({ where })
    ]);

    // Formatter les événements pour la vue
    const formattedEvents = events.map(event => {
      // Déterminer le status basé sur le type
      let status = 'Success';
      if (event.type === 'FEEDBACK_SUBMITTED' && event.stars && event.stars <= 3) {
        status = 'Failed'; // Feedback négatif
      }

      return {
        id: event.id,
        timestamp: event.occurredAt.toISOString().replace('T', ' ').substring(0, 19),
        name: event.type.toLowerCase().replace('_', '.'),
        source: determineSource(event),
        location: event.card?.locationName || event.city || '—',
        status,
        payload: buildPayload(event)
      };
    });

    res.json({
      success: true,
      data: {
        events: formattedEvents,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching analytics events:', error);
    
    if (error.status === 403) {
      return res.status(403).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error fetching analytics events',
      details: error.message
    });
  }
};

/**
 * GET /api/admin/analytics/events/:id
 * Récupère un événement spécifique
 */
export const getEventById = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;

    const event = await prisma.analyticsEvent.findFirst({
      where: {
        id: parseInt(id),
        companyId
      },
      include: {
        card: {
          select: {
            uid: true,
            locationName: true,
            locationAddress: true,
            googleReviewUrl: true
          }
        }
      }
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: event.id,
        timestamp: event.occurredAt.toISOString().replace('T', ' ').substring(0, 19),
        name: event.type.toLowerCase().replace('_', '.'),
        source: determineSource(event),
        location: event.card?.locationName || event.city || '—',
        status: determineStatus(event),
        payload: buildPayload(event)
      }
    });
  } catch (error) {
    console.error('❌ Error fetching event:', error);
    
    if (error.status === 403) {
      return res.status(403).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error fetching event',
      details: error.message
    });
  }
};

/**
 * GET /api/admin/analytics/stats
 * Récupère les statistiques des événements pour la company active
 */
export const getAnalyticsStats = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { startDate, endDate } = req.query;

    const where = {
      companyId
    };

    if (startDate || endDate) {
      where.occurredAt = {};
      if (startDate) where.occurredAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.occurredAt.lte = end;
      }
    }

    // Compter les événements par type
    const [
      totalScans,
      totalPageViews,
      totalRatings,
      totalFeedbacks,
      googleRedirects,
      positiveRatings,
      negativeRatings
    ] = await Promise.all([
      prisma.analyticsEvent.count({ where: { ...where, type: 'SCAN' } }),
      prisma.analyticsEvent.count({ where: { ...where, type: 'PAGE_VIEW' } }),
      prisma.analyticsEvent.count({ where: { ...where, type: 'RATING_SELECTED' } }),
      prisma.analyticsEvent.count({ where: { ...where, type: 'FEEDBACK_SUBMITTED' } }),
      prisma.analyticsEvent.count({ where: { ...where, type: 'GOOGLE_REDIRECT' } }),
      prisma.analyticsEvent.count({ where: { ...where, type: 'RATING_SELECTED', stars: { gte: 4 } } }),
      prisma.analyticsEvent.count({ where: { ...where, type: 'RATING_SELECTED', stars: { lte: 3 } } })
    ]);

    res.json({
      success: true,
      data: {
        totalScans,
        totalPageViews,
        totalRatings,
        totalFeedbacks,
        positiveRatings,
        negativeRatings,
        googleRedirects
      }
    });
  } catch (error) {
    console.error('❌ Error fetching analytics stats:', error);
    
    if (error.status === 403) {
      return res.status(403).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error fetching analytics stats',
      details: error.message
    });
  }
};

// ========== Helpers ==========

function determineSource(event) {
  if (event.type === 'SCAN') return 'NFC Card';
  if (event.type === 'PAGE_VIEW') return 'Web';
  if (event.type === 'RATING_SELECTED') return 'Review Form';
  if (event.type === 'GOOGLE_REDIRECT') return 'System';
  if (event.type === 'FEEDBACK_SUBMITTED') return 'Customer';
  return 'System';
}

function determineStatus(event) {
  if (event.type === 'FEEDBACK_SUBMITTED' && event.stars && event.stars <= 3) {
    return 'Failed';
  }
  return 'Success';
}

function buildPayload(event) {
  const payload = {
    event_id: event.id,
    card_uid: event.cardUid,
    type: event.type,
    occurred_at: event.occurredAt.toISOString()
  };

  // Ajouter les données spécifiques selon le type
  if (event.stars !== null) {
    payload.rating = event.stars;
  }

  if (event.ipAddress) {
    payload.ip_address = event.ipAddress;
  }

  if (event.deviceType) {
    payload.device_type = event.deviceType;
  }

  if (event.userAgent) {
    payload.user_agent = event.userAgent;
  }

  if (event.country) {
    payload.country = event.country;
  }

  if (event.city) {
    payload.city = event.city;
  }

  if (event.referrer) {
    payload.referrer = event.referrer;
  }

  if (event.fingerprintHash) {
    payload.fingerprint = event.fingerprintHash;
  }

  // Ajouter les infos de la carte
  if (event.card) {
    payload.location = {
      name: event.card.locationName,
      address: event.card.locationAddress
    };
  }

  return payload;
}