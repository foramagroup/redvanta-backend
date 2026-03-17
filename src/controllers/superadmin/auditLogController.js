import prisma from "../../config/database.js";


export const getAuditLogs = async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const skip = (page - 1) * pageSize;
    const take = parseInt(pageSize);

    const logs = await prisma.auditLog.findMany({
      include: {
        admin: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take
    });

    const total = await prisma.auditLog.count();

    res.json({ data: logs, total, page: parseInt(page), pageSize: take });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const createAuditLog = async ({ adminId, action, target, metadata, ip }) => {
  return await prisma.auditLog.create({
    data: { adminId, action, target, metadata, ip }
  });
};