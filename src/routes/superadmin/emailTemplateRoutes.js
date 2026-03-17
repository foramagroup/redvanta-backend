import express from 'express';

import  {
    getAllTemplates,
    updateTemplate, 
    createTemplate, 
    duplicateTemplate, 
    deleteTemplate 
} from '../../controllers/superadmin/emailTemplateController.js';

const router = express.Router();

router.get('/', getAllTemplates);
router.post('/', createTemplate);
router.put('/:id', updateTemplate);
router.post('/:id/duplicate', duplicateTemplate);
router.delete('/:id', deleteTemplate);

export default router;