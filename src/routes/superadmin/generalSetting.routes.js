import express from 'express';
import multer from 'multer';
import path from 'path';
import {
  getPlatformSettings,
  updateGeneralSettings,
  updateBrandingSettings,
  uploadLogo,
  updateRecaptchaSettings,
  updateMapsSettings,
  updatePlatformsSettings,
  updateSecuritySettings
} from '../../controllers/superadmin/generalSetting.controller.js';
import { authenticateSuperAdmin, requireSuperAdmin } from "../../middleware/auth.middleware.js";

const router = express.Router();

// Configuration Multer pour l'upload de logo
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/logos/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

// Toutes les routes nécessitent SuperAdmin
router.use(authenticateSuperAdmin, requireSuperAdmin);

// GET - Récupérer les settings
router.get('/', getPlatformSettings);

// PUT - Mettre à jour par section
router.put('/general', updateGeneralSettings);
router.put('/branding', updateBrandingSettings);
router.put('/recaptcha', updateRecaptchaSettings);
router.put('/maps', updateMapsSettings);
router.put('/platforms', updatePlatformsSettings);
router.put('/security', updateSecuritySettings);

// POST - Upload logo
router.post('/logo', upload.single('logo'), uploadLogo);

export default router;