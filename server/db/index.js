const { Pool } = require('pg');
const { getDbSchema, isQaEnvironment } = require('../utils/dbSchema');

let pool;

function getDbConfig() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    const privateHost = process.env.DB_HOST || process.env.DB_PRIVATE_IP || '';
    const rawSocket =
      process.env.DB_INSTANCE_UNIX_SOCKET || process.env.INSTANCE_CONNECTION_NAME || '';
    const socketHost =
      rawSocket && rawSocket.startsWith('/cloudsql/')
        ? rawSocket
        : rawSocket
          ? `/cloudsql/${rawSocket}`
          : '';

    const usePrivateIp = Boolean(privateHost);
    return {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      host: privateHost || socketHost,
      port: usePrivateIp ? Number(process.env.DB_PORT) || 5432 : undefined,
      ssl: usePrivateIp ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };
  }

  return {
    user: process.env.DB_USER || 'sortable',
    password: process.env.DB_PASSWORD || 'sortable',
    database: process.env.DB_DATABASE || 'sortable',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
}

async function initialize() {
  const config = getDbConfig();
  pool = new Pool(config);

  if (process.env.DB_SKIP_HEALTH_CHECK === '1') {
    console.warn('[db] DB_SKIP_HEALTH_CHECK=1 set; skipping startup health check.');
    return pool;
  }

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const client = await pool.connect();
      try {
        if (isQaEnvironment()) {
          await client.query(`SET search_path TO ${getDbSchema()}, public`);
        }
        await client.query('SELECT NOW()');
      } finally {
        client.release();
      }
      console.log(
        `[db] Connected to PostgreSQL at ${config.host}:${config.port || 'socket'} (schema=${getDbSchema()})`
      );
      return pool;
    } catch (error) {
      lastError = error;
      console.warn(`[db] Connection attempt ${attempt} failed: ${error.message}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw lastError;
}

function getPool() {
  if (!pool) {
    throw new Error('Database not initialized. Call initialize() first.');
  }

  if (!isQaEnvironment()) {
    return pool;
  }

  // QA: return a thin wrapper that sets search_path on every connection /
  // every ad-hoc query so connect-pg-simple finds the qa.session table.
  const schema = getDbSchema();
  return {
    connect: async () => {
      const client = await pool.connect();
      await client.query(`SET search_path TO ${schema}, public`);
      return client;
    },
    query: async (text, params) => {
      const client = await pool.connect();
      try {
        await client.query(`SET search_path TO ${schema}, public`);
        return await client.query(text, params);
      } finally {
        client.release();
      }
    },
    end: () => pool.end(),
    on: pool.on.bind(pool),
    get totalCount() { return pool.totalCount; },
    get idleCount() { return pool.idleCount; },
    get waitingCount() { return pool.waitingCount; },
  };
}

async function getClient() {
  if (!pool) {
    throw new Error('Database not initialized. Call initialize() first.');
  }
  const client = await pool.connect();
  if (isQaEnvironment()) {
    await client.query(`SET search_path TO ${getDbSchema()}, public`);
  }
  return client;
}

async function query(text, params) {
  if (!pool) {
    throw new Error('Database not initialized. Call initialize() first.');
  }

  if (isQaEnvironment()) {
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO ${getDbSchema()}, public`);
      return await client.query(text, params);
    } finally {
      client.release();
    }
  }

  return pool.query(text, params);
}

async function close() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

module.exports = { initialize, getPool, getClient, query, close, getDbSchema };
