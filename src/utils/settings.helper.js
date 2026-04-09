import prisma from "../config/database.js";
// Cache
let cache = null;
let cacheTime = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Convertit une valeur selon son type
 */
function convert(value, type) {
  if (value === null || value === undefined) return null;
  switch (type) {
    case 'number':
      return parseFloat(value);
    case 'boolean':
      return value === 'true' || value === true;
    case 'json':
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    default:
      return value;
  }
}

/**
 * Récupère un paramètre par sa clé
 */
export async function getSetting(key, defaultValue = null) {
  try {
    const setting = await prisma.generalSetting.findUnique({
      where: { settingKey: key }
    });
    if (!setting) return defaultValue;
    return convert(setting.settingValue, setting.valueType);
  } catch (error) {
    console.error(`❌ Error getting setting ${key}:`, error);
    return defaultValue;
  }
}

/**
 * Récupère tous les paramètres (avec cache)
 */
export async function getAllSettings(useCache = true) {
  const now = Date.now();
  if (useCache && cache && (now - cacheTime < CACHE_TTL)) {
    return cache;
  }
  try {
    const settings = await prisma.generalSetting.findMany();
    const settingsObject = settings.reduce((acc, setting) => {
      acc[setting.settingKey] = convert(setting.settingValue, setting.valueType);
      return acc;
    }, {});
    cache = settingsObject;
    cacheTime = now;
    return settingsObject;
  } catch (error) {
    console.error('❌ Error getting all settings:', error);
    return {};
  }
}

/**
 * Récupère les paramètres par catégorie
 */
export async function getSettingsByCategory(category) {
  try {
    const settings = await prisma.generalSetting.findMany({
      where: { category }
    });
    return settings.reduce((acc, setting) => {
      acc[setting.settingKey] = convert(setting.settingValue, setting.valueType);
      return acc;
    }, {});
  } catch (error) {
    console.error(`❌ Error getting settings for category ${category}:`, error);
    return {};
  }
}

/**
 * Invalide le cache
 */
export function clearSettingsCache() {
  cache = null;
  cacheTime = null;
}

/**
 * Met à jour un paramètre
 */
export async function updateSetting(key, value) {
  try {
    const existing = await prisma.generalSetting.findUnique({
      where: { settingKey: key }
    });

    if (!existing) {
      throw new Error(`Setting ${key} not found`);
    }

    let finalValue = value;
    if (existing.valueType === 'boolean') {
      finalValue = value === true || value === 'true' ? 'true' : 'false';
    }

    await prisma.generalSetting.update({
      where: { settingKey: key },
      data: { settingValue: String(finalValue) }
    });

    clearSettingsCache();
    return true;
  } catch (error) {
    console.error(`❌ Error updating setting ${key}:`, error);
    return false;
  }
}

/**
 * Récupère les paramètres publics (optimisé avec cache)
 */
export async function getPublicSettings() {
  try {
    const settings = await prisma.generalSetting.findMany({
      where: { isPublic: true },
      select: {
        settingKey: true,
        settingValue: true,
        valueType: true
      }
    });
    return settings.reduce((acc, setting) => {
      acc[setting.settingKey] = convert(setting.settingValue, setting.valueType);
      return acc;
    }, {});
  } catch (error) {
    console.error('❌ Error getting public settings:', error);
    return {};
  }
}


// import { getSetting, getAllSettings } from '../utils/settings.helper.js';
// // Récupérer un paramètre
// const appName = await getSetting('app_name', 'Krootal Review');
// const maintenanceMode = await getSetting('maintenance_mode', false);

// // Récupérer tous les paramètres
// const settings = await getAllSettings();
// console.log(settings.app_name); // "Krootal Review"
// console.log(settings.primary_color); // "#E10600"