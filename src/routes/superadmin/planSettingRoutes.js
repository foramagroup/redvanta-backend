import express from 'express';
import  planSettingController from '../../controllers/superadmin/planSettingController.js';

const router = express.Router();

router.get('/', planSettingController.listPlans);
router.get('/:id', planSettingController.getPlan);
router.post('/', planSettingController.createPlan);
router.put('/:id', planSettingController.updatePlan);
router.delete('/:id', planSettingController.deletePlan);

export default router;