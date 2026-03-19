import prisma from "../../config/database.js";

const planSettingModel = prisma.planSetting;

const parseId = (value) => Number.parseInt(value, 10);

const listPlans = async (req, res) => {
  try {
    const plans = await planSettingModel.findMany({ orderBy: { createdAt: "desc" } });
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


const getPlan = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const plan = await planSettingModel.findUnique({ where: { id } });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createPlan = async (req, res) => {
  try {
    const data = {
      ...req.body,
      updatedAt: new Date(),
    };
    const plan = await planSettingModel.create({ data });
    res.status(201).json(plan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updatePlan = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const data = {
      ...req.body,
      updatedAt: new Date(),
    };
    const plan = await planSettingModel.update({ where: { id }, data });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deletePlan = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    await planSettingModel.delete({ where: { id } });
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
