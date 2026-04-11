import prisma from "../../config/database.js";
import path from 'path';
import fs from 'fs/promises';

/**
 * GET /api/superadmin/platform-settings
 * Récupère les paramètres de la plateforme
 */
export const getPlatformSettings = async (req, res) => {
  try {
    // Récupérer le premier (et unique) enregistrement
    let settings = await prisma.platformSetting.findFirst();

    // Si aucun setting n'existe, en créer un par défaut
    if (!settings) {
      settings = await prisma.platformSetting.create({
        data: {}
      });
    }

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('❌ Error fetching platform settings:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching platform settings',
      details: error.message
    });
  }
};

/**
 * PUT /api/superadmin/platform-settings/general
 * Met à jour les informations générales
 */
export const updateGeneralSettings = async (req, res) => {
  try {
    const {
      companyName,
      companyEmail,
      companyPhone,
      companyCountry,
      countryCode,
      companyAddress,
      vatNumber,
      tradeNumber
    } = req.body;

    // Trouver l'enregistrement unique
    let settings = await prisma.platformSetting.findFirst();

    if (!settings) {
      // Créer si n'existe pas
      settings = await prisma.platformSetting.create({
        data: {
          companyName,
          companyEmail,
          companyPhone,
          companyCountry,
          countryCode,
          companyAddress,
          vatNumber,
          tradeNumber
        }
      });
    } else {
      // Mettre à jour
      const updateData = {};
      if (companyName !== undefined) updateData.companyName = companyName;
      if (companyEmail !== undefined) updateData.companyEmail = companyEmail;
      if (companyPhone !== undefined) updateData.companyPhone = companyPhone;
      if (companyCountry !== undefined) updateData.companyCountry = companyCountry;
      if (countryCode !== undefined) updateData.countryCode = countryCode;
      if (companyAddress !== undefined) updateData.companyAddress = companyAddress;
      if (vatNumber !== undefined) updateData.vatNumber = vatNumber;
      if (tradeNumber !== undefined) updateData.tradeNumber = tradeNumber;

      settings = await prisma.platformSetting.update({
        where: { id: settings.id },
        data: updateData
      });
    }

    res.json({
      success: true,
      message: 'General settings updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('❌ Error updating general settings:', error);
    res.status(500).json({
      success: false,
      error: 'Error updating general settings',
      details: error.message
    });
  }
};

/**
 * PUT /api/superadmin/platform-settings/branding
 * Met à jour le branding
 */
export const updateBrandingSettings = async (req, res) => {
  try {
    const { logoScale, primaryColor, secondaryColor } = req.body;

    let settings = await prisma.platformSetting.findFirst();

    if (!settings) {
      settings = await prisma.platformSetting.create({
        data: { logoScale, primaryColor, secondaryColor }
      });
    } else {
      const updateData = {};
      if (logoScale !== undefined) updateData.logoScale = parseInt(logoScale);
      if (primaryColor) updateData.primaryColor = primaryColor;
      if (secondaryColor) updateData.secondaryColor = secondaryColor;

      settings = await prisma.platformSetting.update({
        where: { id: settings.id },
        data: updateData
      });
    }

    res.json({
      success: true,
      message: 'Branding updated successfully',
      data: settings
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
 * POST /api/superadmin/platform-settings/logo
 * Upload du logo
 */
export const uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const logoPath = `/uploads/logos/${req.file.filename}`;

    let settings = await prisma.platformSetting.findFirst();

    // Supprimer l'ancien logo
    if (settings?.logoUrl && settings.logoUrl.startsWith('/uploads/')) {
      try {
        const oldLogoPath = path.join(process.cwd(), 'public', settings.logoUrl);
        await fs.unlink(oldLogoPath);
      } catch (err) {
        console.log('Old logo not found or already deleted');
      }
    }

    if (!settings) {
      settings = await prisma.platformSetting.create({
        data: { logoUrl: logoPath }
      });
    } else {
      settings = await prisma.platformSetting.update({
        where: { id: settings.id },
        data: { logoUrl: logoPath }
      });
    }

    res.json({
      success: true,
      message: 'Logo uploaded successfully',
      data: {
        logoUrl: logoPath,
        settings
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
 * PUT /api/superadmin/platform-settings/recaptcha
 * Met à jour reCAPTCHA
 */
export const updateRecaptchaSettings = async (req, res) => {
  try {
    const { captchaEnabled, captchaSiteKey, captchaSecret } = req.body;

    let settings = await prisma.platformSetting.findFirst();

    if (!settings) {
      settings = await prisma.platformSetting.create({
        data: { captchaEnabled, captchaSiteKey, captchaSecret }
      });
    } else {
      const updateData = {};
      if (captchaEnabled !== undefined) updateData.captchaEnabled = captchaEnabled;
      if (captchaSiteKey !== undefined) updateData.captchaSiteKey = captchaSiteKey;
      if (captchaSecret !== undefined) updateData.captchaSecret = captchaSecret;

      settings = await prisma.platformSetting.update({
        where: { id: settings.id },
        data: updateData
      });
    }

    res.json({
      success: true,
      message: 'reCAPTCHA settings updated successfully',
      data: settings
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
 * PUT /api/superadmin/platform-settings/maps
 * Met à jour Google Maps
 */
export const updateMapsSettings = async (req, res) => {
  try {
    const { mapsEnabled, mapsApiKey, mapsCloudSecret } = req.body;

    let settings = await prisma.platformSetting.findFirst();

    if (!settings) {
      settings = await prisma.platformSetting.create({
        data: { mapsEnabled, mapsApiKey, mapsCloudSecret }
      });
    } else {
      const updateData = {};
      if (mapsEnabled !== undefined) updateData.mapsEnabled = mapsEnabled;
      if (mapsApiKey !== undefined) updateData.mapsApiKey = mapsApiKey;
      if (mapsCloudSecret !== undefined) updateData.mapsCloudSecret = mapsCloudSecret;

      settings = await prisma.platformSetting.update({
        where: { id: settings.id },
        data: updateData
      });
    }

    res.json({
      success: true,
      message: 'Maps settings updated successfully',
      data: settings
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
 * PUT /api/superadmin/platform-settings/platforms
 * Met à jour les liens des plateformes
 */
export const updatePlatformsSettings = async (req, res) => {
  try {
    const {
      googleLink,
      facebookLink,
      yelpLink,
      tripadvisorLink,
      customReviewLink
    } = req.body;

    let settings = await prisma.platformSetting.findFirst();

    if (!settings) {
      settings = await prisma.platformSetting.create({
        data: { googleLink, facebookLink, yelpLink, tripadvisorLink, customReviewLink }
      });
    } else {
      const updateData = {};
      if (googleLink !== undefined) updateData.googleLink = googleLink;
      if (facebookLink !== undefined) updateData.facebookLink = facebookLink;
      if (yelpLink !== undefined) updateData.yelpLink = yelpLink;
      if (tripadvisorLink !== undefined) updateData.tripadvisorLink = tripadvisorLink;
      if (customReviewLink !== undefined) updateData.customReviewLink = customReviewLink;

      settings = await prisma.platformSetting.update({
        where: { id: settings.id },
        data: updateData
      });
    }

    res.json({
      success: true,
      message: 'Platform links updated successfully',
      data: settings
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
 * PUT /api/superadmin/platform-settings/security
 * Met à jour la sécurité
 */
export const updateSecuritySettings = async (req, res) => {
  try {
    const {
      twoFactorEnabled,
      twoFactorEmail,
      twoFactorPhone,
      twoFactorGoogle
    } = req.body;

    let settings = await prisma.platformSetting.findFirst();

    if (!settings) {
      settings = await prisma.platformSetting.create({
        data: { twoFactorEnabled, twoFactorEmail, twoFactorPhone, twoFactorGoogle }
      });
    } else {
      const updateData = {};
      if (twoFactorEnabled !== undefined) updateData.twoFactorEnabled = twoFactorEnabled;
      if (twoFactorEmail !== undefined) updateData.twoFactorEmail = twoFactorEmail;
      if (twoFactorPhone !== undefined) updateData.twoFactorPhone = twoFactorPhone;
      if (twoFactorGoogle !== undefined) updateData.twoFactorGoogle = twoFactorGoogle;

      settings = await prisma.platformSetting.update({
        where: { id: settings.id },
        data: updateData
      });
    }

    res.json({
      success: true,
      message: 'Security settings updated successfully',
      data: settings
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

// ── SUBSCRIPTION ──────────────────────────────────────────────────────────────

/**
 * GET /api/superadmin/general-settings/subscription
 * Retourne l'abonnement plateforme + la liste des plans disponibles
 */
export const getSubscription = async (req, res) => {
  try {
    const [subscription, plans] = await Promise.all([
      prisma.subscription.findFirst({ where: { companyId: null } }),
      prisma.planSetting.findMany({
        where: { status: 'Active' },
        orderBy: { price: 'asc' },
        select: { id: true, name: true, price: true, annual: true, features: true, locationLimit: true }
      })
    ]);

    res.json({ success: true, data: { subscription, plans } });
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
 * GET /api/superadmin/general-settings/subscription/billing-history
 * Retourne l'historique des factures récurrentes
 */
export const getBillingHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const invoices = await prisma.invoice.findMany({
      where: { isRecurring: true },
      orderBy: { invoiceDate: 'desc' },
      skip,
      take: parseInt(limit),
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        currency: true,
        status: true,
        invoiceDate: true,
        recurringInterval: true,
      }
    });

    res.json({ success: true, data: invoices });
  } catch (error) {
    console.error('❌ Error fetching billing history:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching billing history',
      details: error.message
    });
  }
};

/**
 * PUT /api/superadmin/general-settings/subscription/upgrade
 * Met à jour l'abonnement plateforme (plan + cycle de facturation)
 */
export const upgradePlan = async (req, res) => {
  try {
    const { planName, billingCycle, amount } = req.body;

    if (!planName || amount === undefined) {
      return res.status(400).json({ success: false, error: 'planName and amount are required' });
    }

    const now = new Date();
    const nextBilling = billingCycle === 'yearly'
      ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
      : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    let subscription = await prisma.subscription.findFirst({ where: { companyId: null } });

    if (!subscription) {
      subscription = await prisma.subscription.create({
        data: {
          planName,
          status: 'active',
          amount: parseFloat(amount),
          Interval: billingCycle || 'monthly',
          nextBilling
        }
      });
    } else {
      subscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          planName,
          amount: parseFloat(amount),
          Interval: billingCycle || 'monthly',
          nextBilling
        }
      });
    }

    res.json({ success: true, message: 'Plan upgraded successfully', data: subscription });
  } catch (error) {
    console.error('❌ Error upgrading plan:', error);
    res.status(500).json({
      success: false,
      error: 'Error upgrading plan',
      details: error.message
    });
  }
};

/**
 * POST /api/superadmin/general-settings/subscription/locations
 * Calcule le coût supplémentaire et retourne l'URL de redirection vers les add-ons
 */
export const addLocationsRequest = async (req, res) => {
  try {
    const { quantity = 1 } = req.body ?? {};
    const qty = Math.max(1, parseInt(quantity) || 1);
    const costPerLocation = 29;

    res.json({
      success: true,
      data: {
        quantity: qty,
        additionalMonthlyCost: qty * costPerLocation,
        redirectUrl: `/dashboard/addons?activate=location&qty_location=${qty}`
      }
    });
  } catch (error) {
    console.error('❌ Error processing location request:', error);
    res.status(500).json({
      success: false,
      error: 'Error processing request',
      details: error.message
    });
  }
};