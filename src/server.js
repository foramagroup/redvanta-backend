import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";

// ROUTES
import authRoutes from "./routes/authRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import dashboardUsersRoutes from "./routes/dashboardUsersRoutes.js";
import nfcRoutes from "./routes/nfcRoutes.js";
import bundlesRoutes from "./routes/bundles.js";

// CONTROLLERS
import { publicRedirect } from "./controllers/redirectController.js";
import { writerWebhook } from "./controllers/nfcWriterWebhook.js";

// MIDDLEWARE
import { globalLimiter, strictLimiter, scanLimiter } from "./middleware/rateLimit.js";
import { abuseGuard } from "./middleware/abuseGuard.js";

// ------------------------
// __dirname FIX
// ------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------------
// EXPRESS INIT
// ------------------------
const app = express();

// ------------------------
// SECURITY & PARSING
// ------------------------
app.use(globalLimiter);
app.use(helmet());

// CORS
app.use(
  cors({
    origin: ["http://localhost:3000"], // frontend origin
    credentials: true,                 // allow cookies
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ------------------------
// STATIC FILES
// ------------------------
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/download", express.static(path.join(process.cwd(), "downloads")));

// ------------------------
// ROUTES
// ------------------------
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", strictLimiter, dashboardRoutes);
app.use("/api/dashboard/users", dashboardUsersRoutes);
app.use("/api/nfc", nfcRoutes);
app.use("/api/bundles", bundlesRoutes);

// Public redirect with abuse guard & scan limiter
app.get("/r", scanLimiter, abuseGuard({ max: 50, windowMs: 60_000 }), publicRedirect);

// NFC writer webhook
app.post("/api/nfc-writer/webhook", writerWebhook);

// Health check
app.get("/healthz", (req, res) => res.json({ ok: true }));

// Root endpoint
app.get("/", (req, res) => res.json({ ok: true }));

// ------------------------
// START SERVER
// ------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running at http://localhost:${PORT}`));

export default app;
