// src/services/statsService.js
import prisma from "../config/prisma.js";
import geoip from "geoip-lite";

export const getDashboardStats = async () => {
  const users = await db.user.count();
  const orders = await db.order.count();
  const revenue = await db.order.aggregate({
    _sum: { total: true }
  });

  return {
    users,
    orders,
    revenue: revenue._sum.total || 0
  };
};

export async function logScan(tagId, req) {
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
  const agent = req.headers['user-agent'] || null;
  const geo = geoip.lookup(ip) || {};
  const lat = (geo.ll && geo.ll[0]) || null;
  const lon = (geo.ll && geo.ll[1]) || null;
  const country = geo.country || null;
  const city = geo.city || null;

  return prisma.scanLog.create({
    data: { nfcTagId: tagId, ip, agent, lat, lon, country, city }
  });
}

export async function getScansSummary(tagId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - Number(days));
  const scans = await prisma.scanLog.findMany({
    where: { nfcTagId: tagId, at: { gte: since } },
    orderBy: { at: "asc" }
  });

  // aggregate per day
  const perDay = {};
  scans.forEach(s => {
    const day = s.at.toISOString().slice(0,10);
    perDay[day] = (perDay[day] || 0) + 1;
  });

  const byCountry = {};
  scans.forEach(s => {
    if (s.country) byCountry[s.country] = (byCountry[s.country] || 0) + 1;
  });

  const recent = scans.slice(-200).map(s => ({
    id: s.id, at: s.at, ip: s.ip, agent: s.agent, lat: s.lat, lon: s.lon, country: s.country, city: s.city
  }));

  const heat = scans.filter(s => s.lat && s.lon).map(s => ({ lat: s.lat, lon: s.lon, t: s.at }));

  return { total: scans.length, perDay, byCountry, recent, heat };
}

export async function getTopTagsByClicks(userId, limit = 10) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT t.id, t.qrCodeFile, COUNT(l.id) as clicks
    FROM NFCTag t LEFT JOIN ScanLog l ON t.id = l.nfcTagId
    WHERE t.userId = ?
    GROUP BY t.id
    ORDER BY clicks DESC
    LIMIT ?
  `, userId, limit);
  return rows;
}

export async function exportScansCsv(tagId) {
  const logs = await prisma.scanLog.findMany({ where: { nfcTagId: tagId }, orderBy: { at: "asc" }});
  // build CSV string
  const header = "id,at,ip,agent,country,city,lat,lon\n";
  const lines = logs.map(l => `${l.id},"${l.at.toISOString()}","${l.ip || ''}","${(l.agent || '').replace(/"/g,'""')}","${l.country || ''}","${l.city || ''}",${l.lat || ''},${l.lon || ''}`).join("\n");
  return header + lines;
}