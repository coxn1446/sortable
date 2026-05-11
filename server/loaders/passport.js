const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const AppleStrategy = require('passport-apple');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authQueries = require('../queries/authQueries');
const authService = require('../services/authService');

function applePrivateKeyReady() {
  const k = process.env.APPLE_KEY;
  return typeof k === 'string' && k.trim().length > 0;
}

/**
 * passport-oauth2 passes an empty `profile` by default; Apple’s stable id + email live in the id_token JWT.
 * Name is only in `req.appleProfile` the first time the user consents (form POST `user` field).
 */
const MAX_USERNAME_LEN = 64;

function truncateUsername(username) {
  const s = String(username);
  return s.length <= MAX_USERNAME_LEN ? s : s.slice(0, MAX_USERNAME_LEN);
}

/**
 * Google profile.displayName often matches an existing local username while email differs
 * (or is unset), causing idx_users_username_lower violations. Prefer display name when
 * free; otherwise a stable id-based username.
 */
async function pickGoogleOAuthUsername(profile) {
  const idStr = String(profile.id);
  const fallback = truncateUsername(`user_${idStr}`);
  const raw = profile.displayName && String(profile.displayName).trim();
  if (!raw) return fallback;

  const takenByName = await authQueries.findUserByUsername(raw);
  if (!takenByName) return truncateUsername(raw);

  const suffixed = truncateUsername(`${raw}_${idStr.slice(-12)}`);
  const takenSuffixed = await authQueries.findUserByUsername(suffixed);
  if (!takenSuffixed) return suffixed;

  return fallback;
}

function buildAppleUserFromTokens(req, idToken, oauthProfile) {
  let appleId = null;
  let email = null;
  if (typeof idToken === 'string' && idToken.length > 0) {
    const payload = jwt.decode(idToken);
    if (payload && typeof payload.sub === 'string' && payload.sub.length > 0) {
      appleId = payload.sub;
    }
    if (payload && typeof payload.email === 'string' && payload.email.trim()) {
      email = payload.email.trim();
    }
  }
  if (!appleId && oauthProfile && oauthProfile.id != null) {
    appleId = String(oauthProfile.id);
  }
  if (email == null && oauthProfile && oauthProfile.email != null) {
    const e = oauthProfile.email;
    email = e == null ? null : String(e).trim() || null;
  }
  let firstName = null;
  const fromForm = req.appleProfile && req.appleProfile.name;
  if (fromForm && fromForm.firstName) {
    firstName = String(fromForm.firstName).trim() || null;
  }
  const username = firstName ? `${firstName}_${appleId}` : `user_${appleId}`;
  return { appleId, email, username };
}

