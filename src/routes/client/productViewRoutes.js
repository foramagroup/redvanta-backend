import express from 'express';
const router = express.Router();
import {getShopProduct} from '../../controllers/client/productViewController.js';
router.get('/shop-details', getShopProduct);
export default router;