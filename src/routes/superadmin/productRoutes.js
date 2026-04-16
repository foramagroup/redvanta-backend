import express from "express";
import { validate } from "../../middleware/index.js";
import {
  listProducts, getProduct, createProduct,
  updateProduct, deleteProduct, toggleProduct, getAvailableTemplatesForProducts
} from "../../controllers/superadmin/productController.js";


import {
  createProductSchema, updateProductSchema,
} from "../../validators/superadmin/product.validator.js";


import { authenticateSuperAdmin, requireSuperAdmin } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateSuperAdmin, requireSuperAdmin);


// Apply auth + superadmin guard to all routes in this file
// router.use(authenticate, requireSuperAdmin);

// router.post("/", 
//   authenticate, 
//   authorizeRole("admin", "superadmin"), 
//   validate(productSchema), 
//   authorize("product:create"), 
//   productCtrl.create
// );


router.get('/available-templates', getAvailableTemplatesForProducts);

router.get("/", listProducts);


router.get("/:id", getProduct);


router.post("/", validate(createProductSchema), createProduct);


router.put("/:id", validate(updateProductSchema), updateProduct);


router.patch("/:id/toggle", toggleProduct);


router.delete("/:id", deleteProduct);




export default router;