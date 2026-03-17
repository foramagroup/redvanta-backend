

export const authorize = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentification requise" });
    }

 
    // if (req.user.role === 'superadmin') {
    //   return next();
    // }
    if (!req.user.permissions.includes(requiredPermission)) {
      return res.status(403).json({
        success: false,
        message: `Accès refusé : Permission [${requiredPermission}] manquante`
      });
    }
    next();
  };
};

