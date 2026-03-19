import prisma from "../../config/database.js";

const parseId = (value) => Number.parseInt(value, 10);

export const getLanguages = async (req, res) => {
  try {
    const page = parseId(req.query.page) || 1;
    const limit = parseId(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [languages, total, totalKeys] = await Promise.all([
      prisma.language.findMany({
        orderBy: { name: "asc" },
        skip,
        take: limit,
        include: {
          translations: {
            select: {
              keyId: true,
            },
          },
        },
      }),
      prisma.language.count(),
      prisma.translationKey.count(),
    ]);

    const data = languages.map((language) => {
      const translatedKeys = new Set(language.translations.map((translation) => translation.keyId)).size;
      const completion = totalKeys > 0 ? Math.round((translatedKeys / totalKeys) * 100) : 0;

      return {
        ...language,
        completion,
      };
    });

    res.json({
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createLanguage = async (req, res) => {
  try {
    const { code, name, native, flag, rtl, status, isDefault } = req.body;

    if (isDefault) {
      await prisma.language.updateMany({
        data: { isDefault: false },
      });
    }

    const language = await prisma.language.create({
      data: {
        code,
        name,
        native,
        flag,
        rtl: Boolean(rtl),
        status,
        isDefault: Boolean(isDefault),
      },
    });

    res.json(language);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateLanguage = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const { name, native, flag, rtl, status, isDefault } = req.body;

    if (isDefault) {
      await prisma.language.updateMany({
        where: {
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    const language = await prisma.language.update({
      where: { id },
      data: {
        name,
        native,
        flag,
        rtl: Boolean(rtl),
        status,
        isDefault: Boolean(isDefault),
      },
    });

    res.json(language);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteLanguage = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    await prisma.language.delete({
      where: { id },
    });

    res.json({ message: "Language deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getTranslations = async (req, res) => {
  try {
    const page = parseId(req.query.page) || 1;
    const limit = parseId(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.translationKey.findMany({
        skip,
        take: limit,
        include: {
          translations: {
            include: {
              language: true,
            },
          },
        },
        orderBy: {
          key: "asc",
        },
      }),
      prisma.translationKey.count(),
    ]);

    res.json({
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createKey = async (req, res) => {
  try {
    const { key, translations } = req.body;

    const newKey = await prisma.translationKey.create({
      data: { key },
    });

    if (translations) {
      const languages = await prisma.language.findMany();

      for (const language of languages) {
        if (translations[language.code]) {
          await prisma.translation.create({
            data: {
              keyId: newKey.id,
              languageId: language.id,
              value: translations[language.code],
            },
          });
        }
      }
    }

    res.json({ message: "Key created" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateTranslation = async (req, res) => {
  try {
    const { keyId, languageId, value } = req.body;

    await prisma.translation.upsert({
      where: {
        keyId_languageId: {
          keyId,
          languageId,
        },
      },
      update: { value },
      create: {
        keyId,
        languageId,
        value,
      },
    });

    res.json({ message: "Translation updated" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteKey = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    await prisma.translationKey.delete({
      where: { id },
    });

    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
