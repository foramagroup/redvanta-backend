
import prisma from "../../config/database.js";

import crypto from "crypto";

export const getWebhooks = async (req, res) => {
    try {
        const webhooks = await prisma.webhook.findMany({
            orderBy: { createdAt: 'desc' }
        });

        // On calcule le successRate dynamiquement pour le front
        const formatted = webhooks.map(wh => {
            const total = wh.successCount + wh.failureCount;
            const successRate = total > 0 ? ((wh.successCount / total) * 100).toFixed(1) : 0;
            return {
                ...wh,
                successRate: parseFloat(successRate),
                lastTriggered: wh.lastTriggered ? wh.lastTriggered.toISOString().replace('T', ' ').substring(0, 16) : "Never"
            };
        });

        res.json(formatted);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const createWebhook = async (req, res) => {
    const { name, url, events, active, retryEnabled, maxRetries } = req.body;
    try {
        const webhook = await prisma.webhook.create({
            data: {
                name,
                url,
                events, 
                active,
                retryEnabled,
                maxRetries,
                secret: `whsec_${crypto.randomBytes(16).toString('hex')}`
            }
        });
        res.status(201).json(webhook);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const updateWebhook = async (req, res) => {
    const { id } = req.params;
    const { name, url, events, active, retryEnabled, maxRetries } = req.body;
    try {
        const webhook = await prisma.webhook.update({
            where: { id: parseInt(id) },
            data: { name, url, events, active, retryEnabled, maxRetries }
        });
        res.json(webhook);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const deleteWebhook = async (req, res) => {
    try {
        await prisma.webhook.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};