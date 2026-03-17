import db from "../config/db.js";

export default {
  async createReview(userId, orderId, rating, comment) {
    return db.review.create({
      data: {
        userId,
        orderId,
        rating,
        comment
      }
    });
  },

  async getUserReviews(userId) {
    return db.review.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });
  },

  async getReviewById(id) {
    return db.review.findUnique({
      where: { id },
      include: {
        user: true,
        order: true
      }
    });
  },

  async adminGetAllReviews() {
    return db.review.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: true,
        order: true
      }
    });
  }
};
