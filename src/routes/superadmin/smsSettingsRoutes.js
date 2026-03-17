import express from "express";
import smsSettingsController from '../../controllers/superadmin/smsSettingsController.js';

const router = express.Router();

router.get("/", smsSettingsController.list);

router.post("/", smsSettingsController.create);

router.put("/:id", smsSettingsController.update);

router.delete("/:id", smsSettingsController.deleteSetting);

export default router;