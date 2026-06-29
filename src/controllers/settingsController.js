import prisma from "../config/database.js";
import path from 'path';
import fs from 'fs/promises';
import { getStripe } from "../services/Stripe.service.js";
import {
  getOrCreateStripeCustomer,
  getDefaultPaymentMethod,
  calculatePeriodDates,
  generateSubscriptionOrderNumber,
  createSubscriptionInvoice,
  sendSubscriptionPendingEmail,
} from "../services/stripeSubscription.service.js";


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

    const [company, user] = await Promise.all([
      getUserCompany(userId, companyId),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, phone: true },
      }),
    ]);

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

      const updatedCompany = await getUserCompany(userId, company.id);
      return res.json({
        success: true,
        data: { ...updatedCompany, user },
      });
    }

    res.json({
      success: true,
      data: { ...company, user },
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
      tradeNumber,
      fullName,
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

    const [updated, updatedUser] = await Promise.all([
      prisma.company.update({
        where: { id: parseInt(companyId) },
        data: updateData,
        include: { settings: true, package: true },
      }),
      fullName?.trim()
        ? prisma.user.update({
            where: { id: userId },
            data: { name: fullName.trim() },
            select: { id: true, name: true, email: true, phone: true },
          })
        : prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, phone: true },
          }),
    ]);

    res.json({
      success: true,
      message: 'General settings updated successfully',
      data: { ...updated, user: updatedUser },
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


/**
 * GET /api/admin/general-settings/subscription
 * Récupère la subscription active de la company
 */
export const getSubscription = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    
    // Récupérer la subscription avec plan et addons
    const subscription = await prisma.subscription.findUnique({
      where: { companyId: parseInt(companyId) },
      include: {
        plan: {
          include: {
            translations: {
              include: { language: { select: { id: true, code: true } } },
            },
          },
        },
        addons: {
          where: { status: 'active' },
          include: {
            addon: {
              select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                price: true,
                type: true,
                locationBonus: true,
                apiBonus: true,
                smsBonus: true,
              }
            }
          }
        }
      }
    });

    const lang = req.locale || 'en';

    // Fallback: si pas de Subscription, utiliser le plan assigné à la company (package)
    if (!subscription) {
      const company = await prisma.company.findUnique({
        where: { id: parseInt(companyId) },
        include: {
          package: {
            include: {
              translations: { include: { language: { select: { id: true, code: true } } } },
            },
          },
        },
      });

      if (!company?.package) {
        return res.status(404).json({ success: false, error: 'No active subscription found' });
      }

      const pkgTrs = company.package.translations ?? [];
      const pkgTr  =
        pkgTrs.find((t) => t.language?.code === lang) ??
        pkgTrs.find((t) => t.language?.code === 'en') ??
        pkgTrs[0];
      const locationCount = await prisma.location.count({ where: { companyId: parseInt(companyId) } });

      return res.json({
        success: true,
        data: {
          id: null,
          planName:     pkgTr?.name ?? company.package.slug,
          planSlug:     company.package.slug,
          status:       'active',
          interval:     'monthly',
          amount:       company.package.price,
          addonsAmount: 0,
          totalAmount:  company.package.price,
          nextBilling:  company.billingNextDate ?? null,
          currentPeriodStart: null,
          currentPeriodEnd:   null,
          trialStart: null,
          trialEnd:   null,
          locationCount,
          locationLimit: company.package.locationLimit,
          apiLimit:      company.package.apiLimit,
          smsLimit:      company.package.smsLimit,
          webhookLimit:  company.package.webhookLimit,
          activeAddons:  [],
          features:      pkgTr?.featureSlugs || [],
        },
      });
    }

    // Résoudre le nom du plan depuis les traductions
    const planTrs = subscription.plan?.translations ?? [];
    const planTr  =
      planTrs.find((t) => t.language?.code === lang) ??
      planTrs.find((t) => t.language?.code === 'en') ??
      planTrs[0];
    const planName = planTr?.name ?? subscription.plan?.slug ?? 'Plan';

    // Compter les locations utilisées
    const locationCount = await prisma.location.count({
      where: { companyId: parseInt(companyId) }
    });

    // Calculer les limites totales (plan + addons)
    const totalLocationLimit = (subscription.plan.locationLimit || 0) +
      subscription.addons.reduce((sum, a) => sum + (a.addon.locationBonus || 0), 0);

    const totalApiLimit = (subscription.plan.apiLimit || 0) +
      subscription.addons.reduce((sum, a) => sum + (a.addon.apiBonus || 0), 0);

    const totalSmsLimit = (subscription.plan.smsLimit || 0) +
      subscription.addons.reduce((sum, a) => sum + (a.addon.smsBonus || 0), 0);

    res.json({
      success: true,
      data: {
        id: subscription.id,
        planName,
        planSlug: subscription.plan.slug,
        status: subscription.status,
        interval: subscription.interval,
        amount: subscription.baseAmount,
        addonsAmount: subscription.addonsAmount,
        totalAmount: subscription.totalAmount,
        nextBilling: subscription.nextBillingDate,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        trialStart: subscription.trialStart,
        trialEnd: subscription.trialEnd,
        locationCount,
        locationLimit: totalLocationLimit,
        apiLimit: totalApiLimit,
        smsLimit: totalSmsLimit,
        webhookLimit: subscription.plan.webhookLimit || 0,
        activeAddons: subscription.addons.map(a => ({
          id: a.addon.id,
          name: a.addon.name,
          slug: a.addon.slug,
          price: a.amount,
          type: a.addon.type,
        })),
        features: planTr?.featureSlugs || [],
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching subscription',
      details: error.message
    });
  }
};

