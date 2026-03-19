import crypto from "crypto";
import prisma from "../../config/database.js";

const SETTINGS_MODULE = "email_server_config";
const defaultSettings = {
  failoverEnabled: true,
  failoverServer: "",
  retryAttempts: 3,
  maxPerMinute: 100,
  maxPerDay: 5000,
  globalDailyLimit: 100000,
};

const parseJson = (raw, fallback = {}) => {
  if (!raw) return fallback;

  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const formatServer = (server) => ({
  id: server.id,
  name: server.name,
  value: server.value,
  sid: server.sid,
  region: server.region || "Global",
  status: server.status,
  isDefault: Boolean(server.isDefault),
  config: parseJson(server.config),
});

const getStore = async () => {
  const [servers, settingsRecord] = await Promise.all([
    prisma.emailServerConfig.findMany({
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }),
    prisma.superAdminSetting.findUnique({
      where: { module: SETTINGS_MODULE },
    }),
  ]);

  return {
    servers: servers.map(formatServer),
    settings: settingsRecord ? { ...defaultSettings, ...parseJson(settingsRecord.settings, defaultSettings) } : defaultSettings,
  };
};

const upsertModuleSettings = async (settings) => prisma.superAdminSetting.upsert({
  where: { module: SETTINGS_MODULE },
  update: {
    settings: JSON.stringify(settings),
  },
  create: {
    module: SETTINGS_MODULE,
    settings: JSON.stringify(settings),
  },
});

const normalizeServer = (server) => ({
  id: server.id || crypto.randomUUID(),
  value: server.value || "smtp",
  name: server.name || "SMTP",
  status: server.status || "Active",
  sid: server.sid || (String(server.value || "").includes("api") ? "API" : "SMTP"),
  region: server.region || "Global",
  isDefault: Boolean(server.isDefault),
  config: server.config && typeof server.config === "object" ? server.config : {},
});

export const getEmailServerConfig = async (req, res) => {
  try {
    const { servers, settings } = await getStore();
    res.json({ servers, settings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createEmailServer = async (req, res) => {
  try {
    const { servers: currentServers, settings } = await getStore();
    const nextServer = normalizeServer(req.body);

    await prisma.$transaction(async (tx) => {
      if (nextServer.isDefault) {
        await tx.emailServerConfig.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      await tx.emailServerConfig.create({
        data: {
          id: nextServer.id,
          name: nextServer.name,
          value: nextServer.value,
          sid: nextServer.sid,
          region: nextServer.region,
          status: nextServer.status,
          isDefault: nextServer.isDefault,
          config: JSON.stringify(nextServer.config || {}),
        },
      });
    });

    if (!settings.failoverServer) {
      await upsertModuleSettings({
        ...settings,
        failoverServer: nextServer.value,
      });
    }

    res.status(201).json(nextServer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateEmailServer = async (req, res) => {
  try {
    const { servers: currentServers, settings } = await getStore();
    const currentServer = currentServers.find((server) => server.id === req.params.id);

    if (!currentServer) {
      return res.status(404).json({ message: "Email server not found" });
    }

    const updatedServer = normalizeServer({
      ...currentServer,
      ...req.body,
      id: currentServer.id,
    });

    await prisma.$transaction(async (tx) => {
      if (updatedServer.isDefault) {
        await tx.emailServerConfig.updateMany({
          where: { isDefault: true, NOT: { id: currentServer.id } },
          data: { isDefault: false },
        });
      }

      await tx.emailServerConfig.update({
        where: { id: currentServer.id },
        data: {
          name: updatedServer.name,
          value: updatedServer.value,
          sid: updatedServer.sid,
          region: updatedServer.region,
          status: updatedServer.status,
          isDefault: updatedServer.isDefault,
          config: JSON.stringify(updatedServer.config || {}),
        },
      });
    });

    if (!settings.failoverServer) {
      await upsertModuleSettings({
        ...settings,
        failoverServer: updatedServer.value,
      });
    }

    res.json(updatedServer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteEmailServer = async (req, res) => {
  try {
    const { servers: currentServers, settings } = await getStore();
    const existing = currentServers.find((server) => server.id === req.params.id);

    if (!existing) {
      return res.status(404).json({ message: "Email server not found" });
    }

    await prisma.emailServerConfig.delete({
      where: { id: req.params.id },
    });

    const remainingServers = await prisma.emailServerConfig.findMany({
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    if (remainingServers.length > 0 && !remainingServers.some((server) => server.isDefault)) {
      await prisma.emailServerConfig.update({
        where: { id: remainingServers[0].id },
        data: { isDefault: true },
      });
    }

    const refreshedServers = await prisma.emailServerConfig.findMany({
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    const normalizedServers = refreshedServers.map(formatServer);

    await upsertModuleSettings({
      ...settings,
      failoverServer: normalizedServers.some((server) => server.value === settings.failoverServer)
        ? settings.failoverServer
        : normalizedServers[0]?.value || "",
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateEmailServerSettings = async (req, res) => {
  try {
    const nextSettings = {
      ...defaultSettings,
      ...req.body,
    };

    await upsertModuleSettings(nextSettings);

    res.json(nextSettings);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
