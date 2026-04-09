import prisma from "../config/database.js";
import path from 'path';
import fs from 'fs/promises';


function getCompanyId(req) {
  const id = req.user?.companyId;
  if (!id) throw Object.assign(new Error("Aucune company active"), { status: 403 });
  return parseInt(id);
}

/**
 * Récupère la company de l'utilisateur
 * @param {number} userId - ID de l'utilisateur
 * @param {number} companyId - ID de la company (optionnel)
 * @returns {object} - Company avec settings
 */
async function getUserCompany(userId, companyId = null) {
  // Si companyId est fourni, vérifier que l'utilisateur y a accès
  if (companyId) {
    const userCompany = await prisma.userCompany.findFirst({
      where: {
        userId,
        companyId: parseInt(companyId)
      },
      include: {
        company: {
          include: {
            settings: true,
            package: true,
            defaulLanguage: true,
            subscription: true
          }
        }
      }
    });

    if (!userCompany) {
      return null;
    }

    return {
      ...userCompany.company,
      userRole: userCompany.isOwner ? 'owner' : 'member',
      isOwner: userCompany.isOwner
    };
  }

  // Sinon, récupérer la première company (ou celle par défaut)
  const userCompanies = await prisma.userCompany.findMany({
    where: { userId },
    include: {
      company: {
        include: {
          settings: true,
          package: true,
          defaulLanguage: true,
          subscription: true
        }
      }
    },
    orderBy: [
      { isOwner: 'desc' }, // Owners en premier
      { createdAt: 'asc' }  // Puis par date de création
    ]
  });

  if (userCompanies.length === 0) {
    return null;
  }

  const firstCompany = userCompanies[0];
  return {
    ...firstCompany.company,
    userRole: firstCompany.isOwner ? 'owner' : 'member',
    isOwner: firstCompany.isOwner,
    availableCompanies: userCompanies.map(uc => ({
      id: uc.company.id,
      name: uc.company.name,
      logo: uc.company.logo,
      isOwner: uc.isOwner
    }))
  };
}

/**
 * Vérifie les permissions de modification
 * @param {number} userId - ID de l'utilisateur
 * @param {number} companyId - ID de la company
 * @param {boolean} isSuperadmin - Si l'utilisateur est superadmin
 * @returns {object} - { hasPermission: boolean, isOwner: boolean }
 */
async function checkPermissions(userId, companyId, isSuperadmin = false) {
  // Superadmin peut tout modifier
  if (isSuperadmin) {
    return { hasPermission: true, isOwner: true };
  }
  const userCompany = await prisma.userCompany.findFirst({
    where: {
      userId,
      companyId
    }
  });
  if (!userCompany) {
    return { hasPermission: false, isOwner: false };
  }
  return {
    hasPermission: userCompany.isOwner,
    isOwner: userCompany.isOwner
  };
}

/**
 * GET /api/company-settings
 * GET /api/company-settings?companyId=123
 * Récupère les paramètres d'une company
 */
export const getCompanySettings = async (req, res) => {
  try {
    const userId = req.user.userId;
    const companyId = getCompanyId(req);

    const company = await getUserCompany(userId, companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: companyId 
          ? 'Company not found or you do not have access'
          : 'No company found for this user'
      });
    }

    // Si pas de settings, les créer automatiquement
    if (!company.settings) {
      await prisma.companySettings.create({
        data: { companyId: company.id }
      });

      // Recharger avec les settings
      const updatedCompany = await getUserCompany(userId, company.id);
      return res.json({
        success: true,
        data: updatedCompany
      });
    }

    res.json({
      success: true,
      data: company
    });
  } catch (error) {
    console.error('❌ Error fetching company settings:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching company settings',
      details: error.message
    });
  }
};

/**
 * GET /api/company-settings/list
 * Liste toutes les companies de l'utilisateur
 */
