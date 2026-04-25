// src/controllers/client/ReviewRequest.controller.js
// ─────────────────────────────────────────────────────────────
// Endpoints couverts par la vue Requests (admin) :
//
//   GET    /requests          → liste paginée + stats + filtres
//   POST   /requests          → créer et envoyer 1 demande
//   POST   /requests/bulk     → import CSV (tableau de contacts)
//   POST   /requests/:id/resend  → renvoyer une demande échouée
//   PUT    /requests/:id/cancel  → annuler une demande
//   DELETE /requests/:id         → supprimer (soft: status cancelled)
// ─────────────────────────────────────────────────────────────

import prisma from "../config/database.js";
import { sendTemplatedMail } from "../services/client/mail.service.js";
// import { sendSms } from "../../services/sms.service.js"; // décommenter quand prêt

function getCompanyId(req) {
  const id = req.user?.companyId;
  if (!id) throw Object.assign(new Error("Aucune company active"), { status: 403 });
  return parseInt(id);
}

// ─── Format réponse ───────────────────────────────────────────
function formatRequest(r) {
  return {
    id:           r.id,
    customerName: r.customerName,
    method:       r.method,
    contact:      r.method === "email" ? r.email : `${r.countryCode || ""}${r.phone}`,
    email:        r.email,
    phone:        r.phone,
    countryCode:  r.countryCode,
    status:       r.status,
    conversion:   r.conversion,
    location:     r.location
      ? { id: r.location.id, name: r.location.name }
      : null,
    locationId:   r.locationId,
    customMessage: r.customMessage,
    sentAt:       r.sentAt,
    deliveredAt:  r.deliveredAt,
    openedAt:     r.openedAt,
    completedAt:  r.completedAt,
    failedAt:     r.failedAt,
    failureReason: r.failureReason,
    createdAt:    r.createdAt,
  };
}

// ─── Dispatch de l'envoi (email ou SMS) ───────────────────────
async function dispatchRequest(reviewRequest, company) {
  const { method, email, phone, countryCode, customerName, customMessage } = reviewRequest;

  const defaultMessage = customMessage ||
    `Hi ${customerName}, we'd love your feedback! Would you take a moment to leave us a review? Your opinion means a lot to us.`;

  const reviewUrl = company.googleReviewUrl || company.googleLink || "#";

  if (method === "email" && email) {
    await sendTemplatedMail({
      slug: "review_request",
      to:   email,
      variables: {
        customer_name:  customerName,
        company_name:   company.name,
        custom_message: defaultMessage,
        review_url:     reviewUrl,
        year:           String(new Date().getFullYear()),
      },
      fallbackFn: () => ({
        subject: `${company.name} — We'd love your feedback!`,
        html: `
          <p>Hi ${customerName},</p>
          <p>${defaultMessage}</p>
          <p><a href="${reviewUrl}" style="background:#E10600;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Leave a Review</a></p>
          <p>Thank you,<br/>${company.name}</p>
        `,
        text: `${defaultMessage}\nLeave a review: ${reviewUrl}`,
      }),
    });
    return { success: true };
  }

  if (method === "sms" && phone) {
    // TODO : intégrer le service SMS
    // const fullPhone = `${countryCode || ""}${phone}`;
    // await sendSms({ to: fullPhone, body: `${defaultMessage} ${reviewUrl}` });
    console.log(`[review-request] SMS à envoyer vers ${countryCode}${phone} : ${defaultMessage}`);
    return { success: true };
  }

  throw new Error("Méthode ou contact invalide");
}

