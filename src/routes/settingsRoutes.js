import express from "express";
import multer from 'multer';
const router = express.Router();
import * as settingsCtrl from "../controllers/settingsController.js";
import upload from "../middleware/uploadMiddleware.js";
// const upload = multer({ dest: 'uploads/logos/' });
// import { authenticate } from "../../middleware/auth.js"; 

router.get("/", settingsCtrl.getSettings);
router.put("/general",  settingsCtrl.updateGeneral);
router.put("/branding",  settingsCtrl.updateBranding);
router.put("/security", settingsCtrl.updateSecurity);
router.post("/upload-logo", upload.single('logo'), settingsCtrl.uploadLogo);

export default router;