import prisma from "../../config/database.js";

 const listPlans = async (req, res) => {
  try {
    const plans = await prisma.planSetting.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

 const getPlan = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const plan = await prisma.planSetting.findUnique({ where: { id } });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

 const createPlan = async (req, res) => {
  try {
    const data = req.body;
    const plan = await prisma.planSetting.create({ data });
    res.status(201).json(plan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

 const updatePlan = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = req.body;
    const plan = await prisma.planSetting.update({ where: { id }, data });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deletePlan = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.planSetting.delete({ where: { id } });
    res.json({ message: "Plan deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export default {
  listPlans,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan
};