/**
 * GET /api/admin/general-settings/invoices?limit=10
 * Récupère l'historique des factures
 */
export const getInvoices = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const limit = parseInt(req.query.limit) || 50;
    
    // Récupérer la subscription pour avoir son ID
    const subscription = await prisma.subscription.findUnique({
      where: { companyId: parseInt(companyId) },
      select: { id: true }
    });
    
    if (!subscription) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    // Récupérer les factures depuis billing_history (avec la vraie Invoice si liée)
    const billingHistory = await prisma.billingHistory.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            currency: true,
            status: true,
            invoiceDate: true,
            dueDate: true,
          },
        },
        subscription: {
          include: {
            plan: {
              include: {
                translations: { include: { language: { select: { code: true } } } },
              },
            },
          },
        },
      },
    });

    const lang = req.locale || 'en';

    // Formater les données — priorité à la vraie Invoice si elle existe
    const invoices = billingHistory.map(bh => {
      const inv = bh.invoice;
      const planTrs = bh.subscription?.plan?.translations ?? [];
      const planTr  =
        planTrs.find((t) => t.language?.code === lang) ??
        planTrs.find((t) => t.language?.code === 'en') ??
        planTrs[0];
      const planLabel = planTr?.name ?? bh.subscription?.plan?.slug ?? 'Plan';

      return {
        id:            inv?.id ?? bh.id,
        invoiceNumber: inv?.invoiceNumber ?? `INV-${bh.id.toString().padStart(6, '0')}`,
        invoiceDate:   inv?.invoiceDate ?? bh.createdAt,
        dueDate:       inv?.dueDate ?? bh.periodEnd,
        periodStart:   bh.periodStart,
        periodEnd:     bh.periodEnd,
        baseAmount:    bh.baseAmount,
        addonsAmount:  bh.addonsAmount,
        taxAmount:     bh.taxAmount,
        total:         inv ? Number(inv.total) : bh.totalAmount,
        currency:      inv?.currency ?? 'EUR',
        status:        inv?.status ?? bh.status,
        paidAt:        bh.paidAt,
        paymentMethod: bh.paymentMethod,
        stripeInvoiceId: bh.stripeInvoiceId,
        items: [{
          service:     `${planLabel} Subscription`,
          description: `Billing period: ${new Date(bh.periodStart).toLocaleDateString()} - ${new Date(bh.periodEnd).toLocaleDateString()}`,
          quantity:    1,
          unitPrice:   bh.baseAmount,
          total:       bh.baseAmount,
        }],
      };
    });
    
    res.json({
      success: true,
      data: invoices,
      total: invoices.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching invoices',
      details: error.message
    });
  }
};

