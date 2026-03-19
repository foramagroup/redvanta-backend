import prisma from "../../config/database.js";

const parseId = (value) => Number.parseInt(value, 10);

export const getPaymentGateways = async (req, res) => {
  try {
    const gateways = await prisma.paymentGateway.findMany({
      orderBy: { provider: "asc" },
    });

    res.json(gateways);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createGateway = async (req, res) => {
  try {
    const {
      provider,
      apiKey,
      secretKey,
      webhookSecret,
      mode,
      isDefault,
      status,
      currencies,
      fees,
    } = req.body;

    if (isDefault) {
      await prisma.paymentGateway.updateMany({
        data: { isDefault: false },
      });
    }

    const gateway = await prisma.paymentGateway.create({
      data: {
        provider,
        apiKey,
        secretKey,
        webhookSecret,
        mode,
        isDefault: Boolean(isDefault),
        status: status || "Active",
        currencies: currencies || "all",
        fees: fees || null,
      },
    });

    res.json(gateway);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateGateway = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const { isDefault, ...rest } = req.body;

    if (isDefault) {
      await prisma.paymentGateway.updateMany({
        where: {
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    const gateway = await prisma.paymentGateway.update({
      where: { id },
      data: {
        ...rest,
        isDefault: Boolean(isDefault),
      },
    });

    res.json(gateway);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteGateway = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    await prisma.paymentGateway.delete({
      where: { id },
    });

    res.json({ message: "Gateway deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getManualMethods = async (req, res) => {
  try {
    const methods = await prisma.manualPaymentMethod.findMany({
      orderBy: { name: "asc" },
    });

    res.json(methods);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createManualMethod = async (req, res) => {
  try {
    const { name, instructions, verificationRequired, supportedCurrencies, status } = req.body;

    const method = await prisma.manualPaymentMethod.create({
      data: {
        name,
        instructions,
        verificationRequired: Boolean(verificationRequired),
        supportedCurrencies: supportedCurrencies || "all",
        status: status || "Active",
      },
    });

    res.json(method);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateManualMethod = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const { name, instructions, verificationRequired, supportedCurrencies, status } = req.body;

    const method = await prisma.manualPaymentMethod.update({
      where: { id },
      data: {
        name,
        instructions,
        verificationRequired: Boolean(verificationRequired),
        supportedCurrencies: supportedCurrencies || "all",
        status,
      },
    });

    res.json(method);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteManualMethod = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    await prisma.manualPaymentMethod.delete({
      where: { id },
    });

    res.json({ message: "Manual method deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPaymentSettings = async (req, res) => {
  try {
    const settings = await prisma.paymentSettings.findFirst();

    res.json(
      settings || {
        allowMultiple: true,
        autoRetry: true,
        timeout: 300,
        autoInvoices: true,
        receiptEmails: true,
        invoicePrefix: "INV-",
      }
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updatePaymentSettings = async (req, res) => {
  try {
    const existing = await prisma.paymentSettings.findFirst();

    const data = {
      allowMultiple: Boolean(req.body.allowMultiple),
      autoRetry: Boolean(req.body.autoRetry),
      timeout: Number(req.body.timeout),
      autoInvoices: Boolean(req.body.autoInvoices),
      receiptEmails: Boolean(req.body.receiptEmails),
      invoicePrefix: req.body.invoicePrefix || "INV-",
    };

    const settings = existing
      ? await prisma.paymentSettings.update({
          where: { id: existing.id },
          data,
        })
      : await prisma.paymentSettings.create({
          data,
        });

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
