require('dotenv').config({ quiet: true });

const express = require('express');
const path = require('path');

const { loadSecrets } = require('./server/utils/secrets');

async function startServer(retryCount = 0) {
  try {
    await loadSecrets();

    const db = require('./server/db');
    await db.initialize();

    const { initializeFirebase } = require('./server/config/firebase');
    initializeFirebase();

    const loaders = require('./server/loaders');
    const app = await loaders.init();

    const PORT = process.env.PORT || 8080;

    if (process.env.NODE_ENV === 'production') {
      const buildPath = path.join(__dirname, 'build');
      const staticPath = path.join('build', 'static');

      app.use(
        express.static(buildPath, {
          setHeaders: (res, filePath) => {
            if (path.basename(filePath) === 'index.html') {
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
              res.setHeader('Pragma', 'no-cache');
              res.setHeader('Expires', '0');
              return;
            }
            if (filePath.includes(staticPath)) {
              res.setHeader('Cache-Control', 'max-age=31536000, immutable');
              return;
            }
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
          },
        })
      );

      app.get('*', (req, res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(path.join(buildPath, 'index.html'));
      });
    }

    const server = app.listen(PORT, () => {
      console.log(`[Server] Listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
    });

    const gracefulShutdown = async (signal) => {
      console.log(`[Server] Received ${signal}, shutting down gracefully...`);
      server.close(async () => {
        try {
          await db.close();
          process.exit(0);
        } catch (error) {
          console.error('[Server] Error during graceful shutdown:', error);
          process.exit(1);
        }
      });

      setTimeout(() => {
        console.error('[Server] Forcing shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      console.error('[Server] Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      console.error('[Server] Unhandled Rejection:', reason);
    });
  } catch (error) {
    console.error(`[Server] Error during server startup (attempt ${retryCount + 1}):`, error);

    if (retryCount < 3) {
      const delay = Math.pow(2, retryCount) * 1000;
      setTimeout(() => startServer(retryCount + 1), delay);
    } else {
      console.error('[Server] Max retries reached, exiting...');
      process.exit(1);
    }
  }
}

startServer();
