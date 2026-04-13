import express from 'express';
import  {getAdmins, createAdmin, updateAdmin, getSecuritySettings, updateSecuritySettings} from '../../controllers/superadmin/securityController.js';

import { authenticateSuperAdmin, requireSuperAdmin } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateSuperAdmin, requireSuperAdmin);

router.get("/admins", getAdmins);
router.get("/", getSecuritySettings);
router.put("/", updateSecuritySettings);
router.post("/admins", createAdmin);
router.put("/admins/:id", updateAdmin);

export default router;