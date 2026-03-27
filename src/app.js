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
import billingRoutes from "./routes/superadmin/Billing.routes.js";

//routes client
import productViewRoutes from "./routes/client/productViewRoutes.js";
import shopRoutes from "./routes/client/Shop.routes.js";
import settingClientRoutes from "./routes/client/settingClientRoutes.js";
import clientAuthRoutes from "./routes/client/clientAuthRoutes.js";
import placesRoutes from "./routes/client/Googleplaces.routes.js";
import orderClientRoutes   from "./routes/client/Order.route.js";

// --- Controllers ---
import redirectRouter from "./controllers/redirectController.js";
import reviewsPublicController from "./controllers/reviewsController.js";

// --- Middleware ---
import { errorHandler } from "./middleware/errorHandler.js";
import { requireAuth } from "./middleware/auth.js";
import { requireAdmin } from "./middleware/requireAdmin.js";
import { requireSuperadmin } from "./middleware/requireSuperadmin.js";


//----jobs----
import { startSuspendUnverifiedJob } from "./jobs/client/suspendUnverified.job.js";



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
}));

app.post(
  "/api/orders/webhook",
  express.raw({ type: "application/json" }),
  (req, res, next) => { req.rawBody = req.body; next(); },
  stripeWebhook
);
// --------------------
// BODY PARSERS
// --------------------
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

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
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(__dirname, "..", "uploads"))
);
app.use("/download", express.static(path.join(process.cwd(), "downloads")));

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
  app.use("/api/orders", orderClientRoutes);
  startSuspendUnverifiedJob();




// *************Ges Routes Admin***************
  //auth admin
  app.use("/api/admin/auth", authAdminRoutes);
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
  app.use("/api/superadmin/billing", billingRoutes);

    // const uploadDir = path.resolve(process.env.UPLOAD_DIR || "uploads");
    // app.use("/uploads", express.static(uploadDir));
    app.use(express.json({ limit: "60mb" }));
    app.use(express.urlencoded({ extended: true, limit: "60mb" }));

  // gestion product
  app.use('/api/superadmin/products', productAdminRoutes);
  app.use('/api/superadmin/card-types', cardTypeAdminRoutes);

  // gestion companies
  app.use('/api/superadmin/companies', companyRoutes);


// Public / Legacy routes
app.use("/r", redirectRouter);
app.use("/api/public-reviews", reviewsPublicController);
app.use("/api/superadmin/auth", superadminAuthRoutes);
app.use("/api/superadmin/dashboard", requireAuth, requireSuperadmin, superadminDashboardRoutes);



// --------------------
// GLOBAL ERROR HANDLER
// --------------------
app.use(errorHandler);

export default app;
