// backend/src/controllers/dashboardUsersController.js
import prisma from "../config/prisma.js";
import { v4 as uuidv4 } from "uuid";
import { parse } from "json2csv";
import { sendInvitationEmail } from "../config/mailer.js";
import bcrypt from "bcryptjs";

/**
 * GET /api/dashboard/users
 * Query params:
 *  - page (default 1)
 *  - limit (default 20)
 *  - q (search across name/email)
 */
export async function listUsers(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(5, parseInt(req.query.limit || "20", 10));
    const q = (req.query.q || "").trim();

    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      ok: true,
      data: items,
      meta: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    console.error("listUsers error", err);
    res.status(500).json({ ok: false, error: "Unable to load users" });
  }
}

export async function getUser(req, res) {
  try {
    const id = req.params.id;
    const u = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, phone: true, createdAt: true },
    });
    if (!u) return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, data: u });
  } catch (err) {
    console.error("getUser", err);
    res.status(500).json({ ok: false, error: "Unable to fetch user" });
  }
}

export async function createUser(req, res) {
  try {
    const { name, email, password, role = "user", phone } = req.body;
    if (!email || !password) return res.status(400).json({ ok: false, error: "email & password required" });

    const hashed = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: { id: uuidv4(), name, email, password: hashed, role, phone },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    res.status(201).json({ ok: true, data: newUser });
  } catch (err) {
    console.error("createUser", err);
    res.status(500).json({ ok: false, error: "Unable to create user" });
  }
}

export async function updateUser(req, res) {
  try {
    const id = req.params.id;
    const payload = { ...req.body };
    if (payload.password) {
      payload.password = await bcrypt.hash(payload.password, 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: payload,
      select: { id: true, name: true, email: true, role: true, phone: true, updatedAt: true },
    });

    res.json({ ok: true, data: updated });
  } catch (err) {
    console.error("updateUser", err);
    res.status(500).json({ ok: false, error: "Unable to update user" });
  }
}

export async function deleteUser(req, res) {
  try {
    const id = req.params.id;
    await prisma.user.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    console.error("deleteUser", err);
    res.status(500).json({ ok: false, error: "Unable to delete user" });
  }
}

/* =========================
   Export CSV endpoint
   GET /api/dashboard/users/export? q=&limit=
   - returns CSV
   ========================= */
export async function exportUsersCsv(req, res) {
  try {
    const q = (req.query.q || "").trim();
    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {};

    // fetch all matching users (beware large sets in production)
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    const fields = ["id", "name", "email", "role", "createdAt"];
    const csv = parse(users, { fields });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="users_export_${Date.now()}.csv"`);
    res.status(200).send(csv);
  } catch (err) {
    console.error("exportUsersCsv", err);
    res.status(500).json({ ok: false, error: "Unable to export CSV" });
  }
}

/* =========================
   Invite user route
   POST /api/dashboard/users/invite
   body: { email, name, role }
   -> creates invite token, email with link
   ========================= */
export async function inviteUser(req, res) {
  try {
    const { email, name = "", role = "user" } = req.body;
    if (!email) return res.status(400).json({ ok: false, error: "Email required" });

    // create an invite record (optional) or reuse a token
    const token = uuidv4();

    // store in DB (table Invite) optional - here we store minimal in Setting table for demo
    // better: create Invite model in Prisma with token, email, expiresAt

    // send invitation email (mailer must be configured)
    const frontendBase = process.env.FRONT_URL || "http://localhost:3000";
    const link = `${frontendBase}/onboard/invite?token=${token}&email=${encodeURIComponent(email)}`;

    await sendInvitationEmail({
      to: email,
      subject: `Invitation à rejoindre Krootal Review`,
      html: `<p>Bonjour ${name || ""},</p>
             <p>Tu as été invité(e) à rejoindre Krootal Review. Clique sur ce lien pour créer ton compte :</p>
             <p><a href="${link}">${link}</a></p>
             <p>Si tu n'as pas demandé cette invitation, ignore ce message.</p>`,
    });

    // optional: save invite token
    await prisma.invite.create?.({
      data: { id: uuidv4(), email, token, role, createdAt: new Date() }
    }).catch(() => { /* ignore if table not exist */ });

    res.json({ ok: true, invited: true });
  } catch (err) {
    console.error("inviteUser", err);
    res.status(500).json({ ok: false, error: "Unable to send invite" });
  }
}