export const listUserCompanies = async (req, res) => {
  try {
    const userId = req.user.userId;
    

    const userCompanies = await prisma.userCompany.findMany({
      where: { userId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            logo: true,
            email: true,
            status: true,
            primaryColor: true,
            createdAt: true
          }
        }
      },
      orderBy: [
        { isOwner: 'desc' },
        { createdAt: 'asc' }
      ]
    });

    const companies = userCompanies.map(uc => ({
      ...uc.company,
      isOwner: uc.isOwner,
      role: uc.isOwner ? 'owner' : 'member'
    }));

    res.json({
      success: true,
      data: companies,
      total: companies.length
    });
  } catch (error) {
    console.error('❌ Error listing companies:', error);
    res.status(500).json({
      success: false,
      error: 'Error listing companies',
      details: error.message
    });
  }
};

/**
 * PUT /api/company-settings/general
 * Met à jour les informations générales de la company
 */
export const updateGeneralSettings = async (req, res) => {
  try {
    const userId = req.user.userId;
    const companyId = getCompanyId(req);
    const {
      name,
      email,
      phone,
      country,
      countryCode,
      address,
      vatNumber,
      tradeNumber
    } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'companyId is required'
      });
    }

    // Vérifier les permissions
    const { hasPermission } = await checkPermissions(
      userId,
      parseInt(companyId),
      req.user.isSuperadmin
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Only company owner can update settings'
      });
    }

    // Préparer les données de mise à jour
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (country) updateData.country = country;
    if (countryCode) updateData.countryCode = countryCode;
    if (address !== undefined) updateData.address = address;
    if (vatNumber !== undefined) updateData.vatNumber = vatNumber;
    if (tradeNumber !== undefined) updateData.tradeNumber = tradeNumber;

    const updated = await prisma.company.update({
      where: { id: parseInt(companyId) },
      data: updateData,
      include: {
        settings: true,
        package: true
      }
    });

    res.json({
      success: true,
      message: 'General settings updated successfully',
      data: updated
    });
  } catch (error) {
    console.error('❌ Error updating general settings:', error);
    
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'Email already in use'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error updating general settings',
      details: error.message
    });
  }
};

/**
 * PUT /api/company-settings/branding
 * Met à jour les paramètres de branding (logo, couleurs)
 */
export const updateBrandingSettings = async (req, res) => {
  try {
    const userId = req.user.userId;
    const companyId = getCompanyId(req);
    const {
      logoScale,
      primaryColor,
      secondaryColor
    } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'companyId is required'
      });
    }

    const { hasPermission } = await checkPermissions(
      userId,
      parseInt(companyId),
      req.user.isSuperadmin
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Only company owner can update branding'
      });
    }

    const updateData = {};
    if (logoScale !== undefined) updateData.logoScale = parseInt(logoScale);
    if (primaryColor) updateData.primaryColor = primaryColor;
    if (secondaryColor) updateData.secondaryColor = secondaryColor;

    const updated = await prisma.company.update({
      where: { id: parseInt(companyId) },
      data: updateData
    });

    res.json({
      success: true,
      message: 'Branding updated successfully',
      data: updated
    });
  } catch (error) {
    console.error('❌ Error updating branding:', error);
    res.status(500).json({
      success: false,
      error: 'Error updating branding',
      details: error.message
    });
  }
};

/**
 * POST /api/company-settings/logo
 * Upload du logo de la company
 */
export const uploadLogo = async (req, res) => {
  try {
    const userId = req.user.userId;
    const companyId = getCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'companyId is required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { hasPermission } = await checkPermissions(
      userId,
      parseInt(companyId),
      req.user.isSuperadmin
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Only company owner can upload logo'
      });
    }

    // Construire le chemin du logo
    const logoPath = `/uploads/logos/${req.file.filename}`;

    // Récupérer l'ancien logo pour le supprimer
    const company = await prisma.company.findUnique({
      where: { id: parseInt(companyId) },
      select: { logo: true }
    });

    // Supprimer l'ancien logo si existant
    if (company.logo && company.logo.startsWith('/uploads/')) {
      try {
        const oldLogoPath = path.join(process.cwd(), 'public', company.logo);
        await fs.unlink(oldLogoPath);
      } catch (err) {
        console.log('Old logo not found or already deleted');
      }
    }

    // Mettre à jour le logo
    const updated = await prisma.company.update({
      where: { id: parseInt(companyId) },
      data: { logo: logoPath }
    });

    res.json({
      success: true,
      message: 'Logo uploaded successfully',
      data: {
        logo: logoPath,
        company: updated
      }
    });
  } catch (error) {
    console.error('❌ Error uploading logo:', error);
    res.status(500).json({
      success: false,
      error: 'Error uploading logo',
      details: error.message
    });
  }
};

