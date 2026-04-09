import express from 'express';
import multer from 'multer';
import path from 'path';
import {
  getCompanySettings,
  listUserCompanies,
  updateGeneralSettings,
  updateBrandingSettings,
  uploadLogo,
  updateRecaptchaSettings,
  updateMapsSettings,
  updatePlatformsSettings,
  updateSecuritySettings,
  updateAdvancedSettings
} from '../controllers/settingsController.js';
import { authenticateAdmin, requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

// Configuration Multer pour l'upload de logo
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/logos/');
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

// Toutes les routes nécessitent une authentification
router.use(authenticateAdmin);

// GET - Liste des companies de l'utilisateur
router.get('/list', listUserCompanies);

// GET - Récupérer les settings d'une company
// ?companyId=123 (optionnel, sinon prend la première)
router.get('/', getCompanySettings);



// PUT - Mettre à jour par section (companyId requis dans body)
router.put('/general', requireAdmin, updateGeneralSettings);
router.put('/branding', requireAdmin, updateBrandingSettings);
router.put('/recaptcha', requireAdmin, updateRecaptchaSettings);
router.put('/maps', requireAdmin, updateMapsSettings);
router.put('/platforms', requireAdmin, updatePlatformsSettings);
router.put('/security', requireAdmin, updateSecuritySettings);
router.put('/advanced', requireAdmin, updateAdvancedSettings);

// POST - Upload logo (companyId requis dans body)
router.post('/logo', requireAdmin, upload.single('logo'), uploadLogo);

export default router;