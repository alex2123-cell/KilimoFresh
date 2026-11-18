// Sign-in and the cooperative admin API (orders inbox + catalog management).
const express = require('express');
const config = require('../config');
const store = require('../services/store');
const validate = require('../services/validators');
const users = require('../services/users');
const jwt = require('../pki/jwt');
const { rateLimit, currentUser, requireAdmin } = require('../middleware/security');

const auth = express.Router();
const admin = express.Router();

const ORDER_STATUSES = ['new', 'confirmed', 'delivered', 'cancelled'];
const newestFirst = (rows) => [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

// ---- Authentication ---------------------------------------------------------
auth.post('/login', rateLimit({ name: 'login', max: 8, windowMs: 15 * 60 * 1000 }), async (req, res) => {
  const user = await users.authenticate(req.body.email, req.body.password);
  if (!user) return res.status(401).json({ error: 'Wrong email or password.' });

  const token = jwt.issue({ sub: user.email, role: user.role }, config.sessionHours);
  // HttpOnly: page scripts cannot read the token. SameSite=Strict: other
  // sites cannot send it. Secure: only ever sent over HTTPS.
  res.cookie(config.sessionCookie, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: req.secure,
    maxAge: config.sessionHours * 3600 * 1000,
    path: '/',
  });
  res.json({ user });
});

auth.post('/logout', (req, res) => {
  res.clearCookie(config.sessionCookie, { path: '/' });
  res.json({ ok: true });
});

auth.get('/me', (req, res) => res.json({ user: currentUser(req) }));

// ---- Admin (every route below needs a valid session) ------------------------
admin.use(requireAdmin);

admin.get('/summary', async (req, res) => {
  const [orders, growers, messages, produce] = await Promise.all([
    store.requisitions.all(),
    store.growers.all(),
    store.messages.all(),
    store.produce.all(),
  ]);
  res.json({
    newOrders: orders.filter((o) => o.status === 'new').length,
    orders: orders.length,
    orderValue: orders.filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + o.receipt.total, 0),
    growers: growers.length,
    messages: messages.length,
    listings: produce.length,
  });
});

admin.get('/requisitions', async (req, res) => res.json({ items: newestFirst(await store.requisitions.all()) }));

admin.patch('/requisitions/:ref', async (req, res) => {
  if (!ORDER_STATUSES.includes(req.body.status)) {
    return res.status(422).json({ error: 'Unknown status.' });
  }
  const order = await store.requisitions.update(req.params.ref, { status: req.body.status });
  if (!order) return res.status(404).json({ error: 'Requisition not found.' });
  res.json(order);
});

admin.get('/growers', async (req, res) => res.json({ items: newestFirst(await store.growers.all()) }));
admin.get('/messages', async (req, res) => res.json({ items: newestFirst(await store.messages.all()) }));

// Process 1.0 - publish the harvest catalog.
admin.post('/produce', async (req, res) => {
  const checked = validate.listing(req.body);
  if (!checked.ok) return res.status(422).json({ error: 'Please correct the highlighted fields.', fields: checked.errors });
  res.status(201).json(await store.produce.insert(checked.value));
});

admin.put('/produce/:id', async (req, res) => {
  const checked = validate.listing({ ...req.body, id: req.params.id });
  if (!checked.ok) return res.status(422).json({ error: 'Please correct the highlighted fields.', fields: checked.errors });
  const item = await store.produce.update(checked.value.id, checked.value);
  if (!item) return res.status(404).json({ error: 'Listing not found.' });
  res.json(item);
});

admin.delete('/produce/:id', async (req, res) => {
  const removed = await store.produce.remove(req.params.id.toUpperCase());
  if (!removed) return res.status(404).json({ error: 'Listing not found.' });
  res.status(204).end();
});

module.exports = { auth, admin };
