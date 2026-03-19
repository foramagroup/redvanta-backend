import prisma from "../../config/database.js";

const roleModel = prisma.role;
const moduleModel = prisma.module;
const permissionModel = prisma.permission;
const rolePermissionModel = prisma.rolePermission;

const parseId = (value) => Number.parseInt(value, 10);

export const getRoles = async (req, res) => {
  try {
    const [roles, modules, permissions] = await Promise.all([
      roleModel.findMany({
        include: {
          rolePermissions: {
            include: {
              module: true,
              permission: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      moduleModel.findMany({
        orderBy: { name: "asc" },
      }),
      permissionModel.findMany({
        orderBy: { name: "asc" },
      }),
    ]);

    res.json({
      roles,
      modules,
      permissions,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createRole = async (req, res) => {
  try {
    const { name, permissions = [] } = req.body;

    const role = await roleModel.create({
      data: {
        name,
        updatedAt: new Date(),
      },
    });

    if (permissions.length > 0) {
      const rolePermissions = permissions.map((item) => ({
        roleId: role.id,
        moduleId: Number(item.moduleId),
        permissionId: Number(item.permissionId),
      }));

      await rolePermissionModel.createMany({
        data: rolePermissions,
        skipDuplicates: true,
      });
    }

    const result = await roleModel.findUnique({
      where: { id: role.id },
      include: {
        rolePermissions: {
          include: {
            module: true,
            permission: true,
          },
        },
      },
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updatePermissions = async (req, res) => {
  try {
    const { roleId, permissions = [] } = req.body;
    const parsedRoleId = parseId(roleId);

    await rolePermissionModel.deleteMany({
      where: { roleId: parsedRoleId },
    });

    if (permissions.length > 0) {
      const data = permissions.map((item) => ({
        roleId: parsedRoleId,
        moduleId: Number(item.moduleId),
        permissionId: Number(item.permissionId),
      }));

      await rolePermissionModel.createMany({
        data,
        skipDuplicates: true,
      });
    }

    await roleModel.update({
      where: { id: parsedRoleId },
      data: {
        updatedAt: new Date(),
      },
    });

    res.json({ message: "Permissions updated" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