/**
 * GET /api/admin/general-settings/available-plans
 * Liste tous les plans disponibles pour upgrade
 */
export const getAvailablePlans = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    
    // Récupérer le plan actuel
    const currentSubscription = await prisma.subscription.findUnique({
      where: { companyId: parseInt(companyId) },
      select: { planId: true }
    });
    
    // Récupérer tous les plans actifs avec leurs traductions
    const plans = await prisma.planSetting.findMany({
      where: { status: "Active" },
      orderBy: { displayOrder: 'asc' },
      include: {
        translations: {
          include: { language: { select: { id: true, code: true } } },
        },
      },
    });

    const lang = req.locale || 'en';

    const formattedPlans = plans.map(plan => {
      const trs = plan.translations ?? [];
      const tr  =
        trs.find((t) => t.language?.code === lang) ??
        trs.find((t) => t.language?.code === 'en') ??
        trs[0];
      return {
        id: plan.id,
        name: tr?.name ?? plan.slug,
        slug: plan.slug,
        price: plan.price,
        annual: plan.annual,
        features: tr?.featureSlugs || [],
        apiLimit: plan.apiLimit,
        smsLimit: plan.smsLimit,
        webhookLimit: plan.webhookLimit,
        locationLimit: plan.locationLimit,
        userLimit: plan.userLimit,
        widgetLimit: plan.widgetLimit ?? 1,
        reviewsPerMonth: plan.reviewsPerMonth ?? 100,
        impressionsPerMonth: plan.impressionsPerMonth ?? 5000,
        isPopular: plan.isPopular,
        isCurrent: currentSubscription?.planId === plan.id,
      };
    });
    
    res.json({
      success: true,
      data: formattedPlans
    });
    
  } catch (error) {
    console.error('❌ Error fetching plans:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching plans',
      details: error.message
    });
  }
};

/**
 * GET /api/admin/general-settings/payment-methods
 * Méthodes de paiement disponibles (Stripe + manuelles)
 */
export const getSettingsPaymentMethods = async (req, res) => {
  try {
    const manualMethods = await prisma.manualPaymentMethod.findMany({
      where: { status: 'Active' },
      orderBy: { name: 'asc' },
    });

    const methods = manualMethods.map((m) => ({
      id: m.id,
      type: 'manual',
      name: m.name,
      description: m.instructions ?? null,
      instructions: m.instructions ?? null,
      verificationRequired: m.verificationRequired ?? false,
    }));

    return res.json({ success: true, data: methods });
  } catch (error) {
    console.error('❌ Error fetching payment methods:', error);
    return res.status(500).json({ success: false, error: 'Error fetching payment methods' });
  }
};

/**
 * POST /api/admin/general-settings/change-plan
 * Changer de plan (upgrade/downgrade) avec sélection du mode de paiement
 * Body: { planId, interval?, paymentMethod: 'stripe'|'manual', paymentMethodId? }
 */
