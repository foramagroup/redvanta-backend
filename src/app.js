// backend/src/app.js
import dotenv from 'dotenv';
dotenv.config();
import express from "express";
import { stripeWebhook } from "./controllers/client/Order.controller.js"
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";


// --- Routers ---
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import affiliateRoutes from "./routes/affiliateRoutes.js";
import nfcRoutes from "./routes/nfcRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import customizationRoutes from "./routes/customizationRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import authAdminRoutes from "./routes/authRoutes.js";
import orderAdminRoutes from "./routes/order.routes.js";
import locationRoutes from "./routes/location.routes.js";
import nfcAdminRoutes from "./routes/nfc.routes.js";
import reviewAdminRoutes from "./routes/reviews.routes.js";
import orderTrackAdminRoutes from "./routes/orderTrack.routes.js";
import  myDesignAdminRoutes  from "./routes/myDesign.routes.js";
import  adminSettingsRoutes  from "./routes/settingsRoutes.js";
import analyticsEventsRoutes from './routes/analyticsEvents.routes.js';
import billingAdminRoutes from './routes/billing.routes.js';
import nfcCardsRoutes from "./routes/nfcCards.routes.js";
import reviewRequestRoutes from "./routes/reviewRequest.routes.js";
import requestRoutes from "./routes/request.routes.js";
import automationRoutes from "./routes/automation.routes.js";
import alertsRoutes from "./routes/alerts.routes.js";
import marketplaceRoutes from "./routes/marketplace.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import teamRoutes from "./routes/team.routes.js";
import filteringRoutes from "./routes/filtering.routes.js";
import planBuilderRoutes from "./routes/planBuilder.routes.js";

// routes superadmin
import superadminAuthRoutes from "./routes/superadmin/authRoutes.js";
import superadminDashboardRoutes from "./routes/superadmin/dashboardRoutes.js";
import smsSettingsRoutes from "./routes/superadmin/smsSettingsRoutes.js";
import platformSettingsRoute from "./routes/superadmin/platformSettingsRoutes.js";
import planSettingRoutes from './routes/superadmin/planSettingRoutes.js';
import addonSettingRoutes from "./routes/superadmin/addonSettingRoutes.js";
import roleRoutes from "./routes/superadmin/roleRoutes.js";
import featureFlagRoutes from "./routes/superadmin/featureFlagsRoutes.js";
import securityRoutes from "./routes/superadmin/securityRoutes.js";
import auditLogRoutes from "./routes/superadmin/auditLogRoutes.js";
import designsSuperadminRoutes from "./routes/superadmin/allDesigns.routes.js";
import languageSettingRoutes from "./routes/superadmin/languageSettingRoutes.js";
import globalCurrencyRoutes from "./routes/superadmin/globalCurrencyRoutes.js";
import paymentGatewayRoutes from "./routes/superadmin/paymentGatewayRoutes.js";
import smsTemplateRoutes from "./routes/superadmin/smsTemplateRoutes.js";
import emailTemplateRoutes from "./routes/superadmin/emailTemplateRoutes.js";
import webhooksSettingRoutes from "./routes/superadmin/webhookRoutes.js";
import productAdminRoutes from "./routes/superadmin/productRoutes.js";
import cardTypeAdminRoutes from "./routes/superadmin/cardTypeRoutes.js";
import companyRoutes from "./routes/superadmin/companyRoutes.js";
import authSuperAdminRoutes from "./routes/superadmin/authRoutes.js";
import emailServerConfigRoutes from "./routes/superadmin/emailServerConfigRoutes.js";
import statusRoutes from "./routes/superadmin/statusRoutes.js";
import billingRoutes  from "./routes/superadmin/Billing.routes.js";
import shippingRoutes from "./routes/superadmin/Shipping.routes.js";
import geoCoverageRoutes from "./routes/superadmin/geoCoverage.routes.js";
import frontPagesSeoRoutes from "./routes/superadmin/frontPagesSeo.routes.js";
import publicSeoRoutes from "./routes/client/seo.routes.js";
import nfcSuperAdminRoutes from "./routes/superadmin/nfc.routes.js";
import orderSuperAdminRoutes from "./routes/superadmin/order.routes.js";
import { superNfcRouter } from "./routes/superadmin/nfcCards.routes.js";
import nfcTagRoutes from "./routes/superadmin/nfcTag.routes.js";
import nfcCardRoutes from "./routes/superadmin/nfcListCard.routes.js";
import generalSettingsRoutes from './routes/superadmin/generalSetting.routes.js';
import cardTemplatesRoutes from './routes/superadmin/cardTemplates.routes.js';
import bulkGeneratorRoutes from './routes/superadmin/bulkGenerator.routes.js';
import superadminSubscriptionsRoutes from "./routes/superadmin/subscriptions.routes.js";
import startBillingCron from './cron/billing.cron.js';
import { startWeeklyAlertsCron } from './cron/weeklyAlerts.cron.js';
import startSubscriptionReminderCron from './cron/subscriptionReminder.cron.js';
import startGoogleSyncCron from './cron/googleSync.cron.js';
import "./cron/blogScheduled.cron.js";
import superadminFAQsRoutes from "./routes/superadmin/faqs.routes.js";
import superadminStaticPageRoutes from "./routes/superadmin/staticPages.routes.js";
import faqCategoriesRoutes from "./routes/superadmin/faqCategories.routes.js";
import blogRoutes from "./routes/superadmin/blog.routes.js";
import aiProvidersRoutes from "./routes/superadmin/aiProviders.routes.js";
import aiProviderCostsRoutes from "./routes/superadmin/aiProviderCosts.routes.js";
import aiAnalyticsRoutes from "./routes/superadmin/aiAnalytics.routes.js";
import aiCreditsRoutes from "./routes/superadmin/aiCredits.routes.js";
import aiCreditPacksRoutes from "./routes/superadmin/aiCreditPacks.routes.js";
import aiAdminRoutes from "./routes/aiSettings.routes.js";
import googleAdminRoutes from "./routes/google.routes.js";

