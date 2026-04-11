import express from 'express';
import {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  toggleTemplate,
  getTemplateStats
} from '../../controllers/superadmin/cardTemplates.controller.js';
import { authenticateSuperAdmin, requireSuperAdmin } from '../../middleware/auth.middleware.js';

const router = express.Router();

// Toutes les routes nécessitent SuperAdmin
router.use(authenticateSuperAdmin, requireSuperAdmin);

// GET - Statistiques
router.get('/stats', getTemplateStats);

// GET - Liste des templates
router.get('/', getAllTemplates);

// GET - Template par ID
router.get('/:id', getTemplateById);

// POST - Créer un template
router.post('/', createTemplate);

// POST - Dupliquer un template
router.post('/:id/duplicate', duplicateTemplate);

// PUT - Mettre à jour un template
router.put('/:id', updateTemplate);

// PATCH - Toggle active/inactive
router.patch('/:id/toggle', toggleTemplate);

// DELETE - Supprimer un template
router.delete('/:id', deleteTemplate);

export default router;