// ─────────────────────────────────────────────────────────────
// GET /api/client/shop/requests
// Query : status, method, locationId, page, limit, search
// ─────────────────────────────────────────────────────────────
export const listRequests = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const {
      status,
      method,
      locationId,
      search,
      page  = "1",
      limit = "20",
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // ── Filtres ───────────────────────────────────────────────
    const where = { companyId };
    if (status)     where.status     = status;
    if (method)     where.method     = method;
    if (locationId) where.locationId = parseInt(locationId);
    if (search) {
      where.OR = [
        { customerName: { contains: search } },
        { email:        { contains: search } },
        { phone:        { contains: search } },
      ];
    }

    const [requests, total] = await Promise.all([
      prisma.reviewRequest.findMany({
        where,
        include: { location: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.reviewRequest.count({ where }),
    ]);

    // ── Stats globales de la company ─────────────────────────
    const [
      totalSent,
      totalDelivered,
      totalOpened,
      totalCompleted,
      totalFailed,
    ] = await Promise.all([
      prisma.reviewRequest.count({ where: { companyId } }),
      prisma.reviewRequest.count({ where: { companyId, status: { in: ["delivered", "opened", "completed"] } } }),
      prisma.reviewRequest.count({ where: { companyId, status: { in: ["opened", "completed"] } } }),
      prisma.reviewRequest.count({ where: { companyId, conversion: true } }),
      prisma.reviewRequest.count({ where: { companyId, status: "failed" } }),
    ]);

    const deliveredRate  = totalSent ? Math.round((totalDelivered / totalSent) * 100) : 0;
    const openedRate     = totalSent ? Math.round((totalOpened    / totalSent) * 100) : 0;
    const conversionRate = totalSent ? Math.round((totalCompleted / totalSent) * 100) : 0;

    res.json({
      success: true,
      data: {
        requests: requests.map(formatRequest),
        pagination: {
          total,
          page:       parseInt(page),
          limit:      take,
          totalPages: Math.ceil(total / take),
        },
        stats: {
          totalSent,
          deliveredRate:  `${deliveredRate}%`,
          openedRate:     `${openedRate}%`,
          conversionRate: `${conversionRate}%`,
          totalFailed,
        },
      },
    });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/client/shop/requests
// Body : { customerName, method, email?, phone?, countryCode?, locationId?, customMessage? }
// ─────────────────────────────────────────────────────────────
export const createRequest = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const userId    = req.user.userId;
    const {
      customerName,
      method = "email",
      email,
      phone,
      countryCode,
      locationId,
      customMessage,
    } = req.body;

    // ── Validation ────────────────────────────────────────────
    if (!customerName?.trim()) {
      return res.status(422).json({ success: false, error: "Le nom du client est requis" });
    }
    if (method === "email" && !email?.trim()) {
      return res.status(422).json({ success: false, error: "L'email est requis pour la méthode email" });
    }
    if (method === "sms" && !phone?.trim()) {
      return res.status(422).json({ success: false, error: "Le téléphone est requis pour la méthode SMS" });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, googleReviewUrl: true, googleLink: true },
    });

    // ── Créer la demande en DB ────────────────────────────────
    let reviewRequest = await prisma.reviewRequest.create({
      data: {
        companyId,
        userId,
        customerName:  customerName.trim(),
        method,
        email:         email?.trim()       || null,
        phone:         phone?.trim()       || null,
        countryCode:   countryCode?.trim() || null,
        locationId:    locationId          ? parseInt(locationId) : null,
        customMessage: customMessage?.trim() || null,
        status:        "sent",
        sentAt:        new Date(),
      },
      include: { location: { select: { id: true, name: true } } },
    });

    // ── Dispatcher l'envoi ────────────────────────────────────
    try {
      await dispatchRequest(reviewRequest, company);
    } catch (sendErr) {
      // L'envoi a échoué → marquer comme failed mais ne pas bloquer la réponse
      reviewRequest = await prisma.reviewRequest.update({
        where: { id: reviewRequest.id },
        data: {
          status:        "failed",
          failedAt:      new Date(),
          failureReason: sendErr.message?.slice(0, 500),
        },
        include: { location: { select: { id: true, name: true } } },
      });
      console.error("[review-request] Échec envoi:", sendErr.message);
    }

    res.status(201).json({ success: true, data: formatRequest(reviewRequest) });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/client/shop/requests/bulk
// Body : { contacts: [{ customerName, method, email?, phone?, countryCode? }], locationId?, customMessage? }
// ─────────────────────────────────────────────────────────────
export const bulkCreateRequests = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const userId    = req.user.userId;
    const { contacts, locationId, customMessage } = req.body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(422).json({ success: false, error: "Le tableau contacts[] est requis" });
    }

    // Limiter à 500 par import (protection)
    if (contacts.length > 500) {
      return res.status(422).json({ success: false, error: "Maximum 500 contacts par import" });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, googleReviewUrl: true, googleLink: true },
    });

    const results = { created: 0, failed: 0, errors: [] };

    for (const contact of contacts) {
      const { customerName, method = "email", email, phone, countryCode } = contact;

      // Validation légère par contact
      if (!customerName?.trim()) { results.errors.push(`Contact sans nom ignoré`); results.failed++; continue; }
      if (method === "email" && !email?.trim()) { results.errors.push(`${customerName} : email manquant`); results.failed++; continue; }
      if (method === "sms"   && !phone?.trim()) { results.errors.push(`${customerName} : téléphone manquant`); results.failed++; continue; }

      try {
        const reviewRequest = await prisma.reviewRequest.create({
          data: {
            companyId,
            userId,
            customerName:  customerName.trim(),
            method,
            email:         email?.trim()       || null,
            phone:         phone?.trim()       || null,
            countryCode:   countryCode?.trim() || null,
            locationId:    locationId          ? parseInt(locationId) : null,
            customMessage: customMessage?.trim() || null,
            status:        "sent",
            sentAt:        new Date(),
          },
        });

        // Envoi asynchrone — ne bloque pas la boucle
        dispatchRequest(reviewRequest, company).catch(async (err) => {
          await prisma.reviewRequest.update({
            where: { id: reviewRequest.id },
            data: { status: "failed", failedAt: new Date(), failureReason: err.message?.slice(0, 500) },
          });
        });

        results.created++;
      } catch (err) {
        results.errors.push(`${customerName} : ${err.message}`);
        results.failed++;
      }
    }

    res.status(201).json({
      success: true,
      message: `${results.created} demandes créées, ${results.failed} ignorées`,
      data:    results,
    });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/client/shop/requests/:id/resend
