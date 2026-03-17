/**
 * config/db.js
 * Connexion MySQL/MariaDB via mysql2 (Promise)
 */
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

console.log("Initialisation MySQL...");

function getMysqlConfig() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    try {
      const url = new URL(databaseUrl);
      if (url.protocol !== "mysql:") {
        throw new Error("DATABASE_URL must use mysql:// protocol");
      }

      return {
        host: url.hostname || "localhost",
        user: decodeURIComponent(url.username || "root"),
        password: decodeURIComponent(url.password || ""),
        database: (url.pathname || "/krootal").replace(/^\//, "") || "krootal",
        port: url.port ? Number(url.port) : 3306,
      };
    } catch (error) {
      console.error("Invalid DATABASE_URL, fallback to DB_* variables:", error.message);
    }
  }

  return {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "krootal",
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  };
}

const mysqlConfig = getMysqlConfig();

const pool = mysql.createPool({
  ...mysqlConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
});

// Verification auto au lancement
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log("MySQL connection established");
    conn.release();
  } catch (err) {
    console.error("MYSQL ERROR:", err);
  }
})();

export default pool;