export const changePlan = async (req, res) => {
  try {
    const userId    = req.user.userId;
    const companyId = getCompanyId(req);
    const { planId, interval = 'monthly', paymentMethod, paymentMethodId } = req.body;

    if (!planId) {
      return res.status(400).json({ success: false, error: 'planId is required' });
    }

    const isStripe = paymentMethod === 'stripe';
    const isManual = paymentMethod === 'manual';
    if (!isStripe && !isManual) {
      return res.status(422).json({ success: false, error: "paymentMethod must be 'stripe' or 'manual'" });
    }

    // Vérifier les permissions
    const { hasPermission } = await checkPermissions(userId, parseInt(companyId), req.user.isSuperadmin);
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Only company owner can change plan' });
    }

    // Valider méthode manuelle
    let manualMethod = null;
    if (isManual) {
      if (!paymentMethodId) {
        return res.status(422).json({ success: false, error: 'paymentMethodId required for manual payment' });
      }
      manualMethod = await prisma.manualPaymentMethod.findFirst({
        where: { id: parseInt(paymentMethodId), status: 'Active' },
      });
      if (!manualMethod) {
        return res.status(422).json({ success: false, error: 'Invalid manual payment method' });
      }
    }

    // Récupérer le nouveau plan
    const newPlan = await prisma.planSetting.findUnique({ where: { id: parseInt(planId) } });
    if (!newPlan || newPlan.status !== 'Active') {
      return res.status(404).json({ success: false, error: 'Plan not found or inactive' });
    }

    // Récupérer la subscription actuelle
    const currentSubscription = await prisma.subscription.findUnique({
      where: { companyId: parseInt(companyId) },
    });
    if (!currentSubscription) {
      return res.status(404).json({ success: false, error: 'No active subscription found' });
    }

    const newBaseAmount  = interval === 'yearly' ? (newPlan.annual || newPlan.price) : newPlan.price;
    const newTotalAmount = Math.round((newBaseAmount + currentSubscription.addonsAmount) * 100) / 100;
    const now            = new Date();
    const periods        = calculatePeriodDates(interval, now);

    const user       = await prisma.user.findUnique({ where: { id: userId } });
    const company    = await prisma.company.findUnique({ where: { id: parseInt(companyId) } });
    const orderNumber = await generateSubscriptionOrderNumber();

    // ── Appliquer le changement de plan immédiatement ──
    const applyPlanChange = async (tx) => {
      await tx.subscription.update({
        where: { id: currentSubscription.id },
        data: {
          planId: newPlan.id,
          interval,
          baseAmount: newBaseAmount,
          totalAmount: newTotalAmount,
          currentPeriodStart: now,
          currentPeriodEnd: periods.currentPeriodEnd,
          nextBillingDate: periods.nextBillingDate,
        },
      });
      await tx.companySettings.updateMany({
        where: { companyId: parseInt(companyId) },
        data: {
          maxLocations: newPlan.locationLimit,
          maxApiCalls: newPlan.apiLimit,
          maxSmsCalls: newPlan.smsLimit,
        },
      });
      await tx.company.update({
        where: { id: parseInt(companyId) },
        data: { planId: newPlan.id, mrr: newBaseAmount },
      });
    };

    // ═══════════════════════════════════════════════════════════
    // STRIPE
    // ═══════════════════════════════════════════════════════════
    if (isStripe) {
      const stripe    = await getStripe();
      const customer  = await getOrCreateStripeCustomer(user, company);
      const savedCard = await getDefaultPaymentMethod(customer.id);

      const piData = {
        amount:   Math.round(newTotalAmount * 100),
        currency: 'eur',
        customer: customer.id,
        automatic_payment_methods: { enabled: true },
        metadata: {
          type:        'plan_change',
          companyId:   String(companyId),
          userId:      String(userId),
          planId:      String(newPlan.id),
          interval,
          orderNumber,
          newBaseAmount:  String(newBaseAmount),
          newTotalAmount: String(newTotalAmount),
        },
      };
      if (!savedCard) piData.setup_future_usage = 'off_session';
      else piData.payment_method = savedCard.id;

      const paymentIntent = await stripe.paymentIntents.create(piData);

      await prisma.$transaction(async (tx) => {
        await applyPlanChange(tx);
        await tx.billingHistory.create({
          data: {
            subscriptionId: currentSubscription.id,
            baseAmount: newBaseAmount,
            addonsAmount: currentSubscription.addonsAmount,
            taxAmount: 0,
            totalAmount: newTotalAmount,
            periodStart: now,
            periodEnd: periods.currentPeriodEnd,
            status: 'pending',
            paymentMethod: 'Stripe',
            stripePaymentIntentId: paymentIntent.id,
          },
        });
      });

      return res.json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        message: 'Confirm your payment to activate the plan.',
        data: { orderNumber, totalAmount: newTotalAmount, status: 'pending' },
      });
    }

    // ═══════════════════════════════════════════════════════════
    // MANUEL
    // ═══════════════════════════════════════════════════════════
    if (isManual) {
      const { order, billingHistory: bh } = await prisma.$transaction(async (tx) => {
        await applyPlanChange(tx);

        const order = await tx.order.create({
          data: {
            userId,
            companyId: parseInt(companyId),
            orderNumber,
            status: 'unpaid',
            subtotal: newTotalAmount,
            shippingCost: 0,
            total: newTotalAmount,
            currency: 'EUR',
            exchangeRate: 1,
            methodPayment: manualMethod.name,
            manualPaymentMethodId: manualMethod.id,
          },
        });

        const billingHistory = await tx.billingHistory.create({
          data: {
            subscriptionId: currentSubscription.id,
            baseAmount: newBaseAmount,
            addonsAmount: currentSubscription.addonsAmount,
            taxAmount: 0,
            totalAmount: newTotalAmount,
            periodStart: now,
            periodEnd: periods.currentPeriodEnd,
            status: 'pending',
            paymentMethod: manualMethod.name,
          },
        });

        return { order, billingHistory };
      });

      const invoice = await createSubscriptionInvoice({
        subscription: { ...currentSubscription, planId: newPlan.id, plan: newPlan },
        billingHistory: bh,
        user,
        company,
        paymentMethod: manualMethod.name,
        orderId: order.id,
      });

      await sendSubscriptionPendingEmail(
        { ...currentSubscription, planId: newPlan.id, plan: newPlan },
        user,
        company,
        invoice,
        manualMethod
      );

      return res.json({
        success: true,
        message: `Order ${orderNumber} created. Invoice ${invoice.invoiceNumber} sent.`,
        data: {
          orderNumber,
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: newTotalAmount,
          status: 'unpaid',
          manualInstructions: manualMethod.instructions,
        },
      });
    }
  } catch (error) {
    console.error('❌ Error changing plan:', error);
    res.status(500).json({ success: false, error: 'Error changing plan', details: error.message });
  }
};

