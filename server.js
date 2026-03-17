import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./src/app.js";
import "./src/config/cron.js"; // jobs automatiques

const server = http.createServer(app);

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`🔥 Krootal Backend running on http://localhost:${PORT}`);
});
