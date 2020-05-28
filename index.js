const express = require('express');
const passport = require('passport');
const bodyParser = require('body-parser');
const cookieSession = require('cookie-session');
const app = express();
const PORT = process.env.PORT || 3000;

require('dotenv').config();
require('./passport-setup');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieSession({
  secret: 'This is the session secret',
  resave: false,
  saveUninitialized: true
}));

const isLoggedIn = (req, res, next) => {
  if (req.user) {
    next();
  } else {
    res.redirect('/');
  }
}
app.use(passport.initialize());
app.use(passport.session());

app.get('/', (req, res) => res.send('This is the root dir'));
app.get('/failed', (req, res) => res.send('You failed to log in!'));
app.get('/home', isLoggedIn, (req, res) => res.send(`<h1>Welcome ${req.user.displayName}`));
app.get('/auth', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/callback',
  passport.authenticate('google', { failureRedirect: '/failed' }),
  (req, res) => res.redirect('/home'),
);
app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
