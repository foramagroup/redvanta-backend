import prisma from "../../config/database.js";

export const getSettings = async (req, res) => {
    try {
        const platformSetting = await prisma.platformSetting.findFirst({
            include: {
                smsSetting: true
            }
        });
        const smsSettings = await prisma.smsSetting.findMany({
            include: { supplier: true, region: true }, 
            orderBy: { createdAt: 'desc' }
        });
        res.json({
            platformSetting,
            smsSettings
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateSettings = async (req, res) => {
    try {
        const {
            companyName,
            default_email_sender,
            sms_setting_id,
            rate_limit,
            is_maintenance
        } = req.body;

        const existing = await prisma.platformSetting.findFirst();
        let smsRelation = {};
        if (sms_setting_id) {
            smsRelation = { connect: { id: Number(sms_setting_id) } };
        } else if (existing) {
            smsRelation = { disconnect: true };
        }
        const baseData = {
            companyName,
            default_email_sender,
            rate_limit: Number(rate_limit),
            is_maIntenance: Boolean(is_maintenance), 
        };
        let settings;
        if (existing) {
            settings = await prisma.platformSetting.update({
                where: { id: existing.id },
                data: {
                    ...baseData,
                    smsSetting: smsRelation
                }
            });
        } else {
            settings = await prisma.platformSetting.create({
                data: {
                    ...baseData,
                    ...(sms_setting_id && { smsSetting: { connect: { id: Number(sms_setting_id) } } })
                }
            });
        }
        res.json({
            message: "Paramètres de la plateforme mis à jour avec succès",
            data: settings
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