/**
 * PUT /api/company-settings/recaptcha
 * Met à jour les paramètres reCAPTCHA
 */
export const updateRecaptchaSettings = async (req, res) => {
  try {
    const userId = req.user.userId;
     const companyId = getCompanyId(req);
    const {
      captchaEnabled,
      captchaSiteKey,
      captchaSecret
    } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'companyId is required'
      });
    }

    const { hasPermission } = await checkPermissions(
      userId,
      parseInt(companyId),
      req.user.isSuperadmin
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Permission denied'
      });
    }

    const updateData = {};
    if (captchaEnabled !== undefined) updateData.captchaEnabled = captchaEnabled;
    if (captchaSiteKey !== undefined) updateData.captchaSiteKey = captchaSiteKey;
    if (captchaSecret !== undefined) updateData.captchaSecret = captchaSecret;

    const updated = await prisma.company.update({
      where: { id: parseInt(companyId) },
      data: updateData
    });

    res.json({
      success: true,
      message: 'reCAPTCHA settings updated successfully',
      data: updated
    });
  } catch (error) {
    console.error('❌ Error updating reCAPTCHA settings:', error);
    res.status(500).json({
      success: false,
      error: 'Error updating reCAPTCHA settings',
      details: error.message
    });
  }
};

/**
 * PUT /api/company-settings/maps
 * Met à jour les paramètres Google Maps
 */
export const updateMapsSettings = async (req, res) => {
  try {
    const userId = req.user.userId;
     const companyId = getCompanyId(req);
    const {
      mapsEnabled,
      mapsApiKey,
      mapsCloudSecret
    } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'companyId is required'
      });
    }

    const { hasPermission } = await checkPermissions(
      userId,
      parseInt(companyId),
      req.user.isSuperadmin
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Permission denied'
      });
    }

    const updateData = {};
    if (mapsEnabled !== undefined) updateData.mapsEnabled = mapsEnabled;
    if (mapsApiKey !== undefined) updateData.mapsApiKey = mapsApiKey;
    if (mapsCloudSecret !== undefined) updateData.mapsCloudSecret = mapsCloudSecret;

    const updated = await prisma.company.update({
      where: { id: parseInt(companyId) },
      data: updateData
    });

    res.json({
      success: true,
      message: 'Maps settings updated successfully',
      data: updated
    });
  } catch (error) {
    console.error('❌ Error updating Maps settings:', error);
    res.status(500).json({
      success: false,
      error: 'Error updating Maps settings',
      details: error.message
    });
  }
};

/**
 * PUT /api/company-settings/platforms
 * Met à jour les liens vers les plateformes d'avis
 */
export const updatePlatformsSettings = async (req, res) => {
  try {
    const userId = req.user.userId;
     const companyId = getCompanyId(req);
    const {
      googleLink,
      facebookLink,
      yelpLink,
      tripadvisorLink,
      customReviewLink,
      googlePlaceId,
      googleReviewUrl
    } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'companyId is required'
      });
    }

    const { hasPermission } = await checkPermissions(
      userId,
      parseInt(companyId),
      req.user.isSuperadmin
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Permission denied'
      });
    }

    const updateData = {};
    if (googleLink !== undefined) updateData.googleLink = googleLink;
    if (facebookLink !== undefined) updateData.facebookLink = facebookLink;
    if (yelpLink !== undefined) updateData.yelpLink = yelpLink;
    if (tripadvisorLink !== undefined) updateData.tripadvisorLink = tripadvisorLink;
    if (customReviewLink !== undefined) updateData.customReviewLink = customReviewLink;
    if (googlePlaceId !== undefined) updateData.googlePlaceId = googlePlaceId;
    if (googleReviewUrl !== undefined) updateData.googleReviewUrl = googleReviewUrl;

    const updated = await prisma.company.update({
      where: { id: parseInt(companyId) },
      data: updateData
    });

    res.json({
      success: true,
      message: 'Platform links updated successfully',
      data: updated
    });
  } catch (error) {
    console.error('❌ Error updating platform links:', error);
    res.status(500).json({
      success: false,
      error: 'Error updating platform links',
      details: error.message
    });
  }
};