//routes client
import productViewRoutes from "./routes/client/productViewRoutes.js";
import subscriptionsRoutes from "./routes/client/subscriptions.routes.js";
import addonAdminRoutes    from "./routes/addonRoutes.js";
import shopRoutes from "./routes/client/Shop.routes.js";
import settingClientRoutes from "./routes/client/settingClientRoutes.js";
import clientAuthRoutes from "./routes/client/clientAuthRoutes.js";
import placesRoutes from "./routes/client/Googleplaces.routes.js";
import orderClientRoutes   from "./routes/client/Order.route.js";
import { scanRouter, reviewRouter } from "./routes/client/nfc.routes.js";
import clientFAQsRoutes from "./routes/client/faqs.routes.js";
import clientStaticPageRoutes from "./routes/client/staticPages.routes.js";
import contactRoutes from "./routes/client/contact.routes.js";
import clientBlogRoutes from "./routes/client/blog.routes.js";

// --- Controllers ---
import redirectRouter from "./controllers/redirectController.js";
import reviewsPublicController from "./controllers/reviewsController.js";

// --- Middleware ---
import { errorHandler } from "./middleware/errorHandler.js";
import { requireAuth } from "./middleware/auth.js";
import { requireAdmin } from "./middleware/requireAdmin.js";
import { requireSuperadmin } from "./middleware/requireSuperadmin.js";
import { languageMiddleware } from "./i18n/middleware.js";
import { authenticateAdmin } from "./middleware/auth.middleware.js";
import { requireFeature } from "./middleware/requireFeature.js";


//----jobs----
import { startSuspendUnverifiedJob } from "./jobs/client/suspendUnverified.job.js";
import { suspendUnverifiedAccounts } from './jobs/client/suspendUnverifiedAccounts.job.js';



// --- Cron / Background ---
import "./config/payoutCron.js";

// --- Admin Controllers ---
import adminAffiliateController from "./controllers/adminAffiliateController.js";
import adminPayoutController from "./controllers/adminPayoutController.js";


// --- Affiliate / Stripe Controllers ---
import stripeConnectController from "./controllers/stripeConnectController.js";
import affiliateRegisterController from "./controllers/affiliateRegisterController.js";

// --- Fix __dirname ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();


// --------------------
// SECURITY + CORS
// --------------------
app.use(helmet());
app.set('trust proxy', 1);

//587

// CORS setup for React/Next frontend with credentials
const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  process.env.FRONT_URL,
  process.env.URL_DEV_FRONTEND,
  process.env.URL_PROD_FRONTEND,
].filter(Boolean));

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-App-Language"],
  exposedHeaders: ["X-App-Language"],
}));

app.post(
  "/api/client/shop/webhook",
  express.raw({ type: "application/json" }),
  (req, res, next) => { req.rawBody = req.body; next(); },
  // stripeWebhook
  shopRoutes
);
app.post(
  "/api/client/subscriptions/webhook",
   express.raw({ type: "application/json" }),
  (req, res, next) => {
    req.rawBody = req.body;
    next();
  },
  subscriptionsRoutes
);
// --------------------
// BODY PARSERS
// --------------------
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(languageMiddleware);

