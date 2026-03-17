import express from "express";
import {
 getGlobalCurrencies, 
 createGlobalCurrency, 
 updateGlobalCurrency,  
 deleteGlobalCurrency, 
 getCurrencySettings,
 updateCurrencySettings
 } 
from "../../controllers/superadmin/globalCurrencyController.js";

const router = express.Router();

router.get("/global-currencies",getGlobalCurrencies)

router.post("/global-currencies",createGlobalCurrency)

router.put("/global-currencies/:id",updateGlobalCurrency)

router.delete("/global-currencies/:id",deleteGlobalCurrency)

router.get("/global-currency-settings", getCurrencySettings)

router.put("/global-currency-settings", updateCurrencySettings)

export default router;