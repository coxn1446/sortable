const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const AppleStrategy = require('passport-apple');
const bcrypt = require('bcrypt');
const authQueries = require('../queries/authQueries');

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
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            let user = await authQueries.findUserByGoogleId(profile.id);
            if (!user) {
              user = await authQueries.createGoogleUser({
                google_id: profile.id,
                email: profile.emails?.[0]?.value,
                username: profile.displayName || `user_${profile.id}`,
                profile_picture: profile.photos?.[0]?.value,
              });
            }
            return done(null, user);
          } catch (error) {
            return done(error);
          }
        }
      )
    );
  } else if (!isProduction) {
    console.warn('[passport] Google OAuth disabled (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable).');
  }

  if (process.env.APPLE_CLIENT_ID && process.env.APPLE_KEY) {
    passport.use(
      new AppleStrategy(
        {
          clientID: process.env.APPLE_CLIENT_ID,
          teamID: process.env.APPLE_TEAM_ID,
          keyID: process.env.APPLE_KEY_ID,
          key: process.env.APPLE_KEY,
          callbackURL: `${baseUrl}/api/auth/apple/callback`,
          scope: ['name', 'email'],
        },
        async (accessToken, refreshToken, idToken, profile, done) => {
          try {
            let user = await authQueries.findUserByAppleId(profile.id);
            if (!user) {
              user = await authQueries.createAppleUser({
                apple_id: profile.id,
                email: profile.email,
                username: profile.name?.firstName
                  ? `${profile.name.firstName}_${profile.id}`
                  : `user_${profile.id}`,
              });
            }
            return done(null, user);
          } catch (error) {
            return done(error);
          }
        }
      )
    );
  } else if (!isProduction) {
    console.warn('[passport] Apple Sign In disabled (set APPLE_CLIENT_ID and APPLE_KEY to enable).');
  }

  return passport;
};
