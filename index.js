const express = require('express');
const passport = require('passport'); //Used for authentication
const cookieSession = require('cookie-session'); //Allows for the storage of cookies, keeping users signed in
const app = express(); //Web framework
const PORT = process.env.PORT || 3000; //The port for the server to run on. If deployed, it will use that port.
require('dotenv').config(); //Creates environment variables
require('./passport-setup'); //Configures passport to authenticate with google and use mongodb

const userRouter = require('./routes/user.js');

app.use(express.urlencoded({ extended: false })); //Allows the req body to be easily read
app.use(express.json());
app.use(cookieSession({
    secret: process.env.COOKIE_SESSION_SECRET, 
    resave: false,
    saveUninitialized: true
}));

app.use(passport.initialize()); //Initialize and start passport
app.use(passport.session());

app.set('view engine', 'ejs'); //Allows us to render .ejs files

app.get('/', (req, res) => res.render('index.ejs'));
app.use('/user', userRouter); //When accessing a /user path, uses the routes from ./routes/user.js

app.get('/failed', (req, res) => res.send('You failed to log in!'));
app.get('/auth', passport.authenticate('google', { scope: ['profile', 'email'] })); //Brings up the google sign in page
app.get('/auth/callback', //Once a user signs in with google
    passport.authenticate('google', { failureRedirect: '/failed' }),
    (req, res) => res.redirect('/user'), //If successful sign in, redirect to /user
);

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
