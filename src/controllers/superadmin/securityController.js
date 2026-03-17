import prisma from "../../config/database.js";
import bcrypt from 'bcryptjs';
export const getAdmins = async (req, res) => {

    const admins = await prisma.user.findMany({
        where: {
        roleId: {
            not: null
        }
        },
        include: {
        role: true
        },
        orderBy: {
            createdAt: "desc"
        }
    });

    const formattedAdmins = admins.map(a => ({
        id: a.id,
        name: a.name,
        email: a.email,
        role: a.role?.name,
        twoFa: a.twoFa,
        lastLogin: a.lastLogin
    }));
    
    const loginActivity = await prisma.loginActivity.findMany({
        orderBy: {
        createdAt: "desc"
        },
        take: 10
    });
    const formattedActivity = loginActivity.map(a => ({
        admin: a.adminName,
        ip: a.ip,
        time: a.createdAt,
        status: a.status
    }));

   res.json({
      formattedAdmins,
      formattedActivity
    });
};


export const createAdmin = async (req, res) => {

  const { name, email, roleId } = req.body;
    const hashedPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.create({
    data: {
      name,
      email,
     password: hashedPassword,
      roleId
    }
  });

  res.json(admin);
};


// await prisma.loginActivity.create({
//   data: {
//     userId: user.id,
//     adminName: user.name,
//     ip: req.ip,
//     status: "Success"
//   }
// });

export const updateAdmin = async (req, res) => {

  const { id } = req.params;
  const { name, email, roleId } = req.body;

  const admin = await prisma.user.update({
    where: { id: Number(id) },
    data: {
      name,
      email,
      roleId
    }
  });

  res.json(admin);
};