module.exports = async function () {
  const isProduction = process.env.NODE_ENV === 'production';
  const baseUrl = process.env.DEFAULT_CLIENT_URL || 'http://localhost:3000';

  passport.serializeUser((user, done) => {
    done(null, user.user_id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await authQueries.findUserById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  passport.use(
    new LocalStrategy(
      { usernameField: 'username', passwordField: 'password' },
      async (username, password, done) => {
        try {
          const user = await authQueries.findUserByUsername(username);
          if (!user) {
            return done(null, false, { message: 'Username not found' });
          }
          if (!user.password) {
            return done(null, false, { message: 'Please use OAuth to log in' });
          }
          const isValid = await bcrypt.compare(password, user.password);
          if (!isValid) {
            return done(null, false, { message: 'Wrong password' });
          }
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: `${baseUrl}/api/auth/google/callback`,
          passReqToCallback: true,
        },
        async (req, accessToken, refreshToken, profile, done) => {
          try {
            delete req.session.googleOAuthFailureReason;
            const gEmail = profile.emails?.[0]?.value?.trim() || null;

            let linkIntent = authService.getValidOAuthProviderLinkIntent(req.session, 'google');
            if (linkIntent && req.user && Number(req.user.user_id) !== Number(linkIntent.userId)) {
              authService.clearOAuthProviderLinkIntent(req);
              linkIntent = null;
            }

            if (linkIntent) {
              const account = await authQueries.findUserById(linkIntent.userId);
              if (!account) {
                authService.clearOAuthProviderLinkIntent(req);
                return done(null, false);
              }
              const other = await authQueries.findUserByGoogleId(profile.id);
              if (other && other.user_id !== account.user_id) {
                req.session.googleOAuthFailureReason = 'profile_link_google_in_use';
                authService.clearOAuthProviderLinkIntent(req);
                return done(null, false);
              }
              if (account.google_id && account.google_id !== profile.id) {
                req.session.googleOAuthFailureReason = 'profile_link_google_conflict';
                authService.clearOAuthProviderLinkIntent(req);
                return done(null, false);
              }
              if (account.google_id === profile.id) {
                authService.clearOAuthProviderLinkIntent(req);
                let u = await authQueries.findUserById(account.user_id);
                if (gEmail && u) {
                  const refreshed = await authQueries.syncGoogleOAuthEmail(u.user_id, gEmail);
                  if (refreshed) u = refreshed;
                }
                return done(null, u);
              }
              const updated = await authQueries.attachGoogleToUser({
                userId: account.user_id,
                google_id: profile.id,
                profile_picture: profile.photos?.[0]?.value || null,
                google_email: gEmail,
              });
              authService.clearOAuthProviderLinkIntent(req);
              if (!updated) {
                req.session.googleOAuthFailureReason = 'profile_link_google_failed';
                return done(null, false);
              }
              return done(null, updated);
            }

            let user = await authQueries.findUserByGoogleId(profile.id);
            if (user) {
              if (gEmail) {
                const refreshed = await authQueries.syncGoogleOAuthEmail(user.user_id, gEmail);
                if (refreshed) user = refreshed;
              }
              return done(null, user);
            }

            const email = gEmail;
            if (!email) {
              req.session.googleOAuthFailureReason = 'google_needs_email';
              return done(null, false);
            }

            const existing = await authQueries.findUserByEmail(email);
            if (!existing) {
              const username = await pickGoogleOAuthUsername(profile);
              user = await authQueries.createGoogleUser({
                google_id: profile.id,
                email,
                username,
                profile_picture: profile.photos?.[0]?.value || null,
              });
              return done(null, user);
            }

            if (existing.google_id && existing.google_id !== profile.id) {
              req.session.googleOAuthFailureReason = 'google_email_conflict';
              return done(null, false);
            }

            if (!existing.password) {
              req.session.googleOAuthFailureReason = 'google_oauth_only';
              return done(null, false);
            }

            if (existing.google_id === profile.id) {
              let u = (await authQueries.findUserByGoogleId(profile.id)) || existing;
              if (gEmail) {
                const refreshed = await authQueries.syncGoogleOAuthEmail(u.user_id, gEmail);
                if (refreshed) u = refreshed;
              }
              return done(null, u);
            }

            authService.setPendingGoogleLinkSession(req, {
              google_id: profile.id,
              email,
              username: existing.username,
              profile_picture: profile.photos?.[0]?.value || null,
            });
            return done(null, false);
          } catch (error) {
            return done(error);
          }
        }
      )
    );
  } else if (isProduction) {
    console.warn(
      '[passport] Google OAuth is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET). GET /api/auth/google will fail until they are set.'
    );
  } else {
    console.warn('[passport] Google OAuth disabled (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable).');
  }

  if (process.env.APPLE_CLIENT_ID && applePrivateKeyReady()) {
    const appleClientId = String(process.env.APPLE_CLIENT_ID).trim();
    const appleTeamId = String(process.env.APPLE_TEAM_ID || '').trim();
    const appleKeyId = String(process.env.APPLE_KEY_ID || '').trim();
    passport.use(
      new AppleStrategy(
        {
          clientID: appleClientId,
          teamID: appleTeamId,
          keyID: appleKeyId,
          privateKeyString: process.env.APPLE_KEY,
          callbackURL: `${baseUrl}/api/auth/apple/callback`,
          scope: ['name', 'email'],
        },
        async (req, accessToken, refreshToken, idToken, profile, done) => {
          try {
            delete req.session.appleOAuthFailureReason;

            const apple = buildAppleUserFromTokens(req, idToken, profile);
            if (!apple.appleId) {
              return done(
                new Error('Apple Sign In did not return a user id (id_token sub). Check Services ID and token response.')
              );
            }

            let linkIntent = authService.getValidOAuthProviderLinkIntent(req.session, 'apple');
            if (linkIntent && req.user && Number(req.user.user_id) !== Number(linkIntent.userId)) {
              authService.clearOAuthProviderLinkIntent(req);
              linkIntent = null;
            }

            if (linkIntent) {
              const account = await authQueries.findUserById(linkIntent.userId);
              if (!account) {
                authService.clearOAuthProviderLinkIntent(req);
                return done(null, false);
              }
              const other = await authQueries.findUserByAppleId(apple.appleId);
              if (other && other.user_id !== account.user_id) {
                req.session.appleOAuthFailureReason = 'profile_link_apple_in_use';
                authService.clearOAuthProviderLinkIntent(req);
                return done(null, false);
              }
              if (
                account.apple_id &&
                String(account.apple_id) !== String(apple.appleId)
              ) {
                req.session.appleOAuthFailureReason = 'profile_link_apple_conflict';
                authService.clearOAuthProviderLinkIntent(req);
                return done(null, false);
              }
              if (
                account.apple_id &&
                String(account.apple_id) === String(apple.appleId)
              ) {
                authService.clearOAuthProviderLinkIntent(req);
                let u = await authQueries.findUserById(account.user_id);
                if (apple.email && u) {
                  const refreshed = await authQueries.syncAppleOAuthEmail(u.user_id, apple.email);
                  if (refreshed) u = refreshed;
                }
                return done(null, u);
              }
              const updated = await authQueries.attachAppleToUser({
                userId: account.user_id,
                apple_id: apple.appleId,
                apple_email: apple.email,
              });
              authService.clearOAuthProviderLinkIntent(req);
              if (!updated) {
                req.session.appleOAuthFailureReason = 'profile_link_apple_failed';
                return done(null, false);
              }
              return done(null, updated);
            }

            let user = await authQueries.findUserByAppleId(apple.appleId);
            if (!user) {
              user = await authQueries.createAppleUser({
                apple_id: apple.appleId,
                email: apple.email,
                username: apple.username.slice(0, 64),
              });
            } else if (apple.email) {
              const refreshed = await authQueries.syncAppleOAuthEmail(user.user_id, apple.email);
              if (refreshed) user = refreshed;
            }
            return done(null, user);
          } catch (error) {
            return done(error);
          }
        }
      )
    );
  } else if (isProduction) {
    console.warn(
      '[passport] Apple Sign In is not configured (APPLE_CLIENT_ID / APPLE_KEY). /api/auth/apple will fail until they are set.'
    );
  } else {
    console.warn('[passport] Apple Sign In disabled (set APPLE_CLIENT_ID and APPLE_KEY to enable).');
  }

  return passport;
};