/**
 * PUT /api/company-settings/security
 * Met à jour les paramètres de sécurité (2FA, etc.)
 */
export const updateSecuritySettings = async (req, res) => {
  try {
    const userId = req.user.userId;
     const companyId = getCompanyId(req);
    const {
      twoFactorEnabled,
      twoFactorEmail,
      twoFactorPhone,
      twoFactorGoogle,
      sessionTimeout,
      maxLoginAttempts,
      passwordMinLength
    } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'companyId is required'
      });
    }

    const { hasPermission } = await checkPermissions(
      userId,
      parseInt(companyId),
      req.user.isSuperadmin
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Permission denied'
      });
    }

    const updateData = {};
    if (twoFactorEnabled !== undefined) updateData.twoFactorEnabled = twoFactorEnabled;
    if (twoFactorEmail !== undefined) updateData.twoFactorEmail = twoFactorEmail;
    if (twoFactorPhone !== undefined) updateData.twoFactorPhone = twoFactorPhone;
    if (twoFactorGoogle !== undefined) updateData.twoFactorGoogle = twoFactorGoogle;
    if (sessionTimeout !== undefined) updateData.sessionTimeout = parseInt(sessionTimeout);
    if (maxLoginAttempts !== undefined) updateData.maxLoginAttempts = parseInt(maxLoginAttempts);
    if (passwordMinLength !== undefined) updateData.passwordMinLength = parseInt(passwordMinLength);

    const updated = await prisma.companySettings.upsert({
      where: { companyId: parseInt(companyId) },
      update: updateData,
      create: {
        companyId: parseInt(companyId),
        ...updateData
      }
    });

    res.json({
      success: true,
      message: 'Security settings updated successfully',
      data: updated
    });
  } catch (error) {
    console.error('❌ Error updating security settings:', error);
    res.status(500).json({
      success: false,
      error: 'Error updating security settings',
      details: error.message
    });
  }
};
/**
 * PUT /api/company-settings/advanced
 * Met à jour les paramètres avancés (timezone, devise, etc.)
 */
export const updateAdvancedSettings = async (req, res) => {
  try {
    const userId = req.user.userId;
     const companyId = getCompanyId(req);
    const {
      timezone,
      dateFormat,
      language,
      currency,
      currencySymbol,
      emailNotifications,
      smsNotifications,
      pushNotifications
    } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'companyId is required'
      });
    }

    const { hasPermission } = await checkPermissions(
      userId,
      parseInt(companyId),
      req.user.isSuperadmin
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Permission denied'
      });
    }

    const updateData = {};
    if (timezone) updateData.timezone = timezone;
    if (dateFormat) updateData.dateFormat = dateFormat;
    if (language) updateData.language = language;
    if (currency) updateData.currency = currency;
    if (currencySymbol) updateData.currencySymbol = currencySymbol;
    if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications;
    if (smsNotifications !== undefined) updateData.smsNotifications = smsNotifications;
    if (pushNotifications !== undefined) updateData.pushNotifications = pushNotifications;

    const updated = await prisma.companySettings.upsert({
      where: { companyId: parseInt(companyId) },
      update: updateData,
      create: {
        companyId: parseInt(companyId),
        ...updateData
      }
    });

    res.json({
      success: true,
      message: 'Advanced settings updated successfully',
      data: updated
    });
  } catch (error) {
    console.error('❌ Error updating advanced settings:', error);
    res.status(500).json({
      success: false,
      error: 'Error updating advanced settings',
      details: error.message
    });
  }
};