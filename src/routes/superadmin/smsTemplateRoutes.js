import express from "express";

import {
    getTemplates, 
    createTemplate,
     updateTemplate, 
     deleteTemplate
} from "../../controllers/superadmin/smsTemplateController.js";

import { authenticateSuperAdmin, requireSuperAdmin } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateSuperAdmin, requireSuperAdmin);

router.get("/", getTemplates)

router.post("/", createTemplate)

router.put("/:id", updateTemplate)

router.delete("/:id", deleteTemplate)

export default router;