/**
 * userController.js
 */

import prisma from '../config/database.js';
import bcrypt from 'bcryptjs';
import { ok, fail } from '../utils/responses.js';
import { sendInviteEmail } from "../services/emailService.js";
import { Parser } from "json2csv";

export const userController = {
  async me(req, res) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, email: true, name: true, role: true, createdAt: true }
      });
      return ok(res, { user });
    } catch (err) {
      return fail(res, 500, err.message);
    }
  },

  async updateProfile(req, res) {
    try {
      const { name } = req.body;
      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: { name }
      });
      return ok(res, { user });
    } catch (err) {
      return fail(res, 500, err.message);
    }
  },

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });

      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) return fail(res, 400, 'Mot de passe actuel incorrect');

      const hashed = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: req.user.id },
        data: { password: hashed }
      });

      return ok(res, { message: 'Mot de passe mis à jour' });
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }
};

export async function listUsers(req, res) {
  try {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 20;
    let skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" }
      }),
      prisma.user.count()
    ]);

    res.json({
      items,
      page,
      total,
      pages: Math.ceil(total / limit)
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Unable to load users" });
  }
}

export async function inviteUser(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Missing email" });

    // create temporary user or token
    const invite = await prisma.inviteToken.create({
      data: { email }
    });

    await sendInviteEmail(email, invite.id);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Unable to send invite" });
  }
}

export async function exportUsersCsv(req, res) {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" }
    });

    const parser = new Parser({
      fields: ["id", "name", "email", "createdAt"]
    });

    const csv = parser.parse(users);

    res.header("Content-Type", "text/csv");
    res.attachment("users.csv");
    return res.send(csv);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Unable to export CSV" });
  }
}

