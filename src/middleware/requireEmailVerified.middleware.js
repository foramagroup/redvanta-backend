// src/middleware/requireEmailVerified.middleware.js

/**
 * Middleware pour bloquer l'accès aux comptes non vérifiés
 */
export const requireEmailVerified = async (req, res, next) => {
  try {
    // Vérifier si l'utilisateur est vérifié
    if (!req.user?.emailVerified) {
      return res.status(403).json({
        success: false,
        error: "Veuillez vérifier votre email avant d'accéder à cette ressource",
        code: "EMAIL_NOT_VERIFIED",
        requiresVerification: true
      });
    }

    // Vérifier si le compte est suspendu
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { 
        accountSuspendedAt: true, 
        suspensionReason: true 
      }
    });

    if (user?.accountSuspendedAt) {
      return res.status(403).json({
        success: false,
        error: "Votre compte a été suspendu",
        code: "ACCOUNT_SUSPENDED",
        reason: user.suspensionReason
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};