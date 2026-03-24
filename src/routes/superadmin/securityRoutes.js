import express from 'express';
import  {getAdmins, createAdmin, updateAdmin, getSecuritySettings, updateSecuritySettings} from '../../controllers/superadmin/securityController.js';

const router = express.Router();

router.get("/admins", getAdmins);
router.get("/", getSecuritySettings);
router.put("/:id", updateSecuritySettings);
router.post("/admins", createAdmin);
router.put("/admins/:id", updateAdmin);

export default router;