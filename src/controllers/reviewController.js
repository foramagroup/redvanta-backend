// backend/src/controllers/reviewController.js
import express from "express";
import { ok, fail } from "../utils/responses.js";
import prisma from "../config/prisma.js";
import reviewService from "../services/reviewService.js";
import generateReviewPDF from "../utils/pdfGenerator.js";
import { sendEmail } from "../config/mailer.js";
import { v4 as uuidv4 } from "uuid";
import path from "path";

const router = express.Router();

/* ============================================================
   ADMIN — LIST REVIEWS
============================================================ */
router.get("/", async (req, res) => {
  try {
    const items = await prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return ok(res, { items });
  } catch (err) {
    console.error(err);
    return fail(res, 500, err.message);
  }
});

/* ============================================================
   PUBLIC — SUBMIT REVIEW
============================================================ */
router.post("/", async (req, res) => {
  try {
    const { locationSlug, locationId, rating, message, customerName, contact, source } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return fail(res, 400, "Invalid rating");
    }

    let locId = locationId;

    // If slug provided instead of ID
    if (!locId && locationSlug) {
      const loc = await prisma.location.findUnique({ where: { slug: locationSlug } });
      if (!loc) return fail(res, 404, "Location not found");
      locId = loc.id;
    }

    const review = await prisma.review.create({
      data: {
        id: uuidv4(),
        locationId: locId,
        locationSlug,
        rating,
        comment: message,
        userName: customerName,
        contact,
        source,
        status: rating <= 3 ? "alerted" : "posted",
        postedAt: new Date(),
      },
    });

    // Auto-alert on low rating
    if (rating <= 3 && process.env.OWNER_EMAIL) {
      try {
        await sendEmail({
          to: process.env.OWNER_EMAIL,
          subject: `⚠️ Alerte avis ${rating}★`,
          html: `<p>Nouvel avis négatif :</p><p>${message}</p>`,
        });

        await prisma.review.update({
          where: { id: review.id },
          data: { notifiedOwner: true },
        });
      } catch (emailErr) {
        console.error("Email send error:", emailErr);
      }
    }

    return ok(res, { review });

  } catch (err) {
    console.error(err);
    return fail(res, 500, err.message);
  }
});

/* ============================================================
   PUBLIC — GET REVIEWS BY LOCATION
============================================================ */
router.get("/by-location/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const location = await prisma.location.findUnique({ where: { slug } });
    if (!location) return fail(res, 404, "Location not found");

    const reviews = await prisma.review.findMany({
      where: { locationId: location.id, status: "posted" },
      orderBy: { postedAt: "desc" },
    });

    return ok(res, { reviews, location });

  } catch (err) {
    console.error(err);
    return fail(res, 500, err.message);
  }
});

/* ============================================================
   AUTH USERS — SUBMIT REVIEW (APP LOGGED-IN USERS)
============================================================ */
export const submitReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId, rating, comment } = req.body;

    const review = await reviewService.createReview(userId, orderId, rating, comment);
    res.json({ success: true, review });
  } catch (err) {
    console.error("Review error:", err);
    res.status(500).json({ error: "Unable to submit review" });
  }
};

/* ============================================================
   AUTH USERS — GET OWN REVIEWS
============================================================ */
export const getUserReviews = async (req, res) => {
  try {
    const reviews = await reviewService.getUserReviews(req.user.id);
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: "Cannot load reviews" });
  }
};

/* ============================================================
   AUTH USERS — DOWNLOAD PDF
============================================================ */
export const getReviewPDF = async (req, res) => {
  try {
    const reviewId = req.params.id;
    const review = await reviewService.getReviewById(reviewId);

    if (!review) return res.status(404).json({ error: "Review not found" });

    if (req.user.role !== "admin" && req.user.id !== review.userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const pdfPath = await generateReviewPDF(review);
    return res.download(pdfPath);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "PDF generation failed" });
  }
};

export default router;
