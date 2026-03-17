import express from 'express';
import  {getAdmins, createAdmin, updateAdmin} from '../../controllers/superadmin/securityController.js';

const router = express.Router();

router.get("/admins", getAdmins);
router.post("/admins", createAdmin);
router.put("/admins/:id", updateAdmin);

export default router;