/**
 * POST /api/admin/general-settings/cancel-subscription
 * Annuler l'abonnement
 */
export const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user.userId;
    const companyId = getCompanyId(req);
    const { cancelReason } = req.body;
    
    // Vérifier les permissions
    const { hasPermission } = await checkPermissions(
      userId,
      parseInt(companyId),
      req.user.isSuperadmin
    );
    
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Only company owner can cancel subscription'
      });
    }
    
    const subscription = await prisma.subscription.findUnique({
      where: { companyId: parseInt(companyId) }
    });
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription found'
      });
    }
    
    // Marquer pour annulation à la fin de la période
    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAt: subscription.currentPeriodEnd,
        cancelReason: cancelReason || 'User requested cancellation',
      }
    });
    
    res.json({
      success: true,
      message: 'Subscription will be canceled at the end of the billing period',
      data: {
        cancelAt: updated.cancelAt,
        currentPeriodEnd: updated.currentPeriodEnd,
      }
    });
    
  } catch (error) {
    console.error('❌ Error canceling subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Error canceling subscription',
      details: error.message
    });
  }
};

/**
 * POST /api/admin/general-settings/reactivate-subscription
 * Réactiver un abonnement annulé
 */
export const reactivateSubscription = async (req, res) => {
  try {
    const userId = req.user.userId;
    const companyId = getCompanyId(req);
    
    // Vérifier les permissions
    const { hasPermission } = await checkPermissions(
      userId,
      parseInt(companyId),
      req.user.isSuperadmin
    );
    
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Only company owner can reactivate subscription'
      });
    }
    
    const subscription = await prisma.subscription.findUnique({
      where: { companyId: parseInt(companyId) }
    });
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'No subscription found'
      });
    }
    
    if (!subscription.cancelAt) {
      return res.status(400).json({
        success: false,
        error: 'Subscription is not canceled'
      });
    }
    
    // Annuler la demande d'annulation
    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAt: null,
        cancelReason: null,
        status: 'active',
      }
    });
    
    res.json({
      success: true,
      message: 'Subscription reactivated successfully',
      data: updated
    });
    
  } catch (error) {
    console.error('❌ Error reactivating subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Error reactivating subscription',
      details: error.message
    });
  }
};