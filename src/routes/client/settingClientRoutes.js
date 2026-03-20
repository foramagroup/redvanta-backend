import express from 'express';
const router = express.Router();
import {getGlobalSettings} from '../../controllers/client/settingClientController.js';
router.get('/', getGlobalSettings);

export default router;