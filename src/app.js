// backend/src/app.js
import express from "express";
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

// --- Controllers ---
import redirectRouter from "./controllers/redirectController.js";
import reviewsPublicController from "./controllers/reviewsController.js";

// --- Middleware ---
import { errorHandler } from "./middleware/errorHandler.js";
import { requireAuth } from "./middleware/auth.js";
import { requireAdmin } from "./middleware/requireAdmin.js";
import { requireSuperadmin } from "./middleware/requireSuperadmin.js";

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
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
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

// Dashboard / Admin routes
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin/affiliates", requireAuth, requireAdmin, adminAffiliateController);
app.use("/api/admin/payouts", requireAuth, requireAdmin, adminPayoutController);

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

//gestion product
const uploadDir = path.resolve(process.env.UPLOAD_DIR || "uploads");
app.use("/uploads", express.static(uploadDir));
app.use(express.json({ limit: "60mb" }));
app.use(express.urlencoded({ extended: true, limit: "60mb" }));



app.use('/api/superadmin/products', productAdminRoutes);
app.use('/api/superadmin/card-types', cardTypeAdminRoutes);


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
