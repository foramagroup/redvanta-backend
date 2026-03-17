import express from "express";

import {
    getTemplates, 
    createTemplate,
     updateTemplate, 
     deleteTemplate
} from "../../controllers/superadmin/smsTemplateController.js";

const router = express.Router();

router.get("/", getTemplates)

router.post("/", createTemplate)

router.put("/:id", updateTemplate)

router.delete("/:id", deleteTemplate)

export default router;