// Raw body parser for webhooks
app.use(
  bodyParser.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(cookieParser());

// --------------------
// STATIC FILES
// --------------------
app.use(
  "/api/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(__dirname, "..", "uploads"))
);

app.use("/download", express.static(path.join(process.cwd(), "downloads")));

app.use("/api/public/uploads", 
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static("public/uploads")
);

// --------------------
// ROUTES
// --------------------

// Health check
app.get("/healthz", (req, res) => res.json({ ok: true }));
app.get("/", (req, res) => res.json({ status: "API OK" }));

// Auth & User routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

// Product / Order / Review routes
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/reviews", reviewRoutes);

// Affiliate routes
app.use("/api/affiliates", affiliateRoutes);
app.use("/api/affiliate/connect", requireAuth, stripeConnectController);
app.use("/api/affiliate/register", affiliateRegisterController);

// NFC routes
app.use("/api/nfc", nfcRoutes);

// Webhook routes
app.use("/api/webhooks", webhookRoutes);

// Customization routes
app.use("/api/customization", customizationRoutes);


// *************Ges Routes client***************
  //view client-------Product view shop
  app.use("/api/client", productViewRoutes);
  app.use("/api/client/shop", shopRoutes);
  app.use("/api/client/settings", settingClientRoutes);
  app.use("/api/client/auth", clientAuthRoutes);
  app.use("/api/client/places", placesRoutes);
  app.use("/api/client/orders", orderClientRoutes);
  app.use("/api/c",        scanRouter);
  app.use("/api/review",   reviewRouter);
  app.use("/api/client/subscriptions", subscriptionsRoutes);

  app.use("/api/client/faqs", clientFAQsRoutes);
  app.use("/api/client/all-pages", clientStaticPageRoutes);
  app.use("/api/client/contact", contactRoutes);
  app.use("/api/client/blog",    clientBlogRoutes);
  suspendUnverifiedAccounts();


// *************Ges Routes Admin***************
  //auth admin
  app.use("/api/admin/auth", authAdminRoutes);
  app.use("/api/admin/orders", orderAdminRoutes);
  app.use("/api/admin/locations",       authenticateAdmin, requireFeature("locations"),          locationRoutes);
  app.use('/api/admin/general-settings', adminSettingsRoutes);
  //Mydesgn
  app.use('/api/admin/my-design',       authenticateAdmin, requireFeature("card-designs"),       myDesignAdminRoutes);
  //ges Review
  app.use('/api/admin/reviews',         authenticateAdmin, requireFeature("reviews"),            reviewAdminRoutes);

  //ges analytics event (doit être avant /analytics pour éviter les conflits)
  app.use('/api/admin/analytics/events', authenticateAdmin, requireFeature("event-tracking"),   analyticsEventsRoutes);

  //ges order Tracking
  app.use('/api/admin/order-tracking', orderTrackAdminRoutes);

  //ges billing
  app.use('/api/admin/billing', billingAdminRoutes)

    app.use("/api/admin/addons",        addonAdminRoutes);

  //ges NFCcard
  app.use("/api/admin/nfc-cards",       authenticateAdmin, requireFeature("nfc-cards"),         nfcCardsRoutes);

  //ges Review Request + Contacts/Groups/Templates/Campaigns/Analytics
  app.use("/api/admin/requests",        authenticateAdmin, requireFeature("review-requests"),   requestRoutes);       // monté EN PREMIER (évite conflit /:id)
  app.use("/api/admin/requests",        authenticateAdmin, requireFeature("review-requests"),   reviewRequestRoutes);
  //ges Automation Workflows
  app.use("/api/admin/automation",      authenticateAdmin, requireFeature("auto-responses"),    automationRoutes);
  //ges Alerts
  app.use("/api/admin/alerts",          authenticateAdmin, requireFeature("alerts"),            alertsRoutes);
  //ges Marketplace
  app.use("/api/admin/marketplace",     authenticateAdmin, requireFeature("marketplace"),       marketplaceRoutes);
  //ges Analytics
  app.use("/api/admin/analytics",       authenticateAdmin, requireFeature("basic-analytics"),   analyticsRoutes);
  //ges team
  app.use("/api/admin/team",            authenticateAdmin, requireFeature("team-members"),      teamRoutes);
  //ges filtering
  app.use("/api/admin/filtering",       authenticateAdmin, requireFeature("advanced-filtering"), filteringRoutes);
  //ges planBuilder
  app.use("/api/admin/plan-builder", planBuilderRoutes);
  //ges AI settings + credits + usage
  app.use("/api/admin/ai", aiAdminRoutes);
  // Google OAuth + Business Profile
  app.use("/api/admin/google", googleAdminRoutes);

  // Dashboard / Admin routes
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/admin/affiliates", requireAuth, requireAdmin, adminAffiliateController);
  app.use("/api/admin/payouts", requireAuth, requireAdmin, adminPayoutController);


// ************* Ges Routes SuperAdmin ***************
  //auth superadmin
   app.use("/api/superadmin/auth", authSuperAdminRoutes);
  //setting-superAdmin
  app.use("/api/superadmin/sms-settings", smsSettingsRoutes);
  app.use("/api/superadmin/platform-settings", platformSettingsRoute);
  app.use('/api/superadmin/plan-settings', planSettingRoutes);
  app.use('/api/superadmin/addon-settings', addonSettingRoutes);
  app.use('/api/superadmin/role-settings', roleRoutes);
  app.use('/api/superadmin/feature-flags-settings', featureFlagRoutes);

  app.use('/api/superadmin/security-settings', securityRoutes);
  
  app.use('/api/superadmin/audit-log-settings', auditLogRoutes);
  app.use('/api/superadmin/language-settings', languageSettingRoutes);
  app.use('/api/superadmin/currency-settings', globalCurrencyRoutes);
  app.use('/api/superadmin/payment-settings', paymentGatewayRoutes);
  app.use('/api/superadmin/sms-templates', smsTemplateRoutes);
  app.use('/api/superadmin/email-templates', emailTemplateRoutes);
  app.use('/api/superadmin/webhooks-settings', webhooksSettingRoutes);
  app.use('/api/superadmin/email-server-config', emailServerConfigRoutes);
  app.use('/api/superadmin/status-settings', statusRoutes);
  app.use("/api/superadmin/billing",   billingRoutes);
  app.use("/api/superadmin/shipping",      shippingRoutes);
  app.use("/api/superadmin/geo-coverage",      geoCoverageRoutes);
  app.use("/api/superadmin/front-pages-seo",   frontPagesSeoRoutes);
  app.use('/api/superadmin/general-settings', generalSettingsRoutes);
  app.use('/api/superadmin/card-templates', cardTemplatesRoutes);
  app.use('/api/superadmin/bulk-generator', bulkGeneratorRoutes);
  app.use("/api/superadmin/subscription", superadminSubscriptionsRoutes);
  app.use("/api/superadmin/faqs", superadminFAQsRoutes);
  app.use("/api/superadmin/all-pages", superadminStaticPageRoutes);
  app.use("/api/superadmin/faq-categories", faqCategoriesRoutes);
  app.use("/api/superadmin/blog",           blogRoutes);
  app.use("/api/superadmin/ai/providers",      aiProvidersRoutes);
  app.use("/api/superadmin/ai/provider-costs", aiProviderCostsRoutes);
  app.use("/api/superadmin/ai/credits",        aiCreditsRoutes);
  app.use("/api/superadmin/ai/credit-packs",  aiCreditPacksRoutes);
  app.use("/api/superadmin/ai",                aiAnalyticsRoutes);
  startBillingCron();
  startWeeklyAlertsCron();
  startSubscriptionReminderCron();
  startGoogleSyncCron();

    // const uploadDir = path.resolve(process.env.UPLOAD_DIR || "uploads");
    // app.use("/uploads", express.static(uploadDir));
  app.use(express.json({ limit: "60mb" }));
  app.use(express.urlencoded({ extended: true, limit: "60mb" }));

  // gestion product
  app.use('/api/superadmin/products', productAdminRoutes);
  
  app.use('/api/superadmin/card-types', cardTypeAdminRoutes);

  //gestion Orders
  app.use('/api/superadmin/orders', orderSuperAdminRoutes);

  //gestion NFC/design
  app.use('/api/superadmin/nfc', superNfcRouter);

  //gestion superadmin
  app.use("/api/superadmin/designs", designsSuperadminRoutes);

  //gestion NFCTAGS
  app.use('/api/superadmin/nfc-tags', nfcTagRoutes);

  //gestion NFCCards
  app.use('/api/superadmin/nfc-cards', nfcCardRoutes);

  // gestion companies
  app.use('/api/superadmin/companies', companyRoutes);


// Public / Legacy routes
app.use("/r", redirectRouter);
app.use("/api/public-reviews", reviewsPublicController);
app.use("/api/client/seo",     publicSeoRoutes);

// Public card activation (GET /api/cards/:uid/activate)
import { activateCardPublic } from "./controllers/superadmin/cardsBatchController.js";
app.get("/api/cards/:uid/activate", activateCardPublic);
app.use("/api/superadmin/auth", superadminAuthRoutes);
app.use("/api/superadmin/dashboard", requireAuth, requireSuperadmin, superadminDashboardRoutes);



// --------------------
// GLOBAL ERROR HANDLER
// --------------------
app.use(errorHandler);

export default app;
