
export const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: "Authentification requise" 
      });
    }

    const userRole = req.user.role.toLowerCase();

    const hasRole = allowedRoles
      .map(role => role.toLowerCase())
      .includes(userRole);

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: `Accès interdit : Votre rôle [${userRole}] n'est pas autorisé ici.`
      });
    }
    next();
  };
};