// Renvoie une demande échouée ou expirée
// ─────────────────────────────────────────────────────────────
export const resendRequest = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const id        = parseInt(req.params.id);

    const existing = await prisma.reviewRequest.findFirst({
      where: { id, companyId },
      include: { location: { select: { id: true, name: true } } },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Demande introuvable" });
    }

    if (existing.status === "completed") {
      return res.status(422).json({ success: false, error: "Cette demande est déjà complétée" });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, googleReviewUrl: true, googleLink: true },
    });

    // Remettre en "sent" avant l'envoi
    let updated = await prisma.reviewRequest.update({
      where: { id },
      data: {
        status:       "sent",
        sentAt:       new Date(),
        failedAt:     null,
        failureReason: null,
      },
      include: { location: { select: { id: true, name: true } } },
    });

    // Dispatcher
    try {
      await dispatchRequest(updated, company);
    } catch (sendErr) {
      updated = await prisma.reviewRequest.update({
        where: { id },
        data: { status: "failed", failedAt: new Date(), failureReason: sendErr.message?.slice(0, 500) },
        include: { location: { select: { id: true, name: true } } },
      });
    }

    res.json({ success: true, data: formatRequest(updated) });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/client/shop/requests/:id/cancel
// ─────────────────────────────────────────────────────────────
export const cancelRequest = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const id        = parseInt(req.params.id);

    const existing = await prisma.reviewRequest.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Demande introuvable" });
    }

    if (["completed", "cancelled"].includes(existing.status)) {
      return res.status(422).json({ success: false, error: `La demande est déjà ${existing.status}` });
    }

    const updated = await prisma.reviewRequest.update({
      where: { id },
      data:  { status: "cancelled" },
      include: { location: { select: { id: true, name: true } } },
    });

    res.json({ success: true, data: formatRequest(updated) });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/client/shop/requests/:id
// Suppression définitive (la vue utilise XCircle = cancel,
// mais on expose aussi la suppression pour les besoins futurs)
// ─────────────────────────────────────────────────────────────
export const deleteRequest = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const id        = parseInt(req.params.id);

    const existing = await prisma.reviewRequest.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Demande introuvable" });
    }

    await prisma.reviewRequest.delete({ where: { id } });

    res.json({ success: true, message: "Demande supprimée" });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/client/shop/requests/:id/status
// Webhook-like : appelé par le prestataire SMS/Email pour mettre
// à jour le statut (delivered, opened, completed)
// Peut aussi être appelé manuellement par le superadmin
// ─────────────────────────────────────────────────────────────
export const updateRequestStatus = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const id        = parseInt(req.params.id);
    const { status, conversion } = req.body;

    const allowed = ["delivered", "opened", "completed", "failed"];
    if (!allowed.includes(status)) {
      return res.status(422).json({ success: false, error: `Statut invalide. Valeurs : ${allowed.join(", ")}` });
    }

    const existing = await prisma.reviewRequest.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Demande introuvable" });
    }

    // Construire les champs de date selon le nouveau statut
    const dateField = {
      delivered: "deliveredAt",
      opened:    "openedAt",
      completed: "completedAt",
      failed:    "failedAt",
    }[status];

    const updated = await prisma.reviewRequest.update({
      where: { id },
      data:  {
        status,
        [dateField]: new Date(),
        ...(conversion !== undefined ? { conversion: Boolean(conversion) } : {}),
      },
      include: { location: { select: { id: true, name: true } } },
    });

    res.json({ success: true, data: formatRequest(updated) });
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/requests/locations
// Locations actives de la company → select du formulaire Create
// et de l'import CSV bulk
// ─────────────────────────────────────────────────────────────
export const getLocationsForRequests = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
 
    const locations = await prisma.location.findMany({
      where:   { companyId, active: true },
      select:  {
        id:              true,
        name:            true,
        city:            true,
        address:         true,
        googlePlaceId:   true,
        googleReviewUrl: true,
      },
      orderBy: { name: "asc" },
    });
 
    res.json({ success: true, data: locations });
  } catch (e) {
    next(e);
  }
};