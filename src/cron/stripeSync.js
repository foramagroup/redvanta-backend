import cron from "node-cron";
import * as service from "../services/productsService.js";

cron.schedule("0 3 * * *", async () => {
  console.log("Syncing Stripe prices...");
  // boucle sur tous les produits si nécessaire
});
