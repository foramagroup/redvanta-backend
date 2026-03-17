import express from "express";
import {
 getLanguages, 
 getTranslations, 
 createKey,  
 updateTranslation, 
 deleteKey
 } 
from "../../controllers/superadmin/languageSettingController.js";

const router = express.Router();

router.get("/",getLanguages)

router.get("/translations",getTranslations)

router.post("/translations/key",createKey)

router.put("/translations/update",updateTranslation)

router.delete("/translations/:id",deleteKey)

export default router;