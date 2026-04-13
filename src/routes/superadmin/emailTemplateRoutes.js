import express from 'express';

import  {
    getAllTemplates,
    updateTemplate, 
    createTemplate, 
    duplicateTemplate, 
    deleteTemplate 
} from '../../controllers/superadmin/emailTemplateController.js';

import { authenticateSuperAdmin, requireSuperAdmin } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateSuperAdmin, requireSuperAdmin);

router.get('/', getAllTemplates);
router.post('/', createTemplate);
router.put('/:id', updateTemplate);
router.post('/:id/duplicate', duplicateTemplate);
router.delete('/:id', deleteTemplate);

export default router;