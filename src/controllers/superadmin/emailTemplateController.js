import prisma from "../../config/database.js";

/**
 * GET: Récupère tous les templates formatés pour le front
 * On transforme les relations en objets subject: { fr: '...', en: '...' }
 */
export const getAllTemplates = async (req, res) => {
    try {
        const templates = await prisma.emailTemplate.findMany({
            include: {
                translations: {
                    include: { language: true }
                }
            }
        });

        // Formatage pour correspondre exactement à initialTemplates du front
        const formatted = templates.map(tpl => {
            const subject = {};
            const body = {};
            tpl.translations.forEach(tr => {
                subject[tr.language.code] = tr.subject;
                body[tr.language.code] = tr.body;
            });

            return {
                id: tpl.id,
                name: tpl.name,
                slug: tpl.slug,
                category: tpl.category,
                active: tpl.active,
                subject,
                body
            };
        });

        res.json(formatted);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


/**
 * PUT: Mise à jour explicite d'un template existant
 */
export const updateTemplate = async (req, res) => {
    const { id } = req.params;
    const { name, slug, category, active, subject, body } = req.body;

    try {
        const dbLanguages = await prisma.language.findMany();

        const result = await prisma.$transaction(async (tx) => {
            // 1. Mise à jour des infos de base du template
            const template = await tx.emailTemplate.update({
                where: { id: parseInt(id) },
                data: { name, slug, category, active },
            });

            // 2. Mise à jour ou création des traductions (Loop sur les langues envoyées)
            const translationTasks = Object.keys(body).map(langCode => {
                const lang = dbLanguages.find(l => l.code === langCode);
                if (!lang) return null;

                return tx.emailTemplateTranslation.upsert({
                    where: {
                        templateId_languageId: {
                            templateId: template.id,
                            languageId: lang.id
                        }
                    },
                    update: {
                        subject: subject[langCode] || "",
                        body: body[langCode] || ""
                    },
                    create: {
                        templateId: template.id,
                        languageId: lang.id,
                        subject: subject[langCode] || "",
                        body: body[langCode] || ""
                    }
                });
            });

            await Promise.all(translationTasks.filter(t => t !== null));

            return tx.emailTemplate.findUnique({
                where: { id: template.id },
                include: { translations: { include: { language: true } } }
            });
        });

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error("Update Template Error:", error);
        res.status(400).json({ success: false, message: "Erreur lors de la mise à jour" });
    }
};

/**
 * POST: Sauvegarde (Utilisé uniquement pour la CRÉATION maintenant)
 */
export const createTemplate = async (req, res) => {
    const { name, slug, category, active, subject, body } = req.body;

    try {
        const dbLanguages = await prisma.language.findMany();

        const result = await prisma.$transaction(async (tx) => {
            // Création simple
            const template = await tx.emailTemplate.create({
                data: { 
                    name, 
                    slug, 
                    category, 
                    active,
                    translations: {
                        create: Object.keys(body).map(langCode => {
                            const lang = dbLanguages.find(l => l.code === langCode);
                            return {
                                languageId: lang.id,
                                subject: subject[langCode] || "",
                                body: body[langCode] || ""
                            };
                        }).filter(t => t.languageId)
                    }
                },
                include: { translations: true }
            });

            return template;
        });

        res.status(201).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * DELETE: Suppression
 */
export const deleteTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.emailTemplate.delete({
            where: { id: parseInt(id) }
        });
        res.json({ success: true, message: "Template supprimé" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST: Dupliquer un template (Action "Duplicate" du menu)
 */
export const duplicateTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const original = await prisma.emailTemplate.findUnique({
            where: { id: parseInt(id) },
            include: { translations: true }
        });

        const copy = await prisma.$transaction(async (tx) => {
            const newTpl = await tx.emailTemplate.create({
                data: {
                    name: `${original.name} (Copy)`,
                    slug: `${original.slug}_copy_${Date.now()}`,
                    category: original.category,
                    active: false,
                    translations: {
                        create: original.translations.map(tr => ({
                            languageId: tr.languageId,
                            subject: tr.subject,
                            body: tr.body
                        }))
                    }
                }
            });
            return newTpl;
        });

        res.json({ success: true, data: copy });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};