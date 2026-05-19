import { Router } from "express";
import { requireAuth }  from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import {
  listWorkflows,
  createWorkflow,
  updateWorkflow,
  toggleWorkflow,
  deleteWorkflow,
  testWorkflow,
} from "../controllers/automation.controller.js";

const router = Router();
const auth   = [requireAuth, requireAdmin];

router.get   ("/",            ...auth, listWorkflows);
router.post  ("/",            ...auth, createWorkflow);
router.put   ("/:id",         ...auth, updateWorkflow);
router.patch ("/:id/toggle",  ...auth, toggleWorkflow);
router.delete("/:id",         ...auth, deleteWorkflow);
router.post  ("/:id/test",    ...auth, testWorkflow);

export default router;
