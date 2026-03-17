// src/services/userService.js
import db from "../config/db.js";

export const getUserById = (id) =>
  db.user.findUnique({ where: { id } });

export const updateUserProfile = (id, data) =>
  db.user.update({ where: { id }, data });
