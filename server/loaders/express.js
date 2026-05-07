const cors = require('cors');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const pgSession = require('connect-pg-simple')(session);
const db = require('../db');

module.exports = async function (app) {
  const isProduction = process.env.NODE_ENV === 'production';

  const corsOptions = {
    origin: isProduction
      ? [
          process.env.DEFAULT_CLIENT_URL,
          'https://sortable.net',
          'https://www.sortable.net',
          'https://qa.sortable.net',
          'capacitor://localhost',
          'ionic://localhost',
        ].filter(Boolean)
      : [
          'http://localhost:3000',
          'https://localhost:3000',
          'capacitor://localhost',
          'ionic://localhost',
        ],
    credentials: true,
    optionsSuccessStatus: 200,
  };
  app.use(cors(corsOptions));

  app.use(compression());

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.set('trust proxy', 1);

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error(
      'SESSION_SECRET environment variable is required. Set it in your .env file or Secret Manager.'
    );
  }

  const sessionConfig = {
    store: new pgSession({
      pool: db.getPool(),
      tableName: 'session',
      createTableIfMissing: false,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
    },
    name: 'sortable.sid',
  };

  app.use(session(sessionConfig));

  app.use(passport.initialize());
  app.use(passport.session());

  const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 1000,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);

  return app;
};
