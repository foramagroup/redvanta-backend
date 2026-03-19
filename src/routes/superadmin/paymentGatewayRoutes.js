import express from "express";
import {
 getPaymentGateways, 
 createGateway, 
 updateGateway,  
 deleteGateway, 
 getManualMethods,
 createManualMethod,
 updateManualMethod,
 deleteManualMethod,
 getPaymentSettings,
 updatePaymentSettings
 } 
from "../../controllers/superadmin/paymentGatewayController.js";

const router = express.Router();

router.get("/payment-gateways",getPaymentGateways)

router.post("/payment-gateways",createGateway)

router.put("/payment-gateways/:id",updateGateway)

router.delete("/payment-gateways/:id",deleteGateway)

router.get("/manual-payment-methods",getManualMethods)

router.post("/manual-payment-methods",createManualMethod)

router.put("/manual-payment-methods/:id",updateManualMethod)

router.delete("/manual-payment-methods/:id",deleteManualMethod)

router.get("/payment-settings",getPaymentSettings)

router.put("/payment-settings",updatePaymentSettings)

export default router;
