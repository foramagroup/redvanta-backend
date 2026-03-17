import express from "express";
import { listTemplates } from "../controllers/templateController.js";

const router = express.Router();

router.get("/", listTemplates);

export default router;
