const express = require('express');
const path = require('path');
const expressLoader = require('./express');
const passportLoader = require('./passport');

async function init() {
  const app = express();

  await expressLoader(app);
  await passportLoader();

  const uploadsDir = path.join(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadsDir));

  const routes = require('../routes');
  app.use('/api', routes);

  return app;
}

module.exports = { init };
