// The Express application: middleware -> API routes -> static front end -> errors.
const express = require('express');
const config = require('./config');
const { headers } = require('./middleware/security');
const publicRoutes = require('./routes/public');
const { auth, admin } = require('./routes/admin');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Behind a hosting platform's proxy, trust its X-Forwarded-* headers so
  // req.secure and req.ip are correct.
  if (!config.https) app.set('trust proxy', 1);

  app.use(headers);
  app.use(express.json({ limit: '20kb' }));

  // API responses must never be cached by the browser.
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api/auth', auth);
  app.use('/api/admin', admin);
  app.use('/api', publicRoutes);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Unknown API route.' }));

  // The front end (presentation tier) is served as static files.
  app.use(express.static(config.frontendDir, { extensions: ['html'] }));
  app.use((req, res) => res.status(404).sendFile('404.html', { root: config.frontendDir }));

  // One place for every error, so details never leak to the browser.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(err);
    const message =
      err.type === 'entity.parse.failed' ? 'The request body is not valid JSON.'
      : status >= 500 ? 'Something went wrong on our side. Please try again.'
      : err.message;
    res.status(status).json({ error: message });
  });

  return app;
}

module.exports = { createApp };
