import { Router } from "express";
import { listPublicPages, getPublicPageSeo } from "../../controllers/client/seo.controller.js";

const router = Router();

// Routes publiques — aucune authentification requise
router.get("/",      listPublicPages);   // toutes les pages publiées
router.get("/:key",  getPublicPageSeo);  // une page par key (ex: "home", "pricing")

export default router;
