import prisma from "../../config/database.js";

const serviceDefinitions = [
  { name: "API Gateway", latencyMs: 42, uptime: 99.98 },
  { name: "Webhook Processor", latencyMs: 128, uptime: 99.95 },
  { name: "SMS Gateway", latencyMs: 340, uptime: 99.8 },
  { name: "Database Cluster", latencyMs: 8, uptime: 99.99 },
  { name: "Background Jobs", latencyMs: null, uptime: 99.97 },
  { name: "CDN / Static Assets", latencyMs: 12, uptime: 100 },
];

const formatLatency = (latencyMs) => (latencyMs === null ? "--" : `${latencyMs}ms`);

const getServiceStatus = (uptime) => {
  if (uptime >= 99.9) return "Operational";
  if (uptime >= 99.5) return "Degraded";
  return "Down";
};

const getOverallStatus = (services) => {
  if (services.some((service) => service.status === "Down")) return "Down";
  if (services.some((service) => service.status === "Degraded")) return "Degraded";
  return "Operational";
};

export const getSystemStatus = async (req, res) => {
  try {
    const [pendingEmails, pendingWebhooks, failedWebhooks, recentWebhook] = await Promise.all([
      prisma.emailQueue.count({ where: { processed: false } }),
      prisma.webhooklog.count({ where: { status: "pending" } }),
      prisma.webhooklog.count({ where: { status: "failed" } }),
      prisma.webhook.findFirst({
        where: { lastTriggered: { not: null } },
        orderBy: { lastTriggered: "desc" },
        select: { lastTriggered: true },
      }),
    ]);

    const services = serviceDefinitions.map((service) => ({
      ...service,
      status: service.name === "Webhook Processor" && failedWebhooks > 0
        ? "Degraded"
        : getServiceStatus(service.uptime),
      latency: formatLatency(service.latencyMs),
    }));

    const latencyValues = services
      .map((service) => service.latencyMs)
      .filter((value) => typeof value === "number");
    const averageLatency = latencyValues.length
      ? `${Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length)}ms`
      : "--";

    const payload = {
      summary: {
        overall: getOverallStatus(services),
        averageLatency,
        queueDepth: pendingEmails + pendingWebhooks,
        activeWorkers: `${services.filter((service) => service.status !== "Down").length}/${services.length}`,
        lastTriggered: recentWebhook?.lastTriggered || null,
      },
      services: services.map(({ latencyMs, ...service }) => service),
    };

    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
