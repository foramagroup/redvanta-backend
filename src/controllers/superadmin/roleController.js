import prisma from '../../config/database.js';



export const getRoles = async (req, res) => {
  try {

    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: {
            module: true,
            permission: true
          }
        }
      }
    });

    res.json(roles);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const createRole = async (req, res) => {
  try {

    const { name, permissions } = req.body;

    const role = await prisma.role.create({
      data: { name }
    });

    if (permissions && permissions.length > 0) {

      const rolePermissions = permissions.map(p => ({
        roleId: role.id,
        moduleId: p.moduleId,
        permissionId: p.permissionId
      }));

      await prisma.rolePermission.createMany({
        data: rolePermissions,
         skipDuplicates: true
      });

    }

    const result = await prisma.role.findUnique({
      where: { id: role.id },
      include: {
        permissions: {
          include: {
            module: true,
            permission: true
          }
        }
      }
    });

    res.json(result);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const updatePermissions = async (req, res) => {

  try {

    const { roleId, permissions } = req.body;

    await prisma.rolePermission.deleteMany({
      where: { roleId }
    });

    const data = permissions.map(p => ({
      roleId,
      moduleId: p.moduleId,
      permissionId: p.permissionId
    }));

    await prisma.rolePermission.createMany({
      data
    });

    res.json({ message: "Permissions updated" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};