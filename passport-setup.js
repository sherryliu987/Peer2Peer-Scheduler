const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/callback'
},
  (accessToken, refreshToken, profile, done) => {
    return done(null, profile); //TODO This function needs to use database, like below
    //User.findOrCreate({ googleId: profile.id }, (err, user) => return done(err, user));
  }
));
passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((user, done) => {
  done(null, user); //This might need to be user.id
});

