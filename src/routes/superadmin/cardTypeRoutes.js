import express from "express";
import { authenticate, authorize, authorizeRole, validate } from "../../middleware/index.js";
import {
  listCardTypes, getCardType, createCardType,
  updateCardType, deleteCardType, toggleCardType,
} from "../../controllers/superadmin/caedTypeController.js";

import {
  createCardTypeSchema, updateCardTypeSchema,
} from "../../validators/superadmin/product.validator.js";


const router = express.Router();


// Apply auth + superadmin guard to all routes in this file
// router.use(authenticate, requireSuperAdmin);

// router.post("/", 
//   authenticate, 
//   authorizeRole("admin", "superadmin"), 
//   validate(productSchema), 
//   authorize("product:create"), 
//   productCtrl.create
// );


router.get("/", listCardTypes);


router.get("/:id", getCardType);


router.post("/", validate(createCardTypeSchema), createCardType);

router.put("/:id", validate(updateCardTypeSchema), updateCardType);

router.patch(":id/toggle", toggleCardType);

router.delete(":id", deleteCardType);

export default router;