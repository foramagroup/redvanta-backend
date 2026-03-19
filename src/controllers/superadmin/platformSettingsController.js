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
            platform_name,
            default_email_sender,
            sms_setting_id,
            rate_limit,
            is_maintenance
        } = req.body;
        const data = {
            platform_name,
            default_email_sender,
            rate_limit,
            is_maIntenance: Boolean(is_maintenance),
            smsSetting: sms_setting_id
                ? { connect: { id: Number(sms_setting_id) } }
                : { disconnect: true }
        };

        const existing = await prisma.platformSetting.findFirst();

        let settings;

        if (existing) {

            settings = await prisma.platformSetting.update({
                where: { id: existing.id },
                data
            });

        } else {

            settings = await prisma.platformSetting.create({
                data
            });
        }


        res.json({
            message: "Platform settings updated",
            data: settings
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

