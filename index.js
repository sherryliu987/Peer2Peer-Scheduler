const express = require('express');
const passport = require('passport'); //Used for authentication
const cookieSession = require('cookie-session'); //Allows for the storage of cookies, keeping users signed in
const app = express(); //Web framework
const PORT = process.env.PORT || 3000; //The port for the server to run on. If deployed, it will use that port.
require('dotenv').config(); //Creates environment variables
require('./passport-setup'); //Configures passport to authenticate with google and use mongodb

const studentRouter = require('./routes/student.js');
const mentorRouter = require('./routes/mentor.js');
const signupRouter = require('./routes/signup.js');

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
app.get('/', (req, res) => {
    let data = {
        signedIn: (req.user != null)
    }
    if (req.user) {
        data.isStudent = req.user.isStudent;
        data.isMentor = req.user.isMentor;
        data.appliedMentor = req.user.appliedMentor;
    }
    res.render('index.ejs', data);
});
app.use('/student', studentRouter); //When accessing a /student path, uses the routes from ./routes/student.js
app.use('/mentor', mentorRouter); //When accessing a /mentor path, uses the routes from ./routes/mentor.js
app.use('/signup', signupRouter); //When accessing a /signup path, use the routes from ./routes/signup.js

app.get('/failed', (req, res) => res.send('You failed to log in!'));
app.get('/auth', passport.authenticate('google', { scope: ['profile', 'email'] })); //Brings up the google sign in page
app.get('/auth/callback', //Once a student signs in with google
    passport.authenticate('google', { failureRedirect: '/failed' }),
    (req, res) => res.redirect('/signup'), //If successful sign in, redirect to /signup
);
app.get('/logout', (req, res) => { //When a user accesses /logout, sign them out and redirect back to the home page
    req.logout();
    res.redirect('/');
});

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
