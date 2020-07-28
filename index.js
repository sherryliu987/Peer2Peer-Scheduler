const express = require('express');
const passport = require('passport'); //Used for authentication
const cookieSession = require('cookie-session'); //Allows for the storage of cookies, keeping users signed in
const MongoClient = require('mongodb').MongoClient;
const app = express(); //Web framework
const PORT = process.env.PORT || 3000; //The port for the server to run on. If deployed, it will use that port.
require('dotenv').config(); //Creates environment variables
require('./passport-setup'); //Configures passport to authenticate with google and use mongodb

const studentRouter = require('./routes/student.js');
const mentorRouter = require('./routes/mentor.js');
const peerLeaderRouter = require('./routes/peerLeader.js');
const signupRouter = require('./routes/signup.js');

const db = require('./db.js');
const { check, validationResult } = require('express-validator');
const allSubjects = require('./subjects.json');

app.use(express.urlencoded({ extended: false })); //Allows the req body to be easily read
app.use(express.json());
app.use(cookieSession({
    secret: process.env.COOKIE_SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}));

app.use(passport.initialize()); //Initialize and start passport
app.use(passport.session());
app.use(express.static('static'));

app.set('view engine', 'ejs'); //Allows us to render .ejs files
app.get('/', (req, res) => {
    res.render('index.ejs', {
        signedIn: (req.user != null),
        ...req.user
    });
});
app.use('/student', studentRouter); //When accessing a /student path, uses the routes from ./routes/student.js
app.use('/mentor', mentorRouter); //When accessing a /mentor path, uses the routes from ./routes/mentor.js
app.use('/peerleader', peerLeaderRouter); //When accessing a /peerleader path, uses the routes from ./routes/peerLeader.js
app.use('/signup', signupRouter); //When accessing a /signup path, use the routes from ./routes/signup.js

app.get('/failed', (req, res) => res.send('You failed to log in!'));
app.get('/auth', passport.authenticate('google', { scope: ['profile', 'email'] })); //Brings up the google sign in page
app.get('/auth/callback', //Once a student signs in with google
    passport.authenticate('google', { failureRedirect: '/failed' }),
    (req, res) => {
        if (req.user.isPeerLeader)
            res.redirect('/peerleader');
        else if (req.user.isMentor)
            res.redirect('/mentor');
        else if (req.user.isStudent)
            res.redirect('/student');
        else
            res.redirect('/signup');
    }
);
app.get('/account', (req, res) => {
    if (!req.user) res.redirect('/');
    else {
        let values = { ...req.user };
        if (req.user.isMentor || req.user.isPeerLeader)
            for (const avail of req.user.availability) values[avail] = true;
        if (req.user.isMentor)
            for (const subject of req.user.subjects) values[subject] = true;
        res.render('account', {
            signedIn: (req.user != null),
            ...req.user,
            allSubjects,
            values,
            errors: []
        });
    }
});
app.post('/account', [
    check('firstName').trim().notEmpty().escape(),
    check('lastName').trim().notEmpty().escape(),
    check('email').isEmail().normalizeEmail().escape(),
    check('school').trim().notEmpty().escape(),
    check('phone').isMobilePhone().escape(),
    check('state').isLength(2).escape()
], async (req, res) => {
    if (!req.user) res.send('You are not signed in.');
    else {
        let errors = validationResult(req).array().map(e => e.param);

        let chosenSubjects = [];
        let chosenTimes = [];
        if (req.user.isMentor || req.user.isPeerLeader) {
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            const times = ['Morning', 'Afternoon', 'Evening'];
            for (const day of days) {
                for (const time of times) {
                    if (req.body[day + ' ' + time] == 'on') chosenTimes.push(day + ' ' + time);
                }
            }
            if (chosenTimes.length == 0) errors.push('times');
        }
        if (req.user.isMentor) {
            const subjects = [];
            for (const heading in allSubjects) subjects.push(...allSubjects[heading]);
            for (const subject of subjects) {
                if (req.body[subject] == 'on') chosenSubjects.push(subject);
            }
            if (chosenSubjects.length == 0) errors.push('subjects');
        }

        if (errors.length > 0) {
            res.render('account', {
                signedIn: (req.user != null),
                ...req.user,
                allSubjects,
                values: req.body,
                errors
            });
            return;
        }
        let data = {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email
        };
        if (req.user.isStudent || req.user.isMentor || req.user.isPeerLeader) {
            data.grade = req.body.grade;
            data.state = req.body.state;
            data.school = req.body.school;
            data.phone = req.body.phone;
        }
        if (req.user.isMentor || req.user.isPeerLeader) {
            data.availability = chosenTimes;
        }
        if (req.user.isMentor) {
            data.subjects = chosenSubjects;
        }
        await db.updateUser(req.user.googleId, data);
        res.redirect('/');
    }
});
app.get('/logout', (req, res) => { //When a user accesses /logout, sign them out and redirect back to the home page
    req.logout();
    res.redirect('/');
});

MongoClient.connect(process.env.MONGODB_URI, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
        console.error('Could not connect to db.', err);
        return;
    }
    console.log('DB Connected');
    global.globalDB = client.db(process.env.MONGODB_NAME); //This will be available later in the global variable globalDB
    app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
});

