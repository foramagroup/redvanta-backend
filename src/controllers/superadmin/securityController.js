import prisma from "../../config/database.js";
import bcrypt from "bcryptjs";

const userModel = prisma.user;
const roleModel = prisma.role;
const loginActivityModel = prisma.loginActivity;
const securityPolicyModel = prisma.securitypolicie;

const parseId = (value) => Number.parseInt(value, 10);

export const getSecuritySettings = async (req, res) => {
  try {
    const [securityPolicy, roles] = await Promise.all([
      securityPolicyModel.findFirst(),
      roleModel.findMany({
        orderBy: { name: "asc" },
      }),
    ]);

    res.json({
      policy: securityPolicy || {
        enforce2FA: false,
        ipRestriction: "",
      },
      roles,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateSecuritySettings = async (req, res) => {
  try {
    const { enforce2FA, ipRestriction } = req.body;

    const existingPolicy = await securityPolicyModel.findFirst();

    const data = {
      enforce2FA: Boolean(enforce2FA),
      ipRestriction: ipRestriction || "",
      updatedAt: new Date(),
    };

    const policy = existingPolicy
      ? await securityPolicyModel.update({
          where: { id: existingPolicy.id },
          data,
        })
      : await securityPolicyModel.create({
          data,
        });

    res.json(policy);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAdmins = async (req, res) => {
  try {
    const admins = await userModel.findMany({
      where: {
        roleId: {
          not: null,
        },
      },
      include: {
        role: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedAdmins = admins.map((admin) => ({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      roleId: admin.roleId,
      role: admin.role?.name || "",
      twoFa: Boolean(admin.twoFa),
      lastLogin: admin.lastLogin,
    }));

    const loginActivity = await loginActivityModel.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    });

    const formattedActivity = loginActivity.map((activity) => ({
      admin: activity.admin_name,
      ip: activity.ip,
      time: activity.createdAt,
      status: activity.status,
    }));

    res.json({
      admins: formattedAdmins,
      loginActivity: formattedActivity,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createAdmin = async (req, res) => {
  try {
    const { name, email, roleId } = req.body;
    const hashedPassword = await bcrypt.hash("admin123", 10);

    const admin = await userModel.create({
      data: {
        name,
        email,
        password: hashedPassword,
        roleId: parseId(roleId),
      },
      include: {
        role: true,
      },
    });

    res.json({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      roleId: admin.roleId,
      role: admin.role?.name || "",
      twoFa: Boolean(admin.twoFa),
      lastLogin: admin.lastLogin,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateAdmin = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const { name, email, roleId } = req.body;

    const admin = await userModel.update({
      where: { id },
      data: {
        name,
        email,
        roleId: parseId(roleId),
      },
      include: {
        role: true,
      },
    });

    res.json({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      roleId: admin.roleId,
      role: admin.role?.name || "",
      twoFa: Boolean(admin.twoFa),
      lastLogin: admin.lastLogin,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
