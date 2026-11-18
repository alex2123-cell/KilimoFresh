// Public REST API - everything a buyer or grower needs. No sign-in.
const express = require('express');
const config = require('../config');
const store = require('../services/store');
const validate = require('../services/validators');
const { estimate, reference } = require('../services/estimate');
const keys = require('../pki/keys');
const { rateLimit } = require('../middleware/security');

const router = express.Router();
const formLimit = rateLimit({ name: 'forms', max: 20, windowMs: 15 * 60 * 1000 });

const invalid = (res, errors) =>
  res.status(422).json({ error: 'Please correct the highlighted fields.', fields: errors });

router.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ---- 1.0 / 2.0  Harvest catalog, search and filter -------------------------
router.get('/produce', async (req, res) => {
  const q = validate.text(req.query.q).toLowerCase();
  const category = validate.text(req.query.category);
  const location = validate.text(req.query.location);
  const maxPrice = Number(req.query.maxPrice) || Infinity;
  const inStock = req.query.inStock === 'true';

  const items = (await store.produce.all()).filter(
    (item) =>
      (!q || `${item.crop} ${item.variety} ${item.id} ${item.location}`.toLowerCase().includes(q)) &&
      (!category || item.category === category) &&
      (!location || item.location === location) &&
      item.price <= maxPrice &&
      (!inStock || item.status !== 'sold-out'),
  );
  res.json({ count: items.length, items });
});

router.get('/produce/:id', async (req, res) => {
  const item = await store.produce.find(req.params.id.toUpperCase());
  if (!item) return res.status(404).json({ error: 'Listing not found.' });
  res.json(item);
});

router.get('/zones', async (req, res) => res.json({ items: await store.zones.all() }));

// Figures for the Home page.
router.get('/stats', async (req, res) => {
  const items = await store.produce.all();
  res.json({
    listings: items.filter((i) => i.status !== 'sold-out').length,
    locations: new Set(items.map((i) => i.location)).size,
    cooperatives: new Set(items.map((i) => i.cooperative).filter(Boolean)).size,
    zones: (await store.zones.all()).length,
  });
});

// ---- 3.0  Cost estimate -----------------------------------------------------
router.post('/estimate', async (req, res) => {
  const item = await store.produce.find(String(req.body.produceId || '').toUpperCase());
  if (!item) return res.status(404).json({ error: 'Listing not found.' });
  const zone = await store.zones.find(String(req.body.zone || ''));
  res.json(estimate(item, zone, Number(req.body.quantity)));
});

// ---- 4.0  Validate and submit requisition ----------------------------------
router.post('/requisitions', formLimit, async (req, res) => {
  const item = await store.produce.find(String(req.body.produceId || '').toUpperCase());
  const zone = await store.zones.find(String(req.body.zone || ''));
  const checked = validate.requisition(req.body, { item, zone });
  if (!checked.ok) return invalid(res, checked.errors);

  const order = checked.value;
  const cost = estimate(item, zone, order.quantity);
  const issuedAt = new Date().toISOString();
  const ref = reference('KF', validate.today());

  // The receipt holds the order facts but no phone number or email, so it is
  // safe to show to anyone who has the reference number.
  const receipt = {
    ref,
    issuedAt,
    issuer: config.organisation,
    organisation: order.organisation,
    produceId: item.id,
    crop: item.crop,
    grade: item.grade,
    unit: item.unit,
    quantity: order.quantity,
    unitPrice: item.price,
    subtotal: cost.subtotal,
    zone: zone.name,
    deliveryFee: cost.deliveryFee,
    total: cost.total,
    deliveryDate: order.deliveryDate,
  };
  // PKI: sign the exact text of the receipt with the signing private key.
  const canonical = JSON.stringify(receipt);
  const signature = keys.sign(canonical);

  await store.requisitions.insert({
    ref,
    status: 'new',
    createdAt: issuedAt,
    ...order,
    produceId: item.id,
    zone: zone.id,
    consentAt: issuedAt,
    receipt,
    canonical,
    signature,
  });

  res.status(201).json({ ref, receipt, canonical, signature });
});

// Anyone holding a reference number can fetch the signed receipt and check it.
router.get('/requisitions/:ref/receipt', async (req, res) => {
  const order = await store.requisitions.find(req.params.ref.toUpperCase());
  if (!order) return res.status(404).json({ error: 'No requisition with that reference number.' });
  res.json({
    ref: order.ref,
    status: order.status,
    receipt: order.receipt,
    canonical: order.canonical,
    signature: order.signature,
  });
});

// ---- 5.0  Register grower partner ------------------------------------------
router.post('/growers', formLimit, async (req, res) => {
  const checked = validate.grower(req.body);
  if (!checked.ok) return invalid(res, checked.errors);
  const now = new Date().toISOString();
  const ref = reference('KG', validate.today());
  await store.growers.insert({ ref, status: 'new', createdAt: now, consentAt: now, ...checked.value });
  res.status(201).json({ ref });
});

// ---- Contact form -----------------------------------------------------------
router.post('/contact', formLimit, async (req, res) => {
  const checked = validate.message(req.body);
  if (!checked.ok) return invalid(res, checked.errors);
  const now = new Date().toISOString();
  const ref = reference('KM', validate.today());
  await store.messages.insert({ ref, status: 'new', createdAt: now, consentAt: now, ...checked.value });
  res.status(201).json({ ref });
});

// ---- PKI: certificate chain and public key ----------------------------------
router.get('/pki/certificate', (req, res) => res.json(keys.describe()));

router.get('/pki/ca.crt', (req, res) => {
  res.set('Content-Type', 'application/x-x509-ca-cert');
  res.set('Content-Disposition', 'attachment; filename="kilimofresh-root-ca.crt"');
  res.send(keys.load().caPem);
});

module.exports = router;
