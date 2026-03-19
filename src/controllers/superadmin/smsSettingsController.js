import prisma from '../../config/database.js';

const SETTINGS_MODULE = "sms_api_settings";
const defaultSettings = {
    enableFailover: false,
    failoverProviderId: "",
    retryAttempts: 3,
    maxPerMinute: 100,
    maxPerDay: 5000,
    globalDailyLimit: 100000,
};

const parseSettings = (raw) => {
    if (!raw) return defaultSettings;

    try {
        return {
            ...defaultSettings,
            ...JSON.parse(raw),
        };
    } catch {
        return defaultSettings;
    }
};

const saveSettings = async (settings) => prisma.superAdminSetting.upsert({
    where: { module: SETTINGS_MODULE },
    update: {
        settings: JSON.stringify(settings),
    },
    create: {
        module: SETTINGS_MODULE,
        settings: JSON.stringify(settings),
    },
});


const list = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const [data, total, suppliers, regions, settingsRecord] = await Promise.all([
            prisma.smsSetting.findMany({
                skip,
                take: limit,
                include: {
                    supplier: true,
                    region: true
                },
                orderBy: {
                    createdAt: 'desc'
                }
            }),
            prisma.smsSetting.count(),
            prisma.smsSupplier.findMany({ select: { id: true, name: true } }),
            prisma.smsRegion.findMany({ select: { id: true, name: true } }),
            prisma.superAdminSetting.findUnique({
                where: { module: SETTINGS_MODULE }
            })
        ]);

        res.json({
            data,
            settings: parseSettings(settingsRecord?.settings),
            meta: {
                total,
                page,
                last_page: Math.ceil(total / limit)
            },
            options: {
                suppliers,
                regions
            }
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateGlobalSettings = async (req, res) => {
    try {
        const nextSettings = {
            ...defaultSettings,
            ...req.body,
        };

        await saveSettings(nextSettings);

        res.json({
            message: "SMS global settings updated",
            data: nextSettings,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};



 const create = async (req, res) => {
    // console.log(req.body)
    // process.exit()
    try {
        const {
            supplier_id,
            region_id,
            api_key,
            auth_token,
            phone_number,
            set_default,
            status
        } = req.body;

        // si default = true on reset les autres
        if (set_default) {
            await prisma.smsSetting.updateMany({
                data: { set_default: false }
            });
        }

        const smsSetting = await prisma.smsSetting.create({
            data: {
                supplier_id,
                region_id,
                api_key,
                auth_token,
                phone_number,
                set_default,
                status
            }
        });

        res.status(201).json({
            message: "SMS setting created",
            data: smsSetting
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};




const update = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const {
            supplier_id,
            region_id,
            api_key,
            auth_token,
            phone_number,
            set_default,
            status
        } = req.body;

        if (set_default) {
            await prisma.smsSetting.updateMany({
                data: { set_default: false }
            });
        }

        const smsSetting = await prisma.smsSetting.update({
            where: { id },
            data: {
                supplier_id,
                region_id,
                api_key,
                auth_token,
                phone_number,
                set_default,
                status
            }
        });
        res.json({
            message: "SMS setting updated",
            data: smsSetting
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};




const deleteSetting  = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await prisma.smsSetting.delete({
            where: { id }
        });
        res.json({
            message: "SMS setting deleted"
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export default {
  list,
  create,
  update,
  deleteSetting,
  updateGlobalSettings
};

