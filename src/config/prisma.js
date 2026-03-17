// backend/src/config/prisma.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: ["query", "error"],
});

export default prisma;
