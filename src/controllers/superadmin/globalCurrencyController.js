import prisma from "../../config/database.js";

const parseId = (value) => Number.parseInt(value, 10);

export const getGlobalCurrencies = async (req, res) => {
  try {
    const page = parseId(req.query.page) || 1;
    const limit = parseId(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.globalCurrency.findMany({
        skip,
        take: limit,
        orderBy: { code: "asc" },
      }),
      prisma.globalCurrency.count(),
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

export const createGlobalCurrency = async (req, res) => {
  try {
    const { code, name, symbol, rate, gateway, position, status, isDefault } = req.body;

    if (isDefault) {
      await prisma.globalCurrency.updateMany({
        data: { isDefault: false },
      });
    }

    const currency = await prisma.globalCurrency.create({
      data: {
        code: code.toUpperCase(),
        name,
        symbol,
        rate: parseFloat(rate),
        gateway,
        symbolPosition: position,
        status: status || "Active",
        isDefault: Boolean(isDefault),
      },
    });

    res.json(currency);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateGlobalCurrency = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const { name, symbol, rate, gateway, position, status, isDefault } = req.body;

    if (isDefault) {
      await prisma.globalCurrency.updateMany({
        where: {
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    const currency = await prisma.globalCurrency.update({
      where: { id },
      data: {
        name,
        symbol,
        rate: parseFloat(rate),
        gateway,
        symbolPosition: position,
        status,
        isDefault: Boolean(isDefault),
      },
    });

    res.json(currency);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteGlobalCurrency = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    await prisma.globalCurrency.delete({
      where: { id },
    });

    res.json({ message: "Currency deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCurrencySettings = async (req, res) => {
  try {
    const settings = await prisma.globalCurrencySettings.findFirst();

    res.json(
      settings || {
        conversionMethod: "manual",
        rateProvider: "",
        apiKey: "",
        showSelector: true,
        showBoth: false,
        rounding: 2,
        lastRateUpdate: null,
      }
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateCurrencySettings = async (req, res) => {
  try {
    const {
      conversionMethod,
      rateProvider,
      apiKey,
      showSelector,
      showBoth,
      rounding,
    } = req.body;

    const existing = await prisma.globalCurrencySettings.findFirst();

    const settings = existing
      ? await prisma.globalCurrencySettings.update({
          where: { id: existing.id },
          data: {
            conversionMethod,
            rateProvider,
            apiKey,
            showSelector: Boolean(showSelector),
            showBoth: Boolean(showBoth),
            rounding: parseInt(rounding, 10),
            lastRateUpdate: conversionMethod === "online" ? new Date() : existing.lastRateUpdate,
          },
        })
      : await prisma.globalCurrencySettings.create({
          data: {
            conversionMethod,
            rateProvider,
            apiKey,
            showSelector: Boolean(showSelector),
            showBoth: Boolean(showBoth),
            rounding: parseInt(rounding, 10),
            lastRateUpdate: conversionMethod === "online" ? new Date() : null,
          },
        });

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
