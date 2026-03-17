import * as service from "../services/productsService.js";

export async function list(req, res) {
  try {
    const { page = 1, limit = 20, search = "" } = req.query;
    const data = await service.list({ page, limit, search });
    res.json(data);
  } catch (err) {
    console.error("products.list", err);
    res.status(500).json({ error: "Unable to load products" });
  }
}

export async function get(req, res) {
  try {
    const product = await service.get(req.params.id);
    res.json(product);
  } catch (err) {
    res.status(404).json({ error: "Product not found" });
  }
}

export async function create(req, res) {
  try {
    const product = await service.create(req.body, req.file);
    res.json(product);
  } catch (err) {
    console.error("products.create", err);
    res.status(500).json({ error: "Creation failed" });
  }
}

export async function update(req, res) {
  try {
    const product = await service.update(req.params.id, req.body, req.file);
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: "Update failed" });
  }
}

export async function remove(req, res) {
  try {
    await service.remove(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
}

export async function syncStripePrice(req, res) {
  try {
    const product = await service.syncStripe(req.params.id);
    res.json(product);
  } catch (err) {
    console.error("stripe.sync", err);
    res.status(500).json({ error: "Stripe sync failed" });
  }
}
