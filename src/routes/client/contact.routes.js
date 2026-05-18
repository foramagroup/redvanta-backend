// src/routes/client/contact.routes.js
// Route publique — aucun middleware d'auth

import express from "express";
import { submitContact } from "../../controllers/client/contact.controller.js";

const router = express.Router();

router.post("/", submitContact);

export default router;
