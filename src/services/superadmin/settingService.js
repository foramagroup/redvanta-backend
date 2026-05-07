// services/settingService.js
import prisma from "../../config/database.js";

let settingsCache = null;

const SettingService = {
  async getSettings() {
    if (!settingsCache) {
      settingsCache = await prisma.platformSetting.findFirst({
        select: {
          companyName: true,
          companyEmail: true,
          primaryColor: true,
        }
      });
    }
    return settingsCache;
  },

  async getCompanyName() {
    const settings = await this.getSettings();
    return settings?.companyName || "RedVanta Inc.";
  },

  async getPoweredBy() {
    const name = await this.getCompanyName();
    return `Powered by ${name}`;
  },

  flushCache() {
    settingsCache = null;
  }
};
export default SettingService;